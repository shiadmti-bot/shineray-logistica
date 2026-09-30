<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Sininho e push.
 *
 * A lista de notificações saiu das props compartilhadas (v3.5): era buscada em
 * TODA navegação — duas consultas a mais por clique, atravessando até o TiDB —
 * para alimentar um dropdown que quase nunca é aberto. Com o layout
 * persistente, o sininho busca uma vez ao montar e depois vive do tempo real.
 */
class NotificacaoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'nao_lidas' => $user->unreadNotifications()->count(),
            'itens'     => $user->notifications()->take(10)->get()->map(fn ($notificacao) => [
                'id'      => $notificacao->id,
                'data'    => $notificacao->data,
                'quando'  => $notificacao->created_at?->diffForHumans(),
                'read_at' => $notificacao->read_at,
            ]),
        ]);
    }

    public function marcarComoLidas(Request $request): Response|RedirectResponse
    {
        // Um UPDATE só. A versão anterior carregava a coleção e gravava uma
        // notificação por vez.
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return $request->expectsJson() ? response()->noContent() : back();
    }

    public function registrarOneSignal(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'onesignal_id' => ['required', 'string', 'max:255'],
        ]);

        $request->user()->update($dados);

        return response()->json(['status' => 'success']);
    }
}
