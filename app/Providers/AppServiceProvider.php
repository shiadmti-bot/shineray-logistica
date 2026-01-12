<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL; // <--- ESSA LINHA É OBRIGATÓRIA!

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
        // Força HTTPS na Vercel (Produção)
        if($this->app->environment('production')) {
            URL::forceScheme('https');
        }
    }
}