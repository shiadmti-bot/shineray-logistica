<?php

namespace App\Http\Controllers;

use App\Models\EstoqueLocal;
use App\Models\Peca;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\PedidoLog;
use App\Models\Romaneio;
use App\Models\RomaneioItem;
use App\Services\Estoque\EstoqueInsuficienteException;
use App\Services\Estoque\EstoquePecaService;
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
                        $falhas[] = $e->getMessage();
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
     * Coloca as peças já separadas em uma carga.
     *
     * Aqui `romaneio_itens` entra em uso de verdade: a mesma carga passa a
     * carregar motos (via motos.romaneio_id, mantido) e peças (via itens
     * polimórficos), que era o objetivo do modelo de carga mista.
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

        $criados = 0;

        DB::transaction(function () use ($pedido, $romaneio, &$criados) {
            foreach ($pedido->itensPedido as $item) {
                if (! $item->isPeca() || $item->qtd_atribuida < 1) {
                    continue;
                }

                // updateOrCreate: reenviar o pedido para a mesma carga atualiza
                // a quantidade em vez de duplicar a linha.
                RomaneioItem::updateOrCreate(
                    [
                        'romaneio_id'    => $romaneio->id,
                        'itemable_type'  => Peca::class,
                        'itemable_id'    => $item->peca_id,
                        'pedido_item_id' => $item->id,
                    ],
                    [
                        'pedido_id'        => $pedido->id,
                        'quantidade'       => $item->qtd_atribuida,
                        'status'           => RomaneioItem::STATUS_CARREGADO,
                        'local_destino_id' => $pedido->local_destino_id,
                    ]
                );

                $criados++;
            }

            $pedido->update([
                'romaneio_id' => $romaneio->id,
                'status'      => 'aguardando_coleta',
            ]);

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo'    => 'Peças incluídas na carga',
                'descricao' => "Carga #{$romaneio->id} — {$criados} item(ns).",
            ]);
        });

        return back()->with('success', "{$criados} item(ns) incluído(s) na carga #{$romaneio->id}.");
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

        DB::transaction(function () use ($dados, $pedido, $origem, $destino, $servico, &$recebido, &$divergencias) {
            foreach ($dados['itens'] as $linha) {
                $itemCarga = RomaneioItem::with('itemable')->find($linha['item_id']);

                if (! $itemCarga || ! $itemCarga->isPeca() || $itemCarga->pedido_id !== $pedido->id) {
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

            $pedido->update(['status' => 'concluido']);

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

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo'    => $divergencias > 0 ? 'Recebido com divergência' : 'Recebimento confirmado',
                'descricao' => Auth::user()->name . " recebeu {$recebido} unidade(s)."
                             . ($divergencias > 0 ? " {$divergencias} item(ns) com divergência." : '')
                             . (($dados['observacao'] ?? null) ? " Obs: {$dados['observacao']}" : ''),
            ]);
        });

        $msg = "{$recebido} unidade(s) recebida(s) no estoque.";

        if ($divergencias > 0) {
            $msg .= " {$divergencias} item(ns) com divergência — o CD foi notificado.";
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
