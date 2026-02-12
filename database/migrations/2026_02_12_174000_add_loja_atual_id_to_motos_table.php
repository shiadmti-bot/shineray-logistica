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
            $table->foreignId('loja_atual_id')
                ->nullable()
                ->after('localizacao_atual')
                ->constrained('users')
                ->onDelete('set null'); // Se a loja for deletada, a moto fica sem dono (mas existe)
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('motos', function (Blueprint $table) {
            $table->dropForeign(['loja_atual_id']);
            $table->dropColumn('loja_atual_id');
        });
    }
};
