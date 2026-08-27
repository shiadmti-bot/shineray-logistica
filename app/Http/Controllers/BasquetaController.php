<?php

namespace App\Http\Controllers;

use App\Models\Basqueta;
use App\Models\BasquetaNota;
use App\Models\EstoqueLocal;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\User;
use App\Services\ArquivoComprovante;
use App\Services\OneSignalService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

/**
 * O olho do CD na prateleira — Passo 4 do manual.
 *
 * Uma pergunta que o sistema não sabia responder: "o que está acumulado para
 * Castanhal e desde quando?". Antes só dava para descobrir varrendo pedidos em
 * 'separado' e agrupando por destino na cabeça.
 *
 * A tela também é o alarme de peça parada. Peça em basqueta é saldo RESERVADO:
 * some do disponível do CD sem ter saído do galpão. Se a filial não tem viagem
 * marcada, esse saldo fica preso indefinidamente e ninguém percebe — por isso a
 * idade do item mais antigo aparece em destaque.
 */
class BasquetaController extends Controller
{
    /** A partir de quantos dias uma basqueta sem viagem vira alerta. */
    private const DIAS_PARA_ALERTA = 7;

    public function index()
    {
        $this->autorizarCd();

        /*
         * Não só as abertas: faturada e liberada também precisam aparecer, ou
         * a caixa sumiria da tela do CD exatamente no trecho em que ele mais
         * acompanha — entre o faturamento e o embarque, esperando a conferência
         * da filial. Some só quando é despachada, que é quando deixa o galpão.
         */
        $basquetas = Basqueta::whereIn('status', [
                ...Basqueta::ABERTAS,
                Basqueta::STATUS_FATURADA,
                Basqueta::STATUS_LIBERADA,
            ])
            ->with([
                'local:id,nome',
                'viagem:id,date,status',
                'itens' => fn ($q) => $q->where('qtd_atribuida', '>', 0),
                'itens.peca:id,codigo,descricao,unidade',
                'itens.pedido:id,user_id',
                'itens.pedido.user:id,name,filial',
            ])
            ->get()
            ->map(fn (Basqueta $b) => $this->serializar($b))
            // Mais antigas primeiro: é onde está o saldo preso há mais tempo.
            ->sortByDesc('dias_espera')
            ->values();

        /*
         * Filiais habilitadas que ainda não têm basqueta aberta aparecem
         * vazias, em vez de simplesmente sumirem. "Castanhal sem nada" é uma
         * informação; a ausência da linha seria uma dúvida.
         */
        $comBasqueta = $basquetas->pluck('local_id')->all();

        $vazias = EstoqueLocal::filiaisDePeca()
            ->whereNotIn('id', $comBasqueta)
            ->orderBy('nome')
            ->get(['id', 'nome'])
            ->map(fn ($l) => ['local_id' => $l->id, 'local' => $l->nome]);

        return Inertia::render('Pecas/Basquetas', [
            'basquetas'    => $basquetas,
            'vazias'       => $vazias,
            'diasAlerta'   => self::DIAS_PARA_ALERTA,
        ]);
    }

    /**
     * Passo 6 — recolhe a basqueta, registra a NF e gera o romaneio de peças.
     *
     * É aqui que a caixa deixa de aceitar peça nova. Depois disto, incluir um
     * item exige o ciclo de ajuste do Passo 7: cancelar a nota e emitir outra.
     *
     * A emissão fiscal continua no Microwork — o que se registra é o vínculo.
     */
    public function faturar(Request $request, Basqueta $basqueta)
    {
        $this->autorizarCd();

        $dados = $request->validate([
            'numero'      => ['required', 'string', 'max:30'],
            'serie'       => ['nullable', 'string', 'max:10'],
            'chave'       => ['nullable', 'string', 'size:44'],
            'valor_total' => ['nullable', 'numeric', 'min:0'],
            'volumes'     => ['required', 'integer', 'min:1', 'max:999'],
        ], [
            'numero.required' => 'Informe o número da NF emitida no Microwork.',
            'chave.size'      => 'A chave da NF-e tem 44 dígitos.',
            'volumes.required'=> 'Informe quantas caixas foram embaladas.',
        ]);

        if (! $basqueta->estaAberta()) {
            return back()->withErrors(['geral' => 'Esta basqueta já foi faturada.']);
        }

        if ($basqueta->totalUnidades() < 1) {
            return back()->withErrors(['geral' => 'Basqueta vazia — não há o que faturar.']);
        }

        // Refaturamento depois de um ajuste: a nota anterior já foi cancelada
        // em ajustar(), e o romaneio precisa subir de versão para que a filial
        // saiba que a via na mão dela venceu.
        $refaturando = $basqueta->status === Basqueta::STATUS_AJUSTE;

        DB::transaction(function () use ($basqueta, $dados, $refaturando) {
            if ($refaturando) {
                $basqueta->increment('romaneio_versao');
                $basqueta->refresh();
            }

            BasquetaNota::create([
                'basqueta_id' => $basqueta->id,
                'numero'      => $dados['numero'],
                'serie'       => $dados['serie'] ?? null,
                'chave'       => $dados['chave'] ?? null,
                'valor_total' => $dados['valor_total'] ?? $basqueta->valorEstimado(),
                'emitida_em'  => now(),
                'emitida_por' => Auth::id(),
            ]);

            $basqueta->update(['volumes' => $dados['volumes']]);

            // fechar() zera local_aberto_id: a filial fica livre para abrir a
            // próxima caixa enquanto esta segue para conferência e despacho.
            $basqueta->fechar(Basqueta::STATUS_FATURADA);

            $this->registrarNosPedidos(
                $basqueta,
                'Basqueta faturada 🧾',
                "NF {$dados['numero']} emitida · {$dados['volumes']} volume(s). "
                . 'O romaneio de peças foi enviado para conferência.'
            );
        });

        $this->avisarFilial($basqueta);

        return back()->with('success', "Basqueta #{$basqueta->id} faturada. Romaneio de peças disponível.");
    }

    /**
     * GATE 2 — a filial confere e libera (Passo 7, desfecho bom).
     *
     * A segunda metade da regra: "nenhuma embalagem é despachada sem a dupla
     * confirmação do Pós-Venda". Só depois disto a caixa aparece na mesa de
     * montagem — a trava real está em RomaneioController::embarcarPecas.
     *
     * A foto do romaneio assinado é obrigatória. É ela que transforma "a loja
     * disse que conferiu" em evidência, do mesmo jeito que o canhoto faz no
     * fluxo de moto.
     */
    public function conferir(Request $request, Basqueta $basqueta)
    {
        $this->autorizarConferente($basqueta);

        $dados = $request->validate([
            'foto'       => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'observacao' => ['nullable', 'string', 'max:500'],
        ], [
            'foto.required' => 'Anexe a foto do romaneio conferido — é o comprovante da liberação.',
            'foto.max'      => 'A foto passou de 10 MB. Tire outra com resolução menor.',
        ]);

        if ($basqueta->status !== Basqueta::STATUS_FATURADA) {
            return back()->withErrors([
                'geral' => 'Só uma basqueta faturada pode ser conferida. Esta está como: ' . $basqueta->status,
            ]);
        }

        // Fora da transação: o upload é I/O externo e lento, e segurá-lo dentro
        // de uma transação prende linha de banco à espera de rede.
        $url = app(ArquivoComprovante::class)->guardar(
            $dados['foto'],
            'romaneios-peca',
            "basqueta_{$basqueta->id}_v{$basqueta->romaneio_versao}"
        );

        DB::transaction(function () use ($basqueta, $dados, $url) {
            $basqueta->update([
                'status'                 => Basqueta::STATUS_LIBERADA,
                'conferida_em'           => now(),
                'conferida_por'          => Auth::id(),
                'foto_romaneio_url'      => $url,
                'conferencia_observacao' => $dados['observacao'] ?? null,
            ]);

            $this->registrarNosPedidos(
                $basqueta,
                'Romaneio conferido pela filial ✅',
                Auth::user()->name . ' conferiu o romaneio de peças e liberou o despacho.'
                . (($dados['observacao'] ?? null) ? " Obs: {$dados['observacao']}" : '')
            );
        });

        return back()->with('success', 'Romaneio liberado. A caixa já pode entrar numa carga.');
    }

    /**
     * GATE 2 — a filial acusa falta (Passo 7, desfecho de ajuste).
     *
     * O manual: "a equipe do estoque abre novamente a caixa, insere o item
     * faltante, atualiza e emite uma nova Nota Fiscal e ajusta o romaneio".
     *
     * Três coisas acontecem juntas e precisam ser atômicas: a nota vigente é
     * cancelada, a caixa volta a aceitar peça e o pedido volta a poder ser
     * separado. Cancelar a nota sem reabrir a caixa deixaria mercadoria sem
     * cobertura fiscal e sem caminho de correção.
     */
    public function ajustar(Request $request, Basqueta $basqueta)
    {
        $this->autorizarConferente($basqueta);

        $dados = $request->validate([
            'motivo' => ['required', 'string', 'max:500'],
        ], [
            'motivo.required' => 'Diga o que faltou ou veio errado — é o que o CD vai corrigir.',
        ]);

        if ($basqueta->status !== Basqueta::STATUS_FATURADA) {
            return back()->withErrors([
                'geral' => 'Só uma basqueta faturada pode ser devolvida para ajuste.',
            ]);
        }

        DB::transaction(function () use ($basqueta, $dados) {
            $nota = $basqueta->notaVigente();

            if ($nota) {
                $nota->update([
                    'cancelada_em'        => now(),
                    'cancelada_por'       => Auth::id(),
                    'motivo_cancelamento' => 'Ajuste solicitado na conferência: ' . $dados['motivo'],
                ]);
            }

            $basqueta->reabrirParaAjuste($dados['motivo']);

            /*
             * Os pedidos voltam para 'separado'. Sem isso eles ficariam em
             * 'aguardando_coleta' ou adiante, e a tela do pedido não ofereceria
             * separar o item que falta.
             */
            $pedidoIds = $basqueta->itens()->distinct()->pluck('pedido_id');

            Pedido::whereIn('id', $pedidoIds)
                ->whereNotIn('status', ['concluido', 'cancelado', 'rejeitado'])
                ->update(['status' => 'separado', 'romaneio_id' => null]);

            $this->registrarNosPedidos(
                $basqueta,
                'Ajuste solicitado na conferência ↩️',
                Auth::user()->name . ' acusou divergência: ' . $dados['motivo']
                . ($nota ? " A NF {$nota->rotulo} foi cancelada e precisa ser reemitida." : '')
            );
        });

        return back()->with('success', 'Basqueta reaberta para ajuste. Inclua o item e fature novamente.');
    }

    /**
     * O romaneio de peças — o documento que vai à conferência do Passo 7.
     *
     * Nasce aqui, e não junto com o manifesto da carga, porque os dois têm
     * momentos diferentes: este sai quando a rota é confirmada e a caixa é
     * faturada; o manifesto sai no dia, na montagem.
     */
    public function romaneio(Basqueta $basqueta)
    {
        $this->autorizarVer($basqueta);

        $basqueta->load([
            'local:id,nome',
            'viagem:id,date',
            'conferidaPor:id,name',
            'itens' => fn ($q) => $q->where('qtd_atribuida', '>', 0),
            'itens.peca:id,codigo,descricao,unidade',
            'itens.pedido:id,user_id',
            'itens.pedido.user:id,name,filial',
        ]);

        $nota = $basqueta->notaVigente();

        $user = Auth::user();

        return Inertia::render('Pecas/RomaneioBasqueta', [
            // O Gate 2 só existe enquanto a caixa está faturada e ainda não
            // conferida. Depois de liberada ou despachada não há o que assinar.
            'podeConferir' => $basqueta->status === Basqueta::STATUS_FATURADA
                && (in_array($user->perfil, ['cd', 'admin'], true)
                    || $user->estoque_local_id === $basqueta->estoque_local_id),
            'basqueta' => [
                'id'       => $basqueta->id,
                'local'    => $basqueta->local->nome ?? '—',
                'status'   => $basqueta->status,
                'volumes'  => $basqueta->volumes,
                'versao'   => $basqueta->romaneio_versao,
                'viagem'   => $basqueta->viagem?->date,
                'total_un' => $basqueta->totalUnidades(),
                'ajuste_motivo'  => $basqueta->ajuste_motivo,
                'conferida_em'   => $basqueta->conferida_em,
                'conferida_por'  => $basqueta->conferidaPor?->name,
                'foto'           => $basqueta->foto_romaneio_url,
                'nota'     => $nota ? [
                    'rotulo' => $nota->rotulo,
                    'chave'  => $nota->chave,
                    'valor'  => $nota->valor_total,
                    'em'     => $nota->emitida_em,
                ] : null,
                'itens'    => $basqueta->itens->map(fn ($i) => [
                    'id'         => $i->id,
                    'pedido_id'  => $i->pedido_id,
                    'solicitante'=> $i->pedido?->user?->name,
                    'codigo'     => $i->peca?->codigo ?? '—',
                    'descricao'  => $i->peca?->descricao ?? $i->descricao_solicitada ?? 'Peça',
                    'unidade'    => $i->peca?->unidade ?? 'UN',
                    'quantidade' => $i->qtd_atribuida,
                    'preco'      => $i->preco_unitario,
                ])->values(),
            ],
        ]);
    }

    // ------------------------------------------------------------------

    /**
     * Registra o evento no histórico de todos os pedidos que têm cota na caixa.
     *
     * A basqueta reúne pedidos de lojas diferentes? Não — de solicitantes
     * diferentes da MESMA loja. Mas cada um acompanha o próprio pedido, então o
     * log precisa aparecer em todos.
     */
    private function registrarNosPedidos(Basqueta $basqueta, string $titulo, string $descricao): void
    {
        $pedidoIds = $basqueta->itens()->distinct()->pluck('pedido_id');

        foreach ($pedidoIds as $pedidoId) {
            PedidoLog::create([
                'pedido_id' => $pedidoId,
                'user_id'   => Auth::id(),
                'titulo'    => $titulo,
                'descricao' => $descricao,
            ]);
        }
    }

    /**
     * Avisa a filial que o romaneio chegou para conferência.
     *
     * Fora da transação de propósito: falha de push não pode desfazer um
     * faturamento já gravado.
     */
    private function avisarFilial(Basqueta $basqueta): void
    {
        $destino = User::where('estoque_local_id', $basqueta->estoque_local_id)
            ->whereNotNull('onesignal_id')
            ->pluck('onesignal_id')
            ->all();

        if (! $destino) {
            return;
        }

        try {
            (new OneSignalService())->sendToUser(
                $destino,
                'Romaneio de peças para conferência 📦',
                "A caixa da sua loja foi faturada com {$basqueta->totalUnidades()} unidade(s). Confira antes do despacho.",
                route('pecas.basquetas.romaneio', $basqueta->id)
            );
        } catch (\Throwable $e) {
            Log::warning('Falha ao notificar romaneio de peças', [
                'basqueta' => $basqueta->id,
                'erro'     => $e->getMessage(),
            ]);
        }
    }

    private function serializar(Basqueta $b): array
    {
        $dias = $b->diasEmEspera();

        return [
            'id'          => $b->id,
            'local_id'    => $b->estoque_local_id,
            'local'       => $b->local->nome ?? 'Filial removida',
            'status'      => $b->status,
            'aberta'      => $b->estaAberta(),
            'nota'        => $b->notaVigente()?->rotulo,
            'conferida'   => $b->conferida_em !== null,
            'ajuste_motivo' => $b->ajuste_motivo,
            'dias_espera' => $dias,
            // Sem viagem marcada e parada há dias: o CD precisa agendar a rota
            // ou o saldo continua preso.
            'em_alerta'   => ! $b->schedule_id && $dias >= self::DIAS_PARA_ALERTA,
            'viagem'      => $b->viagem ? [
                'id'     => $b->viagem->id,
                'data'   => $b->viagem->date,
                'status' => $b->viagem->status,
            ] : null,
            'total_un'    => (int) $b->itens->sum('qtd_atribuida'),
            'itens'       => $b->itens->map(fn ($i) => [
                'id'         => $i->id,
                'pedido_id'  => $i->pedido_id,
                'solicitante'=> $i->pedido?->user?->name,
                'codigo'     => $i->peca?->codigo ?? '—',
                'descricao'  => $i->peca?->descricao ?? $i->descricao_solicitada ?? 'Peça',
                'unidade'    => $i->peca?->unidade ?? 'UN',
                'quantidade' => $i->qtd_atribuida,
                'desde'      => $i->updated_at,
            ])->values(),
        ];
    }

    private function autorizarCd(): void
    {
        if (! in_array(Auth::user()->perfil, ['cd', 'admin', 'gestor'], true)) {
            abort(403, 'Apenas o Estoque Central vê as basquetas.');
        }
    }

    /**
     * O romaneio de peças é o único documento da basqueta que a FILIAL precisa
     * ver — é ela quem confere antes do despacho (Passo 7). Por isso a regra
     * aqui é mais larga que a do resto do controller.
     */
    private function autorizarVer(Basqueta $basqueta): void
    {
        $user = Auth::user();

        if (in_array($user->perfil, ['cd', 'admin', 'gestor'], true)) {
            return;
        }

        if ($user->estoque_local_id !== $basqueta->estoque_local_id) {
            abort(403, 'Esta basqueta não é da sua loja.');
        }
    }

    /**
     * Quem assina o Gate 2 é a LOJA QUE RECEBE — não os validadores do Gate 1.
     *
     * São confirmações diferentes por desenho: a primeira é do lado que envia,
     * sobre o código estar certo; esta é do lado que recebe, sobre a caixa
     * estar completa. Por isso aqui vale o escopo de destino, e não a
     * atribuição `valida_pecas`.
     *
     * O CD entra junto porque em filial pequena o mesmo caminhão que leva traz
     * a conferência por telefone — e alguém precisa poder registrar. Admin
     * entra por herança, como em todo o resto.
     */
    private function autorizarConferente(Basqueta $basqueta): void
    {
        $user = Auth::user();

        if (in_array($user->perfil, ['cd', 'admin'], true)) {
            return;
        }

        if ($user->estoque_local_id !== $basqueta->estoque_local_id) {
            abort(403, 'Só a filial de destino confere este romaneio.');
        }
    }
}
