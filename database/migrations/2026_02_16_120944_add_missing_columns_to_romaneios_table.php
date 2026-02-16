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
        Schema::table('romaneios', function (Blueprint $table) {
            $table->string('rota')->nullable()->after('placa'); // Para busca e organização
            $table->string('tipo')->default('misto')->after('status'); // 'misto', 'coleta', 'expedicao'
            $table->dateTime('saida_em')->nullable()->after('updated_at'); // Data real de saída
        });
    }

    public function down(): void
    {
        Schema::table('romaneios', function (Blueprint $table) {
            $table->dropColumn(['rota', 'tipo', 'saida_em']);
        });
    }
};
