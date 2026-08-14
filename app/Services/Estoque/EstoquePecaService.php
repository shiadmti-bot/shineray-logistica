<?php

namespace App\Services\Estoque;

use App\Models\EstoqueLocal;
use App\Models\Peca;
use App\Models\PecaEstoque;
use App\Models\PecaMovimento;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\Romaneio;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * PONTO ÚNICO DE ESCRITA DO ESTOQUE DE PEÇAS.
 *
 * Nenhum controller deve alterar peca_estoques diretamente. Todo movimento passa
 * por aqui para que saldo e ledger (peca_movimentos) sejam gravados na MESMA
 * transação — peça não tem chassi, então o ledger é a única forma de auditar
 * uma divergência depois.
 *
 * CONCORRÊNCIA
 * Toda leitura-para-escrita usa SELECT ... FOR UPDATE (lockForUpdate). Sem isso,
 * duas lojas reservando a última peça no mesmo instante leriam o mesmo saldo e
 * ambas passariam na validação, gerando saldo negativo. O lock serializa as duas
 * requisições no nível da linha do banco, e a segunda enxerga o saldo já
 * decrementado.
 *
 * SALDO FÍSICO x RESERVADO
 *   reservar()  -> só sobe saldo_reservado. A peça continua na prateleira.
 *   darBaixa()  -> desce saldo E saldo_reservado. A peça saiu de fato.
 * Separar os dois é o que impede promessa dupla sem mentir sobre o físico.
 */
class EstoquePecaService
{
    /**
     * Promete quantidade a um pedido. Não move a peça fisicamente.
     *
     * @throws EstoqueInsuficienteException
     */
    public function reservar(
        Peca $peca,
        int $localId,
        int $quantidade,
        ?Pedido $pedido = null,
        ?PedidoItem $pedidoItem = null,
        ?string $observacao = null,
    ): PecaMovimento {
        $this->validarQuantidadePositiva($quantidade);

        return DB::transaction(function () use ($peca, $localId, $quantidade, $pedido, $pedidoItem, $observacao) {
            $estoque = $this->travarEstoque($peca, $localId);

            $disponivel = max(0, $estoque->saldo - $estoque->saldo_reservado);

            if ($quantidade > $disponivel) {
                throw new EstoqueInsuficienteException(
                    $peca, $quantidade, $disponivel, $this->nomeLocal($localId)
                );
            }

            $estoque->saldo_reservado += $quantidade;
            $estoque->save();

            // Reserva não altera saldo físico: anterior == posterior de propósito.
            return $this->registrar(
                peca: $peca,
                localId: $localId,
                tipo: PecaMovimento::TIPO_RESERVA,
                quantidade: $quantidade,
                saldoAnterior: $estoque->saldo,
                saldoPosterior: $estoque->saldo,
                pedido: $pedido,
                pedidoItem: $pedidoItem,
                observacao: $observacao,
            );
        });
    }

    /**
     * Devolve uma reserva ao disponível (pedido cancelado/rejeitado).
     */
    public function liberarReserva(
        Peca $peca,
        int $localId,
        int $quantidade,
        ?Pedido $pedido = null,
        ?PedidoItem $pedidoItem = null,
        ?string $observacao = null,
    ): PecaMovimento {
        $this->validarQuantidadePositiva($quantidade);

        return DB::transaction(function () use ($peca, $localId, $quantidade, $pedido, $pedidoItem, $observacao) {
            $estoque = $this->travarEstoque($peca, $localId);

            // Clamp em 0: liberar mais do que está reservado indica bug a montante,
            // mas deixar saldo_reservado negativo corromperia todo cálculo futuro
            // de disponibilidade. Prende o dano aqui.
            $liberado = min($quantidade, $estoque->saldo_reservado);

            $estoque->saldo_reservado -= $liberado;
            $estoque->save();

            return $this->registrar(
                peca: $peca,
                localId: $localId,
                tipo: PecaMovimento::TIPO_LIBERACAO,
                quantidade: -$liberado,
                saldoAnterior: $estoque->saldo,
                saldoPosterior: $estoque->saldo,
                pedido: $pedido,
                pedidoItem: $pedidoItem,
                observacao: $observacao,
            );
        });
    }

    /**
     * Entrada física (compra, nota de entrada, devolução).
     */
    public function darEntrada(
        Peca $peca,
        int $localId,
        int $quantidade,
        ?string $observacao = null,
        string $tipo = PecaMovimento::TIPO_ENTRADA,
    ): PecaMovimento {
        $this->validarQuantidadePositiva($quantidade);

        return DB::transaction(function () use ($peca, $localId, $quantidade, $observacao, $tipo) {
            $estoque = $this->travarEstoque($peca, $localId);

            $anterior = $estoque->saldo;
            $estoque->saldo += $quantidade;
            $estoque->save();

            return $this->registrar(
                peca: $peca,
                localId: $localId,
                tipo: $tipo,
                quantidade: $quantidade,
                saldoAnterior: $anterior,
                saldoPosterior: $estoque->saldo,
                observacao: $observacao,
            );
        });
    }

    /**
     * Saída física. Baixa o saldo e consome a reserva correspondente.
     *
     * @param  bool  $consomeReserva  Quando a saída atende um pedido que já
     *                                reservou, também desce saldo_reservado.
     *                                Numa venda de balcão sem reserva, false.
     * @throws EstoqueInsuficienteException
     */
    public function darBaixa(
        Peca $peca,
        int $localId,
        int $quantidade,
        ?Pedido $pedido = null,
        ?PedidoItem $pedidoItem = null,
        ?Romaneio $romaneio = null,
        bool $consomeReserva = true,
        ?string $observacao = null,
    ): PecaMovimento {
        $this->validarQuantidadePositiva($quantidade);

        return DB::transaction(function () use (
            $peca, $localId, $quantidade, $pedido, $pedidoItem, $romaneio, $consomeReserva, $observacao
        ) {
            $estoque = $this->travarEstoque($peca, $localId);

            // Confere contra o saldo FÍSICO: a quantidade já estava reservada
            // para este pedido, então não se desconta a reserva aqui.
            $limite = $consomeReserva
                ? $estoque->saldo
                : max(0, $estoque->saldo - $estoque->saldo_reservado);

            if ($quantidade > $limite) {
                throw new EstoqueInsuficienteException(
                    $peca, $quantidade, $limite, $this->nomeLocal($localId)
                );
            }

            $anterior = $estoque->saldo;
            $estoque->saldo -= $quantidade;

            if ($consomeReserva) {
                $estoque->saldo_reservado = max(0, $estoque->saldo_reservado - $quantidade);
            }

            $estoque->save();

            return $this->registrar(
                peca: $peca,
                localId: $localId,
                tipo: PecaMovimento::TIPO_SAIDA,
                quantidade: -$quantidade,
                saldoAnterior: $anterior,
                saldoPosterior: $estoque->saldo,
                pedido: $pedido,
                pedidoItem: $pedidoItem,
                romaneio: $romaneio,
                observacao: $observacao,
            );
        });
    }

    /**
     * Move quantidade entre dois locais: uma transação, duas pernas no ledger.
     *
     * Usar isto (e não darBaixa + darEntrada soltos) garante que origem e destino
     * nunca fiquem inconsistentes se algo falhar no meio.
     *
     * @return array{saida: PecaMovimento, entrada: PecaMovimento}
     * @throws EstoqueInsuficienteException
     */
    public function transferir(
        Peca $peca,
        int $localOrigemId,
        int $localDestinoId,
        int $quantidade,
        ?Pedido $pedido = null,
        ?Romaneio $romaneio = null,
        bool $consomeReserva = true,
        ?string $observacao = null,
    ): array {
        $this->validarQuantidadePositiva($quantidade);

        if ($localOrigemId === $localDestinoId) {
            throw new \InvalidArgumentException('Origem e destino da transferência são o mesmo local.');
        }

        return DB::transaction(function () use (
            $peca, $localOrigemId, $localDestinoId, $quantidade, $pedido, $romaneio, $consomeReserva, $observacao
        ) {
            // Ordem determinística de lock: sempre o menor id primeiro.
            // Duas transferências simultâneas em sentidos opostos (A->B e B->A)
            // travariam uma na outra em deadlock se cada uma travasse na ordem
            // da própria operação.
            $ordem = [$localOrigemId, $localDestinoId];
            sort($ordem);
            foreach ($ordem as $id) {
                $this->travarEstoque($peca, $id);
            }

            $origem = $this->travarEstoque($peca, $localOrigemId);

            $limite = $consomeReserva
                ? $origem->saldo
                : max(0, $origem->saldo - $origem->saldo_reservado);

            if ($quantidade > $limite) {
                throw new EstoqueInsuficienteException(
                    $peca, $quantidade, $limite, $this->nomeLocal($localOrigemId)
                );
            }

            $saldoOrigemAntes = $origem->saldo;
            $origem->saldo -= $quantidade;
            if ($consomeReserva) {
                $origem->saldo_reservado = max(0, $origem->saldo_reservado - $quantidade);
            }
            $origem->save();

            $destino = $this->travarEstoque($peca, $localDestinoId);
            $saldoDestinoAntes = $destino->saldo;
            $destino->saldo += $quantidade;
            $destino->save();

            $saida = $this->registrar(
                peca: $peca,
                localId: $localOrigemId,
                tipo: PecaMovimento::TIPO_TRANSFERENCIA,
                quantidade: -$quantidade,
                saldoAnterior: $saldoOrigemAntes,
                saldoPosterior: $origem->saldo,
                pedido: $pedido,
                romaneio: $romaneio,
                contraparteId: $localDestinoId,
                observacao: $observacao,
            );

            $entrada = $this->registrar(
                peca: $peca,
                localId: $localDestinoId,
                tipo: PecaMovimento::TIPO_TRANSFERENCIA,
                quantidade: $quantidade,
                saldoAnterior: $saldoDestinoAntes,
                saldoPosterior: $destino->saldo,
                pedido: $pedido,
                romaneio: $romaneio,
                contraparteId: $localOrigemId,
                observacao: $observacao,
            );

            return ['saida' => $saida, 'entrada' => $entrada];
        });
    }

    /**
     * Correção de inventário: define o saldo absoluto contado na prateleira.
     * Exige justificativa — ajuste sem motivo é o que torna auditoria inútil.
     */
    public function ajustar(
        Peca $peca,
        int $localId,
        int $saldoContado,
        string $observacao,
    ): PecaMovimento {
        if ($saldoContado < 0) {
            throw new \InvalidArgumentException('Saldo contado não pode ser negativo.');
        }

        if (trim($observacao) === '') {
            throw new \InvalidArgumentException('Ajuste de inventário exige justificativa.');
        }

        return DB::transaction(function () use ($peca, $localId, $saldoContado, $observacao) {
            $estoque = $this->travarEstoque($peca, $localId);

            $anterior = $estoque->saldo;
            $estoque->saldo = $saldoContado;
            $estoque->contado_em = now();
            $estoque->save();

            return $this->registrar(
                peca: $peca,
                localId: $localId,
                tipo: PecaMovimento::TIPO_AJUSTE,
                quantidade: $saldoContado - $anterior,
                saldoAnterior: $anterior,
                saldoPosterior: $saldoContado,
                observacao: $observacao,
            );
        });
    }

    /**
     * Confere se o ledger reconstrói o saldo atual.
     * Divergência significa escrita que fugiu deste serviço.
     *
     * @return array{saldo_atual:int, saldo_ledger:int, bate:bool}
     */
    public function conferir(Peca $peca, int $localId): array
    {
        $estoque = PecaEstoque::where('peca_id', $peca->id)
            ->where('local_id', $localId)
            ->first();

        $saldoAtual = (int) ($estoque->saldo ?? 0);

        $saldoLedger = (int) PecaMovimento::where('peca_id', $peca->id)
            ->where('local_id', $localId)
            ->fisicos()
            ->sum('quantidade');

        return [
            'saldo_atual'  => $saldoAtual,
            'saldo_ledger' => $saldoLedger,
            'bate'         => $saldoAtual === $saldoLedger,
        ];
    }

    // ------------------------------------------------------------------
    // Internos
    // ------------------------------------------------------------------

    /**
     * Busca (ou cria) a linha de saldo e a TRAVA até o fim da transação.
     *
     * firstOrCreate antes do lock é proposital: não dá para travar uma linha que
     * ainda não existe. A corrida de criação é resolvida pelo UNIQUE
     * (peca_id, local_id) — se dois processos criarem ao mesmo tempo, um recebe
     * violação de chave e o retry pega a linha já criada.
     */
    private function travarEstoque(Peca $peca, int $localId): PecaEstoque
    {
        try {
            PecaEstoque::firstOrCreate(
                ['peca_id' => $peca->id, 'local_id' => $localId],
                ['saldo' => 0, 'saldo_reservado' => 0, 'saldo_minimo' => 0],
            );
        } catch (\Illuminate\Database\UniqueConstraintViolationException) {
            // Outro processo criou entre o SELECT e o INSERT. A linha existe.
        }

        return PecaEstoque::where('peca_id', $peca->id)
            ->where('local_id', $localId)
            ->lockForUpdate()
            ->firstOrFail();
    }

    private function registrar(
        Peca $peca,
        int $localId,
        string $tipo,
        int $quantidade,
        int $saldoAnterior,
        int $saldoPosterior,
        ?Pedido $pedido = null,
        ?PedidoItem $pedidoItem = null,
        ?Romaneio $romaneio = null,
        ?int $contraparteId = null,
        ?string $observacao = null,
    ): PecaMovimento {
        return PecaMovimento::create([
            'peca_id'              => $peca->id,
            'local_id'             => $localId,
            'tipo'                 => $tipo,
            'quantidade'           => $quantidade,
            'saldo_anterior'       => $saldoAnterior,
            'saldo_posterior'      => $saldoPosterior,
            'pedido_id'            => $pedido?->id,
            'pedido_item_id'       => $pedidoItem?->id,
            'romaneio_id'          => $romaneio?->id,
            'local_contraparte_id' => $contraparteId,
            'user_id'              => Auth::id(),
            'observacao'           => $observacao,
        ]);
    }

    private function validarQuantidadePositiva(int $quantidade): void
    {
        if ($quantidade <= 0) {
            throw new \InvalidArgumentException('A quantidade deve ser maior que zero.');
        }
    }

    private function nomeLocal(int $localId): string
    {
        return EstoqueLocal::find($localId)?->nome ?? "Local #{$localId}";
    }
}
