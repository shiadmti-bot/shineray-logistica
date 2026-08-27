<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FASE 4 — GATE 2: A CONFERÊNCIA ANTES DO DESPACHO (Passo 7 do manual)
 *
 * A segunda metade da regra de negócio. Até aqui a conferência de peça só
 * existia no RECEBIMENTO — depois que o caminhão viajou, quando o erro já
 * custou uma viagem. O manual manda conferir na doca, com a caixa aberta ao
 * lado, e é isso que estas colunas passam a registrar.
 *
 * A FOTO É A EVIDÊNCIA
 * A validação final é feita com a foto do romaneio assinado. Guardar a URL
 * junto do carimbo de quem conferiu é o que transforma "a loja disse que
 * conferiu" em prova — mesma lógica do canhoto de moto em
 * pedidos.comprovante_url.
 *
 * O MOTIVO DO AJUSTE SOBREVIVE AO CICLO
 * Quando a filial acusa falta, a caixa reabre, o item entra, a NF é cancelada
 * e outra é emitida. `ajuste_motivo` fica gravado para que a próxima
 * conferência saiba o que estava errado — e para que o indicador de "ajustes
 * por conferência" da Fase 5 tenha de onde sair.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('basquetas', function (Blueprint $table) {
            // Foto do romaneio conferido — a evidência do Gate 2.
            $table->string('foto_romaneio_url')->nullable()->after('conferida_por');

            // Observação livre de quem liberou.
            $table->text('conferencia_observacao')->nullable()->after('foto_romaneio_url');

            // O que a filial acusou de errado na última recusa.
            $table->text('ajuste_motivo')->nullable()->after('conferencia_observacao');
        });
    }

    public function down(): void
    {
        Schema::table('basquetas', function (Blueprint $table) {
            $table->dropColumn([
                'foto_romaneio_url',
                'conferencia_observacao',
                'ajuste_motivo',
            ]);
        });
    }
};
