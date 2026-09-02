<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * SEPARAÇÃO DOS MÓDULOS DE MOTOS E PEÇAS
 *
 * Adiciona a permissão explícita `valida_motos` à tabela `users`,
 * permitindo que a validação de motos e a validação de peças (Gate 1)
 * sejam completamente ortogonais e independentes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('valida_motos')
                  ->default(false)
                  ->after('valida_pecas');
        });

        // Usuários gestores recebem valida_motos = true por padrão
        DB::table('users')
            ->where('perfil', 'gestor')
            ->update(['valida_motos' => true]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('valida_motos');
        });
    }
};
