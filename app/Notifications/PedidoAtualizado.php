<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast; // <--- OBRIGATÓRIO
use Illuminate\Notifications\Messages\BroadcastMessage; // <--- OBRIGATÓRIO
use Illuminate\Notifications\Notification;

// Adicione "implements ShouldBroadcast" aqui
class PedidoAtualizado extends Notification implements ShouldBroadcast
{
    use Queueable;

    public $titulo;
    public $mensagem;
    public $link;

    public function __construct($titulo, $mensagem, $link = '#')
    {
        $this->titulo = $titulo;
        $this->mensagem = $mensagem;
        $this->link = $link;
    }

    public function via($notifiable)
    {
        // Aqui definimos os canais. 'broadcast' é o que envia pro Pusher.
        return ['database', 'broadcast']; 
    }

    // O que é salvo no banco (Sininho)
    public function toDatabase($notifiable)
    {
        return [
            'titulo' => $this->titulo,
            'mensagem' => $this->mensagem,
            'link' => $this->link,
        ];
    }

    // O que é enviado ao vivo (Pusher/Socket)
    public function toBroadcast($notifiable)
    {
        return new BroadcastMessage([
            'titulo' => $this->titulo,
            'mensagem' => $this->mensagem,
            'link' => $this->link,
        ]);
    }
}