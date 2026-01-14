<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // 1. Adiciona a coluna 'canal' (se não existir)
            if (!Schema::hasColumn('messages', 'canal')) {
                $table->string('canal')->default('cd')->after('user_id');
            }

            // 2. Renomeia 'body' para 'content' (se 'body' existir e 'content' não)
            if (Schema::hasColumn('messages', 'body') && !Schema::hasColumn('messages', 'content')) {
                $table->renameColumn('body', 'content');
            }

            // 3. Adiciona 'read_at' e remove 'is_read'
            if (Schema::hasColumn('messages', 'is_read')) {
                $table->dropColumn('is_read');
            }
            if (!Schema::hasColumn('messages', 'read_at')) {
                $table->timestamp('read_at')->nullable()->after('content');
            }
        });
    }

    public function down(): void
    {
        // Reversão
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn(['canal', 'read_at']);
            $table->renameColumn('content', 'body');
        });
    }
};