<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

// 1. Configuração padrão do Laravel 11
$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
         $middleware->alias([
            'check_perfil' => \App\Http\Middleware\CheckPerfil::class,
        ]);
        
        $middleware->trustProxies(at: '*');

        $middleware->web(append: [
            \App\Http\Middleware\UserActivity::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();

// 2. --- CORREÇÃO DEFINITIVA PARA VERCEL ---
/*
 * Redireciona tanto o STORAGE quanto o BOOTSTRAP CACHE para /tmp
 * Isso evita o erro "bootstrap/cache directory must be present and writable"
 */
if (isset($_ENV['VERCEL']) || isset($_SERVER['VERCEL'])) {
    // 1. Move o Storage
    $app->useStoragePath('/tmp/storage');

    // 2. Cria as pastas necessárias no /tmp
    $tmpCachePath = '/tmp/storage/bootstrap/cache';
    if (!is_dir($tmpCachePath)) {
        mkdir($tmpCachePath, 0777, true);
        mkdir('/tmp/storage/framework/views', 0777, true);
    }

    // 3. Força os arquivos de cache do bootstrap a ficarem no /tmp
    $app->useEnvironmentPath('/tmp');
    $_SERVER['APP_PACKAGES_CACHE'] = $tmpCachePath . '/packages.php';
    $_SERVER['APP_SERVICES_CACHE'] = $tmpCachePath . '/services.php';
    $_SERVER['APP_ROUTES_CACHE'] = $tmpCachePath . '/routes-v7.php';
    $_SERVER['APP_EVENTS_CACHE'] = $tmpCachePath . '/events.php';
    
    // Força o cache de views para o /tmp
    $_SERVER['VIEW_COMPILED_PATH'] = '/tmp/storage/framework/views';
}
// -------------------------------------------

return $app;