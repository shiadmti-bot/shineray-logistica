<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\User;

/**
 * Registra a última atividade do usuário (`last_seen_at`, o "online" da
 * gestão de usuários).
 */
class UserActivity
{
    /** Intervalo mínimo entre gravações, por sessão. O "online" considera 5 minutos. */
    private const INTERVALO_SEGUNDOS = 60;

    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && $request->hasSession()) {
            $ultimaGravacao = (int) $request->session()->get('atividade_registrada_em', 0);

            // A trava mora na sessão, que já é lida em todo request. A versão
            // anterior perguntava ao cache (driver database) a cada clique —
            // uma consulta extra por navegação só para decidir se gravava.
            if (now()->timestamp - $ultimaGravacao >= self::INTERVALO_SEGUNDOS) {
                User::whereKey($user->id)->update(['last_seen_at' => now()]);
                $request->session()->put('atividade_registrada_em', now()->timestamp);
            }
        }

        return $next($request);
    }
}
