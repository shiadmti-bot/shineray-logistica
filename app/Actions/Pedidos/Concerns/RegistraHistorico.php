<?php

namespace App\Actions\Pedidos\Concerns;

use App\Enums\EventoPedido;
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
    /**
     * Grava uma entrada na linha do tempo do pedido.
     *
     * `$evento` e `$dados` (v3.6) são a metade CONSULTÁVEL do registro: o
     * evento é a chave que o histórico de auditoria filtra, e `dados` guarda o
     * que aconteceu em forma de estrutura em vez de parágrafo. São opcionais
     * porque o sistema tem dezenas de pontos que gravam log, e converter todos
     * de uma vez não era necessário para o histórico de recusa funcionar — o
     * que não classifica fica NULL, e NULL significa "não classificado".
     *
     * O sufixo "(Por: Fulano)" continua sendo escrito na descrição, mesmo com
     * `user_id` gravado ao lado. É deliberado: a descrição é lida crua em
     * lugares que não carregam a relação (BI, timeline da moto), e tirá-la
     * faria o autor desaparecer dessas telas.
     *
     * @param  array<string, mixed>|null  $dados
     */
    protected function registrarLog(
        Pedido $pedido,
        string $titulo,
        string $descricao = '',
        ?EventoPedido $evento = null,
        ?array $dados = null,
    ): void {
        if (! $pedido->exists) {
            return;
        }

        $autor = Auth::user();

        PedidoLog::create([
            'pedido_id' => $pedido->id,
            'user_id'   => $autor?->id,
            'titulo'    => $titulo,
            'evento'    => $evento?->value,
            'descricao' => "{$descricao} (Por: " . ($autor?->name ?? 'Sistema') . ')',
            'dados'     => $dados,
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
