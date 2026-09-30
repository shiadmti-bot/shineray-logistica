<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * O que roda a cada clique (v3.5).
 *
 * Toda navegação Inertia passa pelos middlewares e pelas props compartilhadas.
 * Com o banco a um oceano de distância, cada consulta ali é latência que o
 * usuário sente em TODAS as telas. Estes testes fixam o que saiu desse
 * caminho — e o que continua funcionando por outro.
 */
class CargaPorNavegacaoTest extends TestCase
{
    use DatabaseTransactions;

    public function test_props_compartilhadas_nao_carregam_mais_a_lista_de_notificacoes()
    {
        $user = $this->usuario();

        $this->actingAs($user)
            ->get('/manual')
            ->assertInertia(fn (AssertableInertia $pagina) => $pagina
                ->where('auth.user.id', $user->id)
                ->missing('auth.user.notifications')
                ->missing('auth.user.unread_count')
                ->has('navCounts.pecasPendencias')
            );
    }

    public function test_sininho_busca_as_notificacoes_sob_demanda()
    {
        $user = $this->usuario();
        $this->notificar($user, 'Pedido aprovado');

        $this->actingAs($user)
            ->getJson(route('notificacoes.index'))
            ->assertOk()
            ->assertJsonPath('nao_lidas', 1)
            ->assertJsonPath('itens.0.data.titulo', 'Pedido aprovado');
    }

    public function test_marcar_como_lidas_zera_o_contador()
    {
        $user = $this->usuario();
        $this->notificar($user, 'Um');
        $this->notificar($user, 'Dois');

        $this->actingAs($user)
            ->postJson(route('notificacoes.ler'))
            ->assertNoContent();

        $this->assertSame(0, $user->unreadNotifications()->count());
    }

    public function test_onesignal_exige_um_id()
    {
        $user = $this->usuario();

        $this->actingAs($user)
            ->postJson(route('user.onesignal'), [])
            ->assertUnprocessable();

        $this->actingAs($user)
            ->postJson(route('user.onesignal'), ['onesignal_id' => 'sub-123'])
            ->assertOk();

        $this->assertSame('sub-123', $user->fresh()->onesignal_id);
    }

    /**
     * A última atividade continua sendo gravada, mas a decisão de gravar vem da
     * sessão — sem a consulta ao cache (driver database) que acontecia a cada clique.
     */
    public function test_ultima_atividade_e_gravada_no_maximo_uma_vez_por_minuto()
    {
        $user = $this->usuario();

        $this->actingAs($user)->get('/manual')->assertOk();
        $this->assertNotNull($user->fresh()->last_seen_at);

        // A sessão diz que já gravou há instantes: não grava de novo.
        User::whereKey($user->id)->update(['last_seen_at' => now()->subHour()]);

        $this->actingAs($user)
            ->withSession(['atividade_registrada_em' => now()->timestamp])
            ->get('/manual')
            ->assertOk();

        $this->assertTrue($user->fresh()->last_seen_at->lt(now()->subMinutes(30)));
    }

    private function usuario(): User
    {
        return User::factory()->create([
            'email'  => 'navegacao_' . uniqid() . '@shineray.com.br',
            'perfil' => 'loja',
        ]);
    }

    private function notificar(User $user, string $titulo): void
    {
        $user->notifications()->create([
            'id'   => (string) Str::uuid(),
            'type' => 'App\\Notifications\\PedidoAtualizado',
            'data' => ['titulo' => $titulo, 'mensagem' => 'Teste', 'link' => '/pedidos'],
        ]);
    }
}
