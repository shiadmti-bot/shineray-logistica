<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('filials', function (Blueprint $table) {
            if (!Schema::hasColumn('filials', 'ativo')) {
                $table->boolean('ativo')->default(true)->after('uf');
            }
            if (!Schema::hasColumn('filials', 'codigo_empresa')) {
                $table->string('codigo_empresa', 50)->nullable()->after('ativo');
            }
        });
    }

    public function down(): void
    {
        Schema::table('filials', function (Blueprint $table) {
            if (Schema::hasColumn('filials', 'codigo_empresa')) {
                $table->dropColumn('codigo_empresa');
            }
            if (Schema::hasColumn('filials', 'ativo')) {
                $table->dropColumn('ativo');
            }
        });
    }
};
