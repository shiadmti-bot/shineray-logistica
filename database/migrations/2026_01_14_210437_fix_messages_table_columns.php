<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // 1. Renomeia 'body' para 'content' (se body existir)
            if (Schema::hasColumn('messages', 'body') && !Schema::hasColumn('messages', 'content')) {
                $table->renameColumn('body', 'content');
            }
            
            // 2. Garante que 'read_at' existe (se is_read existir, removemos e criamos read_at)
            if (Schema::hasColumn('messages', 'is_read')) {
                $table->dropColumn('is_read');
            }
            if (!Schema::hasColumn('messages', 'read_at')) {
                $table->timestamp('read_at')->nullable()->after('content');
            }

            // 3. Garante que 'canal' existe
            if (!Schema::hasColumn('messages', 'canal')) {
                $table->string('canal')->default('cd')->after('user_id');
            }
        });
    }

    public function down(): void
    {
        // Reversão (opcional)
        Schema::table('messages', function (Blueprint $table) {
            if (Schema::hasColumn('messages', 'content')) {
                $table->renameColumn('content', 'body');
            }
        });
    }
};