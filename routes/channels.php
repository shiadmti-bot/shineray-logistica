<?php

use Illuminate\Support\Facades\Broadcast;
use App\Models\Pedido;

Broadcast::channel('chat.pedido.{pedidoId}', function ($user, $pedidoId) {
    $pedido = Pedido::find($pedidoId);
    // Permite se for CD ou se for o dono do pedido
    return $user->perfil === 'cd' || $user->id === $pedido->user_id;
});