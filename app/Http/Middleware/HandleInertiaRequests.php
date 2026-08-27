<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            
            // 1. DADOS DE AUTENTICAÇÃO E NOTIFICAÇÕES
            'auth' => [
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'perfil' => $request->user()->perfil,
                    'filial' => $request->user()->filial,
                    // Atribuição de peças: a interface usa para decidir se
                    // mostra o botão de liberar. A trava real é no servidor.
                    'valida_pecas' => $request->user()->podeValidarPecas(),
                    'notifications' => $request->user()->notifications()->take(10)->get(),
                    'unread_count' => $request->user()->unreadNotifications()->count(),
                ] : null,
            ],

            // 2. MENSAGENS FLASH (Sucesso/Erro)
            'flash' => [
                'success' => fn () => $request->session()->get('success') ?? $request->session()->get('message'),
                'error' => fn () => $request->session()->get('error'),
                'warning' => fn () => $request->session()->get('warning'),
            ],

            // 3. CONFIGURAÇÕES PÚBLICAS
            'config' => [
                'onesignal_app_id' => config('services.onesignal.app_id'),
            ],

            /*
             * 4. CONTADORES DO MENU (v3)
             *
             * Closures: o Inertia só as executa quando a prop é de fato
             * serializada, então nenhuma dessas queries roda em requisição
             * parcial que não precise delas.
             */
            'navCounts' => [
                'pecasPendencias' => function () use ($request) {
                    $user = $request->user();

                    if (! $user) {
                        return 0;
                    }

                    $ehCd = in_array($user->perfil, ['cd', 'admin', 'gestor'], true);

                    return \App\Models\RomaneioItem::pecas()
                        ->divergenciasAbertas()
                        ->when(! $ehCd, fn ($q) => $q->where('local_destino_id', $user->estoque_local_id))
                        ->count();
                },
            ],
        ];
    }
}
