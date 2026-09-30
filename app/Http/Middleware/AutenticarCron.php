<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Porta dos webhooks de cron (/webhook/*).
 *
 * FECHA QUANDO O SEGREDO NÃO EXISTE. A checagem antiga, na própria rota, era
 * `if ($cronSecret && ...)`: sem CRON_SECRET definido — ou com `config:cache`,
 * em que env() devolve null — qualquer um disparava o sync do Microwork e a
 * cobrança de pendências pela URL.
 *
 * A Vercel Cron envia `Authorization: Bearer <CRON_SECRET>` sozinha quando a
 * variável existe no projeto; um cron externo precisa mandar o mesmo cabeçalho.
 */
class AutenticarCron
{
    public function handle(Request $request, Closure $next): Response
    {
        $segredo  = (string) config('services.cron.secret');
        $recebido = (string) $request->bearerToken();

        if ($segredo === '' || ! hash_equals($segredo, $recebido)) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        return $next($request);
    }
}
