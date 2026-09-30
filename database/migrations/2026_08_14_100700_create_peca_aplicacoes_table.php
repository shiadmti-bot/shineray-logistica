<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V3.2 — APLICAÇÃO DE PEÇAS (em quais modelos cada peça serve).
 *
 * PROBLEMA
 * O Microwork guarda aplicação como texto livre num único campo: "JEF 150",
 * "SHI 175 CARB", "JEF 150 / SHI 175 CARB", "JET 125/50". Isso é legível para
 * humano mas inútil para busca — a loja que procura peça de JEF não acha
 * "JEF 150 / SHI 175 CARB" com um LIKE simples, e não há como filtrar por
 * modelo. São 153 variações de texto para ~60 modelos reais.
 *
 * SOLUÇÃO
 * Normalizar em linhas (peça, modelo). Uma peça que serve em três modelos vira
 * três linhas, e a busca por modelo passa a ser um join.
 *
 * PROCEDÊNCIA É PARTE DO DADO
 * Peça errada em freio ou motor não é erro cosmético. Por isso cada vínculo
 * carrega `origem` e `confianca`, e a interface deve distinguir o que veio do
 * cadastro oficial do que foi deduzido. Nada aqui é apresentado como certeza
 * quando não é:
 *
 *   microwork  / alta  -> campo `aplicacao` do relatório. Cadastro oficial.
 *   descricao  / media -> modelo citado no nome da peça ("FILTRO OLEO STORM 200").
 *   manual     / alta  -> alguém do CD confirmou.
 *   inferido   / baixa -> dedução do sistema. É SUGESTÃO, e a tela deve dizer isso.
 *
 * O que este módulo deliberadamente NÃO faz: inventar compatibilidade a partir
 * de fontes externas. Existe compatibilidade cruzada real na linha Shineray
 * (a mesma trava de pinhão serve JEF 150, SHI 175 e Storm 200), mas confirmar
 * isso exige código OEM ou catálogo do fabricante — não a semelhança do nome.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('peca_aplicacoes', function (Blueprint $table) {
            $table->id();

            $table->foreignId('peca_id')->constrained('pecas')->cascadeOnDelete();

            // Família normalizada (JEF, SHI, STORM...) e modelo específico.
            // A família permite a busca ampla: "toda peça de JEF".
            $table->string('familia', 40);
            $table->string('modelo', 80)->nullable();

            // Cilindrada, quando identificável (150, 175, 200...). Ajuda a
            // desambiguar JET 50 de JET 125.
            $table->unsignedSmallInteger('cilindrada')->nullable();

            // Variante de alimentação: EFI, CARB. NULL = serve nas duas.
            $table->string('variante', 20)->nullable();

            $table->enum('origem', ['microwork', 'descricao', 'manual', 'inferido'])
                  ->default('microwork');

            $table->enum('confianca', ['alta', 'media', 'baixa'])->default('alta');

            // Texto original que gerou este vínculo — permite auditar o parser
            // e corrigir sem reprocessar tudo.
            $table->string('texto_origem')->nullable();

            $table->timestamps();

            $table->unique(['peca_id', 'familia', 'modelo', 'variante'], 'peca_aplicacao_unica');
            $table->index(['familia', 'cilindrada']);
            $table->index('confianca');
        });

        Schema::table('pecas', function (Blueprint $table) {
            /*
             * Nem toda peça sem aplicação é um cadastro incompleto.
             *
             * Capacete, jaqueta, óleo, bateria e fusível não têm modelo POR
             * NATUREZA — servem em qualquer moto. Tratá-los como "faltando
             * aplicação" encheria a fila de pendências com 600+ itens que nunca
             * serão preenchidos, e esconderia as peças que de fato faltam
             * (carenagem, paralama, rabeta).
             *
             *   especifica -> serve em modelos determinados
             *   universal  -> serve em qualquer moto (acessório, consumível)
             *   indefinido -> ainda não classificado
             */
            $table->enum('tipo_item', ['especifica', 'universal', 'indefinido'])
                  ->default('indefinido')
                  ->after('categoria');

            $table->index('tipo_item');
        });
    }

    public function down(): void
    {
        Schema::table('pecas', function (Blueprint $table) {
            $table->dropIndex(['tipo_item']);
            $table->dropColumn('tipo_item');
        });

        Schema::dropIfExists('peca_aplicacoes');
    }
};
