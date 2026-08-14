<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * V3 — PEDIDO MULTI-TIPO (MOTO / PEÇA / MISTO)
 *
 * A refatoração v2.6 já deixou o pedido genérico: pedido_itens é uma COTA
 * ("5x NEW JEF VERMELHA") e o CD abate essa cota vinculando unidades reais.
 * Peça encaixa nessa forma sem mudança estrutural — "20x pastilha de freio" é
 * a mesma coisa, só que a cota é abatida por quantidade em vez de por chassi.
 *
 * O que falta é DISCRIMINAR o tipo. Sem isso o CD não sabe se a cota se abate
 * bipando chassi ou dando baixa de saldo.
 *
 * COMPATIBILIDADE:
 * Todos os pedidos e cotas existentes são moto. O default 'moto' garante que
 * pedidos legados e o código atual continuem se comportando exatamente igual.
 * modelo/cor viram nullable porque não fazem sentido para peça — o backfill
 * abaixo roda antes, então nenhuma linha existente fica órfã.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            // moto | peca | misto — 'misto' fica reservado para quando uma
            // solicitação puder carregar cotas dos dois tipos.
            $table->enum('tipo_carga', ['moto', 'peca', 'misto'])
                  ->default('moto')
                  ->after('status');

            // Local que atende (CD ou loja fornecedora) e local que recebe.
            // Convivem com origem_user_id/destino_user_id, que continuam válidos.
            $table->foreignId('local_origem_id')->nullable()
                  ->after('origem_user_id')->constrained('estoque_locais')->nullOnDelete();

            $table->foreignId('local_destino_id')->nullable()
                  ->after('local_origem_id')->constrained('estoque_locais')->nullOnDelete();

            $table->index('tipo_carga');
        });

        Schema::table('pedido_itens', function (Blueprint $table) {
            $table->enum('tipo', ['moto', 'peca'])
                  ->default('moto')
                  ->after('pedido_id');

            // Preenchido apenas quando tipo = 'peca'.
            $table->foreignId('peca_id')->nullable()
                  ->after('tipo')->constrained('pecas')->nullOnDelete();

            $table->index(['pedido_id', 'tipo']);
        });

        // Garante que o histórico fique explicitamente marcado como moto,
        // em vez de depender só do default da coluna.
        DB::table('pedidos')->update(['tipo_carga' => 'moto']);
        DB::table('pedido_itens')->update(['tipo' => 'moto']);

        // Só agora afrouxa modelo/cor: nenhuma linha existente é peça.
        Schema::table('pedido_itens', function (Blueprint $table) {
            $table->string('modelo')->nullable()->change();
            $table->string('cor')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('pedido_itens', function (Blueprint $table) {
            $table->dropForeign(['peca_id']);
            $table->dropIndex(['pedido_id', 'tipo']);
            $table->dropColumn(['tipo', 'peca_id']);
        });

        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropForeign(['local_origem_id']);
            $table->dropForeign(['local_destino_id']);
            $table->dropIndex(['tipo_carga']);
            $table->dropColumn(['tipo_carga', 'local_origem_id', 'local_destino_id']);
        });
    }
};
