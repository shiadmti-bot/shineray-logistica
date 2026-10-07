<?php

namespace App\Console\Commands;

use App\Models\Romaneio;
use App\Models\RomaneioItem;
use Illuminate\Console\Command;

/**
 * Fecha cargas que ficaram abertas sem nada pendente.
 *
 * Era a rota GET /corrigir-status-romaneios: qualquer usuário logado fechava
 * carga só de abrir a URL — e GET é o verbo que navegador pré-carrega e que
 * robô de link segue. A regra é a mesma; mudou quem pode rodar.
 *
 * v3.8 — INCIDENTE 01/10: a versão anterior decidia pelo `pedidos.romaneio_id`.
 * Num embarque parcial o pedido só aponta para a ÚLTIMA carga em que teve moto,
 * então a carga anterior parecia "vazia" e foi fechada com moto ainda no
 * caminhão (#12087244 Icoaraci, #12087245 Belém). A carga sumia da fila de
 * trânsito enquanto o pedido seguia "em trânsito". Agora a régua é a mesma de
 * Romaneio::podeFechar(), que lê o conteúdo físico da carga.
 *
 * --reabrir devolve a 'em_transito' as cargas concluídas que ainda têm moto
 * na estrada — a correção dos fechamentos indevidos já ocorridos.
 */
class CorrigirStatusRomaneios extends Command
{
    protected $signature = 'romaneios:corrigir-status
        {--dry : Apenas lista, sem alterar}
        {--reabrir : Reabre cargas concluídas que ainda têm moto em trânsito}';

    protected $description = 'Fecha romaneios vazios ou com tudo entregue (e, com --reabrir, reabre os fechados indevidamente)';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry');
        $prefixo = $dry ? '[dry] ' : '';

        $fechadas = 0;

        foreach (Romaneio::whereNotIn('status', ['concluido', 'cancelado'])->with('motos.pedidos')->get() as $carga) {
            if (! $carga->podeFechar()) {
                continue;
            }

            $vazia = $carga->motos->isEmpty()
                && ! RomaneioItem::where('romaneio_id', $carga->id)->exists();

            if (! $dry) {
                $carga->update(['status' => 'concluido']);
            }

            $fechadas++;
            $this->line("{$prefixo}Carga #{$carga->id} fechada (" . ($vazia ? 'vazia' : 'tudo entregue') . ').');
        }

        $this->info("{$prefixo}Cargas fechadas: {$fechadas}");

        if ($this->option('reabrir')) {
            $this->reabrirFechadasIndevidamente($dry, $prefixo);
        }

        return self::SUCCESS;
    }

    private function reabrirFechadasIndevidamente(bool $dry, string $prefixo): void
    {
        $reabertas = 0;

        $suspeitas = Romaneio::where('status', 'concluido')
            ->whereHas('motos', fn ($q) => $q->whereIn('status', Romaneio::MOTO_NA_ESTRADA))
            ->with('motos.pedidos')
            ->get();

        foreach ($suspeitas as $carga) {
            $naEstrada = $carga->motosNaEstrada();

            if ($naEstrada->isEmpty()) {
                continue;
            }

            if (! $dry) {
                $carga->update(['status' => 'em_transito']);
            }

            $reabertas++;
            $this->warn("{$prefixo}Carga #{$carga->id} ({$carga->rota}) reaberta: " . $naEstrada
                ->map(fn ($m) => "{$m->chassi} → pedido #{$m->pedidos->first()->id} ({$m->pedidos->first()->status})")
                ->implode('; '));
        }

        $this->info("{$prefixo}Cargas reabertas: {$reabertas}");
    }
}
