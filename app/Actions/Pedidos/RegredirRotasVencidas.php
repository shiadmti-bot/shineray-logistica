<?php

namespace App\Actions\Pedidos;

use App\Models\Pedido;
use App\Models\PedidoLog;
use Illuminate\Support\Facades\DB;

/**
 * Pedido com rota confirmada cuja data passou sem o caminhão sair volta para a
 * fila de onde veio.
 *
 * Era CalendarController::limparRotasVencidas, chamado também dentro da
 * LISTAGEM de pedidos: todo GET em /pedidos gravava no banco antes de
 * responder. Hoje roda só pelo cron (webhook /webhook/microwork e o scheduler).
 */
final class RegredirRotasVencidas
{
    /** @return int quantos pedidos voltaram para a fila */
    public function executar(): int
    {
        $regredidos = 0;

        Pedido::with('origem')
            ->where('status', 'rota_confirmada')
            ->whereDate('previsao_entrega', '<', now()->startOfDay())
            ->chunkById(100, function ($pedidos) use (&$regredidos) {
                foreach ($pedidos as $pedido) {
                    DB::transaction(fn () => $this->regredir($pedido));
                    $regredidos++;
                }
            });

        return $regredidos;
    }

    private function regredir(Pedido $pedido): void
    {
        $isTransferencia = $pedido->origem_user_id && $pedido->origem && $pedido->origem->isLoja();

        if ($isTransferencia && $pedido->origem->is_interior && $pedido->created_at >= Pedido::INTERIOR_AGUARDA_ROTA_DESDE) {
            $novoStatus = 'aguardando_rota';
            $msg = 'A rota agendada expirou (passou da data sem despacho oficial). O pedido retornou automaticamente para fila aguardando nova rota.';
        } elseif ($isTransferencia) {
            $novoStatus = 'aguardando_coleta';
            $msg = 'A rota agendada expirou. O item segue pendente de coleta presencial pela frota.';
        } else {
            $novoStatus = 'separado';
            $msg = 'A rota do CD expirou sem ser embarcada. O pedido retornou automaticamente para o patamar de Separado aguardando nova carga.';
        }

        $pedido->update(['previsao_entrega' => null, 'status' => $novoStatus]);
        $pedido->motos()->update(['status' => $novoStatus]);

        PedidoLog::create([
            'pedido_id' => $pedido->id,
            'titulo'    => 'Rota Vencida 🕰️',
            'descricao' => $msg,
        ]);
    }
}
