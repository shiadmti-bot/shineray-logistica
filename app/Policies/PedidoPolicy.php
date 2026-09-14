<?php

namespace App\Policies;

use App\Models\Pedido;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Quem enxerga um pedido.
 *
 * Antes da v3.4, `PedidoController::show` não perguntava nada: o índice
 * filtrava a loja, mas trocar o número na URL abria o pedido de outra filial —
 * chassis, logs, links de comprovante e os dados das duas lojas.
 *
 * Mesma régua de ChatController::autorizarParticipante, alargada pelo que a
 * tela do pedido atende e o chat não: o validador que chega pelo link de uma
 * notificação ou pelo histórico do gestor, e a filial que recebe peça pelo
 * local de estoque (pedido aberto pelo admin em nome dela).
 */
class PedidoPolicy
{
    public function view(User $user, Pedido $pedido): Response
    {
        // CD, gestor e admin acompanham qualquer pedido — é o trabalho deles.
        if (in_array($user->perfil, ['admin', 'gestor', 'cd'], true)) {
            return Response::allow();
        }

        // A loja vê o que pediu e o que sai do estoque dela numa transferência.
        if ((int) $pedido->user_id === $user->id || (int) $pedido->origem_user_id === $user->id) {
            return Response::allow();
        }

        $locais = [(int) $pedido->local_destino_id, (int) $pedido->local_origem_id];

        if ($user->estoque_local_id && in_array((int) $user->estoque_local_id, $locais, true)) {
            return Response::allow();
        }

        // Atribuição, não perfil: a loja que assina liberações precisa abrir o
        // pedido que está validando.
        $validador = $pedido->tipo_carga === 'peca'
            ? $user->podeValidarPecas()
            : $user->podeValidarMotos();

        return $validador
            ? Response::allow()
            : Response::deny('Este pedido pertence a outra filial.');
    }
}
