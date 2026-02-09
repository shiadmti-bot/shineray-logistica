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
        Schema::table('schedules', function (Blueprint $table) {
            // Escala / Rota Secundária
            $table->foreignId('secondary_user_id')
                ->nullable()
                ->after('target_user_id')
                ->constrained('users');
        });
    }

    public function down(): void
    {
        Schema::table('schedules', function (Blueprint $table) {
            $table->dropForeign(['secondary_user_id']);
            $table->dropColumn('secondary_user_id');
        });
    }
};
