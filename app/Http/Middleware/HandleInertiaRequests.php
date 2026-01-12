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
                    'notifications' => $request->user()->notifications()->take(10)->get(),
                    'unread_count' => $request->user()->unreadNotifications()->count(),
                ] : null,
            ],

            // 2. MENSAGENS FLASH (Sucesso/Erro) - ISSO DEVIA ESTAR FALTANDO
            'flash' => [
                'success' => fn () => $request->session()->get('success') ?? $request->session()->get('message'),
                'error' => fn () => $request->session()->get('error'),
                'warning' => fn () => $request->session()->get('warning'),
            ],
        ];
    }
}
