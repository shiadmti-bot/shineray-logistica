<?php

namespace App\Http\Controllers;

use App\Models\EstoqueLocal;
use App\Models\Peca;
use App\Models\PecaEstoque;
use App\Models\PecaMovimento;
use App\Models\PedidoLog;
use App\Models\RomaneioItem;
use App\Services\Estoque\EstoquePecaService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Fila de pendências do CD e painel de reposição.
 *
 * Duas perguntas operacionais que o sistema passa a responder sozinho:
 *   1. "O que deu errado e ainda não foi resolvido?"  -> divergências abertas
 *   2. "O que preciso repor antes de faltar?"          -> saldo abaixo do mínimo
 */
class PecaPendenciaController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();
        $ehCd = in_array($user->perfil, ['cd', 'admin', 'gestor'], true);

        $local = $ehCd
            ? ($request->integer('local') ? EstoqueLocal::find($request->integer('local')) : EstoqueLocal::cd())
            : EstoqueLocal::find($user->estoque_local_id);

        return Inertia::render('Pecas/Pendencias', [
            'divergencias' => $this->divergencias($user, $ehCd),
            'reposicao'    => $this->reposicao($local?->id),
            'local'        => $local ? ['id' => $local->id, 'nome' => $local->nome] : null,
            'locais'       => $ehCd
                ? EstoqueLocal::ativos()->orderByRaw("tipo = 'loja'")->orderBy('nome')->get(['id', 'nome'])
                : [],
            'podeResolver' => in_array($user->perfil, ['cd', 'admin'], true),
        ]);
    }

    /**
     * Divergências de recebimento ainda sem decisão.
     *
     * A loja vê só as suas; o CD vê todas, porque é quem resolve.
     */
    private function divergencias($user, bool $ehCd)
    {
        return RomaneioItem::with([
                'itemable:id,codigo,descricao,unidade',
                'pedido:id,user_id,local_destino_id',
                'pedido.user:id,name,filial',
                'destino:id,nome',
                'romaneio:id,motorista,placa',
            ])
            ->pecas()
            ->divergenciasAbertas()
            ->when(! $ehCd, fn ($q) => $q->where('local_destino_id', $user->estoque_local_id))
            ->latest('entregue_em')
            ->limit(100)
            ->get()
            ->map(fn (RomaneioItem $i) => [
                'id'         => $i->id,
                'codigo'     => $i->itemable?->codigo,
                'descricao'  => $i->itemable?->descricao,
                'unidade'    => $i->itemable?->unidade,
                'enviado'    => $i->quantidade,
                'recebido'   => $i->quantidade_recebida,
                'diferenca'  => $i->diferenca(),
                'pedido_id'  => $i->pedido_id,
                'loja'       => $i->destino?->nome ?? $i->pedido?->user?->filial,
                'carga'      => $i->romaneio_id,
                'motorista'  => $i->romaneio?->motorista,
                'quando'     => $i->entregue_em?->format('d/m/Y H:i'),
            ]);
    }

    /**
     * Peças abaixo do ponto de reposição no local.
     *
     * `sugestao` é quanto pedir para voltar ao dobro do mínimo — um alvo simples
     * e previsível. Não tenta ser esperto: sem histórico de consumo consolidado,
     * uma fórmula elaborada daria falsa precisão.
     */
    private function reposicao(?int $localId): array
    {
        if (! $localId) {
            return [];
        }

        return PecaEstoque::with('peca:id,codigo,descricao,unidade,marca')
            ->where('local_id', $localId)
            ->abaixoDoMinimo()
            ->get()
            ->map(function (PecaEstoque $e) {
                $disponivel = $e->disponivel;
                $alvo = $e->saldo_minimo * 2;

                return [
                    'peca_id'    => $e->peca_id,
                    'codigo'     => $e->peca?->codigo,
                    'descricao'  => $e->peca?->descricao,
                    'unidade'    => $e->peca?->unidade,
                    'disponivel' => $disponivel,
                    'minimo'     => $e->saldo_minimo,
                    'sugestao'   => max(1, $alvo - $disponivel),
                    'zerado'     => $disponivel <= 0,
                ];
            })
            ->sortBy([['zerado', 'desc'], ['disponivel', 'asc']])
            ->values()
            ->all();
    }

    /**
     * CD decide o destino de uma divergência.
     *
     * Cada resolução tem consequência distinta no estoque — por isso não é só
     * marcar como lida:
     *   erro_contagem -> a peça está na loja; o saldo precisa ser corrigido lá.
     *   perda         -> extraviou entre CD e loja; ninguém fica com ela.
     *   reenvio       -> o CD ainda deve; o saldo dele já está correto.
     *   aceito        -> diferença absorvida, sem movimento.
     */
    public function resolver(Request $request, RomaneioItem $item)
    {
        $dados = $request->validate([
            'resolucao'  => ['required', 'in:reenvio,perda,erro_contagem,aceito'],
            'observacao' => ['nullable', 'string', 'max:500'],
        ]);

        if (! in_array(Auth::user()->perfil, ['cd', 'admin'], true)) {
            abort(403, 'Apenas o CD resolve divergências.');
        }

        if ($item->resolvido_em) {
            return back()->withErrors(['geral' => 'Esta pendência já foi resolvida.']);
        }

        $faltou = abs($item->diferenca());

        DB::transaction(function () use ($item, $dados, $faltou) {
            // erro_contagem: a loja achou a peça depois. Ela está lá, então o
            // saldo da loja precisa refletir isso — as outras resoluções não
            // movem estoque, porque o recebimento já acertou os saldos.
            if ($dados['resolucao'] === RomaneioItem::RESOLUCAO_ERRO_CONTAGEM && $faltou > 0) {
                app(EstoquePecaService::class)->darEntrada(
                    peca: $item->itemable,
                    localId: $item->local_destino_id,
                    quantidade: $faltou,
                    observacao: "Recontagem da divergência do pedido #{$item->pedido_id}",
                    tipo: PecaMovimento::TIPO_AJUSTE,
                );
            }

            $item->update([
                'resolvido_em'         => now(),
                'resolvido_por'        => Auth::id(),
                'resolucao'            => $dados['resolucao'],
                'resolucao_observacao' => $dados['observacao'],
                // Erro de contagem significa que a entrega estava correta.
                'status'               => $dados['resolucao'] === RomaneioItem::RESOLUCAO_ERRO_CONTAGEM
                    ? RomaneioItem::STATUS_ENTREGUE
                    : $item->status,
            ]);

            if ($item->pedido_id) {
                PedidoLog::create([
                    'pedido_id' => $item->pedido_id,
                    'titulo'    => 'Divergência resolvida',
                    'descricao' => Auth::user()->name . ' registrou: ' . $this->rotuloResolucao($dados['resolucao'])
                                 . ($dados['observacao'] ? " — {$dados['observacao']}" : ''),
                ]);
            }
        });

        return back()->with('success', 'Pendência resolvida.');
    }

    /**
     * Define o ponto de reposição de uma peça no local.
     */
    public function definirMinimo(Request $request)
    {
        $dados = $request->validate([
            'peca_id'  => ['required', 'exists:pecas,id'],
            'local_id' => ['required', 'exists:estoque_locais,id'],
            'minimo'   => ['required', 'integer', 'min:0', 'max:9999'],
        ]);

        $user = Auth::user();

        if ($user->perfil === 'loja' && $user->estoque_local_id !== $dados['local_id']) {
            abort(403, 'Você só define o mínimo da sua própria loja.');
        }

        // firstOrCreate: definir mínimo de peça que ainda não tem saldo no local
        // é legítimo — é justamente como se sinaliza "quero passar a estocar".
        PecaEstoque::firstOrCreate(
            ['peca_id' => $dados['peca_id'], 'local_id' => $dados['local_id']],
            ['saldo' => 0, 'saldo_reservado' => 0]
        )->update(['saldo_minimo' => $dados['minimo']]);

        return back()->with('success', 'Ponto de reposição atualizado.');
    }

    /**
     * Sugere o mínimo a partir do consumo real registrado no ledger.
     *
     * Base: saídas dos últimos 90 dias. Devolve a média mensal — o usuário
     * decide se adota. Sem consumo registrado, não inventa número.
     */
    public function sugerirMinimo(Request $request)
    {
        $localId = $request->integer('local_id');
        $dias = 90;

        $consumo = PecaMovimento::query()
            ->select('peca_id', DB::raw('SUM(ABS(quantidade)) as total'))
            ->where('local_id', $localId)
            ->whereIn('tipo', [PecaMovimento::TIPO_SAIDA, PecaMovimento::TIPO_TRANSFERENCIA])
            ->where('quantidade', '<', 0)
            ->where('created_at', '>=', now()->subDays($dias))
            ->groupBy('peca_id')
            ->pluck('total', 'peca_id');

        $sugestoes = $consumo->map(fn ($total) => (int) ceil($total / ($dias / 30)));

        return response()->json([
            'base_dias'  => $dias,
            'sugestoes'  => $sugestoes,
            'observacao' => $sugestoes->isEmpty()
                ? 'Ainda não há consumo registrado neste local para calcular sugestão.'
                : 'Média mensal de consumo dos últimos 90 dias.',
        ]);
    }

    private function rotuloResolucao(string $r): string
    {
        return [
            'reenvio'       => 'será reenviado',
            'perda'         => 'perda/extravio',
            'erro_contagem' => 'erro de contagem — peça localizada na loja',
            'aceito'        => 'diferença aceita',
        ][$r] ?? $r;
    }
}
