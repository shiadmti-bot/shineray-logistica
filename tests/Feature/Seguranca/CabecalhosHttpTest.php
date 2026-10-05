<?php

namespace Tests\Feature\Seguranca;

use Tests\TestCase;

/**
 * O middleware de cabeçalhos está registrado de fato, e de forma global.
 * (A lógica dele é testada em Tests\Unit\Middleware\CabecalhosDeSegurancaTest.)
 */
class CabecalhosHttpTest extends TestCase
{
    public function test_telas_saem_com_protecao_contra_iframe(): void
    {
        $this->get(route('login'))
            ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeaderMissing('Strict-Transport-Security');
    }

    public function test_atras_do_proxy_https_da_vercel_vale_o_hsts(): void
    {
        // trustProxies(at: '*'): o X-Forwarded-Proto da Vercel diz que a conexão é HTTPS.
        $this->withHeaders(['X-Forwarded-Proto' => 'https'])
            ->get(route('login'))
            ->assertHeader('Strict-Transport-Security', 'max-age=31536000');
    }

    public function test_respostas_fora_do_grupo_web_tambem_saem_protegidas(): void
    {
        config(['services.cron.secret' => '']);

        $this->get('/webhook/microwork')
            ->assertUnauthorized()
            ->assertHeader('X-Frame-Options', 'SAMEORIGIN');
    }
}
