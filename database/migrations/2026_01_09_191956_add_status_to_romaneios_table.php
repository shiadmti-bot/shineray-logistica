<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('romaneios', function (Blueprint $table) {
            // 1. Cria a coluna transportadora (que estava faltando)
            // Posicionamos ela após 'placa', que com certeza existe
            $table->string('transportadora')->nullable()->after('placa');
            
            // 2. Cria a coluna status
            // Posicionamos após a transportadora recém-criada
            $table->string('status')->default('em_transito')->after('transportadora');
        });
    }

    public function down(): void
    {
        Schema::table('romaneios', function (Blueprint $table) {
            $table->dropColumn(['status', 'transportadora']);
        });
    }
};