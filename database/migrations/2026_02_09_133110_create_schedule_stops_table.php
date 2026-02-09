<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // 1. Cria a tabela de paradas
        Schema::create('schedule_stops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('schedule_id')->constrained()->onDelete('cascade'); // Se apagar a viagem, apaga as paradas
            $table->foreignId('user_id')->constrained(); // A loja
            $table->integer('sequence'); // Ordem da parada (1, 2, 3...)
            $table->enum('type', ['scale', 'destination']); // Escala ou Destino Final
            $table->timestamps();
        });

        // 2. Limpa a tabela pai (schedules) removendo as colunas antigas
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropForeign(['target_user_id']);
            $table->dropForeign(['secondary_user_id']);
            $table->dropColumn(['target_user_id', 'secondary_user_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('schedule_stops');
        // (Opcional) Recriar colunas antigas no down se precisar de rollback
    }
};