<?php

namespace Tests\Feature;

use App\Models\Romaneio;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * Portas que estavam abertas por URL (v3.4).
 *
 * Rotas GET que alteravam dados, webhooks que aceitavam qualquer chamada
 * quando o segredo faltava e um bypass de manutenção sem segredo nenhum.
 */
class RotasSensiveisTest extends TestCase
{
    use DatabaseTransactions;

    public function test_rotas_de_debug_e_de_correcao_por_get_nao_existem_mais()
    {
        $admin = User::factory()->create([
            'email'  => 'rotas_admin_' . uniqid() . '@shineray.com.br',
            'perfil' => 'admin',
        ]);

        $this->actingAs($admin)->get('/corrigir-status-romaneios')->assertNotFound();
        $this->actingAs($admin)->get('/bi-debug')->assertNotFound();
        $this->actingAs($admin)->get('/pedidos/1/imprimir')->assertNotFound();
    }

    /** A checagem antiga era `if ($cronSecret && ...)`: sem segredo, porta aberta. */
    public function test_webhook_fecha_quando_o_segredo_nao_esta_configurado()
    {
        config(['services.cron.secret' => null]);

        $this->get('/webhook/pecas-cobranca')->assertUnauthorized();
        $this->withToken('qualquer')->get('/webhook/microwork')->assertUnauthorized();
    }

    public function test_webhook_recusa_token_errado()
    {
        config(['services.cron.secret' => 'segredo-certo']);

        $this->withToken('segredo-errado')->get('/webhook/pecas-cobranca')->assertUnauthorized();
    }

    public function test_webhook_aceita_o_token_do_cron()
    {
        config(['services.cron.secret' => 'segredo-certo']);

        Artisan::shouldReceive('call')->once()->with('pecas:cobrar')->andReturn(0);
        Artisan::shouldReceive('output')->once()->andReturn('Cobranças enviadas: 0');

        $this->withToken('segredo-certo')
            ->get('/webhook/pecas-cobranca')
            ->assertOk()
            ->assertJsonPath('saida', 'Cobranças enviadas: 0');
    }

    public function test_liberar_acesso_ti_exige_a_chave_configurada()
    {
        config(['app.manutencao.ativa' => true, 'app.manutencao.chave' => null]);

        // Sem chave configurada, nem a URL "certa" abre.
        $this->get('/liberar-acesso-ti?chave=')
            ->assertForbidden()
            ->assertSessionMissing('manutencao_bypass');

        config(['app.manutencao.chave' => 'chave-da-ti']);

        $this->get('/liberar-acesso-ti?chave=errada')
            ->assertForbidden()
            ->assertSessionMissing('manutencao_bypass');

        $this->get('/liberar-acesso-ti?chave=chave-da-ti')
            ->assertRedirect('/dashboard')
            ->assertSessionHas('manutencao_bypass', true);
    }

    /** Lida de config: com `config:cache`, o env() antigo devolvia null e fechava o sistema. */
    public function test_manutencao_segue_a_configuracao()
    {
        $loja = User::factory()->create([
            'email'  => 'rotas_loja_' . uniqid() . '@shineray.com.br',
            'perfil' => 'loja',
        ]);

        config(['app.manutencao.ativa' => true]);
        $this->actingAs($loja)->get('/manual')->assertRedirect(route('maintenance'));

        config(['app.manutencao.ativa' => false]);
        $this->actingAs($loja)->get('/manual')->assertOk();
    }

    public function test_comando_fecha_carga_vazia_e_respeita_o_dry()
    {
        $carga = Romaneio::create([
            'motorista' => 'Motorista Teste',
            'placa'     => 'TST0A00',
            'status'    => 'em_transito',
        ]);

        $this->artisan('romaneios:corrigir-status', ['--dry' => true])->assertSuccessful();
        $this->assertSame('em_transito', $carga->fresh()->status);

        $this->artisan('romaneios:corrigir-status')->assertSuccessful();
        $this->assertSame('concluido', $carga->fresh()->status);
    }
}
