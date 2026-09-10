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

        $locais = $user->perfil === 'admin'
            ? EstoqueLocal::filiaisDePeca()
                ->orderBy('nome')
                ->get(['id', 'nome'])
            : [];

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
            'locais'  => $locais,
            'isAdmin' => $user->perfil === 'admin',
        ]);
    }

    public function store(Request $request)
    {
        /*
         * peca_id deixa de ser obrigatório na v3.1.
         *
         * O manual descreve a filial pedindo o que não sabe nomear — "a peça
         * que trava a marcha da JET" — e o Call Center identificando o código
         * no e-Part. Exigir o SKU aqui empurrava esse caso todo para fora do
         * sistema, de volta para a mensagem.
         *
         * A regra vira: OU o código, OU a descrição. Nenhum dos dois é pedido
         * vazio; os dois juntos é a filial dando contexto além do código, o que
         * ajuda o atendimento.
         */
        $dados = $request->validate([
            'itens'                          => ['required', 'array', 'min:1'],
            'itens.*.peca_id'                => ['nullable', 'exists:pecas,id'],
            'itens.*.descricao_solicitada'   => ['nullable', 'string', 'max:500'],
            'itens.*.quantidade'             => ['required', 'integer', 'min:1', 'max:999'],
            'itens.*.motivo'                 => ['nullable', 'string', 'max:255'],
            'observacao'                     => ['nullable', 'string', 'max:1000'],
            'local_destino_id'               => ['nullable', 'exists:estoque_locais,id'],
        ], [
            'itens.required' => 'Adicione ao menos uma peça ao pedido.',
        ]);

        foreach ($dados['itens'] as $i => $item) {
            if (empty($item['peca_id']) && empty(trim($item['descricao_solicitada'] ?? ''))) {
                return back()->withErrors([
                    "itens.{$i}" => 'Escolha uma peça do catálogo ou descreva o que precisa.',
                ])->withInput();
            }
        }

        $user = Auth::user();
        $cd = EstoqueLocal::cd();

        /*
         * ORIGEM E DESTINO SÃO VERIFICADOS ANTES DE GRAVAR (v3.2).
         *
         * Para lojas, o destino sai direto de $user->estoque_local_id.
         * Para administradores, permite escolher a filial de destino do pedido,
         * ou utiliza o estoque_local_id do admin se possuir um.
         */
        $localDestinoId = ($user->perfil === 'admin' && !empty($dados['local_destino_id']))
            ? (int) $dados['local_destino_id']
            : $user->estoque_local_id;

        if (! $localDestinoId) {
            return back()->withErrors([
                'geral' => $user->perfil === 'admin'
                    ? 'Escolha a filial de destino da peça antes de enviar a solicitação.'
                    : 'Seu usuário não tem um local de estoque vinculado, então não há para onde enviar a peça. Peça ao administrador para vincular sua filial antes de solicitar.',
            ])->withInput();
        }

        $localDestino = EstoqueLocal::find($localDestinoId);
        if (! $localDestino) {
            return back()->withErrors([
                'geral' => 'A filial de destino selecionada não foi encontrada.',
            ])->withInput();
        }

        if (! $cd) {
            return back()->withErrors([
                'geral' => 'O Estoque Central não está cadastrado como local de peças. Avise o administrador.',
            ])->withInput();
        }

        /*
         * Origem igual a destino é pedir para si mesmo: não há transferência
         * possível, e o EstoquePecaService recusaria com uma exceção sem
         * tratamento no recebimento — erro 500 muito depois do ponto onde a
         * decisão errada foi tomada.
         */
        if ($cd->id === $localDestinoId) {
            return back()->withErrors([
                'geral' => 'O destino não pode ser o próprio Estoque Central. Use a tela de entrada de estoque em vez de abrir um pedido.',
            ])->withInput();
        }

        $todosComCodigo = collect($dados['itens'])->every(fn ($item) => ! empty($item['peca_id']));
        $statusInicial = $todosComCodigo ? 'aguardando_confirmacao' : 'solicitado';

        $pedido = DB::transaction(function () use ($dados, $user, $cd, $localDestino, $localDestinoId, $todosComCodigo, $statusInicial) {
            $userIdDestino = ($user->perfil === 'admin' && $localDestino->user_id)
                ? $localDestino->user_id
                : $user->id;

            $pedido = Pedido::create([
                'user_id'          => $userIdDestino,
                'tipo_carga'       => 'peca',
                'status'           => $statusInicial,
                'origem_user_id'   => null, // CD atende
                'local_origem_id'  => $cd?->id,
                'local_destino_id' => $localDestinoId,
                'observacao'       => $dados['observacao'] ?? null,
                // `itens` (JSON) é mantido por compatibilidade com as telas
                // legadas de pedido, que leem esse campo diretamente.
                'itens'            => $this->resumoLegado($dados['itens']),
            ]);

            foreach ($dados['itens'] as $item) {
                // peca_id pode vir vazio: é o "pedido sem código" do manual.
                // Quem preenche é o Call Center, na fila de atendimento.
                $peca = ! empty($item['peca_id']) ? Peca::find($item['peca_id']) : null;
                $descricao = trim($item['descricao_solicitada'] ?? '');

                PedidoItem::create([
                    'pedido_id'            => $pedido->id,
                    'tipo'                 => 'peca',
                    'peca_id'              => $peca?->id,
                    'descricao_solicitada' => $descricao !== '' ? $descricao : null,
                    'preco_unitario'       => $peca?->preco_referencia,
                    'identificado_por'     => $peca ? $user->id : null,
                    'identificado_em'      => $peca ? now() : null,
                    'modelo'               => null, // não se aplica a peça
                    'cor'                  => null,
                    'motivo'               => $item['motivo'] ?? null,
                    'local'                => $localDestino->nome ?: $user->filial,
                    'quantidade'           => $item['quantidade'],
                    'exige_chassi'         => false,
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
            $logDescricao = "{$user->name} solicitou {$totalItens} unidade(s) em "
                . count($dados['itens']) . ' item(ns) de peça.';
            if ($todosComCodigo) {
                $logDescricao .= ' Todos os itens foram identificados via catálogo e encaminhados diretamente para liberação do Pós-Venda.';
            }

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo'    => $todosComCodigo ? 'Solicitação de peças enviada para liberação' : 'Solicitação de peças criada',
                'descricao' => $logDescricao,
            ]);

            return $pedido;
        });

        $msgSucesso = $todosComCodigo
            ? 'Solicitação de peças enviada para liberação do Pós-Venda.'
            : 'Solicitação de peças enviada para triagem do CD.';

        return redirect()
            ->route('pedidos.show', $pedido->id)
            ->with('success', $msgSucesso);
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
            /*
             * REMOVER É PRIVILÉGIO DO CD (v3.2).
             *
             * Confirmar que uma peça serve é captura de conhecimento e continua
             * aberta a todos — é o que resolve as peças sem aplicação, por quem
             * tem a peça na mão. Apagar é outra coisa: destrói vínculo que
             * vale para TODA a rede, e o sync do Microwork nunca o recria,
             * porque vínculo manual tem confiança alta. Um engano de uma filial
             * viraria buraco permanente no catálogo de todas.
             */
            if (! in_array(Auth::user()->perfil, ['cd', 'admin'], true)) {
                return back()->withErrors([
                    'familia' => 'Só o Estoque Central remove uma aplicação do catálogo, porque o vínculo vale para toda a rede. Avise o CD se este modelo estiver errado.',
                ]);
            }

            $removidos = $peca->aplicacoes()->where('familia', $familia)->get();

            $peca->aplicacoes()->where('familia', $familia)->delete();

            /*
             * A remoção precisa deixar rastro. O texto_origem registra quem
             * confirmou, mas nada registrava quem apagou — e era justamente a
             * operação destrutiva que ficava sem dono.
             */
            foreach ($removidos as $aplicacao) {
                activity()
                    ->performedOn($peca)
                    ->causedBy(Auth::user())
                    ->withProperties([
                        'familia'   => $familia,
                        'origem'    => $aplicacao->origem,
                        'confianca' => $aplicacao->confianca,
                    ])
                    ->log("Aplicação {$familia} removida da peça {$peca->codigo}");
            }

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
            $peca = ! empty($i['peca_id']) ? Peca::find($i['peca_id']) : null;
            $descricao = trim($i['descricao_solicitada'] ?? '');

            return [
                'tipo'       => 'peca',
                'peca_id'    => $peca?->id,
                // Sem código, o resumo legado mostra o texto da filial — as
                // telas antigas leem 'modelo' como o nome do item.
                'modelo'     => $peca?->descricao ?: ($descricao ?: 'Peça'),
                'cor'        => $peca?->codigo ?: ($peca ? '' : 'SEM CÓDIGO'),
                'quantidade' => $i['quantidade'],
                'motivo'     => $i['motivo'] ?? null,
            ];
        }, $itens);
    }
}
