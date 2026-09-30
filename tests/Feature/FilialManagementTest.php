<?php

namespace Tests\Feature;

use App\Models\EstoqueLocal;
use App\Models\Filial;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class FilialManagementTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private User $lojaUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'name'   => 'Admin Teste Filiais',
            'email'  => 'admin_filiais_' . uniqid() . '@shineray.com.br',
            'perfil' => 'admin',
        ]);

        $this->lojaUser = User::factory()->create([
            'name'   => 'Operador Loja Teste',
            'email'  => 'loja_filiais_' . uniqid() . '@shineray.com.br',
            'perfil' => 'loja',
        ]);
    }

    public function test_admin_pode_acessar_index_de_filiais()
    {
        $response = $this->actingAs($this->admin)->get(route('filiais.index'));

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page
            ->component('Filiais/Index')
            ->has('filiais')
            ->has('stats')
        );
    }

    public function test_usuario_loja_nao_pode_acessar_gerenciamento_de_filiais()
    {
        $response = $this->actingAs($this->lojaUser)->get(route('filiais.index'));
        $response->assertStatus(403);
    }

    public function test_admin_pode_cadastrar_nova_filial_com_sincronizacao_de_estoque_local()
    {
        $cidade = 'Altamira ' . uniqid();
        $nome = "Shineray {$cidade}";

        $response = $this->actingAs($this->admin)->post(route('filiais.store'), [
            'nome'            => $nome,
            'cidade'          => $cidade,
            'uf'              => 'PA',
            'ativo'           => true,
            'codigo_empresa'  => '99',
            'participa_pecas' => true,
        ]);

        $response->assertRedirect(route('filiais.index'));

        $filial = Filial::where('cidade', $cidade)->first();
        $this->assertNotNull($filial);
        $this->assertEquals($nome, $filial->nome);
        $this->assertEquals('PA', $filial->uf);
        $this->assertTrue($filial->ativo);
        $this->assertEquals('99', $filial->codigo_empresa);

        // Verifica criação automática de EstoqueLocal para atendimento logístico e peças
        $local = EstoqueLocal::where('tipo', EstoqueLocal::TIPO_LOJA)
            ->where('nome', 'LIKE', "%{$cidade}%")
            ->first();

        $this->assertNotNull($local);
        $this->assertTrue($local->participa_pecas);
        $this->assertTrue($local->ativo);
    }

    public function test_admin_pode_atualizar_dados_da_filial()
    {
        $filial = Filial::create([
            'nome'   => 'Shineray Redenção Original',
            'cidade' => 'Redenção ' . uniqid(),
            'uf'     => 'PA',
            'ativo'  => true,
        ]);

        $novoNome = 'Shineray Redenção Atualizada';

        $response = $this->actingAs($this->admin)->put(route('filiais.update', $filial->id), [
            'nome'            => $novoNome,
            'cidade'          => $filial->cidade,
            'uf'              => 'PA',
            'ativo'           => true,
            'participa_pecas' => true,
        ]);

        $response->assertSessionHasNoErrors();
        $filial->refresh();
        $this->assertEquals($novoNome, $filial->nome);
    }

    public function test_admin_pode_alternar_status_ativo_inativo_de_filial()
    {
        $filial = Filial::create([
            'nome'   => 'Filial Toggle Teste',
            'cidade' => 'Cidade Toggle ' . uniqid(),
            'uf'     => 'CE',
            'ativo'  => true,
        ]);

        // Desativa
        $responseDesativar = $this->actingAs($this->admin)->patch(route('filiais.toggle', $filial->id));
        $responseDesativar->assertSessionHasNoErrors();
        $filial->refresh();
        $this->assertFalse($filial->ativo);

        // Reativa
        $responseAtivar = $this->actingAs($this->admin)->patch(route('filiais.toggle', $filial->id));
        $responseAtivar->assertSessionHasNoErrors();
        $filial->refresh();
        $this->assertTrue($filial->ativo);
    }

    public function test_filial_sem_registros_vinculados_e_removida_diretamente()
    {
        $filial = Filial::create([
            'nome'   => 'Filial Sem Vinculos',
            'cidade' => 'Sem Vinculo ' . uniqid(),
            'uf'     => 'PA',
            'ativo'  => true,
        ]);

        $response = $this->actingAs($this->admin)->delete(route('filiais.destroy', $filial->id));
        $response->assertSessionHasNoErrors();

        $this->assertNull(Filial::find($filial->id));
    }

    public function test_filial_com_usuarios_vinculados_e_desativada_com_seguranca()
    {
        $cidade = 'Tucuruí ' . uniqid();
        $filial = Filial::create([
            'nome'   => "Shineray {$cidade}",
            'cidade' => $cidade,
            'uf'     => 'PA',
            'ativo'  => true,
        ]);

        // Vincula um usuário à filial
        User::factory()->create([
            'filial' => "{$cidade}/PA",
        ]);

        // Tenta remover
        $response = $this->actingAs($this->admin)->delete(route('filiais.destroy', $filial->id));
        $response->assertSessionHasNoErrors();

        // Não foi deletada para preservar a integridade, mas foi desativada
        $filial->refresh();
        $this->assertNotNull($filial);
        $this->assertFalse($filial->ativo);
    }

    public function test_users_create_carrega_apenas_filiais_ativas()
    {
        $cidadeAtiva = 'Ativa ' . uniqid();
        $filialAtiva = Filial::create([
            'nome'   => "Shineray {$cidadeAtiva}",
            'cidade' => $cidadeAtiva,
            'uf'     => 'PA',
            'ativo'  => true,
        ]);

        $cidadeInativa = 'Inativa ' . uniqid();
        $filialInativa = Filial::create([
            'nome'   => "Shineray {$cidadeInativa}",
            'cidade' => $cidadeInativa,
            'uf'     => 'PA',
            'ativo'  => false,
        ]);

        $response = $this->actingAs($this->admin)->get(route('users.create'));
        $response->assertStatus(200);

        $response->assertInertia(function ($page) use ($filialAtiva, $filialInativa) {
            $filiais = collect($page->toArray()['props']['filiais']);
            $ids = $filiais->pluck('id')->all();

            return in_array($filialAtiva->id, $ids) && !in_array($filialInativa->id, $ids);
        });
    }

    public function test_desativar_filial_arquiva_automaticamente_usuarios_vinculados_e_reativar_restaura()
    {
        $cidade = 'AutoArchive_' . uniqid();
        $filial = Filial::create([
            'nome'   => "Shineray {$cidade}",
            'cidade' => $cidade,
            'uf'     => 'PA',
            'ativo'  => true,
        ]);

        $user = User::factory()->create([
            'filial' => "{$cidade}/PA",
        ]);

        // 1. Desativa a filial via toggle
        $this->actingAs($this->admin)->patch(route('filiais.toggle', $filial->id));

        $filial->refresh();
        $user->refresh();

        $this->assertFalse($filial->ativo);
        $this->assertTrue($user->trashed());

        // 2. Reativa a filial via toggle
        $this->actingAs($this->admin)->patch(route('filiais.toggle', $filial->id));

        $filial->refresh();
        $user->refresh();

        $this->assertTrue($filial->ativo);
        $this->assertFalse($user->trashed());
    }

    public function test_pedidos_create_nao_contem_filial_desativada_em_locais_entrega()
    {
        $cidadeAtiva = 'EntAtiva_' . uniqid();
        $filialAtiva = Filial::create([
            'nome'   => "Shineray {$cidadeAtiva}",
            'cidade' => $cidadeAtiva,
            'uf'     => 'PA',
            'ativo'  => true,
        ]);

        $cidadeInativa = 'EntInativa_' . uniqid();
        $filialInativa = Filial::create([
            'nome'   => "Shineray {$cidadeInativa}",
            'cidade' => $cidadeInativa,
            'uf'     => 'PA',
            'ativo'  => false,
        ]);

        $response = $this->actingAs($this->admin)->get(route('pedidos.create'));
        $response->assertStatus(200);

        $response->assertInertia(function ($page) use ($filialAtiva, $filialInativa) {
            $locais = $page->toArray()['props']['locaisEntrega'];

            return in_array($filialAtiva->chave_filial, $locais)
                && !in_array($filialInativa->chave_filial, $locais);
        });
    }

    public function test_pedido_com_destino_a_filial_desativada_e_bloqueado()
    {
        $cidadeInativa = 'BloqDest_' . uniqid();
        $filialInativa = Filial::create([
            'nome'   => "Shineray {$cidadeInativa}",
            'cidade' => $cidadeInativa,
            'uf'     => 'PA',
            'ativo'  => false,
        ]);

        $response = $this->actingAs($this->admin)->post(route('pedidos.store'), [
            'itens' => [
                [
                    'modelo'     => 'SHI 175',
                    'cor'        => 'PRETA',
                    'motivo'     => 'Venda Confirmada',
                    'local'      => $filialInativa->chave_filial,
                    'quantidade' => 1,
                ]
            ]
        ]);

        $response->assertSessionHasErrors('itens.0.local');
    }
}
