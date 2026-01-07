<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            // Cria a coluna romaneio_id que aponta para a tabela romaneios
            // Nullable = Pode ser nulo (enquanto o pedido está pendente)
            $table->foreignId('romaneio_id')->nullable()->constrained('romaneios')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropForeign(['romaneio_id']);
            $table->dropColumn('romaneio_id');
        });
    }
};