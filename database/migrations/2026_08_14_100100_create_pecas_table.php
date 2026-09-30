<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V3 — CATÁLOGO DE PEÇAS
 *
 * Diferença fundamental para `motos`: a moto É a unidade (1 linha = 1 chassi
 * físico). A peça é um TIPO — 1 linha aqui = "pastilha de freio dianteira",
 * não uma pastilha específica. O quanto existe de cada uma vive em
 * peca_estoques, por local.
 *
 * `codigo` é a chave de negócio (o código do Microwork/fabricante) e é por ele
 * que a sincronização externa casa os registros, nunca pelo id local.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pecas', function (Blueprint $table) {
            $table->id();

            // Código do fabricante / Microwork. Chave de reconciliação do sync.
            $table->string('codigo')->unique();
            $table->string('descricao');

            // Unidade de medida: UN, PC, PAR, L, KG...
            $table->string('unidade', 10)->default('UN');

            $table->string('categoria')->nullable();

            // Modelos de moto compatíveis, para busca na tela da loja.
            $table->json('aplicacao')->nullable();

            $table->string('codigo_barras')->nullable()->index();

            // Referência de preço — exibição/conferência, não fonte fiscal.
            $table->decimal('preco_referencia', 10, 2)->nullable();

            // De onde este cadastro veio: 'microwork' (sincronizado, somente
            // leitura) ou 'manual' (criado no sistema). Evita que o sync
            // sobrescreva o que o CD cadastrou à mão.
            $table->enum('origem', ['microwork', 'manual'])->default('manual');
            $table->timestamp('sincronizado_em')->nullable();

            $table->boolean('ativo')->default(true);

            $table->timestamps();
            $table->softDeletes();

            $table->index(['ativo', 'categoria']);
            $table->index('descricao');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pecas');
    }
};
