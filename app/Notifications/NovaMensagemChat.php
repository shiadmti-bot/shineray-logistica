<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;

class NovaMensagemChat extends Notification implements ShouldBroadcast
{
    use Queueable;

    public $message;
    public $sender;
    public $pedidoId;

    public function __construct($message, $sender, $pedidoId)
    {
        $this->message = $message;
        $this->sender = $sender;
        $this->pedidoId = $pedidoId;
    }

    public function via($notifiable)
    {
        // Envia para Banco de Dados (Sininho) e Broadcast (Toast em Tempo Real)
        return ['database', 'broadcast'];
    }

    // Sininho/Histórico
    public function toDatabase($notifiable)
    {
        return [
            'titulo' => 'Nova Mensagem 💬',
            'mensagem' => "{$this->sender}: " . substr($this->message, 0, 50) . "...",
            'link' => route('pedidos.show', $this->pedidoId),
            'type' => 'chat'
        ];
    }

    // Toast em Tempo Real (Pusher/Echo)
    public function toBroadcast($notifiable)
    {
        return new BroadcastMessage([
            'titulo' => 'Nova Mensagem 💬',
            'mensagem' => "{$this->sender}: {$this->message}",
            'link' => route('pedidos.show', $this->pedidoId),
        ]);
    }
}
