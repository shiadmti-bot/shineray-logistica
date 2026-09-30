<?php

namespace App\Console\Commands;

use App\Actions\Pedidos\CancelarPedido;
use App\Models\Basqueta;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\User;
use App\Services\Estoque\EstoquePecaService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CancelarPedidoCommand extends Command
{
    protected $signature = 'pedido:cancelar {id : ID do pedido a ser cancelado} {--motivo=Cancelamento solicitado pelo usuário : Motivo do cancelamento} {--force : Executa sem confirmação}';

    protected $description = 'Cancela um pedido de moto ou de peça, liberando reservas de estoque e notas vinculadas';

    public function handle(EstoquePecaService $estoqueService, CancelarPedido $cancelarPedidoAction): int
    {
        $id = (int) $this->argument('id');
        $motivo = (string) $this->option('motivo');
        $force = (bool) $this->option('force');

        $pedido = Pedido::with(['itensPedido.peca', 'motos', 'user'])->find($id);

        if (! $pedido) {
            $this->error("Pedido #{$id} não encontrado.");
            return self::FAILURE;
        }

        $this->info("=====================================================");
        $this->info("  CANCELAMENTO DE PEDIDO #{$pedido->id}  ");
        $this->info("=====================================================");
        $this->line("Tipo de carga: {$pedido->tipo_carga}");
        $this->line("Status atual: {$pedido->status}");
        $this->line("Destino: " . ($pedido->user?->filial ?? $pedido->user?->name ?? 'N/A'));
        $this->line("Motivo: {$motivo}");

        if (! $force && ! $this->confirm("Deseja realmente cancelar o Pedido #{$pedido->id}?")) {
            $this->warn("Operação cancelada.");
            return self::SUCCESS;
        }

        $admin = User::where('perfil', 'admin')->first() ?? User::find(2) ?? $pedido->user;

        DB::transaction(function () use ($pedido, $admin, $motivo, $estoqueService, $cancelarPedidoAction) {
            if ($pedido->tipo_carga === 'peca') {
                // 1. Tratar Basquetas e Notas Fiscais vinculadas
                $basquetaIds = $pedido->itensPedido->pluck('basqueta_id')->filter()->unique();

                foreach ($basquetaIds as $bId) {
                    $basqueta = Basqueta::with(['notas', 'itens'])->find($bId);
                    if ($basqueta) {
                        $nota = $basqueta->notaVigente();
                        if ($nota) {
                            $nota->update([
                                'cancelada_em'        => now(),
                                'cancelada_por'       => $admin->id,
                                'motivo_cancelamento' => "Cancelamento do Pedido #{$pedido->id}: {$motivo}",
                            ]);
                            $this->line("Nota fiscal {$nota->rotulo} cancelada.");
                        }

                        $basqueta->reabrirParaAjuste("Cancelamento do Pedido #{$pedido->id}: {$motivo}");
                    }
                }

                // 2. Executa a ação oficial de cancelamento (libera reservas no CD, desvincula basqueta, grava log e soft delete)
                $cancelarPedidoAction->executar($pedido, $admin, 'cancelado', $motivo);

                // 3. Se a basqueta não possui mais itens de outros pedidos, encerra a basqueta
                foreach ($basquetaIds as $bId) {
                    $basqueta = Basqueta::find($bId);
                    if ($basqueta && $basqueta->itens()->count() === 0) {
                        $basqueta->update([
                            'status'          => 'cancelada',
                            'local_aberto_id' => null,
                        ]);
                        $this->line("Basqueta #{$basqueta->id} encerrada (sem itens pendentes).");
                    }
                }
            } else {
                // Pedido de Moto
                $cancelarPedidoAction->executar($pedido, $admin, 'cancelado', $motivo);
            }
        });

        $this->newLine();
        $this->info("Pedido #{$pedido->id} cancelado com sucesso e estoque liberado!");

        return self::SUCCESS;
    }
}
