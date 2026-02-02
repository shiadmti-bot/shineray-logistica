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
    Schema::table('motos', function (Blueprint $table) {
        $table->boolean('estorno_pendente')->default(false);
        $table->string('motivo_estorno')->nullable();
        $table->unsignedBigInteger('user_estorno_id')->nullable(); // Quem pediu
    });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('motos', function (Blueprint $table) {
            //
        });
    }
};
