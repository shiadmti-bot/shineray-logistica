<?php

namespace Tests\Feature\Pedidos;

use App\Models\Pedido;
use App\Models\User;
use App\Notifications\EstornoSolicitado;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * Regras que a TELA já impunha e o SERVIDOR não (varredura v3.7).
 *
 * Em todos os casos abaixo o botão certo só aparecia para a pessoa certa, no
 * estágio certo — mas a rota aceitava a requisição de qualquer um, em
 * qualquer estágio. Cada teste prova a trava do lado do servidor.
 */
class PedidoTravasDeSegurancaTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    private User $gestor;
    private User $cd;
    private User $lojaDestino;
    private User $lojaOrigem;
    private User $lojaDeFora;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Http::fake();
        Storage::fake('public');

        $this->gestor      = $this->usuario('gestor', ['valida_motos' => true]);
        $this->cd          = $this->usuario('cd', ['filial' => 'CD Matriz']);
        $this->lojaDestino = $this->usuario('loja', ['filial' => 'Loja Destino/PA']);
        $this->lojaOrigem  = $this->usuario('loja', ['filial' => 'Loja Origem/PA']);
        $this->lojaDeFora  = $this->usuario('loja', ['filial' => 'Loja De Fora/PA']);
    }

    // ------------------------------------------------------------------
    // REJEITAR NÃO É ATALHO PARA CANCELAR FORA DE HORA
    // ------------------------------------------------------------------

    /** O fluxo da tela continua: a loja de origem recusa a transferência que ainda não separou. */
    public function test_loja_de_origem_recusa_transferencia_em_solicitado(): void
    {
        [$pedido, $moto] = $this->pedidoComMoto($this->lojaDestino, 'solicitado', 'solicitado', $this->lojaOrigem);

        $this->actingAs($this->lojaOrigem)
            ->post(route('pedidos.rejeitar', $pedido->id), ['motivo' => 'Moto vendida no balcão'])
            ->assertSessionMissing('error');

        $this->assertSame('rejeitado', Pedido::withTrashed()->find($pedido->id)->status);
        $this->assertSame('disponivel', $moto->fresh()->status, 'A moto volta ao estoque da origem.');
    }

    public function test_loja_nao_usa_rejeitar_para_desfazer_pedido_ja_separado(): void
    {
        [$pedido, $moto] = $this->pedidoComMoto($this->lojaDestino, 'aguardando_coleta', 'aguardando_coleta', $this->lojaOrigem);

        $this->actingAs($this->lojaOrigem)
            ->post(route('pedidos.rejeitar', $pedido->id), ['motivo' => 'Desisti'])
            ->assertSessionHas('error');

        $this->assertSame('aguardando_coleta', $pedido->fresh()->status);
        $this->assertSame('aguardando_coleta', $moto->fresh()->status);
        $this->assertTrue($pedido->motos()->whereKey($moto->id)->exists(), 'A moto continua no pedido.');
    }

    public function test_loja_solicitante_nao_desfaz_pedido_em_transito_nem_concluido(): void
    {
        foreach (['em_transito', 'concluido'] as $estagio) {
            [$pedido, $moto] = $this->pedidoComMoto($this->lojaDestino, $estagio, $estagio === 'concluido' ? 'estoque_loja' : 'em_transito');

            $this->actingAs($this->lojaDestino)
                ->post(route('pedidos.rejeitar', $pedido->id), ['motivo' => 'Não quero mais'])
                ->assertSessionHas('error');

            $this->assertSame($estagio, $pedido->fresh()->status, "Pedido em {$estagio} não pode cair pela loja.");
            $this->assertNotSoftDeleted('pedidos', ['id' => $pedido->id]);
        }
    }

    /** A gestão mantém o poder de desfazer em qualquer ponto (decisão da operação, 14/09/2026). */
    public function test_gestao_continua_rejeitando_em_qualquer_estagio(): void
    {
        [$pedido] = $this->pedidoComMoto($this->lojaDestino, 'separado', 'separado');

        $this->actingAs($this->gestor)
            ->post(route('pedidos.rejeitar', $pedido->id), ['motivo' => 'Carga redirecionada pela diretoria'])
            ->assertSessionMissing('error');

        $this->assertSame('rejeitado', Pedido::withTrashed()->find($pedido->id)->status);
    }

    public function test_loja_de_fora_nao_rejeita_pedido_alheio(): void
    {
        [$pedido] = $this->pedidoComMoto($this->lojaDestino, 'solicitado', 'solicitado', $this->lojaOrigem);

        $this->actingAs($this->lojaDeFora)
            ->post(route('pedidos.rejeitar', $pedido->id), ['motivo' => 'Intromissão'])
            ->assertSessionHas('error');

        $this->assertSame('solicitado', $pedido->fresh()->status);
    }

    // ------------------------------------------------------------------
    // PEDIDO DE CORTE (ESTORNO)
    // ------------------------------------------------------------------

    public function test_pedido_de_corte_exige_motivo(): void
    {
        [, $moto] = $this->pedidoComMoto($this->lojaDestino, 'solicitado', 'separado', $this->lojaOrigem);

        $this->actingAs($this->lojaOrigem)
            ->post(route('motos.solicitarRetirada', $moto->id), ['motivo' => ''])
            ->assertSessionHasErrors('motivo');

        $this->assertFalse((bool) $moto->fresh()->estorno_pendente);
    }

    public function test_loja_de_fora_nao_marca_moto_alheia_para_corte(): void
    {
        [, $moto] = $this->pedidoComMoto($this->lojaDestino, 'solicitado', 'separado', $this->lojaOrigem);

        $this->actingAs($this->lojaDeFora)
            ->post(route('motos.solicitarRetirada', $moto->id), ['motivo' => 'Quero esta moto fora do pedido'])
            ->assertForbidden();

        $this->assertFalse((bool) $moto->fresh()->estorno_pendente);
        Notification::assertNothingSent();
    }

    public function test_loja_de_origem_pede_corte_durante_a_separacao_e_o_gestor_e_avisado(): void
    {
        [, $moto] = $this->pedidoComMoto($this->lojaDestino, 'solicitado', 'separado', $this->lojaOrigem);

        $this->actingAs($this->lojaOrigem)
            ->post(route('motos.solicitarRetirada', $moto->id), ['motivo' => 'Riscada no pátio'])
            ->assertSessionHas('success');

        $moto->refresh();
        $this->assertTrue((bool) $moto->estorno_pendente);
        $this->assertSame('loja: Riscada no pátio', $moto->motivo_estorno);
        $this->assertSame($this->lojaOrigem->id, (int) $moto->user_estorno_id);

        Notification::assertSentTo($this->gestor, EstornoSolicitado::class);
    }

    public function test_cd_pede_corte_de_reposicao_em_separacao(): void
    {
        [, $moto] = $this->pedidoComMoto($this->lojaDestino, 'solicitado', 'estoque_fabrica');

        $this->actingAs($this->cd)
            ->post(route('motos.solicitarRetirada', $moto->id), ['motivo' => 'Avaria no estoque'])
            ->assertSessionHas('success');

        $this->assertTrue((bool) $moto->fresh()->estorno_pendente);
    }

    public function test_corte_nao_e_aceito_depois_que_a_moto_saiu(): void
    {
        [, $moto] = $this->pedidoComMoto($this->lojaDestino, 'em_transito', 'em_transito', $this->lojaOrigem);

        $this->actingAs($this->lojaOrigem)
            ->post(route('motos.solicitarRetirada', $moto->id), ['motivo' => 'Tarde demais'])
            ->assertSessionHasErrors();

        $this->assertFalse((bool) $moto->fresh()->estorno_pendente);
    }

    public function test_moto_sem_pedido_ativo_nao_recebe_pedido_de_corte(): void
    {
        [, $moto] = $this->pedidoComMoto($this->lojaDestino, 'concluido', 'separado');

        $this->actingAs($this->cd)
            ->post(route('motos.solicitarRetirada', $moto->id), ['motivo' => 'Sem pedido vivo'])
            ->assertForbidden();
    }

    // ------------------------------------------------------------------
    // APROVAÇÃO: UMA RÉGUA PARA AS DUAS PORTAS
    // ------------------------------------------------------------------

    public function test_gestor_sem_valida_motos_nao_aprova_pela_rota_de_pedidos(): void
    {
        $gestorSemAtribuicao = $this->usuario('gestor', ['valida_motos' => false]);
        $pedido = $this->pedidoMoto($this->lojaDestino, 'em_analise');

        $this->actingAs($gestorSemAtribuicao)
            ->post(route('pedidos.aprovar', $pedido->id))
            ->assertForbidden();

        $this->assertSame('em_analise', $pedido->fresh()->status);
    }

    public function test_quem_valida_motos_aprova_pela_rota_de_pedidos(): void
    {
        $pedido = $this->pedidoMoto($this->lojaDestino, 'em_analise');

        $this->actingAs($this->gestor)
            ->post(route('pedidos.aprovar', $pedido->id))
            ->assertSessionHas('success');

        $this->assertSame('solicitado', $pedido->fresh()->status);
    }

    // ------------------------------------------------------------------
    // RECEBIMENTO: SÓ O QUE ESTÁ NA ESTRADA, E SÓ UMA VEZ
    // ------------------------------------------------------------------

    public function test_pedido_ja_concluido_nao_e_recebido_de_novo(): void
    {
        [$pedido, $moto] = $this->pedidoComMoto($this->lojaDestino, 'concluido', 'estoque_loja');
        $moto->update(['loja_atual_id' => $this->lojaDeFora->id, 'status' => 'em_transito']); // a moto seguiu em outro pedido

        $this->actingAs($this->lojaDestino)
            ->post(route('pedidos.finalizar', $pedido->id), [
                'arquivo_romaneio' => UploadedFile::fake()->image('canhoto.jpg'),
            ])
            ->assertSessionHasErrors('arquivo_romaneio');

        $moto->refresh();
        $this->assertSame('em_transito', $moto->status, 'O recebimento repetido regravava a moto.');
        $this->assertSame($this->lojaDeFora->id, (int) $moto->loja_atual_id);
    }

    public function test_pedido_que_ainda_nao_saiu_nao_e_recebido(): void
    {
        [$pedido] = $this->pedidoComMoto($this->lojaDestino, 'separado', 'separado');

        $this->actingAs($this->lojaDestino)
            ->post(route('pedidos.finalizar', $pedido->id), [
                'arquivo_romaneio' => UploadedFile::fake()->image('canhoto.jpg'),
            ])
            ->assertSessionHasErrors('arquivo_romaneio');

        $this->assertSame('separado', $pedido->fresh()->status);
    }

    public function test_loja_de_fora_nao_recebe_pedido_alheio(): void
    {
        [$pedido] = $this->pedidoComMoto($this->lojaDestino, 'em_transito', 'em_transito');

        $this->actingAs($this->lojaDeFora)
            ->post(route('pedidos.finalizar', $pedido->id), [
                'arquivo_romaneio' => UploadedFile::fake()->image('canhoto.jpg'),
            ])
            ->assertForbidden();

        $this->assertSame('em_transito', $pedido->fresh()->status);
    }
}
