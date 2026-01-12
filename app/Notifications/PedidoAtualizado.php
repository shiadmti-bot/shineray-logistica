<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class PedidoAtualizado extends Notification
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

    public function via(object $notifiable): array
    {
        // Salva no banco E manda em tempo real (broadcast)
        return ['database', 'broadcast'];
    }

    // O que vai para o Banco de Dados
    public function toArray(object $notifiable): array
    {
        return [
            'titulo' => $this->titulo,
            'mensagem' => $this->mensagem,
            'link' => $this->link,
        ];
    }

    // O que vai para o Pusher (Tempo Real)
    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage([
            'titulo' => $this->titulo,
            'mensagem' => $this->mensagem,
            'link' => $this->link,
            'created_at' => now()->diffForHumans(), // Ex: "há 1 minuto"
        ]);
    }
}