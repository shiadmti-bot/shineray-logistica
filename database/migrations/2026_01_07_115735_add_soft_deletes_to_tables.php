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
        // Adiciona a coluna 'deleted_at' na tabela de Usuários
        Schema::table('users', function (Blueprint $table) {
            $table->softDeletes(); 
        });

        // Adiciona a coluna 'deleted_at' na tabela de Motos
        Schema::table('motos', function (Blueprint $table) {
            $table->softDeletes();
        });

        // Adiciona a coluna 'deleted_at' na tabela de Pedidos
        Schema::table('pedidos', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove as colunas caso precisemos desfazer (rollback)
        Schema::table('users', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        Schema::table('motos', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};