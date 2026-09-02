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
                    // Atribuições independentes de validação:
                    'valida_pecas' => $request->user()->podeValidarPecas(),
                    'valida_motos' => $request->user()->podeValidarMotos(),
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

                /*
                 * Devoluções: o contador mostra o que ESTE perfil precisa
                 * tocar, não um total. O gestor tem uma fila de decisão, o CD
                 * tem moto chegando para conferir e a loja tem rascunho parado
                 * — três números diferentes no mesmo lugar do menu.
                 */
                'devolucoesPendentes' => function () use ($request) {
                    $user = $request->user();

                    if (! $user) {
                        return 0;
                    }

                    return match ($user->perfil) {
                        'gestor' => \App\Models\Devolucao::pendentesDeAprovacao()->count(),
                        'cd'     => \App\Models\Devolucao::where('status', \App\Models\Devolucao::STATUS_APROVADA)->count(),
                        'admin'  => \App\Models\Devolucao::emAndamento()->count(),
                        'loja'   => \App\Models\Devolucao::where('user_id', $user->id)
                            ->whereIn('status', [
                                \App\Models\Devolucao::STATUS_RASCUNHO,
                                \App\Models\Devolucao::STATUS_AGUARDANDO,
                            ])->count(),
                        default  => 0,
                    };
                },
            ],
        ];
    }
}
