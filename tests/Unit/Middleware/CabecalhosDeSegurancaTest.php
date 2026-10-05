<?php

namespace Tests\Unit\Middleware;

use App\Http\Middleware\CabecalhosDeSeguranca;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Tests\TestCase;

class CabecalhosDeSegurancaTest extends TestCase
{
    public function test_toda_resposta_sai_protegida_contra_iframe_e_sniffing(): void
    {
        $resposta = $this->passar(Request::create('http://shineray.test/dashboard'));

        $this->assertSame('SAMEORIGIN', $resposta->headers->get('X-Frame-Options'));
        $this->assertSame('nosniff', $resposta->headers->get('X-Content-Type-Options'));
        $this->assertSame('strict-origin-when-cross-origin', $resposta->headers->get('Referrer-Policy'));
    }

    public function test_hsts_so_sobre_https(): void
    {
        $http = $this->passar(Request::create('http://shineray.test/'));
        $https = $this->passar(Request::create('https://shineray.test/'));

        $this->assertFalse($http->headers->has('Strict-Transport-Security'));
        $this->assertSame('max-age=31536000', $https->headers->get('Strict-Transport-Security'));
    }

    private function passar(Request $request): Response
    {
        return (new CabecalhosDeSeguranca())->handle($request, fn () => new Response('ok'));
    }
}
