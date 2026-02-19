<?php

use Illuminate\Support\Facades\Broadcast;
use App\Models\Pedido;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
*/

// 1. CANAL DE NOTIFICAÇÕES PESSOAIS
// Esse canal é usado pelo Laravel Echo para o "Sininho", Toasts e Atualizações de Status.
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    // Segurança: O usuário só pode ouvir o próprio canal
    return (int) $user->id === (int) $id;
});

// 2. CANAL DO CHAT DO PEDIDO (Melhorado)
Broadcast::channel('chat.pedido.{pedidoId}', function ($user, $pedidoId) {
    $pedido = Pedido::find($pedidoId);
    
    // Se o pedido não existir, bloqueia
    if (!$pedido) return false;

    // Permite se for: CD, Admin, Gestor 
    // OU o Dono da Loja (Solicitante) 
    // OU a Loja de Origem (Fornecedora)
    return in_array($user->perfil, ['cd', 'admin', 'gestor']) 
        || $user->id === $pedido->user_id 
        || $user->id === $pedido->origem_user_id;
});