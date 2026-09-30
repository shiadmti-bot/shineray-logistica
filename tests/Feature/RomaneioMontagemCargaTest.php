<?php

namespace Tests\Feature;

use App\Models\Basqueta;
use App\Models\EstoqueLocal;
use App\Models\Filial;
use App\Models\Moto;
use App\Models\Peca;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\Romaneio;
use App\Models\RomaneioItem;
use App\Models\Route;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class RomaneioMontagemCargaTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private User $operadorCd;
    private User $lojaUser;
    private EstoqueLocal $localCd;
    private EstoqueLocal $localLoja;

    protected function setUp(): void
    {
        parent::setUp();

        $this->localCd = EstoqueLocal::firstOrCreate(
            ['tipo' => EstoqueLocal::TIPO_CD],
            ['nome' => 'CD Ananindeua Teste', 'slug' => 'cd-ananindeua-teste-' . uniqid(), 'ativo' => true, 'participa_pecas' => true]
        );

        $this->localLoja = EstoqueLocal::create([
            'nome'            => 'Loja Castanhal Teste',
            'slug'            => 'loja-castanhal-teste-' . uniqid(),
            'tipo'            => EstoqueLocal::TIPO_LOJA,
            'participa_pecas' => true,
            'ativo'           => true,
        ]);

        $this->admin = User::factory()->create([
            'name'         => 'Admin Logística',
            'email'        => 'admin_log_' . uniqid() . '@shineray.com.br',
            'perfil'       => 'admin',
            'valida_pecas' => true,
            'valida_motos' => true,
        ]);

        $this->operadorCd = User::factory()->create([
            'name'             => 'Operador CD',
            'email'            => 'operador_cd_' . uniqid() . '@shineray.com.br',
            'perfil'           => 'cd',
            'estoque_local_id' => $this->localCd->id,
        ]);

        $this->lojaUser = User::factory()->create([
            'name'             => 'Loja Castanhal',
            'email'            => 'loja_cas_' . uniqid() . '@shineray.com.br',
            'perfil'           => 'loja',
            'filial'           => 'Loja Castanhal/PA',
            'estoque_local_id' => $this->localLoja->id,
        ]);
    }

    public function test_operador_pode_acessar_painel_de_montagem_de_carga()
    {
        Route::create([
            'code'   => 'R-TESTE',
            'name'   => 'Rota Teste Castanhal',
            'active' => true,
        ]);

        $response = $this->actingAs($this->operadorCd)->get(route('romaneios.create'));
        $response->assertStatus(200);

        $response->assertInertia(function ($page) {
            $props = $page->toArray()['props'];
            return isset($props['expedicao'])
                && isset($props['coletas'])
                && isset($props['cargasEmAberto'])
                && isset($props['pecasProntas'])
                && isset($props['rotas']);
        });
    }

    public function test_criar_carga_mista_simultanea_com_motos_e_basquetas()
    {
        // 1. Cria Pedido de Moto com moto separada pronta no CD
        $pedidoMoto = Pedido::create([
            'user_id' => $this->lojaUser->id,
            'status'  => 'separado',
        ]);

        $moto = Moto::create([
            'chassi'            => '99HSHF175VS' . rand(100000, 999999),
            'modelo'            => 'SHI 175',
            'cor'               => 'PRETA',
            'status'            => 'separado',
            'localizacao_atual' => 'Docas CD',
        ]);
        $pedidoMoto->motos()->attach($moto->id);

        // 2. Cria Basqueta de Peças Liberada (Gate 2)
        $peca = Peca::create([
            'codigo'    => 'SKU-MC-' . uniqid(),
            'descricao' => 'AMORTECEDOR TRASEIRO',
            'unidade'   => 'UN',
        ]);

        $pedidoPeca = Pedido::create([
            'user_id'    => $this->lojaUser->id,
            'tipo_carga' => 'peca',
            'status'     => 'aprovado',
        ]);

        $basqueta = Basqueta::create([
            'estoque_local_id' => $this->localLoja->id,
            'user_id'          => $this->operadorCd->id,
            'status'           => Basqueta::STATUS_LIBERADA,
            'volumes'          => 2,
            'esvaziada_em'     => now(),
        ]);

        $basqueta->itens()->create([
            'pedido_id'     => $pedidoPeca->id,
            'peca_id'       => $peca->id,
            'quantidade'    => 5,
            'qtd_atribuida' => 5,
        ]);

        // 3. Monta Carga Mista com a moto e a basqueta
        $response = $this->actingAs($this->operadorCd)->post(route('romaneios.store'), [
            'motorista'     => 'Carlos Motorista',
            'placa'         => 'SHI-2026',
            'rota_nome'     => 'Rota Castanhal / Bragança',
            'motos_ids'     => [$moto->id],
            'basquetas_ids' => [$basqueta->id],
        ]);

        $response->assertSessionHasNoErrors();

        // 4. Valida Romaneio e Vinculações
        $moto->refresh();
        $basqueta->refresh();

        $this->assertEquals('expedido', $moto->status);
        $this->assertNotNull($moto->romaneio_id);

        $this->assertEquals(Basqueta::STATUS_DESPACHADA, $basqueta->status);
        $this->assertNotNull($basqueta->romaneio_id);
        $this->assertEquals($moto->romaneio_id, $basqueta->romaneio_id);

        $romaneio = Romaneio::find($moto->romaneio_id);
        $this->assertNotNull($romaneio);
        $this->assertEquals('CARLOS MOTORISTA', $romaneio->motorista);
        $this->assertEquals('SHI-2026', $romaneio->placa);
    }

    public function test_validacao_bloqueia_carga_sem_itens()
    {
        $response = $this->actingAs($this->operadorCd)->post(route('romaneios.store'), [
            'motorista'     => 'Carlos Motorista',
            'placa'         => 'SHI-2026',
            'rota_nome'     => 'Rota Castanhal',
            'motos_ids'     => [],
            'basquetas_ids' => [],
        ]);

        $response->assertSessionHasErrors(['motos_ids']);
    }
}
