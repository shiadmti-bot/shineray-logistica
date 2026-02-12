<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Atualiza status antigo 'disponivel' para o novo padrão 'estoque_loja'
        \Illuminate\Support\Facades\DB::table('motos')
            ->where('status', 'disponivel')
            ->update(['status' => 'estoque_loja']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reverte (apenas para fins de rollback, embora possa pegar motos que já eram estoque_loja)
        \Illuminate\Support\Facades\DB::table('motos')
            ->where('status', 'estoque_loja')
            ->update(['status' => 'disponivel']);
    }
};
