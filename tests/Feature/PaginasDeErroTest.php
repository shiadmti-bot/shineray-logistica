<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * Erros com a cara do sistema (bootstrap/app.php, withExceptions).
 *
 * A tela Error.jsx existia e nada a renderizava: 403 e 404 mostravam a página
 * crua do Laravel, e a sessão expirada caía em "Page Expired" sem saída.
 */
class PaginasDeErroTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    public function test_acesso_negado_mostra_a_tela_do_sistema_com_o_motivo(): void
    {
        $this->actingAs($this->usuario('loja'))
            ->get(route('users.index'))
            ->assertForbidden()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Error')
                ->where('status', 403)
                ->where('mensagem', 'Acesso não autorizado para seu perfil.')
            );
    }

    /** O 404 não repassa a mensagem: ela traz o nome da classe do model. */
    public function test_pedido_inexistente_mostra_404_sem_detalhe_interno(): void
    {
        $this->actingAs($this->usuario('admin'))
            ->get(route('pedidos.show', 999_999_999))
            ->assertNotFound()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Error')
                ->where('status', 404)
                ->where('mensagem', null)
            );
    }

    /** Rota que não existe não passa pelos middlewares web — e a tela ainda renderiza. */
    public function test_rota_inexistente_mostra_404_mesmo_sem_sessao(): void
    {
        $this->get('/rota-que-nao-existe-' . uniqid())
            ->assertNotFound()
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Error')->where('status', 404));
    }

    /** Sininho, chat e Microwork são chamadas JSON: continuam recebendo JSON. */
    public function test_chamada_json_continua_recebendo_json(): void
    {
        $this->actingAs($this->usuario('loja'))
            ->getJson(route('users.index'))
            ->assertForbidden()
            ->assertJsonStructure(['message']);
    }

    public function test_sessao_expirada_volta_para_a_tela_com_aviso(): void
    {
        Route::middleware('web')->post('/_teste/sessao-expirada', fn () => throw new TokenMismatchException());

        $this->from('/pedidos')
            ->post('/_teste/sessao-expirada')
            ->assertRedirect('/pedidos')
            ->assertSessionHas('warning');
    }
}
