<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V3.4 — RESOLUÇÃO DE DIVERGÊNCIA DE RECEBIMENTO.
 *
 * O recebimento já marca o item como `divergencia` quando a loja confere
 * quantidade diferente da enviada. Faltava o outro lado: o CD precisa poder
 * FECHAR essa pendência dizendo o que aconteceu.
 *
 * Sem isso, a divergência fica registrada mas nunca sai da tela — a fila só
 * cresce e vira ruído que todo mundo aprende a ignorar. Uma pendência que não
 * pode ser encerrada é pior que nenhuma pendência.
 *
 * Não criei tabela nova: a divergência é um atributo do item de carga, e um
 * `pendencias` separado duplicaria a chave sem ganhar nada.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('romaneio_itens', function (Blueprint $table) {
            $table->timestamp('resolvido_em')->nullable()->after('entregue_em');

            $table->foreignId('resolvido_por')
                  ->nullable()
                  ->after('resolvido_em')
                  ->constrained('users')
                  ->nullOnDelete();

            /*
             * O que o CD concluiu:
             *   reenvio       -> vai mandar o que faltou em outra carga
             *   perda         -> extraviou; some do estoque de vez
             *   erro_contagem -> a loja recontou e estava certo; devolve ao CD
             *   aceito        -> diferença aceita sem ação de estoque
             */
            $table->enum('resolucao', ['reenvio', 'perda', 'erro_contagem', 'aceito'])
                  ->nullable()
                  ->after('resolvido_por');

            $table->text('resolucao_observacao')->nullable()->after('resolucao');

            // Índice para a fila: divergências ainda abertas.
            $table->index(['status', 'resolvido_em'], 'romaneio_itens_pendencias');
        });
    }

    public function down(): void
    {
        Schema::table('romaneio_itens', function (Blueprint $table) {
            $table->dropIndex('romaneio_itens_pendencias');
            $table->dropForeign(['resolvido_por']);
            $table->dropColumn(['resolvido_em', 'resolvido_por', 'resolucao', 'resolucao_observacao']);
        });
    }
};
