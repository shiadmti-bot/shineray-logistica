<?php

namespace Tests\Feature;

use App\Models\Devolucao;
use App\Models\Moto;
use App\Models\Pedido;
use App\Models\User;
use App\Services\Devolucao\ChecklistMoto;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * O ciclo inteiro da devolução Loja → CD, com os três portões.
 *
 * O que este teste protege não é a gravação de campos — é a ORDEM: nenhuma moto
 * sai da loja sem checklist de origem assinado, ninguém além da diretoria
 * autoriza a saída, e o CD não fecha sem conferir na chegada. Cada um desses
 * três "não" já foi contornado alguma vez em fluxo de papel, e é por isso que
 * eles viraram trava de servidor.
 */
class DevolucaoMotoTest extends TestCase
{
    use DatabaseTransactions;

    private User $gestor;
    private User $cd;
    private User $loja;
    private Moto $moto;

    protected function setUp(): void
    {
        parent::setUp();

        $this->gestor = User::factory()->create(['perfil' => 'gestor']);
        $this->cd     = User::factory()->create(['perfil' => 'cd', 'filial' => 'CD Matriz']);

        $this->loja = User::factory()->create([
            'perfil'      => 'loja',
            'filial'      => 'Loja Castanhal/PA',
            'is_interior' => false,
        ]);

        $this->moto = Moto::create([
            'chassi'            => '9C2TESTE' . random_int(100000, 999999),
            'modelo'            => 'NEW JEF 125',
            'cor'               => 'VERMELHA',
            'status'            => 'estoque_loja',
            'loja_atual_id'     => $this->loja->id,
            'localizacao_atual' => 'Estoque Loja: Loja Castanhal/PA',
        ]);
    }

    public function test_ciclo_completo_da_devolucao_com_checklist_nas_duas_pontas()
    {
        Storage::fake('public');

        // ---------- 1. A LOJA ABRE ----------
        $this->actingAs($this->loja)
            ->post(route('devolucoes.store'), [
                'motos'      => [$this->moto->id],
                'motivo'     => 'defeito_fabrica',
                'observacao' => 'Cliente recusou por ruído no motor.',
            ])
            ->assertSessionHasNoErrors();

        $devolucao = Devolucao::where('user_id', $this->loja->id)->latest('id')->firstOrFail();

        $this->assertEquals(Devolucao::STATUS_RASCUNHO, $devolucao->status);
        $this->assertCount(1, $devolucao->itens);

        $item = $devolucao->itens->first();
        $this->assertEquals($this->moto->chassi, $item->chassi);

        // A mesma moto não pode entrar em duas devoluções abertas.
        $this->actingAs($this->loja)
            ->post(route('devolucoes.store'), [
                'motos'  => [$this->moto->id],
                'motivo' => 'outro',
            ])
            ->assertSessionHasErrors('motos');

        // ---------- 2. PORTÃO 1: SEM CHECKLIST NÃO SAI ----------
        $this->actingAs($this->loja)
            ->post(route('devolucoes.enviar', $devolucao->id))
            ->assertSessionHasErrors('geral');

        $this->assertEquals(
            Devolucao::STATUS_RASCUNHO,
            $devolucao->fresh()->status,
            'Enviar sem checklist não pode mudar o status.'
        );

        // Checklist pela metade também é recusado.
        $this->actingAs($this->loja)
            ->post(route('devolucoes.conferir', [$devolucao->id, $item->id]), [
                'etapa'       => ChecklistMoto::ETAPA_ORIGEM,
                'respostas'   => ['pneus' => 'C'],
                'resultado'   => ChecklistMoto::RESULTADO_CONFORME,
                'responsavel' => 'Maria da Loja',
            ])
            ->assertSessionHasErrors('respostas');

        // Checklist completo, tudo conforme.
        $this->actingAs($this->loja)
            ->post(route('devolucoes.conferir', [$devolucao->id, $item->id]), [
                'etapa'        => ChecklistMoto::ETAPA_ORIGEM,
                'respostas'    => $this->todosConformes(),
                'resultado'    => ChecklistMoto::RESULTADO_CONFORME,
                'responsavel'  => 'Maria da Loja',
                'matricula'    => '4471',
                'numero_motor' => 'MTR-99887',
            ])
            ->assertSessionHasNoErrors();

        $item->refresh();
        $this->assertNotNull($item->origem_assinado_em);
        $this->assertEquals('MTR-99887', $item->numero_motor);
        $this->assertCount(count(ChecklistMoto::chaves()), $item->checklist_origem);

        $this->actingAs($this->loja)
            ->post(route('devolucoes.enviar', $devolucao->id))
            ->assertSessionHasNoErrors();

        $this->assertEquals(Devolucao::STATUS_AGUARDANDO, $devolucao->fresh()->status);

        // ---------- 3. PORTÃO 2: SÓ A DIRETORIA AUTORIZA ----------
        $this->actingAs($this->loja)
            ->post(route('devolucoes.aprovar', $devolucao->id))
            ->assertForbidden();

        $this->actingAs($this->cd)
            ->post(route('devolucoes.aprovar', $devolucao->id))
            ->assertForbidden();

        $this->actingAs($this->gestor)
            ->post(route('devolucoes.aprovar', $devolucao->id))
            ->assertSessionHasNoErrors();

        $devolucao->refresh();
        $this->assertEquals(Devolucao::STATUS_APROVADA, $devolucao->status);
        $this->assertNotNull($devolucao->pedido_id);

        // O frete: transferência Loja -> CD, na forma que a montagem de carga
        // já procura na aba de Coletas.
        //
        // O destino é o usuário-CD canônico do sistema, resolvido por
        // DevolucaoController::usuarioDoCd() — não o usuário de teste criado
        // aqui. Afirmar a IDENTIDADE dele amarraria o teste ao conteúdo da base;
        // o que importa é que origem e destino batem com o dossiê e que quem
        // recebe é de fato o CD.
        $pedido = Pedido::findOrFail($devolucao->pedido_id);
        $this->assertEquals($this->loja->id, $pedido->origem_user_id);
        $this->assertEquals($devolucao->destino_user_id, $pedido->user_id);
        $this->assertContains(
            User::findOrFail($pedido->user_id)->perfil,
            ['cd', 'admin'],
            'A devolução tem de ir para um usuário do CD.'
        );
        $this->assertEquals('aguardando_coleta', $pedido->status);
        $this->assertEquals(0, $pedido->saldoPendente(), 'O chassi já é conhecido: nada a atribuir.');
        $this->assertTrue($pedido->motos()->where('motos.id', $this->moto->id)->exists());

        // A moto continua na loja, mas comprometida com a coleta.
        $this->moto->refresh();
        $this->assertEquals('aguardando_coleta', $this->moto->status);
        $this->assertEquals($this->loja->id, $this->moto->loja_atual_id);

        // ---------- 4. PORTÃO 3: O CD CONFERE NA CHEGADA ----------
        $this->actingAs($this->cd)
            ->post(route('devolucoes.receber', $devolucao->id))
            ->assertSessionHasErrors('geral');

        $this->assertEquals(Devolucao::STATUS_APROVADA, $devolucao->fresh()->status);

        // A loja não confere o destino: são lados opostos da entrega.
        $this->actingAs($this->loja)
            ->post(route('devolucoes.conferir', [$devolucao->id, $item->id]), [
                'etapa'       => ChecklistMoto::ETAPA_DESTINO,
                'respostas'   => $this->todosConformes(),
                'resultado'   => ChecklistMoto::RESULTADO_CONFORME,
                'responsavel' => 'Maria da Loja',
            ])
            ->assertForbidden();

        // Chegou com avaria: NC exige descrição.
        $comAvaria = array_merge($this->todosConformes(), ['pintura_carenagens' => 'NC']);

        $this->actingAs($this->cd)
            ->post(route('devolucoes.conferir', [$devolucao->id, $item->id]), [
                'etapa'       => ChecklistMoto::ETAPA_DESTINO,
                'respostas'   => $comAvaria,
                'resultado'   => ChecklistMoto::RESULTADO_NAO_CONFORME,
                'responsavel' => 'João do CD',
            ])
            ->assertSessionHasErrors('observacao');

        // NC + "conforme" é combinação impossível.
        $this->actingAs($this->cd)
            ->post(route('devolucoes.conferir', [$devolucao->id, $item->id]), [
                'etapa'       => ChecklistMoto::ETAPA_DESTINO,
                'respostas'   => $comAvaria,
                'resultado'   => ChecklistMoto::RESULTADO_CONFORME,
                'responsavel' => 'João do CD',
                'observacao'  => 'Risco na carenagem direita.',
            ])
            ->assertSessionHasErrors('resultado');

        $this->actingAs($this->cd)
            ->post(route('devolucoes.conferir', [$devolucao->id, $item->id]), [
                'etapa'       => ChecklistMoto::ETAPA_DESTINO,
                'respostas'   => $comAvaria,
                'resultado'   => ChecklistMoto::RESULTADO_NAO_CONFORME,
                'responsavel' => 'João do CD',
                'matricula'   => '1200',
                'observacao'  => 'Risco de 12 cm na carenagem direita, não existia na saída.',
            ])
            ->assertSessionHasNoErrors();

        // Ainda falta a foto: divergência sem registro fotográfico não fecha.
        $this->actingAs($this->cd)
            ->post(route('devolucoes.receber', $devolucao->id))
            ->assertSessionHasErrors('geral');

        $this->actingAs($this->cd)
            ->post(route('devolucoes.anexos.store', $devolucao->id), [
                'etapa'     => ChecklistMoto::ETAPA_DESTINO,
                'item_id'   => $item->id,
                'arquivo'   => UploadedFile::fake()->image('avaria.jpg', 800, 600),
                'descricao' => 'Carenagem direita',
            ])
            ->assertSessionHasNoErrors();

        $this->assertEquals(1, $devolucao->anexos()->count());

        // ---------- 5. FECHAMENTO ----------
        $this->actingAs($this->cd)
            ->post(route('devolucoes.receber', $devolucao->id), [
                'entregador_nome'      => 'Carlos Motorista',
                'entregador_resultado' => ChecklistMoto::RESULTADO_RESSALVA,
            ])
            ->assertSessionHasNoErrors();

        $devolucao->refresh();
        $this->assertEquals(Devolucao::STATUS_RECEBIDA, $devolucao->status);
        $this->assertEquals($this->cd->id, $devolucao->recebido_por);
        $this->assertNotNull($devolucao->chegada_em);
        $this->assertEquals('Carlos Motorista', $devolucao->entregador_nome);

        // A moto voltou ao CD — e retida, porque chegou não conforme.
        $this->moto->refresh();
        $this->assertEquals('avariado', $this->moto->status);
        $this->assertNull($this->moto->loja_atual_id);
        $this->assertStringContainsString('carenagem', mb_strtolower((string) $this->moto->detalhes_avaria));
        $this->assertNotNull($this->moto->foto_avaria);

        $this->assertEquals('concluido', $pedido->fresh()->status);
    }

    public function test_pedido_de_devolucao_nao_pode_ser_fechado_pela_tela_de_pedido()
    {
        Storage::fake('public');

        $devolucao = Devolucao::create([
            'user_id'         => $this->loja->id,
            'destino_user_id' => $this->cd->id,
            'status'          => Devolucao::STATUS_APROVADA,
            'motivo'          => 'avaria_transporte',
        ]);

        $pedido = Pedido::create([
            'user_id'        => $this->cd->id,
            'origem_user_id' => $this->loja->id,
            'status'         => 'em_transito',
            'tipo_carga'     => 'moto',
        ]);

        $devolucao->update(['pedido_id' => $pedido->id]);

        /*
         * Fechar por PedidoController::finalizarEntrega pularia o checklist de
         * destino: a moto entraria no estoque do CD como boa, sem ninguém
         * assinar que ela chegou boa.
         */
        $this->actingAs($this->cd)
            ->post(route('pedidos.finalizar', $pedido->id), [
                'arquivo_romaneio' => UploadedFile::fake()->image('canhoto.jpg'),
            ])
            ->assertSessionHasErrors('arquivo_romaneio');

        $this->assertEquals('em_transito', $pedido->fresh()->status);
    }

    /** @return array<string, string> */
    private function todosConformes(): array
    {
        return array_fill_keys(ChecklistMoto::chaves(), ChecklistMoto::CONFORME);
    }
}
