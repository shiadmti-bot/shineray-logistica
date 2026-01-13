<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Altera a coluna para aceitar 'gestor'
        // Usamos SQL puro (DB::statement) pois alterar ENUM via Schema builder do Laravel costuma dar erro
        DB::statement("ALTER TABLE users MODIFY COLUMN perfil ENUM('admin', 'cd', 'loja', 'gestor') NOT NULL DEFAULT 'loja'");
    }

    public function down(): void
    {
        // Reverte para o estado anterior (opcional)
        DB::statement("ALTER TABLE users MODIFY COLUMN perfil ENUM('admin', 'cd', 'loja') NOT NULL DEFAULT 'loja'");
    }
};