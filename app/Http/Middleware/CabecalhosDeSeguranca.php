<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cabeçalhos de segurança em toda resposta.
 *
 * O sistema não mandava nenhum, e a Vercel não acrescenta por conta própria.
 * O que mais pesava era a falta de X-Frame-Options: qualquer site podia abrir
 * o sistema dentro de um iframe invisível e induzir um usuário logado a clicar
 * em "Aprovar", "Rejeitar" ou "Desfazer carga" (clickjacking).
 *
 * CSP fica de fora de propósito: Vite, OneSignal, Pusher e Google Drive
 * carregam recursos de origens diferentes, e uma política errada quebraria
 * telas em produção sem aviso. Merece ser feita à parte, em modo report-only.
 */
class CabecalhosDeSeguranca
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Só faz sentido (e só é respeitado) sobre HTTPS. Sem includeSubDomains:
        // o domínio próprio pode ter subdomínios que não são deste sistema.
        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000');
        }

        return $response;
    }
}
