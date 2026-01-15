<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('motos', function (Blueprint $table) {
            // 'detalhes_avaria': Texto explicando o dano (risco, amassado, peça quebrada)
            $table->text('detalhes_avaria')->nullable()->after('localizacao_atual');
        });
        
        DB::statement("ALTER TABLE motos MODIFY COLUMN status ENUM('estoque_fabrica', 'reservado', 'separado', 'expedido', 'em_transito', 'entregue', 'vendida', 'avariado') NOT NULL DEFAULT 'estoque_fabrica'");
    }

    public function down(): void
    {
        Schema::table('motos', function (Blueprint $table) {
            $table->dropColumn('detalhes_avaria');
        });
    }
};
