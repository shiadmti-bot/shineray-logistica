<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V3.6 — A COTA CORTADA DEIXA DE SER APAGADA.
 *
 * AprovarPedido::cortarItens fazia `$item->delete()` num model SEM soft
 * delete. A linha "5x NEW JEF VERMELHA" desaparecia da base e a única prova
 * de que ela existiu era uma linha de texto no log:
 *
 *     🚫 NEW JEF (VERMELHA) - 5 un.
 *        ↳ Motivo: sem estoque
 *
 * Duas consequências. A primeira é de auditoria: não há como reconstruir o que
 * a loja pediu originalmente, só o que sobrou. A segunda é pior e silenciosa —
 * `pedido_moto.pedido_item_id` é `nullOnDelete()`, então apagar a cota
 * ARRANCAVA o vínculo entre os chassis já atribuídos e a cota que eles
 * abateram, em toda linha do pivô que apontava para ela.
 *
 * COMPATIBILIDADE: nenhuma linha nasce com `deleted_at`, e o escopo global do
 * SoftDeletes reproduz exatamente o que o hard delete fazia — a cota cortada
 * continua fora de `itensPedido`, de `saldoPendente()` e dos contadores da
 * listagem. O que muda é que agora ela pode ser trazida de volta com
 * `withTrashed()` quando alguém precisa saber o que foi recusado.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedido_itens', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('pedido_itens', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
