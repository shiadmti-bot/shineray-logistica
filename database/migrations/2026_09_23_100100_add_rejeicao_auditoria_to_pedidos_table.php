<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * V3.6 — QUEM rejeitou e QUANDO, ao lado do POR QUÊ.
 *
 * `motivo_rejeicao` existe desde 26/12/2025 e, até aqui, era uma coluna
 * fantasma: CancelarPedido escrevia nela e NENHUM lugar do sistema lia. Não
 * havia controller, view ou relatório que consultasse o motivo — ele só
 * sobrevivia dentro da frase do PedidoLog. A loja recebia a notificação
 * "Pedido #X rejeitado: <motivo>" e, ao abrir a lista, não achava o pedido
 * (soft delete) nem o motivo em lugar algum.
 *
 * Autor e data ficavam igualmente implícitos: `deleted_at` dizia quando, por
 * acidente, e o autor só existia como texto no log.
 *
 * BACKFILL: `rejeitado_em` recebe `deleted_at` dos pedidos já encerrados por
 * recusa, porque nesses casos as duas datas são o mesmo instante — a exclusão
 * acontece dentro da transação da rejeição. O autor não é inferido: não existe
 * dado estruturado de onde tirá-lo, e preencher por heurística a partir de
 * texto livre seria inventar responsável em registro de auditoria.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->foreignId('rejeitado_por')->nullable()->after('motivo_rejeicao')
                  ->constrained('users')->nullOnDelete();

            $table->timestamp('rejeitado_em')->nullable()->after('rejeitado_por');
        });

        DB::table('pedidos')
            ->whereIn('status', ['rejeitado', 'cancelado'])
            ->whereNotNull('deleted_at')
            ->update(['rejeitado_em' => DB::raw('deleted_at')]);
    }

    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropForeign(['rejeitado_por']);
            $table->dropColumn(['rejeitado_por', 'rejeitado_em']);
        });
    }
};
