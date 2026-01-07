<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL; // <--- Importante: Adicione isso

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
        // SEGREDO DO DEPLOY NA VERCEL:
        // Força HTTPS se estiver em produção, resolvendo o "Mixed Content"
        if($this->app->environment('production')) {
            URL::forceScheme('https');
        }
    }
}