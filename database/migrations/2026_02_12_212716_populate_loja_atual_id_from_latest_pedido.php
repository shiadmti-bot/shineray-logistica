<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $motosSemLoja = \Illuminate\Support\Facades\DB::table('motos')
            ->whereNull('loja_atual_id')
            ->get();

        foreach ($motosSemLoja as $moto) {
            // Busca o último pedido associado a esta moto
            $ultimoPedido = \Illuminate\Support\Facades\DB::table('pedido_moto')
                ->join('pedidos', 'pedido_moto.pedido_id', '=', 'pedidos.id')
                ->where('pedido_moto.moto_id', $moto->id)
                ->orderBy('pedido_moto.created_at', 'desc')
                ->select('pedidos.user_id')
                ->first();

            if ($ultimoPedido) {
                \Illuminate\Support\Facades\DB::table('motos')
                    ->where('id', $moto->id)
                    ->update(['loja_atual_id' => $ultimoPedido->user_id]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Não é necessário reverter dados populados neste caso específico
    }
};
