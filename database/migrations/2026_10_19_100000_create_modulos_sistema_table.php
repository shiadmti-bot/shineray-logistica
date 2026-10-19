<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Estado de cada módulo opcional que o admin alterou (Gestão > Módulos).
 *
 * Só ganha linha o módulo que alguém ligou ou desligou: sem linha, vale o
 * padrão de config/modulos.php. Ver App\Services\Modulos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('modulos_sistema', function (Blueprint $table) {
            $table->id();
            $table->string('chave', 60)->unique(); // App\Enums\Modulo
            $table->boolean('ativo');
            $table->foreignId('atualizado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('modulos_sistema');
    }
};
