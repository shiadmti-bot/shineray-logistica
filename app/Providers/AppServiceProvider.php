<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Gate;
use App\Models\User;
use App\Services\Estoque\MotoMicroworkProvider;
use App\Services\Estoque\PecaLocalProvider;
use App\Services\Estoque\PecaMicroworkProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        /*
         * PROVIDERS DE ESTOQUE (v3)
         *
         * Resolvidos por tag para que as telas peçam "o provider de peça" sem
         * saber se o dado vem do banco local ou do Microwork.
         *
         * Peça usa PecaLocalProvider enquanto o relatório externo não estiver
         * configurado. Assim que MICROWORK_PECAS_CONFIG existir no .env, a troca
         * abaixo passa a resolver PecaMicroworkProvider sem alterar consumidores.
         */
        $this->app->bind(MotoMicroworkProvider::class, fn ($app) => new MotoMicroworkProvider(
            $app->make(\App\Services\MicroworkService::class)
        ));

        $this->app->bind('estoque.provider.moto', fn ($app) => $app->make(MotoMicroworkProvider::class));

        $this->app->bind('estoque.provider.peca', function ($app) {
            $temRelatorioExterno = ! empty(config('services.microwork.pecas.relatorio_configuracao'))
                && ! empty(config('services.microwork.token'));

            return $temRelatorioExterno
                ? $app->make(PecaMicroworkProvider::class)
                : $app->make(PecaLocalProvider::class);
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // 1. Configuração de HTTPS (Mantenha, essencial para Vercel)
        if($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        // 2. DEFINIÇÃO DE PERMISSÕES (GATES)
        // Isso ensina ao Laravel o que verificar quando usamos middleware('can:admin')
        
        Gate::define('admin', function (User $user) {
            return $user->perfil === 'admin';
        });

        Gate::define('cd', function (User $user) {
            return $user->perfil === 'cd';
        });

        Gate::define('gestor', function (User $user) {
            return $user->perfil === 'gestor';
        });
        
        Gate::define('loja', function (User $user) {
            return $user->perfil === 'loja';
        });
    }
}