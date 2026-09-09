<?php

namespace App\Http\Controllers;

use App\Models\Peca;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\PedidoLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Passos 2 e 3 do manual do Call Center: identificar o código e liberar o pedido.
 *
 * DUAS ASSINATURAS, DOIS ATOS
 *
 *   IDENTIFICAR (CD)   -> escolhe o SKU e informa o preço. Consulta o e-Part
 *                         por fora — ele não expõe dados — e o sistema guarda
 *                         o resultado: qual peça, por quem, quando, por quanto.
 *   LIBERAR (validador)-> assina que aquela peça é a que a oficina precisa.
 *                         Só quem tem users.valida_pecas.
 *
 * Podem ser pessoas diferentes, e é esse o ponto: quem procura no catálogo não
 * é necessariamente quem responde pela escolha.
 *
 * POR QUE ISSO É UMA TRAVA E NÃO UM AVISO
 * O manual diz que nenhuma embalagem é despachada sem a confirmação do
 * Pós-Venda. Enquanto a liberação não vem, o pedido não separa — a checagem
 * vive em PecaAtendimentoController::separar, no servidor. Esta tela só
 * decide o que mostrar.
 *
 * A SEPARAÇÃO EM SI CONTINUA EM PecaAtendimentoController. Aqui é tudo o que
 * acontece ANTES de qualquer coisa se mover no estoque.
 */
class PecaLiberacaoController extends Controller
{
    /** Estados em que um pedido de peça ainda está em atendimento. */
    private const EM_ATENDIMENTO = ['solicitado', 'em_atendimento', 'aguardando_confirmacao'];

    /**
     * Fila do Call Center e Mesa de Aprovações do Pós-Venda.
     */
    public function index(Request $request)
    {
        $this->autorizarCd();

        $user = Auth::user();
        $podeLiberar = $user->podeValidarPecas();
        $podeAtender = in_array($user->perfil, ['cd', 'admin'], true);

        $queryBase = Pedido::where('tipo_carga', 'peca')
            ->with([
                'user:id,name,filial',
                'localDestino:id,nome',
                'itensPedido.peca:id,codigo,descricao,unidade,preco_referencia',
                'itensPedido.identificadoPor:id,name',
            ])
            ->orderBy('created_at');

        // Aprovações do Pós-Venda: pedidos em que todos os itens já têm código e aguardam Gate 1
        $aprovacoes = (clone $queryBase)
            ->where('status', 'aguardando_confirmacao')
            ->get()
            ->map(fn (Pedido $p) => $this->serializarPedido($p));

        // Triagem do CD: pedidos com itens sem código ou devolvidos por recusa
        $triagem = (clone $queryBase)
            ->whereIn('status', ['solicitado', 'em_atendimento'])
            ->get()
            ->map(fn (Pedido $p) => $this->serializarPedido($p));

        $abaPadrao = $podeLiberar ? 'aprovacoes' : 'triagem';
        $abaAtiva = $request->query('aba', $abaPadrao);
        if (! in_array($abaAtiva, ['aprovacoes', 'triagem'], true)) {
            $abaAtiva = $abaPadrao;
        }

        return Inertia::render('Pecas/Atendimento', [
            'aprovacoes'       => $aprovacoes->values(),
            'triagem'          => $triagem->values(),
            'pedidos'          => ($abaAtiva === 'aprovacoes' ? $aprovacoes : $triagem)->values(),
            'totalAprovacoes'  => $aprovacoes->count(),
            'totalTriagem'     => $triagem->count(),
            'abaAtiva'         => $abaAtiva,
            'podeLiberar'      => $podeLiberar,
            'podeAtender'      => $podeAtender,
        ]);
    }

    /**
     * Busca no catálogo para a tela de identificação.
     *
     * O saldo do Microwork vem junto porque é o que o operador olha para dizer
     * "tem 3 em Castanhal". É informativo: reservar continua sendo problema do
     * saldo gerenciado, na separação.
     */
    public function buscar(Request $request)
    {
        $this->autorizarCd();

        $termo = trim((string) $request->input('termo'));

        if (mb_strlen($termo) < 2) {
            return response()->json(['pecas' => []]);
        }

        $pecas = Peca::where('ativo', true)
            ->busca($termo)
            ->with(['saldosExternos' => fn ($q) => $q->comSaldo()->with('empresa')->orderByDesc('saldo')])
            ->limit(12)
            ->get()
            ->map(fn (Peca $p) => [
                'id'        => $p->id,
                'codigo'    => $p->codigo,
                'descricao' => $p->descricao,
                'unidade'   => $p->unidade,
                'preco'     => $p->preco_referencia,
                'onde_tem'  => $p->saldosExternos->map(fn ($s) => [
                    'local' => $s->empresa?->rotulo ?? "Empresa {$s->codigo_empresa}",
                    'saldo' => $s->saldo,
                ])->values(),
            ]);

        return response()->json(['pecas' => $pecas]);
    }

    /**
     * Passo 2 — grava a identificação feita no e-Part.
     *
     * Salva como rascunho por padrão. Com `enviar`, empurra o pedido para a
     * fila de liberação — e só aí exige que TODAS as cotas tenham código, para
     * o validador não receber um pedido pela metade.
     */
    public function atender(Request $request, $pedidoId)
    {
        $this->autorizarCd();

        $dados = $request->validate([
            'itens'                  => ['required', 'array', 'min:1'],
            'itens.*.item_id'        => ['required', 'exists:pedido_itens,id'],
            'itens.*.peca_id'        => ['nullable', 'exists:pecas,id'],
            'itens.*.preco_unitario' => ['nullable', 'numeric', 'min:0', 'max:999999.99'],
            'itens.*.quantidade'     => ['nullable', 'integer', 'min:1', 'max:999'],
            'enviar'                 => ['boolean'],
        ]);

        $pedido = Pedido::with('itensPedido')->findOrFail($pedidoId);

        $this->garantirEmAtendimento($pedido);

        $enviar = (bool) ($dados['enviar'] ?? false);
        $identificados = 0;

        try {
            DB::transaction(function () use ($dados, $pedido, $enviar, &$identificados) {
                foreach ($dados['itens'] as $linha) {
                    $item = $pedido->itensPedido->firstWhere('id', $linha['item_id']);

                    if (! $item || ! $item->isPeca()) {
                        continue;
                    }

                    /*
                     * Item já liberado não é reaberto por uma edição de rascunho.
                     * Trocar o SKU por baixo de uma assinatura existente
                     * invalidaria a liberação sem que ninguém percebesse.
                     */
                    if ($item->isLiberada()) {
                        continue;
                    }

                    $atualizacao = [];

                    if (array_key_exists('peca_id', $linha)) {
                        $atualizacao['peca_id'] = $linha['peca_id'] ?: null;

                        if ($linha['peca_id']) {
                            $atualizacao['identificado_por'] = Auth::id();
                            $atualizacao['identificado_em']  = now();
                            // Nova identificação apaga a recusa anterior: é
                            // justamente a resposta a ela.
                            $atualizacao['recusa_motivo'] = null;
                            $identificados++;
                        }
                    }

                    if (array_key_exists('preco_unitario', $linha)) {
                        $atualizacao['preco_unitario'] = $linha['preco_unitario'];
                    }

                    /*
                     * O manual prevê a filial pedir 10 e o CD confirmar 6. Reduzir
                     * a cota aqui é honesto: o que a loja vê aprovado é o que vai
                     * ser separado. Nunca aumenta — isso seria vender o que não
                     * foi pedido.
                     */
                    if (! empty($linha['quantidade']) && $linha['quantidade'] < $item->quantidade) {
                        $atualizacao['quantidade'] = $linha['quantidade'];
                    }

                    if ($atualizacao) {
                        $item->update($atualizacao);
                    }
                }

                $pedido->load('itensPedido');

                if ($enviar) {
                    $semCodigo = $pedido->itensPedido->filter(
                        fn (PedidoItem $i) => $i->isPeca() && ! $i->isIdentificada()
                    );

                    if ($semCodigo->isNotEmpty()) {
                        throw new \RuntimeException(
                            "{$semCodigo->count()} item(ns) ainda sem código. Identifique todos antes de enviar para liberação."
                        );
                    }

                    $pedido->update(['status' => 'aguardando_confirmacao']);

                    PedidoLog::create([
                        'pedido_id' => $pedido->id,
                        'user_id'   => Auth::id(),
                        'titulo'    => 'Enviado para liberação 🔎',
                        'descricao' => Auth::user()->name . ' identificou os códigos e enviou o pedido para a liberação do Pós-Venda.',
                    ]);
                } elseif ($pedido->status === 'solicitado' && $identificados > 0) {
                    $pedido->update(['status' => 'em_atendimento']);
                }
            });
        } catch (\RuntimeException $e) {
            // Envio incompleto não é erro de servidor: é o operador sendo
            // avisado do que falta. A transação já desfez o rascunho parcial,
            // então ele reenvia com tudo preenchido.
            return back()->withErrors(['geral' => $e->getMessage()]);
        }

        return back()->with('success', $enviar
            ? 'Pedido enviado para liberação do Pós-Venda.'
            : "Atendimento salvo. {$identificados} item(ns) identificado(s).");
    }

    /**
     * Passo 3 — Gate 1. Assina a liberação item a item.
     *
     * Assinar item a item, e não o pedido inteiro, é o que permite liberar as
     * 8 peças certas e devolver as 2 duvidosas ao Call Center sem travar o
     * pedido todo.
     */
    public function liberar(Request $request, $pedidoId)
    {
        $this->autorizarValidador();

        $dados = $request->validate([
            'itens'   => ['nullable', 'array'],
            'itens.*' => ['required', 'exists:pedido_itens,id'],
        ]);

        $pedido = Pedido::with('itensPedido.peca')->findOrFail($pedidoId);

        $this->garantirEmAtendimento($pedido);

        $itensAlvo = ! empty($dados['itens'])
            ? $dados['itens']
            : $pedido->itensPedido
                ->filter(fn (PedidoItem $i) => $i->isPeca() && $i->isIdentificada() && ! $i->isLiberada())
                ->pluck('id')
                ->all();

        if (empty($itensAlvo)) {
            return back()->withErrors(['geral' => 'Nenhum item elegível para liberação.']);
        }

        $liberados = 0;
        $autoAssinados = 0;

        /*
         * SEGREGAÇÃO DAS DUAS ASSINATURAS (v3.2).
         *
         * O desenho sempre foi dois atos: quem procura o código no e-Part não é
         * quem responde pela escolha. Mas nada garantia que fossem duas pessoas
         * — um validador identificava o SKU e assinava a própria identificação,
         * gravando o mesmo nome em identificado_por e confirmado_por. A dupla
         * confirmação do manual virava uma só, e a auditoria ficava sem o dado
         * que justifica os dois campos.
         *
         * O admin é a saída de emergência, e existe por um motivo concreto: se
         * a empresa tiver um único validador e ele também identificar, uma
         * trava sem exceção travaria a fila inteira. Quando o admin acumula os
         * dois papéis, o log diz isso com todas as letras — a exceção fica
         * visível na trilha, em vez de implícita na autorização.
         */
        $ehAdmin = Auth::user()->perfil === 'admin';

        DB::transaction(function () use ($itensAlvo, $pedido, $ehAdmin, &$liberados, &$autoAssinados) {
            foreach ($itensAlvo as $itemId) {
                $item = $pedido->itensPedido->firstWhere('id', $itemId);

                // Sem código não há o que assinar: a liberação é sobre uma
                // peça concreta, não sobre a intenção do pedido.
                if (! $item || ! $item->isPeca() || ! $item->isIdentificada() || $item->isLiberada()) {
                    continue;
                }

                if ($item->identificado_por === Auth::id() && ! $ehAdmin) {
                    $autoAssinados++;
                    continue;
                }

                $updates = [
                    'confirmado_por' => Auth::id(),
                    'confirmado_em'  => now(),
                    'recusa_motivo'  => null,
                ];

                if ($item->preco_unitario === null && $item->peca?->preco_referencia) {
                    $updates['preco_unitario'] = $item->peca->preco_referencia;
                }

                $item->update($updates);
                $liberados++;

                // Acúmulo pelo admin: registrado item a item, porque é a
                // exceção à dupla confirmação e precisa ser encontrável depois.
                if ($item->identificado_por === Auth::id()) {
                    activity()
                        ->performedOn($item)
                        ->causedBy(Auth::user())
                        ->withProperties(['pedido_id' => $pedido->id, 'peca_id' => $item->peca_id])
                        ->log('Admin identificou e liberou o mesmo item (acúmulo dos dois atos do Gate 1)');
                }
            }

            if ($liberados === 0) {
                return;
            }

            $pedido->load('itensPedido');

            /*
             * O pedido só avança quando não sobra nada pendente. Com itens
             * recusados ou ainda sem código, ele volta para o Call Center em
             * 'em_atendimento' — o que já foi assinado permanece assinado.
             */
            $pendentes = $pedido->itensPedido->filter(
                fn (PedidoItem $i) => $i->isPeca() && ! $i->isLiberada() && $i->qtd_cancelada < $i->quantidade
            );

            $pedido->update([
                'status' => $pendentes->isEmpty() ? 'aprovado' : 'em_atendimento',
            ]);

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'user_id'   => Auth::id(),
                'titulo'    => 'Liberação do Pós-Venda ✅',
                'descricao' => Auth::user()->name . " liberou {$liberados} item(ns) para separação."
                             . ($pendentes->isNotEmpty() ? " {$pendentes->count()} item(ns) ainda em atendimento." : ''),
            ]);
        });

        /*
         * A mensagem precisa dizer QUE regra barrou, senão o operador só vê um
         * botão que não faz nada e conclui que o sistema está quebrado.
         */
        if ($liberados === 0) {
            return back()->withErrors([
                'geral' => $autoAssinados > 0
                    ? "Você identificou {$autoAssinados} item(ns) deste pedido e não pode liberar a própria identificação — a dupla confirmação do Pós-Venda exige duas pessoas. Peça a outro validador para assinar."
                    : 'Nenhum item elegível para liberação.',
            ]);
        }

        $msg = "{$liberados} item(ns) liberado(s) para separação.";

        if ($autoAssinados > 0) {
            $msg .= " {$autoAssinados} item(ns) ficaram de fora por terem sido identificados por você — outro validador precisa assiná-los.";
        }

        return back()->with('success', $msg);
    }

    /**
     * Gate 1 negativo: devolve o item ao Call Center com o motivo.
     *
     * Não cancela a cota. A filial continua precisando da peça — o que estava
     * errado era o código escolhido.
     */
    public function recusar(Request $request, $pedidoId)
    {
        $this->autorizarValidador();

        $dados = $request->validate([
            'item_id' => ['required', 'exists:pedido_itens,id'],
            'motivo'  => ['required', 'string', 'max:500'],
        ], [
            'motivo.required' => 'Diga o que está errado — é isso que o Call Center vai usar para achar a peça certa.',
        ]);

        $pedido = Pedido::with('itensPedido')->findOrFail($pedidoId);

        $this->garantirEmAtendimento($pedido);

        $item = $pedido->itensPedido->firstWhere('id', $dados['item_id']);

        if (! $item || ! $item->isPeca()) {
            return back()->withErrors(['geral' => 'Item não encontrado neste pedido.']);
        }

        DB::transaction(function () use ($item, $pedido, $dados) {
            $item->update([
                // Devolve ao estado "precisa de código": é o que recoloca a
                // cota na fila de identificação.
                'peca_id'          => null,
                'identificado_por' => null,
                'identificado_em'  => null,
                'confirmado_por'   => null,
                'confirmado_em'    => null,
                'recusa_motivo'    => $dados['motivo'],
            ]);

            $pedido->update(['status' => 'em_atendimento']);

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'user_id'   => Auth::id(),
                'titulo'    => 'Item recusado na liberação ↩️',
                'descricao' => Auth::user()->name . ' recusou um item: ' . $dados['motivo'],
            ]);
        });

        return back()->with('success', 'Item devolvido ao Call Center para nova identificação.');
    }

    // ------------------------------------------------------------------

    private function serializarPedido(Pedido $p): array
    {
        $itensPeca = $p->itensPedido->filter(fn (PedidoItem $i) => $i->isPeca());

        $itensSerializados = $itensPeca->map(function (PedidoItem $i) {
            $precoUnitario = $i->preco_unitario !== null ? (float) $i->preco_unitario : ($i->peca?->preco_referencia !== null ? (float) $i->peca->preco_referencia : null);
            $subtotal = $precoUnitario !== null ? round($precoUnitario * $i->quantidade, 2) : 0;

            return [
                'id'                   => $i->id,
                'quantidade'           => $i->quantidade,
                'motivo'               => $i->motivo,
                'descricao_solicitada' => $i->descricao_solicitada,
                'preco_unitario'       => $precoUnitario,
                'subtotal'             => $subtotal,
                'recusa_motivo'        => $i->recusa_motivo,
                'identificada'         => $i->isIdentificada(),
                'liberada'             => $i->isLiberada(),
                'identificado_por'     => $i->identificadoPor?->name,
                'peca'                 => $i->peca ? [
                    'id'        => $i->peca->id,
                    'codigo'    => $i->peca->codigo,
                    'descricao' => $i->peca->descricao,
                    'unidade'   => $i->peca->unidade,
                    'preco'     => $i->peca->preco_referencia,
                ] : null,
            ];
        })->values();

        $valorTotal = $itensSerializados->sum('subtotal');
        $totalUnidades = $itensSerializados->sum('quantidade');
        $itensSemCodigo = $itensSerializados->where('identificada', false)->count();
        $itensAguardando = $itensSerializados->where('identificada', true)->where('liberada', false)->count();

        return [
            'id'                     => $p->id,
            'status'                 => $p->status,
            'loja'                   => $p->localDestino->nome ?? $p->user->filial ?? $p->user->name,
            'solicitante'            => $p->user->name,
            'observacao'             => $p->observacao,
            'created_at'             => $p->created_at,
            'valor_total'            => $valorTotal,
            'total_unidades'         => $totalUnidades,
            'itens_sem_codigo_count' => $itensSemCodigo,
            'itens_aguardando_count' => $itensAguardando,
            'itens'                  => $itensSerializados,
        ];
    }

    private function autorizarCd(): void
    {
        if (! in_array(Auth::user()->perfil, ['cd', 'admin'], true) && ! Auth::user()->podeValidarPecas()) {
            abort(403, 'Apenas o Estoque Central ou Validadores de Peças têm acesso a esta fila.');
        }
    }

    private function autorizarValidador(): void
    {
        if (! Auth::user()->podeValidarPecas()) {
            abort(403, 'Você não tem atribuição para liberar pedidos de peça.');
        }
    }

    private function garantirEmAtendimento(Pedido $pedido): void
    {
        if ($pedido->tipo_carga !== 'peca') {
            abort(400, 'Este fluxo atende apenas pedidos de peça.');
        }

        if (! in_array($pedido->status, self::EM_ATENDIMENTO, true)) {
            abort(409, 'Este pedido já saiu da fase de atendimento.');
        }
    }
}
