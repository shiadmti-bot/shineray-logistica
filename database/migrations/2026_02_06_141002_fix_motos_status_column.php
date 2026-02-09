<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Transforma o status da tabela MOTOS em Texto (VARCHAR)
        // Isso permite salvar 'transito_loja', 'transito_cd', 'no_cd', etc.
        DB::statement("ALTER TABLE motos MODIFY COLUMN status VARCHAR(255) NOT NULL DEFAULT 'disponivel'");

        // 2. Aumenta o tamanho da localização atual (para caber nomes de rotas longos)
        DB::statement("ALTER TABLE motos MODIFY COLUMN localizacao_atual VARCHAR(255) NULL");

        // 3. Garante o mesmo para a tabela PEDIDOS
        DB::statement("ALTER TABLE pedidos MODIFY COLUMN status VARCHAR(255) NOT NULL DEFAULT 'em_analise'");
    }

    public function down(): void
    {
        // Não é necessário reverter para ENUM, pois texto abrange tudo.
    }
};