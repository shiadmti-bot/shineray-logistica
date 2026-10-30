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
        Schema::table('romaneios', function (Blueprint $table) {
            $table->string('telefone_motorista', 30)->nullable()->after('motorista');
            $table->json('ordem_paradas')->nullable()->after('rota');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('romaneios', function (Blueprint $table) {
            $table->dropColumn(['telefone_motorista', 'ordem_paradas']);
        });
    }
};
