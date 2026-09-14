<?php

namespace App\Actions\Pedidos\Concerns;

use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Notifications\PedidoAtualizado;
use App\Services\OneSignalService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

/**
 * Linha do tempo e avisos de um pedido — o que toda etapa do fluxo faz ao terminar.
 */
trait RegistraHistorico
{
    protected function registrarLog(Pedido $pedido, string $titulo, string $descricao = ''): void
    {
        if (! $pedido->exists) {
            return;
        }

        PedidoLog::create([
            'pedido_id' => $pedido->id,
            'titulo'    => $titulo,
            'descricao' => "{$descricao} (Por: " . (Auth::user()?->name ?? 'Sistema') . ')',
        ]);
    }

    /**
     * Notifica no sininho e por push, depois da resposta: aviso não pode
     * atrasar nem derrubar a operação que o gerou.
     */
    protected function enviarNotificacao($usuarios, string $titulo, string $mensagem, string $link): void
    {
        \Illuminate\Support\defer(function () use ($usuarios, $titulo, $mensagem, $link) {
            $usuarios = is_iterable($usuarios) ? $usuarios : collect([$usuarios]);

            foreach ($usuarios as $usuario) {
                $usuario?->notify(new PedidoAtualizado($titulo, $mensagem, $link));
            }

            $ids = collect($usuarios)->pluck('onesignal_id')->filter()->toArray();

            if (! empty($ids)) {
                try {
                    (new OneSignalService())->sendToUser($ids, $titulo, $mensagem, $link);
                } catch (\Exception $e) {
                    Log::warning('OneSignal: ' . $e->getMessage());
                }
            }
        });
    }
}
