<?php

namespace Tests\Feature;

use App\Models\ModuloSistema;
use App\Models\Pedido;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia;
use Spatie\Activitylog\Models\Activity;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * Módulos opcionais (Gestão > Módulos): quem liga, o que um módulo desligado
 * barra e o que continua aberto.
 *
 * O phpunit.xml liga os módulos para as demais suítes; aqui o padrão volta a
 * ser o de produção — pedidos de peças desligado.
 */
class ModulosTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    protected function setUp(): void
    {
        parent::setUp();

        config(['modulos.pedidos_pecas' => false]);
    }

    public function test_tela_de_modulo_desligado_volta_ao_inicio_com_o_aviso(): void
    {
        $this->actingAs($this->usuario('loja'))
            ->get(route('pecas.solicitar'))
            ->assertRedirect(route('dashboard'))
            ->assertSessionHas('warning', fn (string $aviso) => str_contains($aviso, 'Pedidos de peças'));
    }

    public function test_acao_de_modulo_desligado_nao_executa(): void
    {
        $antes = Pedido::withTrashed()->count();

        $this->actingAs($this->usuario('loja'))
            ->from(route('pedidos.index'))
            ->post(route('pecas.solicitar.store'), ['itens' => [['descricao' => 'Filtro de óleo', 'quantidade' => 1]]])
            ->assertRedirect(route('pedidos.index'))
            ->assertSessionHas('error');

        $this->assertSame($antes, Pedido::withTrashed()->count(), 'Nenhum pedido de peça pode nascer com o módulo desligado.');
    }

    public function test_chamada_json_de_modulo_desligado_recebe_403(): void
    {
        $this->actingAs($this->usuario('cd'))
            ->getJson(route('pecas.atendimento.buscar', ['q' => 'filtro']))
            ->assertForbidden()
            ->assertJsonFragment(['message' => 'O módulo “Pedidos de peças” está temporariamente desativado. Avisaremos no mural quando for liberado.']);
    }

    /** Catálogo, onde encontrar e estoque não dependem do fluxo de pedido. */
    public function test_catalogo_e_estoque_de_pecas_seguem_abertos(): void
    {
        $this->actingAs($this->usuario('loja'))->get(route('pecas.index'))->assertOk();
        $this->actingAs($this->usuario('cd'))->get(route('pecas.estoque.index'))->assertOk();
    }

    /** O gestor é mandado do início para o painel dele; o aviso vai junto. */
    public function test_aviso_sobrevive_ao_redirecionamento_do_gestor(): void
    {
        $this->actingAs($this->usuario('gestor', ['valida_motos' => true]))
            ->get(route('pecas.indicadores'))
            ->assertRedirect(route('dashboard'));

        $this->get(route('dashboard'))
            ->assertRedirect(route('gestor.index'))
            ->assertSessionHas('warning');
    }

    public function test_admin_liga_e_desliga_e_a_mudanca_fica_registrada(): void
    {
        $admin = $this->usuario('admin');
        $loja = $this->usuario('loja');

        $this->actingAs($admin)
            ->patch(route('modulos.atualizar', 'pedidos_pecas'), ['ativo' => true])
            ->assertSessionHas('success');

        $this->assertDatabaseHas('modulos_sistema', [
            'chave' => 'pedidos_pecas', 'ativo' => true, 'atualizado_por' => $admin->id,
        ]);
        $this->actingAs($loja)->get(route('pecas.solicitar'))->assertOk();

        $this->actingAs($admin)->patch(route('modulos.atualizar', 'pedidos_pecas'), ['ativo' => false]);
        $this->actingAs($loja)->get(route('pecas.solicitar'))->assertRedirect(route('dashboard'));

        // A trilha aparece na tela de Auditoria.
        $this->assertTrue(Activity::where('subject_type', ModuloSistema::class)->exists());
    }

    public function test_so_o_admin_muda_modulo(): void
    {
        foreach (['gestor', 'cd', 'loja'] as $perfil) {
            $this->actingAs($this->usuario($perfil))
                ->patch(route('modulos.atualizar', 'pedidos_pecas'), ['ativo' => true])
                ->assertForbidden();
        }

        $this->assertDatabaseMissing('modulos_sistema', ['chave' => 'pedidos_pecas']);
    }

    public function test_modulo_inexistente_responde_404(): void
    {
        $this->actingAs($this->usuario('admin'))
            ->patch(route('modulos.atualizar', 'modulo_que_nao_existe'), ['ativo' => true])
            ->assertNotFound();
    }

    public function test_tela_de_modulos_mostra_estado_e_padrao(): void
    {
        $this->actingAs($this->usuario('admin'))
            ->get(route('modulos.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Modulos')
                ->where('modulos.0.chave', 'pedidos_pecas')
                ->where('modulos.0.ativo', false)
                ->where('modulos.0.padrao', false)
                ->where('modulos.1.chave', 'devolucoes')
                ->where('modulos.1.ativo', true)
            );
    }

    /** É a prop que o menu e os atalhos usam para esconder as entradas. */
    public function test_telas_recebem_o_estado_dos_modulos(): void
    {
        $this->actingAs($this->usuario('loja'))
            ->get(route('pedidos.index'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('modulos.pedidos_pecas', false)
                ->where('modulos.devolucoes', true)
                ->where('navCounts.pecasPendencias', 0)
            );
    }

    public function test_devolucoes_desligado_bloqueia_o_modulo(): void
    {
        config(['modulos.devolucoes' => false]);

        $this->actingAs($this->usuario('loja'))
            ->get(route('devolucoes.index'))
            ->assertRedirect(route('dashboard'));
    }

    public function test_cobranca_diaria_de_pecas_nao_roda_com_o_modulo_desligado(): void
    {
        $this->artisan('pecas:cobrar')
            ->expectsOutputToContain('desativado')
            ->assertSuccessful();
    }
}
