<?php

namespace Tests\Feature;

use App\Models\EstoqueLocal;
use App\Models\Pedido;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * A tela do pedido só abre para quem participa dele.
 *
 * Antes da v3.4 o índice filtrava a loja, mas `show` não perguntava nada:
 * trocar o número na URL abria o pedido de outra filial. Os testes fixam os
 * dois lados — quem é de fora não entra, e quem chega por um caminho legítimo
 * (origem da transferência, validador, filial de destino da peça) continua
 * entrando.
 */
class PedidoVisibilidadeTest extends TestCase
{
    use DatabaseTransactions;

    private User $lojaDona;
    private User $lojaOrigem;
    private User $lojaIntrusa;
    private Pedido $transferencia;

    protected function setUp(): void
    {
        parent::setUp();

        $this->lojaDona    = $this->loja('Loja Dona');
        $this->lojaOrigem  = $this->loja('Loja Origem');
        $this->lojaIntrusa = $this->loja('Loja Intrusa');

        $this->transferencia = Pedido::create([
            'user_id'        => $this->lojaDona->id,
            'origem_user_id' => $this->lojaOrigem->id,
            'status'         => 'solicitado',
        ]);
    }

    public function test_loja_de_fora_nao_abre_pedido_de_outra_filial()
    {
        $this->actingAs($this->lojaIntrusa)
            ->get(route('pedidos.show', $this->transferencia->id))
            ->assertForbidden();
    }

    public function test_solicitante_e_loja_de_origem_abrem_o_pedido()
    {
        $this->actingAs($this->lojaDona)
            ->get(route('pedidos.show', $this->transferencia->id))
            ->assertOk();

        $this->actingAs($this->lojaOrigem)
            ->get(route('pedidos.show', $this->transferencia->id))
            ->assertOk();
    }

    public function test_cd_gestor_e_admin_abrem_qualquer_pedido()
    {
        foreach (['cd', 'gestor', 'admin'] as $perfil) {
            $usuario = User::factory()->create([
                'email'  => "visib_{$perfil}_" . uniqid() . '@shineray.com.br',
                'perfil' => $perfil,
            ]);

            $this->actingAs($usuario)
                ->get(route('pedidos.show', $this->transferencia->id))
                ->assertOk();
        }
    }

    /**
     * O validador de motos chega ao pedido pelo histórico do gestor e pelas
     * notificações — mas a atribuição dele não abre pedido de peça.
     */
    public function test_loja_validadora_de_motos_abre_pedido_de_moto_mas_nao_o_de_peca()
    {
        $validadora = $this->loja('Loja Validadora', ['valida_motos' => true]);

        $pedidoPeca = Pedido::create([
            'user_id'    => $this->lojaDona->id,
            'tipo_carga' => 'peca',
            'status'     => 'solicitado',
        ]);

        $this->actingAs($validadora)
            ->get(route('pedidos.show', $this->transferencia->id))
            ->assertOk();

        $this->actingAs($validadora)
            ->get(route('pedidos.show', $pedidoPeca->id))
            ->assertForbidden();
    }

    /** Pedido de peça aberto pelo admin em nome da filial: ela é destino pelo local de estoque. */
    public function test_filial_de_destino_pelo_local_de_estoque_abre_pedido_de_peca()
    {
        $local = EstoqueLocal::create([
            'nome'            => 'Loja Destino Peça',
            'slug'            => 'loja-destino-peca-' . uniqid(),
            'tipo'            => EstoqueLocal::TIPO_LOJA,
            'participa_pecas' => true,
            'ativo'           => true,
        ]);

        $admin = User::factory()->create([
            'email'  => 'visib_admin_peca_' . uniqid() . '@shineray.com.br',
            'perfil' => 'admin',
        ]);

        $filial = $this->loja('Loja Destino Peça', ['estoque_local_id' => $local->id]);

        $pedido = Pedido::create([
            'user_id'          => $admin->id,
            'tipo_carga'       => 'peca',
            'status'           => 'solicitado',
            'local_destino_id' => $local->id,
        ]);

        $this->actingAs($filial)
            ->get(route('pedidos.show', $pedido->id))
            ->assertOk();

        $this->actingAs($this->lojaIntrusa)
            ->get(route('pedidos.show', $pedido->id))
            ->assertForbidden();
    }

    private function loja(string $filial, array $extra = []): User
    {
        return User::factory()->create([
            'email'  => 'visib_' . uniqid() . '@shineray.com.br',
            'perfil' => 'loja',
            'filial' => $filial,
            ...$extra,
        ]);
    }
}
