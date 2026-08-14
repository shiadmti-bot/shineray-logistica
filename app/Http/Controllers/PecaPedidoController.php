<?php

namespace App\Http\Controllers;

use App\Models\EstoqueLocal;
use App\Models\Peca;
use App\Models\PecaAplicacao;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\PedidoLog;
use App\Services\Pecas\CatalogoModelos;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Solicitação de peças da loja para o CD.
 *
 * Reaproveita a estrutura de pedido que já existe (Pedido + PedidoItem), com
 * tipo_carga='peca'. Nada de fluxo paralelo: aprovação, romaneio e recebimento
 * continuam sendo os mesmos do pedido de moto.
 */
class PecaPedidoController extends Controller
{
    public function create(Request $request)
    {
        $user = Auth::user();

        $query = Peca::query()
            ->where('ativo', true)
            ->with([
                'aplicacoes' => fn ($q) => $q->orderBy('familia'),
                'saldosExternos' => fn ($q) => $q->comSaldo()->with('empresa')->orderByDesc('saldo'),
            ]);

        if ($modelo = $request->input('modelo')) {
            $query->paraModelo($modelo);
        }

        if ($busca = trim((string) $request->input('busca'))) {
            $query->busca($busca);
        }

        // Sem filtro nenhum, 2.385 peças não ajudam ninguém a montar um pedido.
        // Exigir um ponto de partida é o que torna a tela usável.
        $temFiltro = $modelo || $busca;

        $pecas = $temFiltro
            ? $query->orderBy('descricao')->paginate(24)->withQueryString()->through(
                fn (Peca $p) => $this->serializar($p)
            )
            : null;

        return Inertia::render('Pecas/Solicitar', [
            'pecas'   => $pecas,
            'modelos' => $this->modelosDisponiveis(),
            'filtros' => [
                'modelo' => $modelo ?? '',
                'busca'  => $busca ?? '',
            ],
            'loja'    => [
                'nome'  => $user->filial ?: $user->name,
                'local' => $user->estoque_local_id,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $dados = $request->validate([
            'itens'              => ['required', 'array', 'min:1'],
            'itens.*.peca_id'    => ['required', 'exists:pecas,id'],
            'itens.*.quantidade' => ['required', 'integer', 'min:1', 'max:999'],
            'itens.*.motivo'     => ['nullable', 'string', 'max:255'],
            'observacao'         => ['nullable', 'string', 'max:1000'],
        ], [
            'itens.required' => 'Adicione ao menos uma peça ao pedido.',
        ]);

        $user = Auth::user();
        $cd = EstoqueLocal::cd();

        $pedido = DB::transaction(function () use ($dados, $user, $cd) {
            $pedido = Pedido::create([
                'user_id'          => $user->id,
                'tipo_carga'       => 'peca',
                'status'           => 'solicitado',
                'origem_user_id'   => null, // CD atende
                'local_origem_id'  => $cd?->id,
                'local_destino_id' => $user->estoque_local_id,
                'observacao'       => $dados['observacao'] ?? null,
                // `itens` (JSON) é mantido por compatibilidade com as telas
                // legadas de pedido, que leem esse campo diretamente.
                'itens'            => $this->resumoLegado($dados['itens']),
            ]);

            foreach ($dados['itens'] as $item) {
                $peca = Peca::find($item['peca_id']);

                PedidoItem::create([
                    'pedido_id'    => $pedido->id,
                    'tipo'         => 'peca',
                    'peca_id'      => $peca->id,
                    'modelo'       => null, // não se aplica a peça
                    'cor'          => null,
                    'motivo'       => $item['motivo'] ?? null,
                    'local'        => $user->filial,
                    'quantidade'   => $item['quantidade'],
                    'exige_chassi' => false,
                ]);
            }

            /*
             * Sem reserva de saldo aqui, de propósito.
             *
             * O saldo gerenciado de peças ainda é construído por inventário — o
             * do Microwork é agregado e não serve para reservar. Reservar sobre
             * saldo inexistente derrubaria toda solicitação. A reserva passa a
             * acontecer quando o CD separar, que é quando ele confirma que a
             * peça existe na prateleira.
             */

            $totalItens = collect($dados['itens'])->sum('quantidade');

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo'    => 'Solicitação de peças criada',
                'descricao' => "{$user->name} solicitou {$totalItens} unidade(s) em "
                             . count($dados['itens']) . ' item(ns) de peça.',
            ]);

            return $pedido;
        });

        return redirect()
            ->route('pedidos.show', $pedido->id)
            ->with('success', 'Solicitação de peças enviada ao CD.');
    }

    /**
     * Registra que uma peça serve (ou não) em um modelo.
     *
     * É assim que as 1.434 peças sem aplicação se resolvem: no uso, por quem
     * tem a peça na mão. Vínculo manual nasce com confiança alta e o sync
     * nunca o sobrescreve — ver ProcessarAplicacaoPecas.
     */
    public function confirmarAplicacao(Request $request, Peca $peca)
    {
        $dados = $request->validate([
            'familia' => ['required', 'string', 'max:40'],
            'serve'   => ['required', 'boolean'],
        ]);

        $familia = mb_strtoupper($dados['familia'], 'UTF-8');

        if (! array_key_exists($familia, CatalogoModelos::FAMILIAS)) {
            return back()->withErrors(['familia' => 'Modelo desconhecido.']);
        }

        if (! $dados['serve']) {
            // Não serve: remove o vínculo, inclusive um deduzido errado.
            $peca->aplicacoes()->where('familia', $familia)->delete();

            return back()->with('success', "Registrado: não serve em {$familia}.");
        }

        PecaAplicacao::updateOrCreate(
            [
                'peca_id'  => $peca->id,
                'familia'  => $familia,
                'modelo'   => CatalogoModelos::label($familia),
                'variante' => null,
            ],
            [
                'origem'       => PecaAplicacao::ORIGEM_MANUAL,
                'confianca'    => 'alta',
                'texto_origem' => 'Confirmado por ' . Auth::user()->name,
            ]
        );

        // Peça que ganhou aplicação deixa de ser "a confirmar".
        if ($peca->tipo_item === 'indefinido') {
            $peca->update(['tipo_item' => 'especifica']);
        }

        return back()->with('success', 'Aplicação confirmada. Obrigado — isso ajuda as outras lojas.');
    }

    private function serializar(Peca $p): array
    {
        return [
            'id'        => $p->id,
            'codigo'    => $p->codigo,
            'descricao' => $p->descricao,
            'unidade'   => $p->unidade,
            'marca'     => $p->marca,
            'preco'     => $p->preco_referencia,
            'tipo_item' => $p->tipo_item,
            'modelos'   => $p->aplicacoes->map(fn ($a) => [
                'label'     => $a->modelo,
                'familia'   => $a->familia,
                'confiavel' => $a->isConfiavel(),
            ])->values(),
            'onde_tem'  => $p->saldosExternos->map(fn ($s) => [
                'local'    => $s->empresa?->rotulo ?? "Empresa {$s->codigo_empresa}",
                'saldo'    => $s->saldo,
                'agrupado' => (bool) $s->empresa?->isAgrupada(),
            ])->values(),
        ];
    }

    /** @return array<int, array{valor:string, label:string, total:int}> */
    private function modelosDisponiveis(): array
    {
        return PecaAplicacao::query()
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

    /**
     * Resumo textual no formato que as telas antigas de pedido esperam em
     * `pedidos.itens`. Evita ter que alterar Pedidos/Index e Show agora.
     */
    private function resumoLegado(array $itens): array
    {
        return array_map(function (array $i) {
            $peca = Peca::find($i['peca_id']);

            return [
                'tipo'       => 'peca',
                'peca_id'    => $peca?->id,
                'modelo'     => $peca?->descricao ?? 'Peça',
                'cor'        => $peca?->codigo ?? '',
                'quantidade' => $i['quantidade'],
                'motivo'     => $i['motivo'] ?? null,
            ];
        }, $itens);
    }
}
