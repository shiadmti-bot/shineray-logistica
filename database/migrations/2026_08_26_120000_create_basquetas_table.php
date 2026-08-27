<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FASE 2 — A BASQUETA (Passos 4 e 5 do manual)
 *
 * A basqueta é o caixote reservado a uma filial no galpão. A peça separada
 * cai nele e fica acumulando por dias, até o CD montar a carga daquela filial
 * — quando ela é esvaziada inteira, de uma vez.
 *
 * POR QUE UMA TABELA E NÃO UMA CONSULTA
 * Hoje "o que está acumulado para Castanhal" só é reconstruível varrendo
 * pedidos em 'separado'. Isso responde o conteúdo, mas não responde nada do
 * que os Passos 6 e 7 precisam: qual viagem vai levar esta caixa, qual NF foi
 * emitida para ela, quem conferiu o romaneio, quando foi reaberta. Tudo isso
 * é atributo do CAIXOTE, não de um pedido — e um caixote reúne itens de
 * vários pedidos.
 *
 * UMA ABERTA POR FILIAL, GARANTIDO PELO BANCO
 * `local_aberto_id` repete estoque_local_id enquanto a basqueta está aberta e
 * vira NULL quando ela é esvaziada. Como no MySQL/TiDB NULL nunca colide com
 * NULL num índice UNIQUE, isso dá exatamente a regra desejada: no máximo uma
 * basqueta aberta por filial, e quantas fechadas quiserem no histórico.
 *
 * É a mesma peculiaridade de NULL que a migration 2026_08_14_100000 apontou
 * como armadilha em peca_estoques — lá ela quebrava o índice, aqui ela é o
 * mecanismo. A diferença é que ali NULL significava "o CD", um valor real
 * disfarçado; aqui significa "não está aberta", que é ausência de verdade.
 *
 * A DATA DE SAÍDA NÃO MORA AQUI
 * `schedule_id` aponta para a viagem que o gerente do CD montou no Calendário.
 * A data vem de schedules.date, nunca copiada — se a viagem for remarcada, a
 * basqueta acompanha sozinha.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('basquetas', function (Blueprint $table) {
            $table->id();

            $table->foreignId('estoque_local_id')->constrained('estoque_locais')->cascadeOnDelete();

            /*
             * aberta          -> acumulando peças separadas
             * rota_confirmada -> o CD confirmou a viagem que vai levá-la
             * faturada        -> NF emitida e romaneio de peças gerado (Fase 3)
             * em_conferencia  -> romaneio enviado à filial (Fase 4)
             * ajuste_solicitado -> a filial pediu correção (Fase 4)
             * liberada        -> conferida, pronta para embarcar (Fase 4)
             * despachada      -> saiu no caminhão
             */
            $table->string('status')->default('aberta');

            // Espelho de estoque_local_id enquanto aberta; NULL depois.
            // Ver o cabeçalho: é o que garante uma aberta por filial.
            $table->unsignedBigInteger('local_aberto_id')->nullable()->unique();

            // Viagem do Calendário que vai levar esta caixa.
            $table->foreignId('schedule_id')->nullable()
                  ->constrained('schedules')->nullOnDelete();

            // Carga em que a caixa efetivamente embarcou.
            $table->foreignId('romaneio_id')->nullable()
                  ->constrained('romaneios')->nullOnDelete();

            // --- Preenchidos nas Fases 3 e 4 ---
            $table->unsignedInteger('volumes')->nullable();       // quantas caixas
            $table->timestamp('esvaziada_em')->nullable();        // recolhida para faturar
            $table->timestamp('conferida_em')->nullable();        // Gate 2
            $table->foreignId('conferida_por')->nullable()
                  ->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->index(['estoque_local_id', 'status']);
        });

        Schema::table('pedido_itens', function (Blueprint $table) {
            /*
             * A cota aponta para o caixote em que suas unidades foram
             * depositadas. NULL enquanto não separada — e para toda cota de
             * moto, que não usa basqueta.
             */
            $table->foreignId('basqueta_id')->nullable()
                  ->after('confirmado_em')
                  ->constrained('basquetas')
                  ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('pedido_itens', function (Blueprint $table) {
            $table->dropForeign(['basqueta_id']);
            $table->dropColumn('basqueta_id');
        });

        Schema::dropIfExists('basquetas');
    }
};
