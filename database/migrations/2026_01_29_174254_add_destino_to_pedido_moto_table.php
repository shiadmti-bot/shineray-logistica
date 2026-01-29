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
        Schema::table('pedido_moto', function (Blueprint $table) {
            $table->string('destino')->nullable()->comment('Local específico de entrega deste item');
        });
    }

    public function down()
    {
        Schema::table('pedido_moto', function (Blueprint $table) {
            $table->dropColumn('destino');
        });
    }
};
