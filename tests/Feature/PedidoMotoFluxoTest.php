<?php

namespace Tests\Feature;

use App\Models\Moto;
use App\Models\Pedido;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * O ciclo de um pedido de MOTO: criar, aprovar, separar, cancelar e receber.
 *
 * Nasceu como teste de caracterização (v3.5): fixa o comportamento que o
 * PedidoController tinha antes de a regra ser movida para Actions, para que a
 * mudança de lugar não mude o que o sistema faz. O fluxo de peças tem as
 * próprias suítes (PecaFluxoCompletoTest, PecaTravasDeFluxoTest).
 */
class PedidoMotoFluxoTest extends TestCase
{
    use DatabaseTransactions;

    private User $gestor;
    private User $cd;
    private User $loja;
    private User $lojaOrigem;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Http::fake();
        Storage::fake('public');

        $this->gestor     = $this->usuario('gestor', ['valida_motos' => true]);
        $this->cd         = $this->usuario('cd', ['filial' => 'CD Matriz']);
        $this->loja       = $this->usuario('loja', ['filial' => 'Loja Fluxo Destino']);
        $this->lojaOrigem = $this->usuario('loja', ['filial' => 'Loja Fluxo Origem', 'is_interior' => false]);
    }

    // ------------------------------------------------------------------
    // CRIAR
    // ------------------------------------------------------------------

    /** Reposição genérica: a loja pede modelo, cor e quantidade; o CD atribui o chassi depois. */
    public function test_loja_cria_reposicao_sem_chassi()
    {
        $this->actingAs($this->loja)
            ->post(route('pedidos.store'), [
                'modo'  => 'cd',
                'itens' => [$this->item(['modelo' => 'jet 50', 'cor' => 'preta', 'quantidade' => 3])],
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('pedidos.index'));

        $pedido = Pedido::where('user_id', $this->loja->id)->latest('id')->firstOrFail();

        $this->assertSame('em_analise', $pedido->status);
        $this->assertNull($pedido->origem_user_id);
        $this->assertSame(0, $pedido->motos()->count());
        $this->assertTrue($pedido->logs()->where('titulo', 'Criado')->exists());

        $cota = $pedido->itensPedido()->sole();
        $this->assertSame('JET 50', $cota->modelo);
        $this->assertSame('PRETA', $cota->cor);
        $this->assertSame(3, (int) $cota->quantidade);
        $this->assertSame(0, (int) $cota->qtd_atribuida);
        $this->assertFalse((bool) $cota->exige_chassi);
    }

    /** Transferência: a moto já existe na loja de origem e fica presa ao pedido. */
    public function test_loja_cria_transferencia_com_chassi()
    {
        $moto = $this->moto('estoque_loja', $this->lojaOrigem);

        $this->actingAs($this->loja)
            ->post(route('pedidos.store'), [
                'modo'      => 'transferencia',
                'origem_id' => $this->lojaOrigem->id,
                'itens'     => [$this->item(['chassi' => strtolower($moto->chassi)])],
            ])
            ->assertSessionHasNoErrors();

        $pedido = Pedido::where('user_id', $this->loja->id)->latest('id')->firstOrFail();

        $this->assertSame($this->lojaOrigem->id, $pedido->origem_user_id);
        $this->assertTrue($pedido->motos()->whereKey($moto->id)->exists());
        $this->assertSame('solicitado', $moto->fresh()->status);

        $cota = $pedido->itensPedido()->sole();
        $this->assertSame(1, (int) $cota->qtd_atribuida);
        $this->assertTrue((bool) $cota->exige_chassi);
    }

    public function test_transferencia_sem_chassi_e_recusada()
    {
        $this->actingAs($this->loja)
            ->post(route('pedidos.store'), [
                'modo'      => 'transferencia',
                'origem_id' => $this->lojaOrigem->id,
                'itens'     => [$this->item()],
            ])
            ->assertSessionHasErrors('itens');

        $this->assertFalse(Pedido::where('user_id', $this->loja->id)->exists());
    }

    /** Trava da diretoria: carga que já chegou precisa ser finalizada antes de pedir mais. */
    public function test_loja_com_carga_inteira_em_transito_nao_abre_pedido_novo()
    {
        $emTransito = Pedido::create(['user_id' => $this->loja->id, 'status' => 'em_transito']);
        $emTransito->motos()->attach($this->moto('em_transito')->id, ['destino' => 'Loja Fluxo Destino']);

        $this->actingAs($this->loja)
            ->post(route('pedidos.store'), ['modo' => 'cd', 'itens' => [$this->item()]])
            ->assertSessionHasErrors('itens');

        $this->assertSame(1, Pedido::where('user_id', $this->loja->id)->count());
    }

    // ------------------------------------------------------------------
    // APROVAR E SEPARAR
    // ------------------------------------------------------------------

    public function test_so_a_diretoria_aprova_e_so_uma_vez()
    {
        $pedido = Pedido::create(['user_id' => $this->loja->id, 'status' => 'em_analise']);

        $this->actingAs($this->loja)
            ->post(route('pedidos.aprovar', $pedido->id))
            ->assertForbidden();

        $this->actingAs($this->gestor)
            ->post(route('pedidos.aprovar', $pedido->id))
            ->assertSessionHas('success');

        $this->assertSame('solicitado', $pedido->fresh()->status);
        $this->assertTrue($pedido->logs()->where('titulo', 'Aprovado')->exists());

        $this->actingAs($this->gestor)
            ->post(route('pedidos.aprovar', $pedido->id))
            ->assertSessionHas('error');
    }

    public function test_reposicao_e_separada_pelo_cd_e_nao_pela_loja()
    {
        $pedido = Pedido::create(['user_id' => $this->loja->id, 'status' => 'solicitado']);
        $moto = $this->moto('solicitado');
        $pedido->motos()->attach($moto->id, ['destino' => 'Loja Fluxo Destino']);

        $this->actingAs($this->loja)
            ->post(route('pedidos.separar', $pedido->id))
            ->assertSessionHasErrors('erro');

        $this->assertSame('solicitado', $pedido->fresh()->status);

        $this->actingAs($this->cd)
            ->post(route('pedidos.separar', $pedido->id))
            ->assertSessionHasNoErrors();

        $this->assertSame('separado', $pedido->fresh()->status);
        $this->assertSame('separado', $moto->fresh()->status);
    }

    public function test_transferencia_da_capital_e_separada_pela_origem_e_vai_para_coleta()
    {
        $pedido = Pedido::create([
            'user_id'        => $this->loja->id,
            'origem_user_id' => $this->lojaOrigem->id,
            'status'         => 'solicitado',
        ]);
        $pedido->motos()->attach($this->moto('solicitado', $this->lojaOrigem)->id, ['destino' => 'Loja Fluxo Destino']);

        $this->actingAs($this->loja)
            ->post(route('pedidos.separar', $pedido->id))
            ->assertSessionHasErrors('erro');

        $this->actingAs($this->lojaOrigem)
            ->post(route('pedidos.separar', $pedido->id))
            ->assertSessionHasNoErrors();

        $this->assertSame('aguardando_coleta', $pedido->fresh()->status);
    }

    // ------------------------------------------------------------------
    // CANCELAR E REJEITAR
    // ------------------------------------------------------------------

    public function test_loja_cancela_o_proprio_pedido_em_analise_e_a_moto_volta_ao_cd()
    {
        $pedido = Pedido::create(['user_id' => $this->loja->id, 'status' => 'em_analise']);
        $moto = $this->moto('solicitado');
        $pedido->motos()->attach($moto->id, ['destino' => 'Loja Fluxo Destino']);

        $this->actingAs($this->loja)
            ->post(route('pedidos.cancelar', $pedido->id))
            ->assertRedirect(route('dashboard'));

        $cancelado = Pedido::withTrashed()->findOrFail($pedido->id);
        $this->assertTrue($cancelado->trashed());
        $this->assertSame('cancelado', $cancelado->status);
        $this->assertSame('estoque_fabrica', $moto->fresh()->status);
        $this->assertSame(0, DB::table('pedido_moto')->where('pedido_id', $pedido->id)->count());
    }

    public function test_loja_de_fora_nao_cancela_e_loja_dona_nao_cancela_depois_da_separacao()
    {
        $pedido = Pedido::create(['user_id' => $this->loja->id, 'status' => 'separado']);

        $this->actingAs($this->lojaOrigem)
            ->post(route('pedidos.cancelar', $pedido->id))
            ->assertSessionHas('error');

        $this->actingAs($this->loja)
            ->post(route('pedidos.cancelar', $pedido->id))
            ->assertSessionHas('error');

        $this->assertFalse($pedido->fresh()->trashed());
        $this->assertSame('separado', $pedido->fresh()->status);
    }

    public function test_gestor_rejeita_com_motivo()
    {
        $pedido = Pedido::create(['user_id' => $this->loja->id, 'status' => 'em_analise']);

        $this->actingAs($this->gestor)
            ->post(route('pedidos.rejeitar', $pedido->id), ['motivo' => 'Sem giro nesta loja'])
            ->assertRedirect(route('dashboard'));

        $rejeitado = Pedido::withTrashed()->findOrFail($pedido->id);
        $this->assertSame('rejeitado', $rejeitado->status);
        $this->assertSame('Sem giro nesta loja', $rejeitado->motivo_rejeicao);
    }

    // ------------------------------------------------------------------
    // RECEBER
    // ------------------------------------------------------------------

    public function test_recebimento_e_bloqueado_enquanto_ha_moto_no_cd()
    {
        $pedido = Pedido::create(['user_id' => $this->loja->id, 'status' => 'em_transito']);
        $pedido->motos()->attach($this->moto('em_transito')->id, ['destino' => 'Loja Fluxo Destino']);
        $pedido->motos()->attach($this->moto('separado')->id, ['destino' => 'Loja Fluxo Destino']);

        $this->actingAs($this->loja)
            ->post(route('pedidos.finalizar', $pedido->id), [
                'arquivo_romaneio' => UploadedFile::fake()->image('canhoto.jpg'),
            ])
            ->assertSessionHasErrors('arquivo_romaneio');

        $this->assertSame('em_transito', $pedido->fresh()->status);
    }

    // ------------------------------------------------------------------
    // DASHBOARD
    // ------------------------------------------------------------------

    public function test_dashboard_mostra_os_numeros_de_cada_perfil_e_manda_o_gestor_para_o_painel_dele()
    {
        Pedido::create(['user_id' => $this->loja->id, 'status' => 'em_transito']);

        $this->actingAs($this->loja)
            ->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $pagina) => $pagina
                ->component('Dashboard')
                ->where('perfil', 'loja')
                ->where('stats.meus_pedidos', 1)
                ->where('stats.receber', 1)
                ->has('notices')
            );

        $this->actingAs($this->cd)
            ->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $pagina) => $pagina
                ->where('perfil', 'cd')
                ->has('stats.no_patio')
            );

        $this->actingAs($this->gestor)
            ->get(route('dashboard'))
            ->assertRedirect(route('gestor.index'));
    }

    public function test_gestor_aprova_com_corte_parcial()
    {
        $pedido = Pedido::create(['user_id' => $this->loja->id, 'status' => 'em_analise']);
        $moto1 = $this->moto('solicitado');
        $moto2 = $this->moto('solicitado');
        $pedido->motos()->attach([$moto1->id => ['destino' => 'Loja Fluxo'], $moto2->id => ['destino' => 'Loja Fluxo']]);

        $this->actingAs($this->gestor)
            ->post(route('gestor.aprovar', $pedido->id), [
                'rejeitadas' => [$moto1->id],
                'motivos'    => [$moto1->id => 'Sem estoque'],
                'justificativa' => 'Aprovado parcialmente',
            ])
            ->assertRedirect(route('gestor.index'))
            ->assertSessionHas('success');

        $pedidoAtualizado = $pedido->fresh();
        $this->assertSame('solicitado', $pedidoAtualizado->status);
        $this->assertCount(1, $pedidoAtualizado->motos);
        $this->assertSame($moto2->id, $pedidoAtualizado->motos->first()->id);
        $this->assertTrue($pedidoAtualizado->logs()->where('titulo', 'Auditoria Comercial (Gestor)')->exists());
    }

    /**
     * Regra do corte, confirmada com a operação: moto sem nenhum outro pedido
     * tem o cadastro apagado; moto com histórico em outro pedido volta ao CD.
     */
    public function test_corte_apaga_moto_sem_outro_pedido_e_devolve_ao_cd_a_que_tem_historico()
    {
        $pedido = Pedido::create(['user_id' => $this->loja->id, 'status' => 'em_analise']);
        $semHistorico = $this->moto('solicitado');
        $comHistorico = $this->moto('solicitado');
        $mantida = $this->moto('solicitado');
        $pedido->motos()->attach([
            $semHistorico->id => ['destino' => 'Loja Fluxo Destino'],
            $comHistorico->id => ['destino' => 'Loja Fluxo Destino'],
            $mantida->id      => ['destino' => 'Loja Fluxo Destino'],
        ]);

        $pedidoAntigo = Pedido::create(['user_id' => $this->lojaOrigem->id, 'status' => 'concluido']);
        $pedidoAntigo->motos()->attach($comHistorico->id, ['destino' => 'Loja Fluxo Origem']);

        $this->actingAs($this->gestor)
            ->post(route('gestor.aprovar', $pedido->id), [
                'rejeitadas' => [$semHistorico->id, $comHistorico->id],
                'motivos'    => [$semHistorico->id => 'Sem giro', $comHistorico->id => 'Sem giro'],
            ])
            ->assertSessionHas('success');

        $this->assertNull(Moto::find($semHistorico->id));

        $devolvida = $comHistorico->fresh();
        $this->assertSame('disponivel', $devolvida->status);
        $this->assertSame('Fábrica/CD', $devolvida->localizacao_atual);
        $this->assertTrue($pedidoAntigo->motos()->whereKey($comHistorico->id)->exists());

        $this->assertSame([$mantida->id], $pedido->motos()->pluck('motos.id')->all());
        $this->assertSame('solicitado', $pedido->fresh()->status);
    }

    public function test_gestor_aprova_com_corte_total_cancela_pedido()
    {
        $pedido = Pedido::create(['user_id' => $this->loja->id, 'status' => 'em_analise']);
        $moto1 = $this->moto('solicitado');
        $pedido->motos()->attach([$moto1->id => ['destino' => 'Loja Fluxo']]);

        $this->actingAs($this->gestor)
            ->post(route('gestor.aprovar', $pedido->id), [
                'rejeitadas' => [$moto1->id],
                'motivos'    => [$moto1->id => 'Sem estoque'],
            ])
            ->assertRedirect(route('gestor.index'))
            ->assertSessionHas('warning');

        $cancelado = Pedido::withTrashed()->findOrFail($pedido->id);
        $this->assertTrue($cancelado->trashed());
        $this->assertSame('cancelado', $cancelado->status);
        $this->assertNotEmpty($cancelado->motivo_rejeicao);
        $this->assertTrue($cancelado->logs()->where('titulo', 'Auditoria Comercial (Gestor)')->exists());
    }

    /** O corte só alcança as motos do próprio pedido. */
    public function test_corte_do_gestor_nao_alcanca_moto_de_outro_pedido()
    {
        $pedido = Pedido::create(['user_id' => $this->loja->id, 'status' => 'em_analise']);
        $pedido->motos()->attach($this->moto('solicitado')->id, ['destino' => 'Loja Fluxo Destino']);

        $outroPedido = Pedido::create(['user_id' => $this->lojaOrigem->id, 'status' => 'separado']);
        $motoAlheia = $this->moto('separado');
        $outroPedido->motos()->attach($motoAlheia->id, ['destino' => 'Loja Fluxo Origem']);

        $this->actingAs($this->gestor)
            ->post(route('gestor.aprovar', $pedido->id), [
                'rejeitadas' => [$motoAlheia->id],
                'motivos'    => [$motoAlheia->id => 'Id de outro pedido'],
            ])
            ->assertSessionHas('success');

        $this->assertSame('separado', $motoAlheia->fresh()->status);
        $this->assertTrue($outroPedido->motos()->whereKey($motoAlheia->id)->exists());
        $this->assertSame('solicitado', $pedido->fresh()->status);
        $this->assertSame(1, $pedido->motos()->count());
    }

    public function test_gestor_rejeita_pelo_painel_e_a_moto_volta_ao_cd()
    {
        $pedido = Pedido::create(['user_id' => $this->loja->id, 'status' => 'em_analise']);
        $moto = $this->moto('solicitado');
        $pedido->motos()->attach($moto->id, ['destino' => 'Loja Fluxo Destino']);

        $this->actingAs($this->gestor)
            ->post(route('gestor.rejeitar', $pedido->id), ['justificativa' => 'Loja com estoque alto'])
            ->assertRedirect(route('gestor.index'))
            ->assertSessionHas('warning');

        $rejeitado = Pedido::withTrashed()->findOrFail($pedido->id);
        $this->assertTrue($rejeitado->trashed());
        $this->assertSame('rejeitado', $rejeitado->status);
        $this->assertSame('Loja com estoque alto', $rejeitado->motivo_rejeicao);
        $this->assertSame('estoque_fabrica', $moto->fresh()->status);
    }

    /** O painel só rejeita o que ainda está em análise: pedido já liberado não volta. */
    public function test_gestor_nao_rejeita_pedido_que_ja_saiu_da_analise()
    {
        $pedido = Pedido::create(['user_id' => $this->loja->id, 'status' => 'separado']);
        $moto = $this->moto('separado');
        $pedido->motos()->attach($moto->id, ['destino' => 'Loja Fluxo Destino']);

        $this->actingAs($this->gestor)
            ->post(route('gestor.rejeitar', $pedido->id), ['justificativa' => 'Tarde demais'])
            ->assertSessionHas('error');

        $this->assertFalse($pedido->fresh()->trashed());
        $this->assertSame('separado', $pedido->fresh()->status);
        $this->assertSame('separado', $moto->fresh()->status);
        $this->assertSame(1, $pedido->motos()->count());
    }

    // ------------------------------------------------------------------

    private function usuario(string $perfil, array $extra = []): User
    {
        return User::factory()->create([
            'email'  => "fluxo_{$perfil}_" . uniqid() . '@shineray.com.br',
            'perfil' => $perfil,
            ...$extra,
        ]);
    }

    private function moto(string $status, ?User $loja = null): Moto
    {
        return Moto::create([
            'chassi'        => '9C2FLUXO' . random_int(1000000, 9999999),
            'modelo'        => 'JET 50',
            'cor'           => 'PRETA',
            'status'        => $status,
            'loja_atual_id' => $loja?->id,
        ]);
    }

    private function item(array $extra = []): array
    {
        return [
            'modelo'     => 'JET 50',
            'cor'        => 'PRETA',
            'motivo'     => 'Estoque Regular (Giro)',
            'local'      => 'Matriz / CD',
            'quantidade' => 1,
            ...$extra,
        ];
    }
}
