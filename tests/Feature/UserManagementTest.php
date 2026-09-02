<?php

namespace Tests\Feature;

use App\Models\EstoqueLocal;
use App\Models\Filial;
use App\Models\Route;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private Filial $filial;
    private Route $rota;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'name' => 'Administrador Teste',
            'email' => 'admin_gestao_' . uniqid() . '@shineray.com.br',
            'perfil' => 'admin',
        ]);

        $this->filial = Filial::firstOrCreate(
            ['nome' => 'Filial Teste V3', 'cidade' => 'Ananindeua', 'uf' => 'PA']
        );

        $this->rota = Route::firstOrCreate(
            ['code' => 'TEST-01'],
            ['name' => 'Rota Teste', 'active' => true]
        );
    }

    public function test_admin_pode_acessar_index_com_stats()
    {
        $response = $this->actingAs($this->admin)->get(route('users.index'));

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Users/Index')
            ->has('users.data')
            ->has('stats.total')
            ->has('stats.lojas')
            ->has('stats.cd')
            ->has('stats.gestores')
        );
    }

    public function test_admin_pode_criar_usuario_loja_personalizado()
    {
        $emailLoja = 'loja_' . uniqid() . '@shineray.com.br';

        $response = $this->actingAs($this->admin)->post(route('users.store'), [
            'name' => 'Loja Ananindeua Teste',
            'email' => $emailLoja,
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'perfil' => 'loja',
            'filial' => 'Ananindeua/PA',
            'is_interior' => true,
            'default_route_id' => $this->rota->id,
            'valida_pecas' => false,
        ]);

        $response->assertRedirect(route('users.index'));

        $user = User::where('email', $emailLoja)->first();
        $this->assertNotNull($user);
        $this->assertEquals('loja', $user->perfil);
        $this->assertEquals('Ananindeua/PA', $user->filial);
        $this->assertTrue((bool) $user->is_interior);
        $this->assertEquals($this->rota->id, $user->default_route_id);
    }

    public function test_admin_pode_criar_usuario_cd_com_gate1_pecas()
    {
        $emailCd = 'cd_' . uniqid() . '@shineray.com.br';

        $response = $this->actingAs($this->admin)->post(route('users.store'), [
            'name' => 'Operador CD Peças Teste',
            'email' => $emailCd,
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'perfil' => 'cd',
            'valida_pecas' => true,
        ]);

        $response->assertRedirect(route('users.index'));

        $user = User::where('email', $emailCd)->first();
        $this->assertNotNull($user);
        $this->assertEquals('cd', $user->perfil);
        $this->assertTrue((bool) $user->valida_pecas);
        $this->assertTrue($user->podeValidarPecas());
    }

    public function test_admin_pode_alternar_regra_logistica_interior()
    {
        $userLoja = User::factory()->create([
            'perfil' => 'loja',
            'filial' => 'Loja Castanhal',
            'is_interior' => false,
        ]);

        $response = $this->actingAs($this->admin)->patch(route('users.toggle-interior', $userLoja->id));
        $response->assertSessionHasNoErrors();

        $userLoja->refresh();
        $this->assertTrue((bool) $userLoja->is_interior);

        // Inverte de volta para Capital
        $this->actingAs($this->admin)->patch(route('users.toggle-interior', $userLoja->id));
        $userLoja->refresh();
        $this->assertFalse((bool) $userLoja->is_interior);
    }

    public function test_separacao_validador_de_pecas_nao_valida_motos_e_nao_acessa_gestor()
    {
        // Usuário do Pós-Venda que valida peças
        $validadorPecas = User::factory()->create([
            'perfil' => 'cd',
            'valida_pecas' => true,
            'valida_motos' => false,
        ]);

        $this->assertTrue($validadorPecas->podeValidarPecas());
        $this->assertFalse($validadorPecas->podeValidarMotos());

        // Tentar acessar o painel de aprovação de motos deve retornar 403
        $response = $this->actingAs($validadorPecas)->get(route('gestor.index'));
        $response->assertStatus(403);
    }

    public function test_separacao_validador_de_motos_nao_valida_pecas()
    {
        // Gestor Comercial que valida motos
        $gestorMotos = User::factory()->create([
            'perfil' => 'gestor',
            'valida_motos' => true,
            'valida_pecas' => false,
        ]);

        $this->assertTrue($gestorMotos->podeValidarMotos());
        $this->assertFalse($gestorMotos->podeValidarPecas());

        // Consegue acessar aprovação de motos normalmente
        $response = $this->actingAs($gestorMotos)->get(route('gestor.index'));
        $response->assertStatus(200);
    }

    public function test_validador_de_pecas_pode_acessar_fila_de_atendimento_mesmo_sem_ser_cd()
    {
        $validadorExclusivo = User::factory()->create([
            'perfil' => 'gestor',
            'valida_pecas' => true,
            'valida_motos' => false,
        ]);

        // Acessa fila de atendimento de peças sem receber 403
        $response = $this->actingAs($validadorExclusivo)->get(route('pecas.atendimento'));
        $response->assertStatus(200);
    }

    public function test_pedidos_index_permite_filtrar_por_tipo_moto_e_peca()
    {
        $response = $this->actingAs($this->admin)->get(route('pedidos.index', ['tipo' => 'moto']));
        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Pedidos/Index')
            ->where('currentTipo', 'moto')
            ->has('tipoCounts.moto')
            ->has('tipoCounts.peca')
        );

        $responsePeca = $this->actingAs($this->admin)->get(route('pedidos.index', ['tipo' => 'peca']));
        $responsePeca->assertStatus(200);
        $responsePeca->assertInertia(fn ($page) => $page
            ->component('Pedidos/Index')
            ->where('currentTipo', 'peca')
        );
    }
}
