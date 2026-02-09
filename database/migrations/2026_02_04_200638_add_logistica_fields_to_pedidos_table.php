<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            
            // Só cria se NÃO existir
            if (!Schema::hasColumn('pedidos', 'origem_user_id')) {
                $table->foreignId('origem_user_id')->nullable()->constrained('users')->onDelete('set null');
            }

            if (!Schema::hasColumn('pedidos', 'previsao_coleta')) {
                $table->date('previsao_coleta')->nullable();
            }

            if (!Schema::hasColumn('pedidos', 'previsao_entrega')) {
                $table->date('previsao_entrega')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropForeign(['origem_user_id']);
            $table->dropColumn(['origem_user_id', 'previsao_coleta', 'previsao_entrega']);
        });
    }
};