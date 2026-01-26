<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

// 1. Criamos a aplicação e guardamos na variável $app (em vez de retornar direto)
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
        
        // Confiar nos Proxies da Vercel
        $middleware->trustProxies(at: '*');

        // Seus Middlewares personalizados
        $middleware->web(append: [
            \App\Http\Middleware\UserActivity::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();

// 2. --- CORREÇÃO PARA VERCEL (ADICIONE ISTO AQUI) ---
/*
 * Em ambiente Serverless (Vercel), o sistema de arquivos é somente leitura.
 * Aqui nós dizemos para o Laravel usar a pasta temporária (/tmp) para 
 * arquivos de armazenamento e cache que precisam ser gravados.
 */
if (isset($_ENV['VERCEL']) || isset($_SERVER['VERCEL'])) {
    $app->useStoragePath('/tmp/storage');

    // Cria a estrutura de pastas no /tmp se não existir
    if (!is_dir('/tmp/storage/bootstrap/cache')) {
        mkdir('/tmp/storage/bootstrap/cache', 0777, true);
    }
    
    if (!is_dir('/tmp/storage/framework/views')) {
        mkdir('/tmp/storage/framework/views', 0777, true);
    }
}
// -----------------------------------------------------

// 3. Finalmente, retornamos a aplicação
return $app;