<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FASE 3 — NOTA FISCAL DA BASQUETA (Passo 6 do manual)
 *
 * Até aqui o sistema não registrava NENHUMA nota fiscal. Não há número, série
 * nem chave em pedidos, romaneios ou romaneio_itens: a NF é emitida no
 * Microwork e o vínculo com a carga simplesmente se perdia.
 *
 * POR QUE UMA TABELA E NÃO COLUNAS EM `basquetas`
 * O Passo 7 do manual prevê exatamente o caso que colunas não suportam: falta
 * uma peça, a caixa é reaberta, o item entra e é emitida uma NOVA nota. As duas
 * precisam coexistir — a cancelada com o motivo, a vigente em uso. Sobrescrever
 * o número apagaria o rastro fiscal justamente no evento que mais precisa dele.
 *
 * POR QUE PERTENCE À BASQUETA E NÃO AO ROMANEIO
 * A NF é por destinatário. Um caminhão com caixas para três filiais emite três
 * notas, e a carga é uma só. Pendurar a nota no romaneio forçaria uma nota por
 * caminhão, que é fiscalmente errado.
 *
 * O NÚMERO VEM DIGITADO
 * A emissão continua no Microwork. Este registro é o vínculo — o que permite
 * responder "qual nota cobre esta caixa?" e "qual foi cancelada e por quê?".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('basqueta_notas', function (Blueprint $table) {
            $table->id();

            $table->foreignId('basqueta_id')->constrained('basquetas')->cascadeOnDelete();

            $table->string('numero');
            $table->string('serie', 10)->nullable();

            // Chave de acesso da NF-e: 44 dígitos. Nullable porque a nota pode
            // ser registrada antes de o XML voltar autorizado.
            $table->string('chave', 44)->nullable();

            $table->decimal('valor_total', 12, 2)->nullable();

            $table->timestamp('emitida_em');
            $table->foreignId('emitida_por')->nullable()
                  ->constrained('users')->nullOnDelete();

            // Preenchidos quando o Passo 7 obriga a reemitir.
            $table->timestamp('cancelada_em')->nullable();
            $table->foreignId('cancelada_por')->nullable()
                  ->constrained('users')->nullOnDelete();
            $table->text('motivo_cancelamento')->nullable();

            $table->timestamps();

            // "Qual a nota vigente desta caixa?" é a pergunta feita a cada
            // impressão de romaneio e a cada conferência.
            $table->index(['basqueta_id', 'cancelada_em']);
        });

        Schema::table('basquetas', function (Blueprint $table) {
            /*
             * Versão do romaneio de peças. Sobe a cada reemissão do Passo 7,
             * para que a filial saiba que o documento na mão dela venceu — um
             * romaneio corrigido sem número novo é indistinguível do anterior.
             */
            $table->unsignedInteger('romaneio_versao')->default(1)->after('volumes');
        });
    }

    public function down(): void
    {
        Schema::table('basquetas', function (Blueprint $table) {
            $table->dropColumn('romaneio_versao');
        });

        Schema::dropIfExists('basqueta_notas');
    }
};
