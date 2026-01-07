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
        $table->index('chassi'); // Busca super rápida
        $table->index('status'); // Filtros rápidos
    });

    Schema::table('pedidos', function (Blueprint $table) {
        $table->index('status');
        $table->index('user_id'); // Relação rápida
    });

    Schema::table('romaneios', function (Blueprint $table) {
        $table->index('placa');
        $table->index('motorista');
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('improve_search', function (Blueprint $table) {
            //
        });
    }
};
