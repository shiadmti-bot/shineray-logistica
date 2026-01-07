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
    Schema::create('pedido_logs', function (Blueprint $table) {
        $table->id();
        $table->foreignId('pedido_id')->constrained()->onDelete('cascade');
        $table->string('titulo'); // Ex: "Pedido Separado"
        $table->text('descricao')->nullable(); // Ex: "Conferido por João"
        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pedido_logs');
    }
};
