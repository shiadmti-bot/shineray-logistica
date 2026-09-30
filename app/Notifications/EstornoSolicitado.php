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
            'titulo' => 'Estorno Solicitado',
            'mensagem' => "⚠️ Estorno solicitado: {$this->moto->modelo} ({$this->moto->chassi})",
            'link' => route('gestor.index'), // Link para onde o gestor vai ao clicar
            'tipo' => 'estorno'
        ];
    }

    // Envia para o WebSocket (React Echo). O toast agora vem só do sininho,
    // que usa `titulo` — antes o painel do gestor montava o próprio título.
    public function toBroadcast($notifiable)
    {
        return new BroadcastMessage([
            'titulo' => 'Estorno Solicitado',
            'mensagem' => "⚠️ {$this->solicitante->name} solicitou estorno/corte da moto {$this->moto->modelo}.",
            'link' => route('gestor.index'),
            'type' => 'EstornoSolicitado' // Importante para o ícone no Dashboard
        ]);
    }
}