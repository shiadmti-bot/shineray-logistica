<?php

namespace App\Console\Commands;

use App\Models\Romaneio;
use Illuminate\Console\Command;

/**
 * Fecha cargas que ficaram abertas sem nada pendente.
 *
 * Era a rota GET /corrigir-status-romaneios: qualquer usuário logado fechava
 * carga só de abrir a URL — e GET é o verbo que navegador pré-carrega e que
 * robô de link segue. A regra é a mesma; mudou quem pode rodar.
 */
class CorrigirStatusRomaneios extends Command
{
    protected $signature = 'romaneios:corrigir-status {--dry : Apenas lista, sem alterar}';

    protected $description = 'Fecha romaneios vazios ou com todos os pedidos entregues';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry');
        $corrigidos = 0;

        foreach (Romaneio::whereNotIn('status', ['concluido', 'cancelado'])->get() as $carga) {
            $ativos = $carga->pedidos()->where('status', '!=', 'cancelado')->count();

            if ($ativos === 0) {
                $motivo = 'vazia';
            } else {
                // 'no_cd' é intermediário de transbordo: não conta como
                // pendência, mas carga parada nele também não fecha.
                $pendencias  = $carga->pedidos()->whereNotIn('status', ['concluido', 'cancelado', 'no_cd'])->count();
                $statusAtual = $carga->pedidos->first()->status ?? 'concluido';

                if ($pendencias > 0 || $statusAtual === 'no_cd') {
                    continue;
                }

                $motivo = 'tudo entregue';
            }

            if (! $dry) {
                $carga->update(['status' => 'concluido']);
            }

            $corrigidos++;
            $this->line("Carga #{$carga->id} fechada ({$motivo}).");
        }

        $this->info(($dry ? '[dry] ' : '') . "Cargas corrigidas: {$corrigidos}");

        return self::SUCCESS;
    }
}
