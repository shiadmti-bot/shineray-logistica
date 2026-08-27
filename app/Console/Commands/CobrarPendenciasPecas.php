<?php

namespace App\Console\Commands;

use App\Models\Basqueta;
use App\Models\PedidoItem;
use App\Models\User;
use App\Notifications\PedidoAtualizado;
use App\Services\OneSignalService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Cobra as pendências do fluxo de peças.
 *
 * O manual descreve um processo com duas travas humanas — a liberação do
 * Pós-Venda e a conferência da filial. Trava humana sem cobrança vira gargalo
 * silencioso: hoje uma caixa pode esperar conferência indefinidamente e o
 * caminhão não sai, sem que ninguém receba um sinal.
 *
 * QUATRO PERGUNTAS, QUATRO DESTINATÁRIOS
 *   Sem código há muito tempo   -> CD (o Call Center precisa atender)
 *   Sem liberação há muito tempo-> os 3 validadores (assinatura pendente)
 *   Basqueta sem viagem         -> CD (marcar rota, senão o saldo fica preso)
 *   Conferência parada          -> a filial (o caminhão espera por ela)
 *
 * ANTI-SPAM SEM ESTADO NOVO
 * Cobrar todo dia um item travado há três semanas treina as pessoas a ignorar
 * a notificação. Em vez de guardar "última cobrança" em coluna, a cadência sai
 * da própria idade: cobra ao cruzar o limite e depois a cada 2 dias. Só é
 * estável se o comando rodar UMA VEZ por dia — é assim que está agendado.
 */
class CobrarPendenciasPecas extends Command
{
    protected $signature = 'pecas:cobrar {--dry : Apenas lista, sem notificar}';

    protected $description = 'Notifica responsáveis por pendências travadas no fluxo de peças';

    /** Limites em horas a partir dos quais a pendência passa a ser cobrada. */
    private const LIMITE_ATENDIMENTO = 24;
    private const LIMITE_LIBERACAO   = 24;
    private const LIMITE_CONFERENCIA = 48;
    private const LIMITE_SEM_ROTA_DIAS = 7;

    private bool $dry = false;

    public function handle(): int
    {
        $this->dry = (bool) $this->option('dry');

        $enviadas = 0;
        $enviadas += $this->cobrarAtendimento();
        $enviadas += $this->cobrarLiberacao();
        $enviadas += $this->cobrarBasquetaSemRota();
        $enviadas += $this->cobrarConferencia();

        $this->info(($this->dry ? '[dry] ' : '') . "Cobranças enviadas: {$enviadas}");

        return self::SUCCESS;
    }

    /** Passo 2: cotas esperando o Call Center achar o código. */
    private function cobrarAtendimento(): int
    {
        $itens = PedidoItem::aguardandoIdentificacao()
            ->whereHas('pedido', fn ($q) => $q->whereIn('status', ['solicitado', 'em_atendimento']))
            ->with('pedido.user:id,name,filial')
            ->get()
            ->filter(fn ($i) => $this->deveCobrar($i->pedido->created_at, self::LIMITE_ATENDIMENTO));

        if ($itens->isEmpty()) {
            return 0;
        }

        $lojas = $itens->pluck('pedido.user.filial')->filter()->unique()->take(3)->implode(', ');

        return $this->notificar(
            $this->equipeCd(),
            'Peças aguardando identificação 🔎',
            "{$itens->count()} item(ns) sem código há mais de " . self::LIMITE_ATENDIMENTO . 'h'
            . ($lojas ? " — {$lojas}." : '.'),
            route('pecas.atendimento')
        );
    }

    /** Passo 3 / Gate 1: cotas identificadas esperando assinatura. */
    private function cobrarLiberacao(): int
    {
        $itens = PedidoItem::aguardandoLiberacao()
            ->whereHas('pedido', fn ($q) => $q->whereIn('status', ['em_atendimento', 'aguardando_confirmacao']))
            ->get()
            ->filter(fn ($i) => $this->deveCobrar($i->identificado_em, self::LIMITE_LIBERACAO));

        if ($itens->isEmpty()) {
            return 0;
        }

        $validadores = User::where('valida_pecas', true)->get();

        if ($validadores->isEmpty()) {
            // Sem validador marcado, a fila trava inteira e ninguém é avisado.
            // Cobrar o admin é o único caminho de saída.
            Log::warning('Nenhum usuário com valida_pecas — cobrança de liberação foi para o admin.');
            $validadores = User::where('perfil', 'admin')->get();
        }

        return $this->notificar(
            $validadores,
            'Pedidos de peça aguardando sua liberação ✍️',
            "{$itens->count()} item(ns) com código definido esperam assinatura há mais de "
            . self::LIMITE_LIBERACAO . 'h. Nenhuma peça é separada antes disso.',
            route('pecas.atendimento')
        );
    }

    /** Passo 5: caixa com peça dentro e nenhuma viagem marcada. */
    private function cobrarBasquetaSemRota(): int
    {
        $paradas = Basqueta::abertas()
            ->whereNull('schedule_id')
            ->with('local:id,nome')
            ->get()
            ->filter(fn (Basqueta $b) => $b->totalUnidades() > 0
                && $this->deveCobrar($b->created_at, self::LIMITE_SEM_ROTA_DIAS * 24));

        if ($paradas->isEmpty()) {
            return 0;
        }

        $nomes = $paradas->map(fn ($b) => $b->local->nome ?? "#{$b->id}")->take(5)->implode(', ');

        return $this->notificar(
            $this->equipeCd(),
            'Basquetas sem viagem marcada 📦',
            "{$paradas->count()} caixa(s) com peça separada há mais de " . self::LIMITE_SEM_ROTA_DIAS
            . " dias sem rota: {$nomes}. Esse saldo está reservado e não sai do CD.",
            route('pecas.basquetas')
        );
    }

    /**
     * Passo 7 / Gate 2: a caixa está faturada e o caminhão espera a filial.
     *
     * É a cobrança mais urgente das quatro — as outras atrasam um pedido, esta
     * segura uma carga inteira. Por isso vai também por push, e não só no sino.
     */
    private function cobrarConferencia(): int
    {
        $aguardando = Basqueta::where('status', Basqueta::STATUS_FATURADA)
            ->whereNull('conferida_em')
            ->with('local:id,nome')
            ->get()
            ->filter(fn (Basqueta $b) => $this->deveCobrar($b->esvaziada_em, self::LIMITE_CONFERENCIA));

        $enviadas = 0;

        foreach ($aguardando as $basqueta) {
            $horas = (int) abs(now()->diffInHours($basqueta->esvaziada_em));

            $destinatarios = User::where('estoque_local_id', $basqueta->estoque_local_id)->get();

            $titulo = 'Romaneio de peças esperando sua conferência ⏳';
            $mensagem = "A caixa da sua loja está faturada há {$horas}h e não pode ser despachada "
                      . 'sem a sua conferência.';
            $link = route('pecas.basquetas.romaneio', $basqueta->id);

            $enviadas += $this->notificar($destinatarios, $titulo, $mensagem, $link);
            $this->empurrar($destinatarios, $titulo, $mensagem, $link);

            // O CD precisa saber que a carga dele está presa esperando a loja.
            $enviadas += $this->notificar(
                $this->equipeCd(),
                'Carga presa aguardando conferência 🚧',
                ($basqueta->local->nome ?? "Basqueta #{$basqueta->id}")
                . " não confere o romaneio há {$horas}h.",
                route('pecas.basquetas')
            );
        }

        return $enviadas;
    }

    // ------------------------------------------------------------------

    /**
     * Cobra ao cruzar o limite e depois a cada 2 dias.
     *
     * Depende de o comando rodar uma vez por dia. Rodar duas vezes duplica a
     * cobrança do dia; não rodar num dia apenas pula aquele ciclo.
     */
    private function deveCobrar(?Carbon $desde, int $limiteHoras): bool
    {
        if (! $desde) {
            return false;
        }

        $idade = abs(now()->diffInHours($desde));

        if ($idade < $limiteHoras) {
            return false;
        }

        return intdiv((int) ($idade - $limiteHoras), 24) % 2 === 0;
    }

    private function equipeCd()
    {
        return User::whereIn('perfil', ['cd', 'admin'])->get();
    }

    private function notificar($destinatarios, string $titulo, string $mensagem, string $link): int
    {
        if ($destinatarios->isEmpty()) {
            return 0;
        }

        $this->line("  → {$titulo} ({$destinatarios->count()} destinatário(s))");
        $this->line("    {$mensagem}");

        if ($this->dry) {
            return 0;
        }

        foreach ($destinatarios as $user) {
            $user->notify(new PedidoAtualizado($titulo, $mensagem, $link));
        }

        return $destinatarios->count();
    }

    /**
     * Push além do sino. Falha de push nunca derruba a cobrança: a notificação
     * no banco já foi gravada e é a fonte de verdade.
     */
    private function empurrar($destinatarios, string $titulo, string $mensagem, string $link): void
    {
        if ($this->dry) {
            return;
        }

        $ids = $destinatarios->pluck('onesignal_id')->filter()->values()->all();

        if (! $ids) {
            return;
        }

        try {
            (new OneSignalService())->sendToUser($ids, $titulo, $mensagem, $link);
        } catch (\Throwable $e) {
            Log::warning('Falha no push de cobrança de peças', ['erro' => $e->getMessage()]);
        }
    }
}
