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

    private function pedidoNoPeriodo(User $loja, string $status, bool $recusado = false): void
    {
        $pedido = $this->pedidoMoto($loja, $status);

        DB::table('pedidos')->where('id', $pedido->id)->update([
            'created_at' => self::DIA,
            'updated_at' => self::DIA,
            'deleted_at' => $recusado ? self::DIA : null,
        ]);
    }
}
