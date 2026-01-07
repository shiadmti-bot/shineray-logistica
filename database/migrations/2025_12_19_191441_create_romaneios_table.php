<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Verifica se já existe para não dar erro
        if (!Schema::hasTable('romaneios')) {
            Schema::create('romaneios', function (Blueprint $table) {
                $table->id(); // ESSE SERÁ O NÚMERO DO ROMANEIO (Sequencial: 1, 2, 3...)
                $table->string('motorista');
                $table->string('placa');
                // Data de criação (created_at) servirá como data de emissão
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('romaneios');
    }
};