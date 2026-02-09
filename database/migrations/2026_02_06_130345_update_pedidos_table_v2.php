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
        Schema::table('pedidos', function (Blueprint $table) {
            // Se já existirem, o Laravel ignora ou podemos usar hasColumn, 
            // mas aqui garanto que existam:
            if (!Schema::hasColumn('pedidos', 'origem_user_id')) {
                $table->foreignId('origem_user_id')->nullable()->after('user_id')->constrained('users');
            }
            if (!Schema::hasColumn('pedidos', 'itens')) {
                $table->json('itens')->nullable()->after('status'); // Salva o array de motos solicitadas
            }
            if (!Schema::hasColumn('pedidos', 'observacao')) {
                $table->text('observacao')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
