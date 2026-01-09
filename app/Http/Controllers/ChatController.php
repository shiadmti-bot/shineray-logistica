<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\Message;
use App\Models\Pedido;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ChatController extends Controller
{
    // Lista mensagens antigas
    public function index($pedidoId)
    {
        $pedido = Pedido::findOrFail($pedidoId);
        
        // Segurança: Só dono ou CD pode ver
        if (Auth::user()->perfil === 'loja' && $pedido->user_id !== Auth::id()) {
            abort(403);
        }

        return Message::with('user')
            ->where('pedido_id', $pedidoId)
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($msg) {
                return [
                    'id' => $msg->id,
                    'content' => $msg->content,
                    'user_id' => $msg->user_id,
                    'user_name' => $msg->user->name,
                    'created_at' => $msg->created_at->format('H:i'),
                    'read_at' => $msg->read_at,
                    'is_me' => $msg->user_id === Auth::id()
                ];
            });
    }

    // Envia nova mensagem
    public function store(Request $request, $pedidoId)
    {
        $request->validate(['content' => 'required|string']);

        $message = Message::create([
            'pedido_id' => $pedidoId,
            'user_id' => Auth::id(),
            'content' => $request->content
        ]);

        // Carrega o usuário para o evento
        $message->load('user');

        // Dispara o WebSocket
        broadcast(new MessageSent($message))->toOthers();

        return response()->json(['status' => 'Message Sent!', 'message' => $message]);
    }
    
    // Marca como lida (Ticks Azuis)
    public function markAsRead($pedidoId)
    {
        // Marca como lidas todas as mensagens DESTE pedido que NÃO são minhas
        Message::where('pedido_id', $pedidoId)
            ->where('user_id', '!=', Auth::id())
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
            
        return response()->json(['status' => 'Read']);
    }
}