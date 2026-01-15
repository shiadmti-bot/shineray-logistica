<?php

namespace App\Http\Controllers;

use App\Models\Pedido;
use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ChatController extends Controller
{
    public function index($pedidoId)
    {
        return Message::where('pedido_id', $pedidoId)
            ->with('user')
            ->orderBy('created_at', 'asc')
            ->get();
    }

    public function store(Request $request, $pedidoId)
    {
        // BLCO TRY-CATCH PARA REVELAR O ERRO REAL
        try {
            // 1. Validação Manual (para garantir que não é isso)
            if (!$request->content) throw new \Exception("Campo 'content' vazio.");
            if (!$request->canal) throw new \Exception("Campo 'canal' vazio.");

            $pedido = Pedido::findOrFail($pedidoId);

            // 2. Criação da Mensagem
            $message = $pedido->messages()->create([
                'user_id' => Auth::id(),
                'content' => $request->content,
                'canal'   => $request->canal,
                'read_at' => null
            ]);

            $message->load('user');

            // 3. ENVIO DO EVENTO (MODO SEGURO)
            // Usamos 'event()' simples primeiro. Se funcionar, depois voltamos pro toOthers
            // Usamos o caminho completo \App\Events\NewMessage para evitar erro de "Class not found"
            try {
                event(new \App\Events\NewMessage($message));
            } catch (\Exception $e) {
                // Se der erro no Pusher, não trava o chat, apenas loga (mas salva a mensagem)
                // Isso impede o erro 500 de travar a tela
            }

            return $message;

        } catch (\Exception $e) {
            // RETORNA O ERRO REAL COMO JSON (Para você ler no Console do Navegador)
            return response()->json([
                'erro_titulo' => 'ERRO NO CONTROLLER',
                'mensagem' => $e->getMessage(),
                'arquivo' => $e->getFile(),
                'linha' => $e->getLine()
            ], 500);
        }
    }

    public function markAsRead(Request $request, $pedidoId)
    {
        Message::where('pedido_id', $pedidoId)
            ->where('user_id', '!=', Auth::id())
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->noContent();
    }
}