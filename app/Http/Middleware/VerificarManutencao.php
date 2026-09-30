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
        // 1. Manutenção desligada: libera o acesso imediatamente para todos.
        // Lido de config, não de env(): com `config:cache` o env() devolve null,
        // e `null === false` fechava o sistema inteiro sem ninguém pedir.
        if (! config('app.manutencao.ativa')) {
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