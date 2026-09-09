<?php

namespace App\Services\Pecas;

use App\Models\Basqueta;
use App\Models\Peca;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\Romaneio;
use App\Models\RomaneioItem;
use Illuminate\Support\Facades\Auth;

/**
 * PONTO ÚNICO DE EMBARQUE DE PEÇA.
 *
 * A UNIDADE DE EMBARQUE É A BASQUETA, NUNCA O PEDIDO.
 *
 * Uma basqueta é uma caixa física lacrada e faturada sob UMA nota. Ela reúne
 * cotas de vários pedidos da mesma filial, então não existe "embarcar meio
 * pedido": o que sobe no caminhão é a caixa inteira. Antes da v3.2 havia dois
 * caminhos para a carga — este e um por pedido — e só um checava o Gate 2. O
 * outro despachava mercadoria sem nota e deixava a basqueta órfã, segurando
 * saldo reservado de peça que já tinha saído do galpão.
 *
 * A TRAVA DO GATE 2 VIVE AQUI, não na tela.
 *
 * Filtrar por STATUS_LIBERADA no próprio WHERE faz com que uma basqueta não
 * conferida simplesmente não seja encontrada — mesmo que o id venha numa
 * requisição forjada ou de uma tela em cache aberta antes de um pedido de
 * ajuste. Quem chama recebe a contagem do que de fato embarcou e compara com o
 * que pediu; a diferença é a recusa.
 */
class EmbarqueBasquetaService
{
    /**
     * Embarca basquetas liberadas numa carga.
     *
     * Chamar sempre dentro de uma transação: a atualização da basqueta, dos
     * pedidos e das linhas de romaneio precisa ser atômica, ou uma falha no
     * meio deixa caixa despachada sem item correspondente na carga.
     *
     * @param  array<int, int>  $basquetaIds
     * @return array{itens: int, basquetas: \Illuminate\Support\Collection<int, Basqueta>}
     */
    public function embarcar(array $basquetaIds, Romaneio $romaneio): array
    {
        if (empty($basquetaIds)) {
            return ['itens' => 0, 'basquetas' => collect()];
        }

        $basquetas = Basqueta::whereIn('id', $basquetaIds)
            ->where('status', Basqueta::STATUS_LIBERADA)
            ->whereNull('romaneio_id')
            ->with('itens.pedido')
            ->lockForUpdate()
            ->get();

        $criados = 0;

        foreach ($basquetas as $basqueta) {
            $pedidosTocados = [];

            foreach ($basqueta->itens as $item) {
                // Só embarca o que foi de fato separado.
                if (! $item->isPeca() || $item->qtd_atribuida < 1) {
                    continue;
                }

                // updateOrCreate: reprocessar a mesma carga atualiza a quantidade
                // em vez de duplicar a linha.
                RomaneioItem::updateOrCreate(
                    [
                        'romaneio_id'    => $romaneio->id,
                        'itemable_type'  => Peca::class,
                        'itemable_id'    => $item->peca_id,
                        'pedido_item_id' => $item->id,
                    ],
                    [
                        'pedido_id'        => $item->pedido_id,
                        'quantidade'       => $item->qtd_atribuida,
                        'status'           => RomaneioItem::STATUS_CARREGADO,
                        'local_destino_id' => $basqueta->estoque_local_id,
                    ]
                );

                $pedidosTocados[$item->pedido_id] = true;
                $criados++;
            }

            $basqueta->update([
                'romaneio_id' => $romaneio->id,
                'status'      => Basqueta::STATUS_DESPACHADA,
            ]);

            $nota = $basqueta->notaVigente();

            /*
             * Cada pedido acompanha o próprio histórico, e uma basqueta reúne
             * vários. O status vai para todos os que tiveram cota embarcada.
             */
            foreach (array_keys($pedidosTocados) as $pedidoId) {
                Pedido::where('id', $pedidoId)->update([
                    'romaneio_id' => $romaneio->id,
                    'status'      => 'aguardando_coleta',
                ]);

                PedidoLog::create([
                    'pedido_id' => $pedidoId,
                    'titulo'    => 'Peças incluídas na carga',
                    'descricao' => "Basqueta #{$basqueta->id} embarcada na carga #{$romaneio->id}"
                                 . ($nota ? " sob a NF {$nota->rotulo}" : '')
                                 . ' por ' . (Auth::user()->name ?? 'sistema') . '.',
                ]);
            }
        }

        return ['itens' => $criados, 'basquetas' => $basquetas];
    }

    /**
     * As basquetas que guardam as cotas separadas deste pedido.
     *
     * Uma separação parcial reaponta para a mesma caixa, mas um pedido que
     * atravessou um ciclo de ajuste pode ter cotas em mais de uma — por isso o
     * retorno é uma lista, e não um id só.
     *
     * @return array<int, int>
     */
    public function basquetasDoPedido(Pedido $pedido): array
    {
        return $pedido->itensPedido
            ->filter(fn ($i) => $i->isPeca() && $i->qtd_atribuida > 0 && $i->basqueta_id)
            ->pluck('basqueta_id')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Explica, na linguagem do operador, por que uma caixa não pôde embarcar.
     *
     * Dizer "não foi possível" sem o estado da caixa obriga o CD a caçar a
     * informação em outra tela. O estado é a instrução: 'aberta' significa
     * faturar, 'faturada' significa esperar a filial conferir.
     *
     * @param  array<int, int>  $basquetaIds
     */
    public function motivoDeRecusa(array $basquetaIds): string
    {
        $pendentes = Basqueta::whereIn('id', $basquetaIds)
            ->where(fn ($q) => $q->where('status', '!=', Basqueta::STATUS_LIBERADA)
                                 ->orWhereNotNull('romaneio_id'))
            ->get();

        if ($pendentes->isEmpty()) {
            return 'Nenhuma basqueta deste pedido está pronta para embarque.';
        }

        $motivos = $pendentes->map(function (Basqueta $b) {
            $texto = match (true) {
                $b->romaneio_id !== null              => "já embarcada na carga #{$b->romaneio_id}",
                $b->status === Basqueta::STATUS_ABERTA,
                $b->status === Basqueta::STATUS_ROTA_CONFIRMADA => 'ainda não faturada — emita a NF em Basquetas',
                $b->status === Basqueta::STATUS_FATURADA => 'aguardando a conferência da filial (Gate 2)',
                $b->status === Basqueta::STATUS_AJUSTE   => 'devolvida para ajuste — inclua o item e fature de novo',
                default                                  => "no estado '{$b->status}'",
            };

            return "Basqueta #{$b->id}: {$texto}.";
        })->implode(' ');

        return $motivos;
    }
}
