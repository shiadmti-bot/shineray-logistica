<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        // 1. Criar Tabela de Rotas (Novidade, não afeta ninguém)
        if (!Schema::hasTable('routes')) {
            Schema::create('routes', function (Blueprint $table) {
                $table->id();
                $table->string('code')->unique(); // Ex: BR 01
                $table->string('name')->nullable();
                $table->boolean('active')->default(true);
                $table->timestamps();
            });
        }

        // 2. Criar Calendário Avançado (Novidade)
        if (!Schema::hasTable('schedules')) {
            Schema::create('schedules', function (Blueprint $table) {
                $table->id();
                $table->date('date');
                $table->foreignId('route_id')->constrained('routes');
                $table->enum('type', ['coleta', 'entrega', 'mista'])->default('mista');
                $table->string('status')->default('scheduled');
                $table->timestamps();
            });
        }

        // 3. Alterar Usuários (COM CUIDADO)
        Schema::table('users', function (Blueprint $table) {
            // Importante: nullable() para não dar erro nos usuários que já existem!
            $table->foreignId('default_route_id')
                ->nullable()
                ->constrained('routes')
                ->after('filial'); 
        });
        
        // 4. Alterar Pedidos (Preparar para Loja > Loja)
        Schema::table('pedidos', function (Blueprint $table) {
            // Se o pedido for Loja > CD (o atual), isso fica null. Sem problemas.
            $table->foreignId('destino_user_id')
                ->nullable()
                ->constrained('users') // Aponta para a loja de destino
                ->after('user_id');

            $table->date('previsao_coleta')->nullable();
            $table->date('previsao_entrega')->nullable();
        });
    }

    public function down()
    {
        // O rollback deve desfazer na ordem inversa
        Schema::table('pedidos', function (Blueprint $table) {
            $table->dropColumn(['destino_user_id', 'previsao_coleta', 'previsao_entrega']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['default_route_id']);
            $table->dropColumn('default_route_id');
        });
        Schema::dropIfExists('schedules');
        Schema::dropIfExists('routes');
    }
};
