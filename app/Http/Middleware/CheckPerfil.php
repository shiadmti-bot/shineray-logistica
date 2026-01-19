<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Auth;

class CheckPerfil
{
    public function handle(Request $request, Closure $next, ...$perfils): Response
    {
        // Se o usuário não estiver logado
        if (!Auth::check()) {
            return redirect('/login');
        }

        $user = Auth::user();

        // Se o perfil do usuário estiver na lista de permitidos
        if (in_array($user->perfil, $perfils)) {
            return $next($request);
        }

        // Se não tiver permissão
        abort(403, 'Acesso não autorizado para seu perfil.');
    }
}