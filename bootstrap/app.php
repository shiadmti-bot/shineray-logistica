<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

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
            'cron'         => \App\Http\Middleware\AutenticarCron::class,
        ]);
        
        $middleware->trustProxies(at: '*');

        // Global: vale também para os webhooks e para o /up.
        $middleware->append(\App\Http\Middleware\CabecalhosDeSeguranca::class);

        $middleware->web(append: [
            \App\Http\Middleware\UserActivity::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        /*
         * Erro com a cara do sistema, não do framework.
         *
         * A tela Pages/Error.jsx existia (e o app.jsx já a tirava do shell),
         * mas nada a renderizava: quem esbarrava num 403 via a página crua do
         * Laravel — no Inertia, dentro de um modal — e perdia o motivo que a
         * regra escreveu em português ("Só a filial de destino confere...").
         */
        $exceptions->respond(function (Response $response, Throwable $e, Request $request) {
            $status = $response->getStatusCode();

            /*
             * Sessão expirada (CSRF). Quem deixa a aba parada além do
             * SESSION_LIFETIME e clica em salvar recebia "Page Expired" e
             * nenhum caminho de volta. Agora volta para a tela, com aviso.
             */
            if ($status === 419) {
                return back()->with('warning', 'Sua sessão expirou por inatividade. Confira os dados e envie de novo.');
            }

            // Chamadas do próprio front (sininho, chat, Microwork) seguem com o JSON delas.
            if ($request->expectsJson() && ! $request->header('X-Inertia')) {
                return $response;
            }

            // 500 com debug ligado continua mostrando o stack trace para quem desenvolve.
            $paginaPropria = in_array($status, [403, 404], true)
                || (in_array($status, [500, 503], true) && ! config('app.debug'));

            if (! $paginaPropria) {
                return $response;
            }

            // Só o 403 traz texto escrito para o usuário (abort/Policy). Os
            // outros podem carregar nome de classe ou SQL.
            $mensagem = $status === 403 ? trim($e->getMessage()) : '';

            return Inertia::render('Error', [
                'status'   => $status,
                'mensagem' => in_array($mensagem, ['', 'This action is unauthorized.'], true) ? null : $mensagem,
            ])->toResponse($request)->setStatusCode($status);
        });
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
    $pastas = [
        $tmpCachePath,
        '/tmp/storage/framework/views',
        '/tmp/storage/framework/cache',
        '/tmp/storage/framework/cache/data',
        '/tmp/storage/framework/sessions',
        '/tmp/storage/logs',
        '/tmp/storage/app/public',
    ];
    foreach ($pastas as $pasta) {
        if (!is_dir($pasta)) {
            mkdir($pasta, 0777, true);
        }
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