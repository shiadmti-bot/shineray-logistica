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
        Schema::table('pedido_moto', function (Blueprint $table) {
            $table->text('detalhes_avaria')->nullable();
            $table->string('foto_avaria')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('pedido_moto', function (Blueprint $table) {
            $table->dropColumn(['detalhes_avaria', 'foto_avaria']);
        });
    }
};
