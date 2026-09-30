<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\Pedido;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * O chat de um pedido é conversa fechada entre quem participa dele.
 *
 * Antes da v3.4 os três métodos agiam sobre o `$pedidoId` da URL sem verificar
 * relação nenhuma: trocar o número devolvia a conversa de outra filial. Os
 * testes abaixo fixam os dois lados — a filial de fora não entra, e quem
 * participa continua entrando sem atrito.
 */
class ChatEscopoTest extends TestCase
{
    use DatabaseTransactions;

    private User $lojaDona;
    private User $lojaIntrusa;
    private User $lojaOrigem;
    private User $operadorCd;
    private Pedido $pedido;

    protected function setUp(): void
    {
        parent::setUp();

        // Push e notificação interna não são o objeto deste teste, e o
        // OneSignal bateria numa API externa.
        Notification::fake();

        $this->lojaDona = User::factory()->create([
            'email'  => 'dona_' . uniqid() . '@shineray.com.br',
            'perfil' => 'loja',
            'filial' => 'Loja Dona',
        ]);

        $this->lojaIntrusa = User::factory()->create([
            'email'  => 'intrusa_' . uniqid() . '@shineray.com.br',
            'perfil' => 'loja',
            'filial' => 'Loja Intrusa',
        ]);

        $this->lojaOrigem = User::factory()->create([
            'email'  => 'origem_' . uniqid() . '@shineray.com.br',
            'perfil' => 'loja',
            'filial' => 'Loja Origem',
        ]);

        $this->operadorCd = User::factory()->create([
            'email'  => 'cd_chat_' . uniqid() . '@shineray.com.br',
            'perfil' => 'cd',
        ]);

        // Transferência: a dona pede, a origem cede do estoque dela.
        $this->pedido = Pedido::create([
            'user_id'        => $this->lojaDona->id,
            'origem_user_id' => $this->lojaOrigem->id,
            'status'         => 'solicitado',
        ]);

        Message::create([
            'pedido_id' => $this->pedido->id,
            'user_id'   => $this->lojaDona->id,
            'content'   => 'Consigo desconto no frete desta transferência?',
            'canal'     => 'cd',
        ]);
    }

    /** O conteúdo da conversa não vaza para uma filial que não participa. */
    public function test_loja_de_fora_nao_le_a_conversa_de_outro_pedido()
    {
        $resposta = $this->actingAs($this->lojaIntrusa)
            ->getJson(route('chat.index', $this->pedido->id));

        $resposta->assertForbidden();
        $resposta->assertDontSee('desconto no frete');
    }

    /** Nem escreve nela. */
    public function test_loja_de_fora_nao_escreve_no_chat_alheio()
    {
        $this->actingAs($this->lojaIntrusa)
            ->postJson(route('chat.store', $this->pedido->id), [
                'content' => 'mensagem indevida',
                'canal'   => 'cd',
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('messages', [
            'pedido_id' => $this->pedido->id,
            'content'   => 'mensagem indevida',
        ]);
    }

    /**
     * Nem marca como lida.
     *
     * Este era o mais silencioso dos três: o destinatário legítimo perdia o
     * aviso de não lida sem nada aparecer na tela dele.
     */
    public function test_loja_de_fora_nao_marca_mensagem_alheia_como_lida()
    {
        $this->actingAs($this->lojaIntrusa)
            ->postJson(route('chat.markRead', $this->pedido->id))
            ->assertForbidden();

        $this->assertDatabaseHas('messages', [
            'pedido_id' => $this->pedido->id,
            'read_at'   => null,
        ]);
    }

    /** Quem pediu continua lendo o próprio pedido. */
    public function test_solicitante_le_a_propria_conversa()
    {
        $this->actingAs($this->lojaDona)
            ->getJson(route('chat.index', $this->pedido->id))
            ->assertOk()
            ->assertSee('desconto no frete');
    }

    /**
     * A loja de ORIGEM da transferência também participa.
     *
     * É a metade da regra que um escopo ingênuo por `user_id` deixaria de
     * fora: quem cede a moto do próprio estoque precisa acompanhar a conversa.
     */
    public function test_loja_de_origem_participa_da_conversa()
    {
        $this->actingAs($this->lojaOrigem)
            ->getJson(route('chat.index', $this->pedido->id))
            ->assertOk();

        $this->actingAs($this->lojaOrigem)
            ->postJson(route('chat.store', $this->pedido->id), [
                'content' => 'Separo hoje a tarde.',
                'canal'   => 'cd',
            ])
            ->assertSuccessful();
    }

    /** CD acompanha qualquer pedido — é o trabalho dele. */
    public function test_cd_acompanha_qualquer_pedido()
    {
        $this->actingAs($this->operadorCd)
            ->getJson(route('chat.index', $this->pedido->id))
            ->assertOk()
            ->assertSee('desconto no frete');
    }

    /** Pedido cancelado é soft-deleted, mas o histórico segue dos participantes. */
    public function test_historico_continua_legivel_depois_do_pedido_cancelado()
    {
        $this->pedido->delete();

        $this->actingAs($this->lojaDona)
            ->getJson(route('chat.index', $this->pedido->id))
            ->assertOk()
            ->assertSee('desconto no frete');
    }
}
