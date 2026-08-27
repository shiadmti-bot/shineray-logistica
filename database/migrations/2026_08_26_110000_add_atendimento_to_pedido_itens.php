<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * FASE 1 — ATENDIMENTO E LIBERAÇÃO DE PEÇAS (Passos 2 e 3 do manual)
 *
 * Duas lacunas fecham aqui.
 *
 * 1. PEDIDO SEM CÓDIGO
 *    O manual descreve a filial pedindo uma peça que ela não sabe nomear:
 *    "a peça que trava a marcha da JET". Hoje isso é impossível — a validação
 *    exige peca_id. `descricao_solicitada` guarda o texto da filial, e peca_id
 *    (já nullable desde a v3) fica vazio até o Call Center identificar.
 *
 * 2. AS DUAS ASSINATURAS
 *    identificado_por -> quem consultou o e-Part e escolheu o SKU.
 *    confirmado_por   -> quem liberou o item para separação (Gate 1).
 *    São atos distintos, podem ser pessoas distintas, e ambos precisam de
 *    rastro: sem eles não há como responder "quem mandou separar isto?".
 *
 * O PREÇO FICA NA COTA, NÃO NA PEÇA
 * pecas.preco_referencia é catálogo e muda com o tempo. preco_unitario congela
 * o valor informado à filial naquele atendimento — é o que ela aprovou.
 *
 * GRANDFATHERING
 * A partir desta versão, separar exige confirmado_em. Pedidos de peça que já
 * estão em curso nunca passaram pelo gate e ficariam presos, com saldo
 * reservado e sem caminho. O backfill abaixo os marca como confirmados na
 * migration, deixando explícito no motivo que a liberação é retroativa.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedido_itens', function (Blueprint $table) {
            // O que a filial pediu quando não sabia o código.
            $table->text('descricao_solicitada')->nullable()->after('peca_id');

            // Valor informado à filial neste atendimento.
            $table->decimal('preco_unitario', 10, 2)->nullable()->after('quantidade');

            // Passo 2 — identificação do código (e-Part, manual).
            $table->foreignId('identificado_por')->nullable()
                  ->after('exige_chassi')->constrained('users')->nullOnDelete();
            $table->timestamp('identificado_em')->nullable()->after('identificado_por');

            // Passo 3 — liberação do Pós-Venda (Gate 1).
            $table->foreignId('confirmado_por')->nullable()
                  ->after('identificado_em')->constrained('users')->nullOnDelete();
            $table->timestamp('confirmado_em')->nullable()->after('confirmado_por');

            // Preenchido quando o validador recusa: volta ao Call Center para
            // identificar outro SKU, em vez de sumir da fila.
            $table->text('recusa_motivo')->nullable()->after('confirmado_em');

            // A fila de atendimento pergunta "o que ainda não foi identificado?"
            // e "o que espera liberação?" a cada carregamento.
            $table->index(['tipo', 'confirmado_em']);
        });

        $this->liberarPedidosEmCurso();
    }

    public function down(): void
    {
        Schema::table('pedido_itens', function (Blueprint $table) {
            $table->dropForeign(['identificado_por']);
            $table->dropForeign(['confirmado_por']);
            $table->dropIndex(['tipo', 'confirmado_em']);
            $table->dropColumn([
                'descricao_solicitada',
                'preco_unitario',
                'identificado_por',
                'identificado_em',
                'confirmado_por',
                'confirmado_em',
                'recusa_motivo',
            ]);
        });
    }

    /**
     * Marca como já liberado tudo que está em curso.
     *
     * Encerrados ficam de fora: um pedido concluído ou cancelado não vai ser
     * separado de novo, e carimbá-lo inventaria uma liberação que ninguém deu.
     */
    private function liberarPedidosEmCurso(): void
    {
        $encerrados = ['concluido', 'cancelado', 'rejeitado'];

        $pedidos = DB::table('pedidos')
            ->where('tipo_carga', 'peca')
            ->whereNotIn('status', $encerrados)
            ->pluck('id');

        if ($pedidos->isEmpty()) {
            echo '  → Nenhum pedido de peça em curso: nada a liberar retroativamente.' . PHP_EOL;

            return;
        }

        $itens = DB::table('pedido_itens')
            ->where('tipo', 'peca')
            ->whereIn('pedido_id', $pedidos)
            ->update([
                'confirmado_em' => now(),
                'recusa_motivo' => null,
                'updated_at'    => now(),
            ]);

        echo "  → Liberação retroativa aplicada a {$itens} cota(s) de peça em {$pedidos->count()} pedido(s)." . PHP_EOL;
        echo '    confirmado_por fica NULL de propósito: ninguém assinou, foi a migration.' . PHP_EOL;
    }
};
