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
    Schema::table('pedidos', function (Blueprint $table) {
        $table->text('motivo_rejeicao')->nullable()->after('status');
    });
    
    // NOTA: Se o seu banco for muito rigoroso com ENUM, talvez precise rodar SQL puro.
    // Mas o Laravel costuma aceitar string se não for strict mode. 
    // Vamos assumir que vai funcionar, senão rodamos um comando de alter table.
}

public function down(): void
{
    Schema::table('pedidos', function (Blueprint $table) {
        $table->dropColumn('motivo_rejeicao');
    });
}
};
