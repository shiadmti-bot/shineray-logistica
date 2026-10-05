<?php

namespace Tests\Feature\Notificacoes;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * O sininho é pessoal: cada um lê, conta e marca só o que é dele.
 */
class NotificacoesTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    public function test_cada_um_ve_so_as_proprias_notificacoes(): void
    {
        $eu = $this->usuario('loja');
        $outro = $this->usuario('loja');

        $this->notificar($eu, 'Seu pedido foi aprovado');
        $this->notificar($outro, 'Pedido de outra loja');

        $resposta = $this->actingAs($eu)->getJson(route('notificacoes.index'))->assertOk();

        $this->assertSame(1, $resposta->json('nao_lidas'));
        $this->assertCount(1, $resposta->json('itens'));
        $this->assertSame('Seu pedido foi aprovado', $resposta->json('itens.0.data.titulo'));
    }

    public function test_marcar_como_lidas_nao_mexe_nas_dos_outros(): void
    {
        $eu = $this->usuario('loja');
        $outro = $this->usuario('loja');

        $this->notificar($eu, 'Minha');
        $this->notificar($outro, 'Dele');

        $this->actingAs($eu)->postJson(route('notificacoes.ler'))->assertNoContent();

        $this->assertSame(0, $eu->unreadNotifications()->count());
        $this->assertSame(1, $outro->unreadNotifications()->count());
    }

    public function test_registro_do_push_valida_e_grava_so_no_proprio_usuario(): void
    {
        $eu = $this->usuario('loja');

        $this->actingAs($eu)->postJson(route('user.onesignal'), [])->assertJsonValidationErrors('onesignal_id');

        $this->actingAs($eu)
            ->postJson(route('user.onesignal'), ['onesignal_id' => 'dispositivo-abc', 'perfil' => 'admin'])
            ->assertOk();

        $eu->refresh();
        $this->assertSame('dispositivo-abc', $eu->onesignal_id);
        $this->assertSame('loja', $eu->perfil, 'Campo extra no payload não pode virar mass assignment.');
    }

    private function notificar(User $user, string $titulo): void
    {
        $user->notifications()->create([
            'id'   => (string) Str::uuid(),
            'type' => 'App\\Notifications\\PedidoAtualizado',
            'data' => ['titulo' => $titulo, 'mensagem' => $titulo],
        ]);
    }
}
