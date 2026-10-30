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
            if (!Schema::hasColumn('romaneios', 'tipo_veiculo')) {
                $table->string('tipo_veiculo', 50)->nullable()->default('3_4')->after('tipo');
            }
            if (!Schema::hasColumn('romaneios', 'capacidade_veiculo')) {
                $table->integer('capacidade_veiculo')->nullable()->default(16)->after('tipo_veiculo');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('romaneios', function (Blueprint $table) {
            $cols = [];
            if (Schema::hasColumn('romaneios', 'capacidade_veiculo')) {
                $cols[] = 'capacidade_veiculo';
            }
            if (Schema::hasColumn('romaneios', 'tipo_veiculo')) {
                $cols[] = 'tipo_veiculo';
            }
            if (!empty($cols)) {
                $table->dropColumn($cols);
            }
        });
    }
};
