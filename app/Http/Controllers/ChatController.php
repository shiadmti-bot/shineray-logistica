<?php

namespace App\Http\Controllers;

use App\Models\Pedido;
use App\Models\Message;
use App\Events\NewMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ChatController extends Controller
{
    /**
     * Lista as mensagens de um pedido.
     */
    public function index($pedidoId)
    {
        return Message::where('pedido_id', $pedidoId)
            ->with('user') // Traz o nome e dados do usuário
            ->orderBy('created_at', 'asc')
            ->get();
    }

    /**
     * Salva uma nova mensagem e dispara o evento.
     */
    public function store(Request $request, $pedidoId)
    {
        // 1. Validação
        $request->validate([
            'content' => 'required|string',
            'canal'   => 'required|string|in:cd,gestor'
        ]);

        $pedido = Pedido::findOrFail($pedidoId);

        // 2. Criação da Mensagem
        $message = $pedido->messages()->create([
            'user_id' => Auth::id(),
            'content' => $request->content,
            'canal'   => $request->canal,
            'read_at' => null
        ]);

        // Carrega o usuário para exibir nome/foto instantaneamente no frontend
        $message->load('user');

        // 3. Dispara o Evento (WebSocket)
        // Usamos event() que é mais robusto que broadcast()->toOthers() em ambientes serverless
        event(new NewMessage($message));

        return $message;
    }

    /**
     * Marca as mensagens como lidas.
     */
    public function markAsRead(Request $request, $pedidoId)
    {
        Message::where('pedido_id', $pedidoId)
            ->where('user_id', '!=', Auth::id()) // Apenas mensagens dos outros
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->noContent();
    }
}