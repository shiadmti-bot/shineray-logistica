<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
{
    Schema::table('pedidos', function (Blueprint $table) {
        // Adiciona a coluna 'motivo' se ela não existir
        if (!Schema::hasColumn('pedidos', 'motivo')) {
            $table->string('motivo')->nullable()->after('user_id'); 
            // Nullable para não quebrar pedidos antigos
        }
    });
}

public function down()
{
    Schema::table('pedidos', function (Blueprint $table) {
        $table->dropColumn('motivo');
    });
}
};
