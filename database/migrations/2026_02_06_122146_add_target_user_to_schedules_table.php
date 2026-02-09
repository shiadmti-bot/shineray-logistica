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
        Schema::table('schedules', function (Blueprint $table) {
            // Agora o agendamento aponta para uma Loja específica
            $table->foreignId('target_user_id')->nullable()->after('id')->constrained('users');
            
            // Vamos deixar route_id anulável caso queira manter o histórico, 
            // ou você pode remover se quiser limpar tudo. Vou deixar anulável por segurança.
            $table->unsignedBigInteger('route_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropForeign(['target_user_id']);
            $table->dropColumn('target_user_id');
        });
    }
};
