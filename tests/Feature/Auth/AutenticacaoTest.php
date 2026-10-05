<?php

namespace Tests\Feature\Auth;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * Entrada no sistema e ciclo da senha.
 *
 * Os testes do Breeze foram removidos junto com o auto-cadastro (v3.4) e o
 * módulo ficou sem nenhuma cobertura. Aqui ficam as garantias que importam
 * para um sistema interno: só entra quem o admin cadastrou, força bruta é
 * barrada, conta arquivada não loga e a recuperação de senha não entrega a
 * lista de e-mails válidos.
 */
class AutenticacaoTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    public function test_tela_de_login_abre(): void
    {
        $this->get(route('login'))->assertOk();
    }

    public function test_login_com_a_senha_certa_entra(): void
    {
        $user = $this->usuario('loja', ['password' => 'senha-forte-123']);

        $this->post(route('login'), ['email' => $user->email, 'password' => 'senha-forte-123'])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($user);
    }

    public function test_senha_errada_nao_entra(): void
    {
        $user = $this->usuario('loja', ['password' => 'senha-forte-123']);

        $this->post(route('login'), ['email' => $user->email, 'password' => 'outra-senha'])
            ->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_depois_de_cinco_erros_ate_a_senha_certa_e_barrada(): void
    {
        $user = $this->usuario('loja', ['password' => 'senha-forte-123']);

        for ($tentativa = 1; $tentativa <= 5; $tentativa++) {
            $this->post(route('login'), ['email' => $user->email, 'password' => "chute-{$tentativa}"]);
        }

        $this->post(route('login'), ['email' => $user->email, 'password' => 'senha-forte-123'])
            ->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_conta_arquivada_pelo_admin_nao_entra(): void
    {
        $user = $this->usuario('loja', ['password' => 'senha-forte-123']);
        $user->delete(); // "arquivar" em /usuarios é soft delete

        $this->post(route('login'), ['email' => $user->email, 'password' => 'senha-forte-123'])
            ->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_logout_encerra_a_sessao(): void
    {
        $this->actingAs($this->usuario('loja'))
            ->post(route('logout'))
            ->assertRedirect('/');

        $this->assertGuest();
    }

    public function test_auto_cadastro_publico_nao_existe(): void
    {
        $email = 'intruso_' . uniqid() . '@teste.com.br';

        $this->get('/register')->assertNotFound();
        $this->post('/register', [
            'name' => 'Intruso', 'email' => $email,
            'password' => 'senha-forte-123', 'password_confirmation' => 'senha-forte-123',
        ])->assertNotFound();

        $this->assertDatabaseMissing('users', ['email' => $email]);
    }

    public function test_recuperacao_de_senha_nao_revela_se_o_email_existe(): void
    {
        Notification::fake();
        $user = $this->usuario('loja');

        $this->post(route('password.email'), ['email' => $user->email])->assertSessionHasNoErrors();
        $respostaExistente = session('status');

        $this->post(route('password.email'), ['email' => 'ninguem_' . uniqid() . '@teste.com.br'])->assertSessionHasNoErrors();
        $respostaInexistente = session('status');

        $this->assertNotEmpty($respostaExistente);
        $this->assertSame($respostaExistente, $respostaInexistente, 'As duas respostas precisam ser idênticas.');

        Notification::assertSentTo($user, ResetPassword::class);
        Notification::assertCount(1);
    }

    public function test_recuperacao_de_senha_tem_limite_de_envios(): void
    {
        Notification::fake();

        for ($i = 0; $i < 6; $i++) {
            $this->post(route('password.email'), ['email' => "spam{$i}_" . uniqid() . '@teste.com.br']);
        }

        $this->post(route('password.email'), ['email' => 'mais_um@teste.com.br'])->assertStatus(429);
    }

    public function test_link_de_redefinicao_troca_a_senha(): void
    {
        Notification::fake();
        $user = $this->usuario('loja');

        $this->post(route('password.email'), ['email' => $user->email]);

        $token = null;
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $aviso) use (&$token) {
            $token = $aviso->token;

            return true;
        });

        $this->post(route('password.store'), [
            'token'                 => $token,
            'email'                 => $user->email,
            'password'              => 'nova-senha-123',
            'password_confirmation' => 'nova-senha-123',
        ])->assertSessionHasNoErrors()->assertRedirect(route('login'));

        $this->assertTrue(Hash::check('nova-senha-123', $user->fresh()->password));
    }

    public function test_token_de_redefinicao_falso_nao_troca_a_senha(): void
    {
        $user = $this->usuario('loja', ['password' => 'senha-original-1']);

        $this->post(route('password.store'), [
            'token'                 => 'token-inventado',
            'email'                 => $user->email,
            'password'              => 'nova-senha-123',
            'password_confirmation' => 'nova-senha-123',
        ])->assertSessionHasErrors('email');

        $this->assertTrue(Hash::check('senha-original-1', $user->fresh()->password));
    }

    public function test_trocar_a_senha_exige_a_senha_atual(): void
    {
        $user = $this->usuario('loja', ['password' => 'senha-atual-123']);

        $this->actingAs($user)->from(route('profile.edit'))->put(route('password.update'), [
            'current_password'      => 'chute-errado',
            'password'              => 'nova-senha-123',
            'password_confirmation' => 'nova-senha-123',
        ])->assertSessionHasErrors('current_password');

        $this->assertTrue(Hash::check('senha-atual-123', $user->fresh()->password));

        $this->actingAs($user)->from(route('profile.edit'))->put(route('password.update'), [
            'current_password'      => 'senha-atual-123',
            'password'              => 'nova-senha-123',
            'password_confirmation' => 'nova-senha-123',
        ])->assertSessionHasNoErrors();

        $this->assertTrue(Hash::check('nova-senha-123', $user->fresh()->password));
    }

    /**
     * A tela de perfil edita nome e e-mail — e só. Mandar `perfil` ou as
     * atribuições junto não pode promover ninguém (mass assignment).
     */
    public function test_editar_o_proprio_perfil_nao_promove_ninguem(): void
    {
        $user = $this->usuario('loja', ['name' => 'Loja Antes']);

        $this->actingAs($user)->patch(route('profile.update'), [
            'name'             => 'Loja Depois',
            'email'            => $user->email,
            'perfil'           => 'admin',
            'valida_motos'     => true,
            'valida_pecas'     => true,
            'estoque_local_id' => 1,
        ])->assertSessionHasNoErrors();

        $user->refresh();
        $this->assertSame('Loja Depois', $user->name);
        $this->assertSame('loja', $user->perfil);
        $this->assertFalse($user->valida_motos);
        $this->assertFalse($user->valida_pecas);
        $this->assertNull($user->estoque_local_id);
    }

    public function test_autoexclusao_de_conta_nao_existe(): void
    {
        $user = $this->usuario('loja');

        $this->actingAs($user)->delete('/profile', ['password' => 'password'])->assertStatus(405);

        $this->assertNotSoftDeleted('users', ['id' => $user->id]);
    }
}
