<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;
use Symfony\Component\HttpFoundation\Response;

class VerificarManutencao
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Se a sessão tiver o passe livre (Bypass), deixa passar
        if (Session::has('manutencao_bypass')) {
            return $next($request);
        }

        // Se não tiver, manda para a tela de manutenção
        return redirect()->route('maintenance');
    }
}