<?php

namespace App\Http\Controllers;

use App\Models\Pedido;
use App\Models\Message;
use App\Events\NewMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;
use App\Models\User;
use App\Services\OneSignalService;
use App\Notifications\NovaMensagemChat;

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

        // 3. Dispara o Evento (WebSocket - Atualiza o Chat aberto)
        event(new NewMessage($message));

        // 4. Notificações Inteligentes (Sininho + Push)
        $user = Auth::user();
        $destinatarios = collect([]);

        if ($user->perfil === 'loja') {
            // Se Loja fala -> Avisa Gestores e CD
            $destinatarios = User::whereIn('perfil', ['gestor', 'cd'])->get();
        } else {
            // Se CD/Gestor fala -> Avisa Loja Solicitante e Origem
            if ($pedido->user_id !== $user->id) {
                $destinatarios->push($pedido->user); // Solicitante
            }
            if ($pedido->origem_user_id && $pedido->origem_user_id !== $user->id) {
                $destinatarios->push($pedido->origem_user); // Origem (se houver)
            }
        }

        // Filtra nulos e o próprio remetente (garantia extra)
        $destinatarios = $destinatarios->filter(function($u) use ($user) {
            return $u && $u->id !== $user->id;
        })->unique('id');

        // A. Envia Notificação Interna (Sininho + Toast)
        Notification::send($destinatarios, new \App\Notifications\NovaMensagemChat(
            $request->content, 
            $user->name, 
            $pedido->id
        ));

        // B. Envia Push Notification (OneSignal)
        $onesignalIds = $destinatarios->pluck('onesignal_id')->filter()->values()->toArray();
        if (!empty($onesignalIds)) {
            try {
                (new \App\Services\OneSignalService())->sendToUser(
                    $onesignalIds,
                    "Nova mensagem de {$user->name}",
                    $request->content,
                    route('pedidos.show', $pedido->id)
                );
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error("Erro OneSignal Chat: " . $e->getMessage());
            }
        }

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