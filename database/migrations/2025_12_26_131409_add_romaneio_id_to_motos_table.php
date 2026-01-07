<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
{
    Schema::table('motos', function (Blueprint $table) {
        // Moto pertence a um romaneio de carga
        $table->foreignId('romaneio_id')->nullable()->constrained('romaneios')->onDelete('set null');
    });
}

public function down(): void
{
    Schema::table('motos', function (Blueprint $table) {
        $table->dropForeign(['romaneio_id']);
        $table->dropColumn('romaneio_id');
    });
}
};
