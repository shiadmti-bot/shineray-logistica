<?php

namespace App\Http\Middleware;

use App\Enums\Perfil;
use App\Enums\StatusPedido;
use App\Models\Devolucao;
use App\Models\Pedido;
use App\Models\RomaneioItem;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
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
     * Por quanto tempo os contadores do menu podem ficar atrasados.
     *
     * São quatro COUNTs que rodavam em toda navegação. Um número de menu com
     * até 30 s de atraso não muda decisão nenhuma — o que é urgente chega pelo
     * sininho, em tempo real.
     */
    private const CONTADORES_SEGUNDOS = 30;

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Props compartilhadas — avaliadas em TODA navegação.
     *
     * Regra (v3.5): o que entra aqui fora de closure sai da memória, sem
     * consulta. Com o banco na nuvem, cada query neste método é latência somada
     * a todas as telas do sistema.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),

            // 1. AUTENTICAÇÃO — só atributos já carregados. A lista de
            // notificações e o contador de não lidas saíram daqui: o sininho
            // busca sob demanda (NotificacaoController).
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'perfil' => $user->perfil,
                    'filial' => $user->filial,
                    // Atribuições independentes de validação:
                    'valida_pecas' => $user->podeValidarPecas(),
                    'valida_motos' => $user->podeValidarMotos(),
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

            // 4. CONTADORES DO MENU — closure: não roda em recarga parcial.
            'navCounts' => fn () => $user ? $this->contadoresDoMenu($user) : [],
        ];
    }

    /**
     * Os números ao lado de cada item do menu, por usuário.
     *
     * Cada contador mostra o que ESTE perfil precisa tocar, não um total. Nas
     * devoluções, por exemplo, o gestor tem uma fila de decisão, o CD tem moto
     * chegando para conferir e a loja tem rascunho parado — três números
     * diferentes no mesmo lugar do menu.
     *
     * @return array<string, int>
     */
    private function contadoresDoMenu(User $user): array
    {
        return Cache::remember("nav_counts:{$user->id}", self::CONTADORES_SEGUNDOS, function () use ($user) {
            $pecas = fn () => Pedido::where('tipo_carga', 'peca');

            return [
                'pecasAprovacoesPendentes' => $user->podeValidarPecas()
                    ? $pecas()->where('status', StatusPedido::AguardandoConfirmacao->value)->count()
                    : 0,

                'pecasTriagemPendentes' => $user->temPerfil(Perfil::Cd, Perfil::Admin)
                    ? $pecas()->whereIn('status', [StatusPedido::Solicitado->value, StatusPedido::EmAtendimento->value])->count()
                    : 0,

                'pecasPendencias' => RomaneioItem::pecas()
                    ->divergenciasAbertas()
                    ->when(
                        ! $user->temPerfil(...Perfil::operacaoCentral()),
                        fn ($q) => $q->where('local_destino_id', $user->estoque_local_id)
                    )
                    ->count(),

                'devolucoesPendentes' => match (Perfil::tryFrom((string) $user->perfil)) {
                    Perfil::Gestor => Devolucao::pendentesDeAprovacao()->count(),
                    Perfil::Cd     => Devolucao::where('status', Devolucao::STATUS_APROVADA)->count(),
                    Perfil::Admin  => Devolucao::emAndamento()->count(),
                    Perfil::Loja   => Devolucao::where('user_id', $user->id)
                        ->whereIn('status', [Devolucao::STATUS_RASCUNHO, Devolucao::STATUS_AGUARDANDO])
                        ->count(),
                    default        => 0,
                },
            ];
        });
    }
}
