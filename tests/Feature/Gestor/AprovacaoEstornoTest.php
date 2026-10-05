<?php

namespace Tests\Feature\Gestor;

use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * O corte de moto que a loja ou o CD pedem e o gestor aprova.
 *
 * O que estava aberto: aprovar não conferia se havia pedido de corte. O id de
 * QUALQUER moto era "estornado" — inclusive de uma em trânsito —, saindo dos
 * pedidos ativos e voltando ao estoque, sem rastro de quem fez.
 */
class AprovacaoEstornoTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    private User $gestor;
    private User $loja;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();

        $this->gestor = $this->usuario('gestor', ['valida_motos' => true, 'name' => 'Gestora Comercial']);
        $this->loja   = $this->usuario('loja', ['filial' => 'Loja Estorno/PA']);
    }

    public function test_sem_pedido_de_corte_nada_e_estornado(): void
    {
        [$pedido, $moto] = $this->pedidoComMoto($this->loja, 'em_transito', 'em_transito');

        $this->actingAs($this->gestor)
            ->post(route('gestor.aprovarEstorno', $moto->id))
            ->assertSessionHas('error');

        $this->assertSame('em_transito', $moto->fresh()->status);
        $this->assertTrue($pedido->motos()->whereKey($moto->id)->exists(), 'A moto continua no caminhão e no pedido.');
        $this->assertSame('em_transito', $pedido->fresh()->status);
    }

    public function test_corte_aprovado_tira_a_moto_e_registra_quem_aprovou(): void
    {
        [$pedido, $cortada] = $this->pedidoComMoto($this->loja, 'solicitado', 'separado');
        $outra = $this->moto('separado');
        $pedido->motos()->attach($outra->id, ['destino' => 'Loja Estorno/PA']);

        $cortada->update(['estorno_pendente' => true, 'motivo_estorno' => 'cd: Avaria no pátio']);

        $this->actingAs($this->gestor)
            ->post(route('gestor.aprovarEstorno', $cortada->id))
            ->assertSessionHas('success');

        $cortada->refresh();
        $this->assertFalse($pedido->motos()->whereKey($cortada->id)->exists());
        $this->assertSame('disponivel', $cortada->status);
        $this->assertFalse((bool) $cortada->estorno_pendente);

        // O pedido segue com a outra moto.
        $this->assertSame('solicitado', $pedido->fresh()->status);

        $log = PedidoLog::where('pedido_id', $pedido->id)->where('titulo', 'Corte Aprovado ✂️')->sole();
        $this->assertSame($this->gestor->id, (int) $log->user_id);
        $this->assertStringContainsString('Avaria no pátio', $log->descricao);
        $this->assertStringContainsString('Gestora Comercial', $log->descricao);
    }

    public function test_pedido_que_fica_vazio_e_cancelado(): void
    {
        [$pedido, $moto] = $this->pedidoComMoto($this->loja, 'solicitado', 'separado');
        $moto->update(['estorno_pendente' => true, 'motivo_estorno' => 'loja: Cliente desistiu']);

        $this->actingAs($this->gestor)->post(route('gestor.aprovarEstorno', $moto->id));

        $this->assertSoftDeleted('pedidos', ['id' => $pedido->id]);
        $this->assertSame('cancelado', Pedido::withTrashed()->find($pedido->id)->status);
    }

    public function test_quem_nao_valida_motos_nao_aprova_corte(): void
    {
        [, $moto] = $this->pedidoComMoto($this->loja, 'solicitado', 'separado');
        $moto->update(['estorno_pendente' => true]);

        foreach ([$this->usuario('cd'), $this->loja, $this->usuario('gestor')] as $semAtribuicao) {
            $this->actingAs($semAtribuicao)
                ->post(route('gestor.aprovarEstorno', $moto->id))
                ->assertForbidden();
        }

        $this->assertTrue((bool) $moto->fresh()->estorno_pendente);
    }

    public function test_rejeicao_pelo_gestor_exige_motivo_e_so_vale_em_analise(): void
    {
        $emAnalise = $this->pedidoMoto($this->loja, 'em_analise');

        $this->actingAs($this->gestor)
            ->post(route('gestor.rejeitar', $emAnalise->id), ['justificativa' => ''])
            ->assertSessionHasErrors();

        $separado = $this->pedidoMoto($this->loja, 'separado');

        $this->actingAs($this->gestor)
            ->post(route('gestor.rejeitar', $separado->id), ['justificativa' => 'Fora de hora'])
            ->assertSessionHas('error');

        $this->assertSame('separado', $separado->fresh()->status);
    }
}
