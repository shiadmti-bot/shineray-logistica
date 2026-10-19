<?php

namespace App\Http\Middleware;

use App\Enums\Modulo;
use App\Services\Modulos;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Barra as rotas de um módulo opcional desligado (`modulo:pedidos_pecas`).
 *
 * Esconder o item do menu não basta: link salvo, aba antiga e requisição
 * montada à mão continuam chegando na rota. Quem decide é o servidor.
 *
 * Tela (GET) volta ao início com o aviso; ação (POST/PATCH/DELETE) volta à
 * tela de onde veio. O GET não usa back() de propósito: a URL bloqueada,
 * aberta direto no navegador, fica gravada como "página anterior", e voltar
 * para ela entraria em laço.
 */
class ExigirModulo
{
    public function __construct(private Modulos $modulos)
    {
    }

    public function handle(Request $request, Closure $next, string $chave): Response
    {
        // Chave inválida na declaração da rota estoura aqui, como em
        // CheckPerfil: um erro de digitação não pode virar "módulo desligado".
        $modulo = Modulo::from($chave);

        if ($this->modulos->ativo($modulo)) {
            return $next($request);
        }

        $mensagem = "O módulo “{$modulo->rotulo()}” está temporariamente desativado. Avisaremos no mural quando for liberado.";

        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            return response()->json(['message' => $mensagem], 403);
        }

        return $request->isMethod('GET')
            ? redirect()->route('dashboard')->with('warning', $mensagem)
            : back()->with('error', $mensagem);
    }
}
