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
        Schema::table('motos', function (Blueprint $table) {
            $table->string('motivo_solicitacao')->nullable()->after('cor');
        });
    }

    public function down(): void
    {
        Schema::table('motos', function (Blueprint $table) {
            $table->dropColumn('motivo_solicitacao');
        });
    }
};
