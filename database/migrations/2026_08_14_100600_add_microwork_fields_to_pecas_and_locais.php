<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V3.1 — CAMPOS REAIS DO RELATÓRIO DE PEÇAS DO MICROWORK (151/67).
 *
 * Ajusta o schema ao que a API devolve de fato, verificado contra 4.689
 * registros reais:
 *
 *   codigomercadoria    -> pecas.codigo          (até 19 chars)
 *   descricaomercadoria -> pecas.descricao       (até 117 chars)
 *   aplicacao           -> pecas.aplicacao       (até 73 chars, texto livre)
 *   valorbasevenda      -> pecas.preco_referencia
 *   custoaquisicao      -> pecas.custo_aquisicao   (novo)
 *   marca               -> pecas.marca             (novo)
 *   codigoncm           -> pecas.codigo_ncm        (novo)
 *   data...ultimaentrada/saida -> pecas.ultima_*   (novo, alimenta curva de giro)
 *
 * O PONTO CRÍTICO É `codigoempresa`.
 *
 * O relatório NÃO devolve um saldo consolidado: devolve uma linha por
 * (mercadoria, empresa). O mesmo código aparece em várias empresas — 885 dos
 * 2.385 códigos estão em mais de uma. Sem traduzir empresa -> local, o sync
 * somaria o estoque de todas as lojas no CD e o saldo de cada ponto ficaria
 * errado.
 *
 * `estoque_locais.codigo_empresa_microwork` é essa tradução. Locais sem
 * mapeamento são ignorados pelo sync de propósito: deixar de importar é
 * recuperável, importar no lugar errado não.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('estoque_locais', function (Blueprint $table) {
            // Empresa correspondente no Microwork. NULL = não sincroniza.
            $table->unsignedInteger('codigo_empresa_microwork')
                  ->nullable()
                  ->unique()
                  ->after('user_id');
        });

        Schema::table('pecas', function (Blueprint $table) {
            $table->string('marca')->nullable()->after('categoria');
            $table->string('codigo_ncm', 20)->nullable()->after('codigo_barras');
            $table->decimal('custo_aquisicao', 10, 2)->nullable()->after('preco_referencia');
            $table->date('ultima_entrada')->nullable()->after('sincronizado_em');
            $table->date('ultima_saida')->nullable()->after('ultima_entrada');

            $table->index('marca');
        });

        // `aplicacao` foi criada como JSON prevendo uma lista, mas a API manda
        // texto livre ("JET 125/50"). Texto é o formato certo aqui: converter
        // para array exigiria adivinhar o separador e perderia informação.
        Schema::table('pecas', function (Blueprint $table) {
            $table->text('aplicacao')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('pecas', function (Blueprint $table) {
            $table->dropIndex(['marca']);
            $table->dropColumn([
                'marca', 'codigo_ncm', 'custo_aquisicao', 'ultima_entrada', 'ultima_saida',
            ]);
            $table->json('aplicacao')->nullable()->change();
        });

        Schema::table('estoque_locais', function (Blueprint $table) {
            $table->dropUnique(['codigo_empresa_microwork']);
            $table->dropColumn('codigo_empresa_microwork');
        });
    }
};
