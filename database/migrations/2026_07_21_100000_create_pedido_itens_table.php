<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V2.6 — Pedido Genérico (sem chassi) e Atribuição pelo CD.
 *
 * A partir desta versão a loja pode pedir "5x NEW JEF VERMELHA" sem informar chassi.
 * Cada linha desta tabela representa uma cota (modelo + cor + motivo + destino) e
 * controla quantos chassis reais o CD já vinculou àquela cota.
 *
 * COMPATIBILIDADE COM PEDIDOS LEGADOS:
 * Pedidos criados antes desta atualização NÃO recebem linhas aqui (não há backfill).
 * A ausência de linhas é interpretada pelo sistema como "pedido legado, 100% atribuído",
 * de modo que todo o fluxo antigo (separação, romaneio, recebimento) continua idêntico.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pedido_itens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->constrained('pedidos')->onDelete('cascade');

            $table->string('modelo');
            $table->string('cor');
            $table->string('motivo')->nullable();
            $table->string('local')->nullable(); // Destino final da cota

            $table->unsignedInteger('quantidade')->default(1);
            $table->unsignedInteger('qtd_atribuida')->default(0);
            $table->unsignedInteger('qtd_cancelada')->default(0);

            // Encerramento de saldo pelo CD (ex: pediram 5, só existiam 3)
            $table->text('motivo_cancelamento')->nullable();
            $table->foreignId('cancelado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cancelado_em')->nullable();

            // TRUE quando a loja informou o chassi na criação (transferência / venda confirmada)
            $table->boolean('exige_chassi')->default(false);

            $table->timestamps();

            $table->index(['pedido_id', 'modelo', 'cor']);
        });

        Schema::table('pedido_moto', function (Blueprint $table) {
            // Liga o chassi bipado à cota genérica que ele abateu.
            // NULL = vínculo legado (chassi informado direto pela loja).
            $table->foreignId('pedido_item_id')
                  ->nullable()
                  ->after('moto_id')
                  ->constrained('pedido_itens')
                  ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('pedido_moto', function (Blueprint $table) {
            $table->dropForeign(['pedido_item_id']);
            $table->dropColumn('pedido_item_id');
        });

        Schema::dropIfExists('pedido_itens');
    }
};
