<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Session;

class VerificarManutencao
{
    public function handle(Request $request, Closure $next): Response
    {
        // 1. Verifica se a manutenção está DESLIGADA no .env
        // Se estiver 'false', libera o acesso imediatamente para todos
        if (env('SISTEMA_MANUTENCAO', false) === false) {
            return $next($request);
        }

        // -----------------------------------------------------------
        // SE CHEGOU AQUI, A MANUTENÇÃO ESTÁ ATIVA (true)
        // -----------------------------------------------------------

        // 2. Libera rotas essenciais para não dar loop (login, a própria tela de manutenção e o bypass)
        if ($request->routeIs('maintenance') || 
            $request->is('liberar-acesso-ti') || 
            $request->is('bloquear-acesso')) {
            return $next($request);
        }

        // 3. Verifica se o usuário tem a "chave mestra" da TI na sessão
        if (Session::has('manutencao_bypass')) {
            return $next($request);
        }

        // 4. Se não for TI e o sistema estiver em manutenção, manda pra tela de aviso
        return redirect()->route('maintenance');
    }
}