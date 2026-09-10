<?php

namespace App\Http\Controllers;

use App\Models\EstoqueLocal;
use App\Models\Peca;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\Romaneio;
use App\Models\RomaneioItem;
use App\Services\Estoque\EstoqueInsuficienteException;
use App\Services\Estoque\EstoquePecaService;
use App\Services\Pecas\EmbarqueBasquetaService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Atendimento de pedidos de peça pelo CD, e recebimento pela loja.
 *
 * CICLO DE ESTOQUE — três momentos, três efeitos distintos:
 *
 *   1. SEPARAR (CD)     -> reserva(). O saldo físico não muda; a quantidade
 *                          fica prometida a este pedido e some do disponível.
 *   2. EXPEDIR (carga)  -> nada de estoque. A peça ainda é do CD, só está no
 *                          caminhão. Vira linha em romaneio_itens.
 *   3. RECEBER (loja)   -> transferir(). Só agora o saldo sai do CD e entra na
 *                          loja, consumindo a reserva.
 *
 * Separar essas três etapas é o que permite responder "o que está prometido mas
 * ainda não saiu" e "o que saiu mas não chegou" — perguntas que um único
 * movimento de baixa na separação tornaria impossíveis.
 *
 * SEPARAÇÃO PARCIAL é o caso normal, não a exceção: o CD separa o que tem na
 * prateleira. `qtd_atribuida` de PedidoItem registra quanto foi de fato
 * separado, reaproveitando a mesma mecânica de cotas das motos.
 */
class PecaAtendimentoController extends Controller
{
    /** Estados terminais: o pedido não aceita mais movimento de estoque. */
    private const ENCERRADOS = ['concluido', 'cancelado', 'rejeitado'];

    /**
     * CD separa as peças: reserva o saldo do que conseguiu localizar.
     */
    public function separar(Request $request, $pedidoId)
    {
        $dados = $request->validate([
            'itens'              => ['required', 'array', 'min:1'],
            'itens.*.item_id'    => ['required', 'exists:pedido_itens,id'],
            'itens.*.quantidade' => ['required', 'integer', 'min:0'],
        ]);

        $pedido = Pedido::with('itensPedido.peca')->findOrFail($pedidoId);

        $this->autorizarCd();
        $this->garantirPedidoDePeca($pedido);

        /*
         * Pedido encerrado não volta a separar.
         *
         * Uma separação parcial seguida de recebimento deixa qtd_pendente > 0
         * num pedido já 'concluido'. Sem esta guarda, o CD conseguia reservar
         * saldo novo para ele — e essa reserva ficava presa, porque não há mais
         * nenhum evento futuro naquele pedido que a libere.
         */
        if (in_array($pedido->status, self::ENCERRADOS, true)) {
            return back()->withErrors([
                'geral' => "Este pedido está como '{$pedido->status}' e não aceita mais separação.",
            ]);
        }

        $origem = $pedido->local_origem_id ?? EstoqueLocal::cd()?->id;

        if (! $origem) {
            return back()->withErrors(['geral' => 'Local de origem do pedido não definido.']);
        }

        if (! $pedido->local_destino_id) {
            return back()->withErrors(['geral' => 'Destino do pedido não definido — sem ele não há basqueta.']);
        }

        $servico = app(EstoquePecaService::class);
        $falhas = [];
        $separados = 0;

        try {
            DB::transaction(function () use ($dados, $pedido, $origem, $servico, &$falhas, &$separados) {
                /*
                 * Passo 4 do manual: a peça separada vai para a basqueta
                 * reservada daquela filial. Uma só por filial, aberta sob lock
                 * — ver Basqueta::abertaPara.
                 */
                $basqueta = \App\Models\Basqueta::abertaPara($pedido->local_destino_id);

                foreach ($dados['itens'] as $linha) {
                    $item = $pedido->itensPedido->firstWhere('id', $linha['item_id']);

                    if (! $item || ! $item->isPeca() || $linha['quantidade'] < 1) {
                        continue;
                    }

                    /*
                     * GATE 1 — a trava do manual.
                     *
                     * "Nenhuma embalagem é despachada sem a dupla confirmação
                     * do Pós-Venda." A primeira confirmação é esta: sem
                     * assinatura, a peça não sai da prateleira nem é reservada.
                     *
                     * A checagem é por ITEM e não pelo pedido porque a
                     * liberação é item a item — o validador pode liberar 8 de
                     * 10 e devolver 2 ao Call Center.
                     */
                    if (! $item->isLiberada()) {
                        $falhas[] = "{$item->descricao}: aguardando liberação do Pós-Venda.";
                        continue;
                    }

                    // Não deixa separar mais do que foi pedido.
                    $maximo = $item->qtd_pendente;
                    $qtd = min($linha['quantidade'], $maximo);

                    if ($qtd < 1) {
                        continue;
                    }

                    try {
                        $servico->reservar(
                            peca: $item->peca,
                            localId: $origem,
                            quantidade: $qtd,
                            pedido: $pedido,
                            pedidoItem: $item,
                            observacao: "Separação do pedido #{$pedido->id}",
                        );

                        $item->increment('qtd_atribuida', $qtd);

                        // Deposita a cota no caixote da filial. Separação
                        // parcial reaponta para a mesma basqueta, então o
                        // item não se divide entre duas caixas.
                        if ($item->basqueta_id !== $basqueta->id) {
                            $item->update(['basqueta_id' => $basqueta->id]);
                        }

                        $separados += $qtd;
                    } catch (EstoqueInsuficienteException $e) {
                        // Coleta e segue: o CD precisa saber tudo que faltou de
                        // uma vez, não item por item.
                        $falhas[] = $e->getMessage() . " Registre a entrada física em Peças > Estoque de Peças antes de separar.";
                    }
                }

                if ($separados > 0) {
                    /*
                     * O pedido continua em 'separado' — que é a verdade sobre
                     * ELE. Quem passa a esperar a rota é a BASQUETA, e é ela
                     * que carrega esse estado. Manter o pedido nos estados que
                     * o calendário e a mesa de montagem já conhecem evita mexer
                     * nas listas de status espalhadas por PedidoController.
                     */
                    $pedido->update(['status' => 'separado']);

                    $viagem = $basqueta->viagem;

                    PedidoLog::create([
                        'pedido_id' => $pedido->id,
                        'titulo'    => 'Peças separadas',
                        'descricao' => Auth::user()->name . " separou {$separados} unidade(s)"
                                     . " na basqueta #{$basqueta->id}."
                                     . ($viagem
                                        ? ' Sai na viagem de ' . $viagem->date . '.'
                                        : ' Aguardando o CD marcar a viagem desta filial.'),
                    ]);
                }
            });
        } catch (\Throwable $e) {
            return back()->withErrors(['geral' => 'Erro ao separar: ' . $e->getMessage()]);
        }

        if ($falhas && $separados === 0) {
            return back()->withErrors(['geral' => implode(' ', $falhas)]);
        }

        $aviso = $falhas ? ' Pendências: ' . implode(' ', $falhas) : '';

        return back()->with('success', "{$separados} unidade(s) separada(s).{$aviso}");
    }

    /**
     * Embarca, a partir da tela do pedido, a(s) basqueta(s) que guardam as
     * cotas dele.
     *
     * O QUE MUDOU NA v3.2 E POR QUÊ
     *
     * Este método montava linhas de romaneio direto do pedido, sem olhar a
     * basqueta. Era a segunda porta para a carga, e a única sem Gate 2: dava
     * para despachar mercadoria sem nota emitida e sem a filial ter conferido
     * nada. Pior, a caixa ficava órfã — seguia 'aberta' segurando saldo
     * reservado de peça que já tinha saído do galpão, e nunca mais era
     * encontrada pela mesa de montagem, que só enxerga basqueta liberada.
     *
     * Agora este caminho e a mesa de montagem passam pelo MESMO
     * EmbarqueBasquetaService. A tela continua servindo à conveniência de quem
     * está com o pedido aberto; o que ela não faz mais é pular a fila de
     * portões.
     *
     * EMBARCA A CAIXA INTEIRA, e é assim que tem que ser: a basqueta é uma
     * caixa física lacrada sob uma nota só, reunindo cotas de vários pedidos da
     * mesma filial. Não existe embarcar meio pedido — o que sobe no caminhão é
     * a caixa. Por isso a mensagem de retorno diz quantos pedidos foram junto.
     */
    public function adicionarNaCarga(Request $request, $pedidoId)
    {
        $dados = $request->validate([
            'romaneio_id' => ['required', 'exists:romaneios,id'],
        ]);

        $pedido = Pedido::with('itensPedido.peca')->findOrFail($pedidoId);
        $romaneio = Romaneio::findOrFail($dados['romaneio_id']);

        $this->autorizarCd();
        $this->garantirPedidoDePeca($pedido);

        if (in_array($romaneio->status, ['concluido', 'cancelado'], true)) {
            return back()->withErrors(['geral' => 'Esta carga já foi encerrada.']);
        }

        $servico = app(EmbarqueBasquetaService::class);
        $basquetaIds = $servico->basquetasDoPedido($pedido);

        if (empty($basquetaIds)) {
            return back()->withErrors([
                'geral' => 'Nenhuma peça separada neste pedido está em uma basqueta. Separe as peças antes de embarcar.',
            ]);
        }

        $resultado = DB::transaction(
            fn () => $servico->embarcar($basquetaIds, $romaneio)
        );

        /*
         * Zero embarcado não é erro de sistema: é o Gate 2 fazendo o trabalho
         * dele. O operador precisa saber QUAL caixa travou e em que estado ela
         * está, senão vai caçar a informação em outra tela.
         */
        if ($resultado['itens'] === 0) {
            return back()->withErrors(['geral' => $servico->motivoDeRecusa($basquetaIds)]);
        }

        $caixas = $resultado['basquetas']->count();
        $recusadas = count($basquetaIds) - $caixas;

        $msg = "{$resultado['itens']} item(ns) embarcado(s) na carga #{$romaneio->id}"
             . ' em ' . ($caixas === 1 ? '1 basqueta' : "{$caixas} basquetas") . '.';

        if ($recusadas > 0) {
            $msg .= ' ' . $servico->motivoDeRecusa($basquetaIds);
        }

        return back()->with('success', $msg);
    }

    /**
     * Loja confirma o recebimento: só agora o saldo muda de lugar.
     *
     * A quantidade conferida pode divergir da enviada — e é isso que vira
     * pendência para o CD, em vez de sumir silenciosamente.
     */
    public function receber(Request $request, $pedidoId)
    {
        $dados = $request->validate([
            'itens'              => ['required', 'array', 'min:1'],
            'itens.*.item_id'    => ['required', 'exists:romaneio_itens,id'],
            'itens.*.quantidade' => ['required', 'integer', 'min:0'],
            'observacao'         => ['nullable', 'string', 'max:500'],
        ]);

        $pedido = Pedido::with('itensPedido')->findOrFail($pedidoId);

        $this->garantirPedidoDePeca($pedido);
        $this->autorizarDestino($pedido);

        $origem  = $pedido->local_origem_id ?? EstoqueLocal::cd()?->id;
        $destino = $pedido->local_destino_id;

        if (! $origem || ! $destino) {
            return back()->withErrors(['geral' => 'Origem ou destino do pedido não definidos.']);
        }

        $servico = app(EstoquePecaService::class);
        $recebido = 0;
        $divergencias = 0;
        $jaBaixados = 0;

        DB::transaction(function () use ($dados, $pedido, $origem, $destino, $servico, &$recebido, &$divergencias, &$jaBaixados) {
            /*
             * TRAVA DE RECEBIMENTO DUPLO.
             *
             * Sem o lock, duas requisições simultâneas — duplo clique, retry de
             * rede num galpão com sinal ruim, voltar e reenviar o formulário —
             * leem as mesmas linhas em 'em_transito' e cada uma executa a
             * transferência. O saldo sairia do CD e entraria na loja em dobro,
             * com duas pernas de ledger que parecem legítimas.
             *
             * O lock no pedido serializa as duas; a segunda encontra os itens
             * já em 'entregue' e cai no guard abaixo.
             */
            Pedido::where('id', $pedido->id)->lockForUpdate()->first();

            foreach ($dados['itens'] as $linha) {
                $itemCarga = RomaneioItem::with('itemable')->find($linha['item_id']);

                if (! $itemCarga || ! $itemCarga->isPeca() || $itemCarga->pedido_id !== $pedido->id) {
                    continue;
                }

                /*
                 * Item já baixado não se recebe de novo. Conferir de novo é
                 * legítimo (a tela permite reabrir), mas mover o saldo outra
                 * vez não — a peça só entra uma vez na loja.
                 */
                if (in_array($itemCarga->status, [
                    RomaneioItem::STATUS_ENTREGUE,
                    RomaneioItem::STATUS_DIVERGENCIA,
                    RomaneioItem::STATUS_RETORNADO,
                ], true)) {
                    $jaBaixados++;
                    continue;
                }

                /*
                 * Só o que saiu de fato pode ser recebido. 'carregado' é peça
                 * que está na carga mas ainda no galpão — receber aí baixaria
                 * do CD mercadoria que nunca foi embarcada.
                 */
                if ($itemCarga->status !== RomaneioItem::STATUS_EM_TRANSITO) {
                    continue;
                }

                $qtdRecebida = min($linha['quantidade'], $itemCarga->quantidade);

                if ($qtdRecebida > 0) {
                    $servico->transferir(
                        peca: $itemCarga->itemable,
                        localOrigemId: $origem,
                        localDestinoId: $destino,
                        quantidade: $qtdRecebida,
                        pedido: $pedido,
                        romaneio: $itemCarga->romaneio,
                        consomeReserva: true,
                        observacao: "Recebimento do pedido #{$pedido->id}",
                    );

                    $recebido += $qtdRecebida;
                }

                $divergiu = $qtdRecebida !== $itemCarga->quantidade;

                if ($divergiu) {
                    $divergencias++;

                    /*
                     * O que não chegou continua reservado no CD e seria saldo
                     * fantasma — prometido a um pedido já encerrado. Liberar
                     * devolve a quantidade ao disponível.
                     */
                    $faltou = $itemCarga->quantidade - $qtdRecebida;

                    if ($faltou > 0) {
                        $servico->liberarReserva(
                            peca: $itemCarga->itemable,
                            localId: $origem,
                            quantidade: $faltou,
                            pedido: $pedido,
                            observacao: "Divergência no recebimento do pedido #{$pedido->id}",
                        );
                    }
                }

                $itemCarga->update([
                    'quantidade_recebida' => $qtdRecebida,
                    'status'              => $divergiu
                        ? RomaneioItem::STATUS_DIVERGENCIA
                        : RomaneioItem::STATUS_ENTREGUE,
                    'entregue_em'         => now(),
                ]);
            }

            /*
             * O pedido só encerra quando não sobra linha de carga pendente.
             *
             * Antes da v3.2 esta linha ficava fora de qualquer condição: um
             * envio que não casasse nenhum item — ids de outro pedido, tudo
             * zerado, itens já baixados — encerrava o pedido com zero
             * recebimento e o tirava de todas as filas de acompanhamento.
             *
             * Recebimento parcial mantém o pedido aberto de propósito: o que
             * ficou para trás continua visível para a filial cobrar.
             */
            $pendentesNaCarga = RomaneioItem::where('pedido_id', $pedido->id)
                ->pecas()
                ->whereNotIn('status', [
                    RomaneioItem::STATUS_ENTREGUE,
                    RomaneioItem::STATUS_DIVERGENCIA,
                    RomaneioItem::STATUS_RETORNADO,
                ])
                ->count();

            if ($pendentesNaCarga === 0 && ($recebido > 0 || $divergencias > 0)) {
                $pedido->update(['status' => 'concluido']);
            }

            // Verifica se a carga foi integralmente entregue
            if ($pedido->romaneio_id) {
                $romaneio = Romaneio::with(['motos.pedidos'])->find($pedido->romaneio_id);
                if ($romaneio && $romaneio->status !== 'concluido') {
                    $motosConcluidas = $romaneio->motos->every(function ($m) {
                        $p = $m->pedidos->first();
                        return $p && in_array($p->status, ['concluido', 'cancelado', 'no_cd']);
                    });

                    $pecasConcluidas = RomaneioItem::where('romaneio_id', $romaneio->id)
                        ->where('itemable_type', Peca::class)
                        ->whereNotIn('status', [RomaneioItem::STATUS_ENTREGUE, RomaneioItem::STATUS_DIVERGENCIA, RomaneioItem::STATUS_RETORNADO])
                        ->count() === 0;

                    if ($motosConcluidas && $pecasConcluidas) {
                        $romaneio->update(['status' => 'concluido']);
                    }
                }
            }

            // Envio que não moveu nada não vira evento no histórico: poluiria a
            // timeline do pedido com um recebimento que não aconteceu.
            if ($recebido === 0 && $divergencias === 0) {
                return;
            }

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo'    => $divergencias > 0 ? 'Recebido com divergência' : 'Recebimento confirmado',
                'descricao' => Auth::user()->name . " recebeu {$recebido} unidade(s)."
                             . ($divergencias > 0 ? " {$divergencias} item(ns) com divergência." : '')
                             . (($dados['observacao'] ?? null) ? " Obs: {$dados['observacao']}" : ''),
            ]);
        });

        if ($recebido === 0 && $divergencias === 0) {
            return back()->withErrors([
                'geral' => $jaBaixados > 0
                    ? 'Estes itens já haviam sido recebidos — nada foi movimentado.'
                    : 'Nenhum item elegível para recebimento. Confirme se a carga já saiu do CD.',
            ]);
        }

        $msg = "{$recebido} unidade(s) recebida(s) no estoque.";

        if ($divergencias > 0) {
            $msg .= " {$divergencias} item(ns) com divergência — o CD foi notificado.";
        }

        if ($jaBaixados > 0) {
            $msg .= " {$jaBaixados} item(ns) já estavam baixados e foram ignorados.";
        }

        return back()->with('success', $msg);
    }

    // ------------------------------------------------------------------

    private function autorizarCd(): void
    {
        if (! in_array(Auth::user()->perfil, ['cd', 'admin'], true)) {
            abort(403, 'Apenas o CD pode separar peças.');
        }
    }

    private function autorizarDestino(Pedido $pedido): void
    {
        $user = Auth::user();

        if (in_array($user->perfil, ['admin', 'cd'], true)) {
            return;
        }

        if ($user->estoque_local_id !== $pedido->local_destino_id) {
            abort(403, 'Este pedido não é da sua loja.');
        }
    }

    private function garantirPedidoDePeca(Pedido $pedido): void
    {
        if ($pedido->tipo_carga !== 'peca') {
            abort(400, 'Este fluxo atende apenas pedidos de peça.');
        }
    }
}
