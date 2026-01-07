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
        // Cria coluna para o caminho do arquivo (pode ser nulo no começo)
        $table->string('arquivo_assinado')->nullable()->after('observacao');
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            //
        });
    }
};
