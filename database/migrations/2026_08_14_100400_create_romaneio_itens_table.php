<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * V3 — ITENS DE CARGA (ROMANEIO MISTO)
 *
 * Hoje a carga é `Romaneio hasMany Moto` via motos.romaneio_id. Isso embute
 * duas premissas que a expedição de peças quebra:
 *   1. o item de carga é sempre uma moto;
 *   2. o item é sempre 1 unidade (a moto é indivisível).
 *
 * Peça precisa de "12x pastilha", e o mesmo caminhão leva moto e peça.
 * Daí a tabela polimórfica com quantidade.
 *
 * ESTRATÉGIA DE MIGRAÇÃO — SEM REGRESSÃO:
 * motos.romaneio_id NÃO é removida e continua sendo escrita normalmente. Todo o
 * código atual (RomaneioController, telas de carga, dashboard) segue funcionando
 * sem alteração. Esta tabela é preenchida em paralelo (dual-write) e é o que as
 * telas novas leem. A remoção de motos.romaneio_id só deve acontecer quando
 * nenhuma leitura depender mais dela — não faz parte desta fase.
 *
 * O backfill abaixo replica o vínculo moto->carga que já existe, para que a
 * visão nova nasça consistente com o histórico.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('romaneio_itens', function (Blueprint $table) {
            $table->id();

            $table->foreignId('romaneio_id')->constrained('romaneios')->cascadeOnDelete();

            // Moto (quantidade sempre 1) ou Peca (quantidade N).
            $table->morphs('itemable');

            $table->foreignId('pedido_id')->nullable()->constrained('pedidos')->nullOnDelete();
            $table->foreignId('pedido_item_id')->nullable()->constrained('pedido_itens')->nullOnDelete();

            $table->unsignedInteger('quantidade')->default(1);

            // Quanto o destino confirmou no recebimento. Divergência = quantidade
            // != quantidade_recebida, e é isso que abre pendência para o CD.
            $table->unsignedInteger('quantidade_recebida')->nullable();

            /*
             * carregado    -> está no caminhão
             * em_transito  -> carga saiu
             * entregue     -> destino confirmou integralmente
             * divergencia  -> destino confirmou quantidade diferente
             * retornado    -> voltou ao CD sem entregar
             */
            $table->enum('status', [
                'carregado', 'em_transito', 'entregue', 'divergencia', 'retornado',
            ])->default('carregado');

            // Local de destino do item. Numa carga com várias paradas, itens do
            // mesmo romaneio descem em lojas diferentes.
            $table->foreignId('local_destino_id')->nullable()->constrained('estoque_locais')->nullOnDelete();

            $table->text('observacao')->nullable();
            $table->timestamp('entregue_em')->nullable();

            $table->timestamps();

            $table->index(['romaneio_id', 'status']);
            $table->index(['pedido_id']);
        });

        $this->backfillMotos();
    }

    /**
     * Replica em romaneio_itens os vínculos moto->carga que já existem,
     * para que a visão nova cubra também o histórico.
     *
     * Set-based de propósito: uma query só. Iterar moto a moto consultando
     * pedido_moto individualmente derruba a migration em bases reais.
     *
     * O pedido de referência é o de MAIOR id em pedido_moto para aquela moto —
     * id é monotônico e é a PK, então o desempate é estável e indexado
     * (created_at pode empatar em vínculos criados no mesmo segundo).
     */
    private function backfillMotos(): void
    {
        $motoClass = str_replace('\\', '\\\\', \App\Models\Moto::class);

        DB::statement("
            INSERT INTO romaneio_itens (
                romaneio_id, itemable_type, itemable_id,
                pedido_id, pedido_item_id,
                quantidade, quantidade_recebida, status,
                local_destino_id, created_at, updated_at
            )
            SELECT
                m.romaneio_id,
                '{$motoClass}',
                m.id,
                pm.pedido_id,
                pm.pedido_item_id,
                1,
                CASE WHEN m.status = 'estoque_loja' THEN 1 ELSE NULL END,
                CASE WHEN m.status = 'estoque_loja' THEN 'entregue' ELSE 'carregado' END,
                u.estoque_local_id,
                COALESCE(m.created_at, NOW()),
                NOW()
            FROM motos m
            LEFT JOIN (
                SELECT pmi.moto_id, pmi.pedido_id, pmi.pedido_item_id
                FROM pedido_moto pmi
                INNER JOIN (
                    SELECT moto_id, MAX(id) AS max_id
                    FROM pedido_moto
                    GROUP BY moto_id
                ) ult ON ult.max_id = pmi.id
            ) pm ON pm.moto_id = m.id
            LEFT JOIN users u ON u.id = m.loja_atual_id
            WHERE m.romaneio_id IS NOT NULL
              AND m.deleted_at IS NULL
        ");
    }

    public function down(): void
    {
        Schema::dropIfExists('romaneio_itens');
    }
};
