<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V3 — SALDO DE PEÇAS POR LOCAL
 *
 * Uma linha por (peça, local). O UNIQUE composto é o que garante que o saldo
 * de um SKU num local seja um número só — por isso `local_id` é NOT NULL e o
 * CD é uma linha de estoque_locais, não um NULL.
 *
 * Três números, não um:
 *   saldo           -> o que fisicamente está no local
 *   saldo_reservado -> parte do saldo já prometida a pedidos abertos
 *   disponível      -> saldo - saldo_reservado (calculado, nunca gravado)
 *
 * A reserva impede a venda dupla: duas lojas pedindo a última peça ao mesmo
 * tempo. O saldo físico só cai na expedição real.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('peca_estoques', function (Blueprint $table) {
            $table->id();

            $table->foreignId('peca_id')->constrained('pecas')->cascadeOnDelete();
            $table->foreignId('local_id')->constrained('estoque_locais')->cascadeOnDelete();

            $table->integer('saldo')->default(0);
            $table->integer('saldo_reservado')->default(0);

            // Ponto de reposição: alimenta o alerta de "precisa pedir ao CD".
            $table->integer('saldo_minimo')->default(0);

            $table->timestamp('contado_em')->nullable(); // último inventário físico

            $table->timestamps();

            // O coração da integridade do estoque fungível.
            $table->unique(['peca_id', 'local_id']);
            $table->index('local_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('peca_estoques');
    }
};
