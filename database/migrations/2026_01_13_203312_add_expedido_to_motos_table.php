<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Atualiza a coluna status para incluir 'expedido'
        // Usamos SQL puro para garantir que o ENUM seja atualizado corretamente no MySQL/TiDB
        DB::statement("
            ALTER TABLE motos 
            MODIFY COLUMN status 
            ENUM('estoque_fabrica', 'reservado', 'separado', 'expedido', 'em_transito', 'entregue', 'vendida') 
            NOT NULL DEFAULT 'estoque_fabrica'
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reverte para a lista anterior (remove 'expedido' se precisar voltar atrás)
        // CUIDADO: Se houver motos com status 'expedido', isso pode dar erro ao reverter.
        DB::statement("
            ALTER TABLE motos 
            MODIFY COLUMN status 
            ENUM('estoque_fabrica', 'reservado', 'separado', 'em_transito', 'entregue', 'vendida') 
            NOT NULL DEFAULT 'estoque_fabrica'
        ");
    }
};