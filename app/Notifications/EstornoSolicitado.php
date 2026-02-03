<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class EstornoSolicitado extends Notification implements ShouldQueue
{
    use Queueable;

    public $moto;
    public $solicitante;

    public function __construct($moto, $solicitante)
    {
        $this->moto = $moto;
        $this->solicitante = $solicitante;
    }

    public function via($notifiable)
    {
        return ['database', 'broadcast']; // Salva no banco e manda pro Pusher/Reverb
    }

    // Salva no banco de dados (para listar no sininho se tiver)
    public function toArray($notifiable)
    {
        return [
            'mensagem' => "⚠️ Estorno solicitado: {$this->moto->modelo} ({$this->moto->chassi})",
            'link' => route('gestor.index'), // Link para onde o gestor vai ao clicar
            'tipo' => 'estorno'
        ];
    }

    // Envia para o WebSocket (React Echo)
    public function toBroadcast($notifiable)
    {
        return new BroadcastMessage([
            'mensagem' => "⚠️ {$this->solicitante->name} solicitou estorno/corte da moto {$this->moto->modelo}.",
            'link' => route('gestor.index'),
            'type' => 'EstornoSolicitado' // Importante para o ícone no Dashboard
        ]);
    }
}