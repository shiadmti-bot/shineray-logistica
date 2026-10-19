<?php

namespace Tests\Feature;

use App\Models\Pedido;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * Os números do BI.
 *
 * Pedido recusado é soft-deleted (CancelarPedido). O BI contava sem
 * withTrashed: "Cancelados" marcava praticamente zero e a taxa de sucesso
 * saía inflada, porque o total também perdia os recusados.
 */
class BiIndicadoresTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    /** Período sem nenhum outro dado no banco de testes. */
    private const DIA = '2031-03-15 10:00:00';

    public function test_cancelados_e_rejeitados_entram_nos_numeros(): void
    {
        $loja = $this->usuario('loja', ['filial' => 'Loja BI/PA']);

        $this->pedidoNoPeriodo($loja, 'concluido');
        $this->pedidoNoPeriodo($loja, 'em_transito');
        $this->pedidoNoPeriodo($loja, 'cancelado', recusado: true);
        $this->pedidoNoPeriodo($loja, 'rejeitado', recusado: true);

        $this->actingAs($this->usuario('admin'))
            ->get(route('bi.index', ['start_date' => '2031-03-01', 'end_date' => '2031-03-31']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('kpis.total_pedidos', 4)
                ->where('kpis.concluidos', 1)
                ->where('kpis.cancelados', 2)
                ->where('kpis.taxa_sucesso', 25)
            );
    }

    /**
     * A v2.6 rejeitava e cancelava só com delete(), sem trocar o status. No
     * indicador do período isso foi recusa, e conta como cancelado — embora a
     * listagem esconda o pedido (Pedido::comRecusados).
     */
    public function test_excluido_pela_v26_sem_status_de_recusa_conta_como_cancelado(): void
    {
        $loja = $this->usuario('loja', ['filial' => 'Loja BI Legado/PA']);
        $dia = '2031-04-15 10:00:00';

        $this->pedidoNoPeriodo($loja, 'concluido', dia: $dia);
        $this->pedidoNoPeriodo($loja, 'em_analise', recusado: true, dia: $dia);
        $this->pedidoNoPeriodo($loja, 'solicitado', recusado: true, dia: $dia);
        // Concluído excluído não é recusa.
        $this->pedidoNoPeriodo($loja, 'concluido', recusado: true, dia: $dia);

        $this->actingAs($this->usuario('admin'))
            ->get(route('bi.index', ['start_date' => '2031-04-01', 'end_date' => '2031-04-30']))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('kpis.total_pedidos', 4)
                ->where('kpis.cancelados', 2)
            );
    }

    private function pedidoNoPeriodo(User $loja, string $status, bool $recusado = false, string $dia = self::DIA): void
    {
        $pedido = $this->pedidoMoto($loja, $status);

        DB::table('pedidos')->where('id', $pedido->id)->update([
            'created_at' => $dia,
            'updated_at' => $dia,
            'deleted_at' => $recusado ? $dia : null,
        ]);
    }
}
