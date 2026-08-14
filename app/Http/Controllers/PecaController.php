<?php

namespace App\Http\Controllers;

use App\Models\EstoqueLocal;
use App\Models\Peca;
use App\Models\PecaEstoque;
use App\Services\Pecas\CatalogoModelos;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/**
 * Estoque de peças.
 *
 * Primeira tela do módulo — valida a fundação (catálogo + saldo por local +
 * ledger) de ponta a ponta. As ações de escrita (entrada, transferência,
 * inventário) entram nas próximas telas e devem passar sempre pelo
 * EstoquePecaService, nunca gravar em peca_estoques direto.
 */
class PecaController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();

        // Loja enxerga apenas o próprio estoque; CD/admin/gestor escolhem o local.
        $locais = EstoqueLocal::ativos()->orderByRaw("tipo = 'loja'")->orderBy('nome')->get();

        $localSelecionado = $this->resolverLocal($request, $user, $locais);

        /*
         * A listagem parte do CATÁLOGO, não da tabela de saldo.
         *
         * O catálogo vem do Microwork (2.385 peças) e o saldo é construído
         * localmente por entrada/inventário — então a maioria das peças começa
         * sem linha em peca_estoques. Partir do saldo mostraria uma tela vazia
         * e esconderia o catálogo inteiro; o LEFT JOIN mostra a peça com zero.
         */
        $query = Peca::query()
            ->where('pecas.ativo', true)
            ->leftJoin('peca_estoques', function ($join) use ($localSelecionado) {
                $join->on('peca_estoques.peca_id', '=', 'pecas.id')
                     ->where('peca_estoques.local_id', '=', $localSelecionado);
            })
            ->select([
                'pecas.*',
                'peca_estoques.id as estoque_id',
                'peca_estoques.saldo',
                'peca_estoques.saldo_reservado',
                'peca_estoques.saldo_minimo',
            ]);

        if ($busca = trim((string) $request->input('busca'))) {
            $query->busca($busca);
        }

        // Filtro por família de modelo — o principal ganho para quem monta um
        // pedido: "me mostre tudo que serve na JEF".
        if ($modelo = $request->input('modelo')) {
            $query->paraModelo($modelo);
        }

        if ($request->boolean('apenas_criticos')) {
            $query->whereNotNull('peca_estoques.id')
                  ->where('peca_estoques.saldo_minimo', '>', 0)
                  ->whereRaw('(peca_estoques.saldo - peca_estoques.saldo_reservado) <= peca_estoques.saldo_minimo');
        }

        if ($request->boolean('apenas_com_saldo')) {
            $query->where('peca_estoques.saldo', '>', 0);
        }

        $estoques = $query
            ->with([
                'aplicacoes' => fn ($q) => $q->orderBy('familia')->orderBy('cilindrada'),
                // Onde a peça existe segundo o Microwork — orienta quem separa
                // e transfere. Carregado só para a página atual.
                'saldosExternos' => fn ($q) => $q->comSaldo()->with('empresa')->orderByDesc('saldo'),
            ])
            ->orderBy('pecas.descricao')
            ->paginate(30)
            ->withQueryString()
            ->through(function (Peca $p) {
                $saldo     = (int) ($p->saldo ?? 0);
                $reservado = (int) ($p->saldo_reservado ?? 0);
                $minimo    = (int) ($p->saldo_minimo ?? 0);
                $disponivel = max(0, $saldo - $reservado);

                return [
                    'id'               => $p->estoque_id,
                    'peca_id'          => $p->id,
                    'codigo'           => $p->codigo,
                    'descricao'        => $p->descricao,
                    'unidade'          => $p->unidade,
                    'categoria'        => $p->marca ?: $p->categoria,
                    'aplicacao'        => $p->aplicacao,
                    'tipo_item'        => $p->tipo_item,
                    // Modelos em que serve, já com a procedência: a tela precisa
                    // distinguir cadastro oficial de dedução.
                    'modelos'          => $p->aplicacoes->map(fn ($a) => [
                        'label'     => $a->modelo,
                        'familia'   => $a->familia,
                        'confiavel' => $a->isConfiavel(),
                    ])->values(),
                    // Onde a peça existe fisicamente, segundo o Microwork.
                    // `agrupado` avisa que o número cobre mais de um ponto.
                    'onde_tem'         => $p->saldosExternos->map(fn ($s) => [
                        'local'     => $s->empresa?->rotulo ?? "Empresa {$s->codigo_empresa}",
                        'saldo'     => $s->saldo,
                        'agrupado'  => (bool) $s->empresa?->isAgrupada(),
                        'detalhe'   => $s->empresa?->agrupa,
                    ])->values(),
                    'preco'            => $p->preco_referencia,
                    'saldo'            => $saldo,
                    'reservado'        => $reservado,
                    'disponivel'       => $disponivel,
                    'minimo'           => $minimo,
                    'abaixo_do_minimo' => $minimo > 0 && $disponivel <= $minimo,
                ];
            });

        return Inertia::render('Pecas/Index', [
            'estoques'   => $estoques,
            'locais'     => $locais->map(fn ($l) => ['id' => $l->id, 'nome' => $l->nome, 'tipo' => $l->tipo]),
            'localAtual' => $localSelecionado,
            'podeEscolherLocal' => in_array($user->perfil, ['admin', 'cd', 'gestor'], true),
            'filtros'    => [
                'busca'           => $request->input('busca', ''),
                'modelo'          => $request->input('modelo', ''),
                'apenas_criticos' => $request->boolean('apenas_criticos'),
            ],
            // Famílias que realmente têm peça vinculada — oferecer um modelo
            // sem nenhuma peça só gera busca vazia.
            'modelos'    => $this->familiasComPecas(),
            'resumo'     => $this->resumo($localSelecionado),
        ]);
    }

    /**
     * Local cujo estoque será exibido.
     * Loja fica presa ao próprio local — não escolhe e não vê o das outras.
     */
    private function resolverLocal(Request $request, $user, $locais): ?int
    {
        if ($user->perfil === 'loja') {
            return $user->estoque_local_id;
        }

        $solicitado = $request->integer('local');

        if ($solicitado && $locais->contains('id', $solicitado)) {
            return $solicitado;
        }

        return EstoqueLocal::cd()?->id;
    }

    /**
     * Famílias de modelo com pelo menos uma peça vinculada, para o filtro.
     *
     * @return array<int, array{valor:string, label:string, total:int}>
     */
    private function familiasComPecas(): array
    {
        return \App\Models\PecaAplicacao::query()
            ->selectRaw('familia, count(distinct peca_id) as total')
            ->groupBy('familia')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($r) => [
                'valor' => $r->familia,
                'label' => CatalogoModelos::label($r->familia),
                'total' => (int) $r->total,
            ])
            ->all();
    }

    private function resumo(?int $localId): array
    {
        $base = PecaEstoque::query()
            ->when($localId, fn ($q) => $q->where('local_id', $localId));

        return [
            // Catálogo é global; os demais números são do local selecionado.
            'catalogo'  => Peca::where('ativo', true)->count(),
            'skus'      => (clone $base)->where('saldo', '>', 0)->count(),
            'unidades'  => (int) (clone $base)->sum('saldo'),
            'reservado' => (int) (clone $base)->sum('saldo_reservado'),
            'criticos'  => (clone $base)->abaixoDoMinimo()->count(),
        ];
    }
}
