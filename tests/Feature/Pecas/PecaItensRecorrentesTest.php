<?php

namespace Tests\Feature\Pecas;

use App\Enums\Perfil;
use App\Models\EstoqueLocal;
use App\Models\Peca;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Testes para a funcionalidade de "Pedir Novamente" / Reposição Rápida de Giro Recorrente.
 */
class PecaItensRecorrentesTest extends TestCase
{
    use DatabaseTransactions;

    private User $lojaUser;
    private User $lojaUserB;
    private User $admin;
    private EstoqueLocal $localLojaA;
    private EstoqueLocal $localLojaB;
    private EstoqueLocal $localCd;

    protected function setUp(): void
    {
        parent::setUp();

        $this->localCd = EstoqueLocal::firstOrCreate(
            ['tipo' => EstoqueLocal::TIPO_CD],
            [
                'nome'            => 'CD Central Teste Recorrentes',
                'slug'            => 'cd-central-teste-recorrentes-' . uniqid(),
                'ativo'           => true,
                'participa_pecas' => true,
            ]
        );

        $this->localLojaA = EstoqueLocal::create([
            'nome'            => 'Concessionária Shineray Centro Teste ' . uniqid(),
            'slug'            => 'loja-centro-teste-' . uniqid(),
            'tipo'            => EstoqueLocal::TIPO_LOJA,
            'participa_pecas' => true,
            'ativo'           => true,
        ]);

        $this->localLojaB = EstoqueLocal::create([
            'nome'            => 'Concessionária Shineray Sul Teste ' . uniqid(),
            'slug'            => 'loja-sul-teste-' . uniqid(),
            'tipo'            => EstoqueLocal::TIPO_LOJA,
            'participa_pecas' => true,
            'ativo'           => true,
        ]);

        $this->lojaUser = User::factory()->create([
            'name'             => 'Gerente Loja Centro',
            'email'            => 'loja_centro_' . uniqid() . '@shineray.com.br',
            'perfil'           => Perfil::Loja->value,
            'estoque_local_id' => $this->localLojaA->id,
            'filial'           => 'Shineray Centro',
        ]);

        $this->lojaUserB = User::factory()->create([
            'name'             => 'Gerente Loja Sul',
            'email'            => 'loja_sul_' . uniqid() . '@shineray.com.br',
            'perfil'           => Perfil::Loja->value,
            'estoque_local_id' => $this->localLojaB->id,
            'filial'           => 'Shineray Sul',
        ]);

        $this->admin = User::factory()->create([
            'name'             => 'Admin Shineray',
            'email'            => 'admin_' . uniqid() . '@shineray.com.br',
            'perfil'           => Perfil::Admin->value,
            'valida_pecas'     => true,
        ]);
    }

    public function test_tela_solicitar_retorna_prop_recorrentes_mesmo_sem_historico()
    {
        $response = $this->actingAs($this->lojaUser)->get(route('pecas.solicitar'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Pecas/Solicitar')
            ->has('recorrentes')
            ->has('maisPedidos')
            ->where('recorrentes', [])
            ->where('maisPedidos', [])
        );
    }

    public function test_recorrentes_traz_itens_mais_pedidos_nos_ultimos_90_dias_ordenados_por_quantidade()
    {
        $pecaTop = Peca::create([
            'codigo'           => 'REC-001-' . uniqid(),
            'descricao'        => 'Óleo Motor 4T 20W50',
            'unidade'          => 'UN',
            'categoria'        => 'Lubrificantes',
            'tipo_item'        => 'universal',
            'preco_referencia' => 35.50,
            'ativo'            => true,
        ]);

        $pecaMedia = Peca::create([
            'codigo'           => 'REC-002-' . uniqid(),
            'descricao'        => 'Pastilha de Freio Dianteira',
            'unidade'          => 'PAR',
            'categoria'        => 'Freios',
            'tipo_item'        => 'especifica',
            'preco_referencia' => 45.00,
            'ativo'            => true,
        ]);

        $pecaAntiga = Peca::create([
            'codigo'           => 'REC-003-' . uniqid(),
            'descricao'        => 'Filtro de Ar Antigo',
            'unidade'          => 'UN',
            'categoria'        => 'Filtros',
            'tipo_item'        => 'especifica',
            'preco_referencia' => 20.00,
            'ativo'            => true,
        ]);

        // Pedido 1: 30 dias atrás (concluido) - 8 unidades do óleo
        $ped1 = Pedido::create([
            'user_id'          => $this->lojaUser->id,
            'tipo_carga'       => 'peca',
            'status'           => 'concluido',
            'local_origem_id'  => $this->localCd->id,
            'local_destino_id' => $this->localLojaA->id,
            'itens'            => [],
            'created_at'       => now()->subDays(30),
        ]);
        PedidoItem::create([
            'pedido_id'   => $ped1->id,
            'tipo'        => 'peca',
            'peca_id'     => $pecaTop->id,
            'quantidade'  => 8,
            'created_at'  => now()->subDays(30),
        ]);

        // Pedido 2: 10 dias atrás (aprovado) - 4 unidades do óleo + 5 pastilhas
        $ped2 = Pedido::create([
            'user_id'          => $this->lojaUser->id,
            'tipo_carga'       => 'peca',
            'status'           => 'aprovado',
            'local_origem_id'  => $this->localCd->id,
            'local_destino_id' => $this->localLojaA->id,
            'itens'            => [],
            'created_at'       => now()->subDays(10),
        ]);
        PedidoItem::create([
            'pedido_id'   => $ped2->id,
            'tipo'        => 'peca',
            'peca_id'     => $pecaTop->id,
            'quantidade'  => 4,
            'created_at'  => now()->subDays(10),
        ]);
        PedidoItem::create([
            'pedido_id'   => $ped2->id,
            'tipo'        => 'peca',
            'peca_id'     => $pecaMedia->id,
            'quantidade'  => 5,
            'created_at'  => now()->subDays(10),
        ]);

        // Pedido 3: 120 dias atrás (> 90 dias) - NÃO deve entrar
        $ped3 = Pedido::create([
            'user_id'          => $this->lojaUser->id,
            'tipo_carga'       => 'peca',
            'status'           => 'concluido',
            'local_origem_id'  => $this->localCd->id,
            'local_destino_id' => $this->localLojaA->id,
            'itens'            => [],
        ]);
        DB::table('pedidos')->where('id', $ped3->id)->update(['created_at' => now()->subDays(120)]);

        PedidoItem::create([
            'pedido_id'   => $ped3->id,
            'tipo'        => 'peca',
            'peca_id'     => $pecaAntiga->id,
            'quantidade'  => 50,
        ]);

        $response = $this->actingAs($this->lojaUser)->get(route('pecas.solicitar'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Pecas/Solicitar')
            ->has('recorrentes', 2)
            ->where('recorrentes.0.id', $pecaTop->id)
            ->where('recorrentes.0.total_quantidade', 12)
            ->where('recorrentes.0.total_pedidos', 2)
            ->where('recorrentes.1.id', $pecaMedia->id)
            ->where('recorrentes.1.total_quantidade', 5)
            ->where('recorrentes.1.total_pedidos', 1)
        );
    }

    public function test_recorrentes_ignora_pedidos_cancelados_ou_rejeitados()
    {
        $pecaCancelada = Peca::create([
            'codigo'           => 'REC-CANC-' . uniqid(),
            'descricao'        => 'Peça Cancelada',
            'unidade'          => 'UN',
            'tipo_item'        => 'universal',
            'preco_referencia' => 10.00,
            'ativo'            => true,
        ]);

        $pedCanc = Pedido::create([
            'user_id'          => $this->lojaUser->id,
            'tipo_carga'       => 'peca',
            'status'           => 'cancelado',
            'local_origem_id'  => $this->localCd->id,
            'local_destino_id' => $this->localLojaA->id,
            'itens'            => [],
            'created_at'       => now()->subDays(5),
        ]);
        PedidoItem::create([
            'pedido_id'   => $pedCanc->id,
            'tipo'        => 'peca',
            'peca_id'     => $pecaCancelada->id,
            'quantidade'  => 20,
            'created_at'  => now()->subDays(5),
        ]);

        $response = $this->actingAs($this->lojaUser)->get(route('pecas.solicitar'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Pecas/Solicitar')
            ->where('recorrentes', [])
        );
    }

    public function test_loja_nao_enxerga_itens_recorrentes_de_outra_loja()
    {
        $pecaLojaB = Peca::create([
            'codigo'           => 'REC-LOJA-B-' . uniqid(),
            'descricao'        => 'Peça Exclusiva Loja B',
            'unidade'          => 'UN',
            'tipo_item'        => 'universal',
            'preco_referencia' => 50.00,
            'ativo'            => true,
        ]);

        $pedB = Pedido::create([
            'user_id'          => $this->lojaUserB->id,
            'tipo_carga'       => 'peca',
            'status'           => 'concluido',
            'local_origem_id'  => $this->localCd->id,
            'local_destino_id' => $this->localLojaB->id,
            'itens'            => [],
            'created_at'       => now()->subDays(15),
        ]);
        PedidoItem::create([
            'pedido_id'   => $pedB->id,
            'tipo'        => 'peca',
            'peca_id'     => $pecaLojaB->id,
            'quantidade'  => 10,
            'created_at'  => now()->subDays(15),
        ]);

        // Loja A não pode ver o item da Loja B
        $response = $this->actingAs($this->lojaUser)->get(route('pecas.solicitar'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Pecas/Solicitar')
            ->where('recorrentes', [])
        );

        // Mas a Loja B enxerga o item
        $responseB = $this->actingAs($this->lojaUserB)->get(route('pecas.solicitar'));
        $responseB->assertOk();
        $responseB->assertInertia(fn (Assert $page) => $page
            ->component('Pecas/Solicitar')
            ->has('recorrentes', 1)
            ->where('recorrentes.0.id', $pecaLojaB->id)
        );
    }

    public function test_admin_pode_filtrar_itens_recorrentes_por_filial()
    {
        $pecaLojaA = Peca::create([
            'codigo'           => 'REC-ADM-A-' . uniqid(),
            'descricao'        => 'Vela de Ignição A',
            'unidade'          => 'UN',
            'tipo_item'        => 'universal',
            'preco_referencia' => 15.00,
            'ativo'            => true,
        ]);

        $pedA = Pedido::create([
            'user_id'          => $this->lojaUser->id,
            'tipo_carga'       => 'peca',
            'status'           => 'concluido',
            'local_origem_id'  => $this->localCd->id,
            'local_destino_id' => $this->localLojaA->id,
            'itens'            => [],
            'created_at'       => now()->subDays(10),
        ]);
        PedidoItem::create([
            'pedido_id'   => $pedA->id,
            'tipo'        => 'peca',
            'peca_id'     => $pecaLojaA->id,
            'quantidade'  => 7,
            'created_at'  => now()->subDays(10),
        ]);

        // Admin acessando para a filial A
        $response = $this->actingAs($this->admin)->get(route('pecas.solicitar', ['local_id' => $this->localLojaA->id]));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Pecas/Solicitar')
            ->has('recorrentes', 1)
            ->where('recorrentes.0.id', $pecaLojaA->id)
            ->where('filtros.local_id', (string) $this->localLojaA->id)
        );
    }
}
