<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Gate;
use App\Models\User;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
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