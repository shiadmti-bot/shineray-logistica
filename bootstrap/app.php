<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php', // Mantive seu channels
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
         $middleware->alias([
            'check_perfil' => \App\Http\Middleware\CheckPerfil::class,
        ]);
        
        // 1. Confiar nos Proxies da Vercel (Corrige o Mixed Content)
        $middleware->trustProxies(at: '*');

        // 2. Seus Middlewares personalizados
        $middleware->web(append: [
            \App\Http\Middleware\UserActivity::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();