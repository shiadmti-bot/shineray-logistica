<?php

namespace Tests\Feature\Chat;

use App\Models\Message;
use App\Models\User;
use App\Notifications\NovaMensagemChat;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * O que o chat mostra e quem ele avisa. O escopo (quem entra na conversa)
 * está em Tests\Feature\ChatEscopoTest.
 */
class ChatPrivacidadeTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    private User $cd;
    private User $destino;
    private User $origem;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Http::fake();

        $this->cd      = $this->usuario('cd', ['filial' => 'CD Matriz', 'onesignal_id' => 'push-do-cd-123']);
        $this->destino = $this->usuario('loja', ['filial' => 'Loja Pediu/PA']);
        $this->origem  = $this->usuario('loja', ['filial' => 'Loja Cede/PA']);
    }

    public function test_conversa_nao_expoe_email_nem_push_de_quem_escreveu(): void
    {
        $pedido = $this->pedidoMoto($this->destino, 'solicitado', $this->origem);
        Message::create(['pedido_id' => $pedido->id, 'user_id' => $this->cd->id, 'content' => 'Separando hoje', 'canal' => 'cd']);

        $autor = $this->actingAs($this->destino)
            ->getJson(route('chat.index', $pedido->id))
            ->assertOk()
            ->json('0.user');

        $this->assertEqualsCanonicalizing(['id', 'name', 'perfil', 'filial'], array_keys($autor));
        $this->assertSame($this->cd->name, $autor['name']);
    }

    public function test_mensagem_nova_volta_sem_dados_internos_do_autor(): void
    {
        $pedido = $this->pedidoMoto($this->destino, 'solicitado');

        $autor = $this->actingAs($this->cd)
            ->postJson(route('chat.store', $pedido->id), ['content' => 'Chega amanhã', 'canal' => 'cd'])
            ->assertSuccessful()
            ->json('user');

        $this->assertArrayNotHasKey('email', $autor);
        $this->assertArrayNotHasKey('onesignal_id', $autor);
    }

    /**
     * O código lia `$pedido->origem_user`, relação que não existe: a loja de
     * origem de uma transferência nunca era avisada das mensagens do CD.
     */
    public function test_mensagem_do_cd_avisa_solicitante_e_loja_de_origem(): void
    {
        $pedido = $this->pedidoMoto($this->destino, 'solicitado', $this->origem);

        $this->actingAs($this->cd)
            ->postJson(route('chat.store', $pedido->id), ['content' => 'Coleta na quinta', 'canal' => 'cd'])
            ->assertSuccessful();

        Notification::assertSentTo($this->destino, NovaMensagemChat::class);
        Notification::assertSentTo($this->origem, NovaMensagemChat::class);
        Notification::assertNotSentTo($this->cd, NovaMensagemChat::class);
    }

    public function test_mensagem_gigante_e_recusada(): void
    {
        $pedido = $this->pedidoMoto($this->destino, 'solicitado');

        $this->actingAs($this->destino)
            ->postJson(route('chat.store', $pedido->id), ['content' => str_repeat('a', 5001), 'canal' => 'cd'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('content');
    }

    public function test_canal_inventado_e_recusado(): void
    {
        $pedido = $this->pedidoMoto($this->destino, 'solicitado');

        $this->actingAs($this->destino)
            ->postJson(route('chat.store', $pedido->id), ['content' => 'oi', 'canal' => 'diretoria-secreta'])
            ->assertJsonValidationErrors('canal');
    }
}
