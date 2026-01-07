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
        Schema::create('motos', function (Blueprint $table) {
            $table->id();
            $table->string('modelo');
            $table->string('chassi')->unique();
            $table->string('cor')->nullable();
            $table->string('ano_fabricacao')->nullable();
            
            // --- AQUI ESTÁ A CORREÇÃO: Adicionamos 'separado' e os outros status novos ---
            $table->enum('status', [
                'disponivel', 
                'reservado',   // Quando a loja solicita
                'separado',    // Quando o CD confere (O ERRO OCORRIA AQUI)
                'expedido',    // Quando entra no romaneio
                'em_transito', // Quando sai do CD
                'entregue',    // Final
                'cancelado'
            ])->default('reservado');
            
            $table->string('localizacao_atual')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('motos');
    }
};