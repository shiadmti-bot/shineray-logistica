<?php

namespace App\Http\Middleware;

use App\Enums\Perfil;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPerfil
{
    public function handle(Request $request, Closure $next, string ...$perfis): Response
    {
        $user = $request->user();

        // Se o usuário não estiver logado
        if (! $user) {
            return redirect('/login');
        }

        // Perfil inválido na declaração da rota lança ValueError aqui mesmo: um
        // erro de digitação em `check_perfil:` não pode virar "acesso negado
        // para todo mundo" sem ninguém perceber.
        $permitidos = array_map(fn (string $perfil) => Perfil::from($perfil), $perfis);

        if ($user->temPerfil(...$permitidos)) {
            return $next($request);
        }

        abort(403, 'Acesso não autorizado para seu perfil.');
    }
}
