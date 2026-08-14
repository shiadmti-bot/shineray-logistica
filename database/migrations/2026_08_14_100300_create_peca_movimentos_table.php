<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V3 — LEDGER DE MOVIMENTAÇÃO DE PEÇAS
 *
 * peca_estoques guarda o saldo ATUAL; esta tabela guarda COMO ele chegou lá.
 *
 * Para moto essa história já existe de graça: a timeline é reconstruída de
 * pedido_moto + pedido_logs porque cada chassi é rastreável. Peça não tem
 * identidade individual — sem um livro-razão, um saldo errado é impossível de
 * auditar depois ("sumiram 3 pastilhas" vira investigação manual).
 *
 * Toda escrita em peca_estoques deve passar pelo EstoquePecaService e gravar
 * uma linha aqui na mesma transação. `saldo_anterior`/`saldo_posterior` tornam
 * a conferência aritmética e detectam qualquer escrita que fugiu do serviço.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('peca_movimentos', function (Blueprint $table) {
            $table->id();

            $table->foreignId('peca_id')->constrained('pecas')->cascadeOnDelete();
            $table->foreignId('local_id')->constrained('estoque_locais')->cascadeOnDelete();

            /*
             * entrada          -> compra/nota de entrada no CD
             * saida            -> baixa física (expedição, venda no balcão)
             * reserva          -> promete saldo a um pedido (não move saldo físico)
             * liberacao        -> devolve reserva ao disponível (pedido cancelado)
             * transferencia    -> perna de uma transferência entre locais
             * ajuste           -> correção de inventário (exige observação)
             * sync             -> reconciliação com o estoque externo (Microwork)
             */
            $table->enum('tipo', [
                'entrada', 'saida', 'reserva', 'liberacao',
                'transferencia', 'ajuste', 'sync',
            ]);

            // Assinado: positivo entra, negativo sai. Somatório por (peca, local)
            // dos tipos que mexem em saldo físico == peca_estoques.saldo.
            $table->integer('quantidade');

            $table->integer('saldo_anterior');
            $table->integer('saldo_posterior');

            // Rastro de origem do movimento.
            $table->foreignId('pedido_id')->nullable()->constrained('pedidos')->nullOnDelete();
            $table->foreignId('pedido_item_id')->nullable()->constrained('pedido_itens')->nullOnDelete();
            $table->foreignId('romaneio_id')->nullable()->constrained('romaneios')->nullOnDelete();

            // Contraparte numa transferência (local de origem ou destino).
            $table->foreignId('local_contraparte_id')->nullable()->constrained('estoque_locais')->nullOnDelete();

            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('observacao')->nullable();

            $table->timestamps();

            $table->index(['peca_id', 'local_id', 'created_at']);
            $table->index(['pedido_id']);
            $table->index(['tipo', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('peca_movimentos');
    }
};
