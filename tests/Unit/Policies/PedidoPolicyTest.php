<?php

namespace Tests\Unit\Policies;

use App\Models\Pedido;
use App\Models\User;
use App\Policies\PedidoPolicy;
use Tests\TestCase;

/**
 * Quem enxerga e quem aprova um pedido — a régua que fecha o "trocar o número
 * na URL" (v3.4). Testada aqui sem banco; o caminho HTTP está em
 * Tests\Feature\PedidoVisibilidadeTest.
 */
class PedidoPolicyTest extends TestCase
{
    private PedidoPolicy $policy;

    protected function setUp(): void
    {
        parent::setUp();

        $this->policy = new PedidoPolicy();
    }

    public function test_operacao_central_ve_qualquer_pedido(): void
    {
        $pedido = $this->pedido(['user_id' => 900, 'origem_user_id' => 901]);

        foreach (['admin', 'gestor', 'cd'] as $perfil) {
            $this->assertTrue($this->policy->view($this->user($perfil, 1), $pedido)->allowed(), $perfil);
        }
    }

    public function test_loja_ve_o_que_pediu_e_o_que_sai_dela(): void
    {
        $pedido = $this->pedido(['user_id' => 10, 'origem_user_id' => 20]);

        $this->assertTrue($this->policy->view($this->user('loja', 10), $pedido)->allowed(), 'solicitante');
        $this->assertTrue($this->policy->view($this->user('loja', 20), $pedido)->allowed(), 'origem');
        $this->assertTrue($this->policy->view($this->user('loja', 30), $pedido)->denied(), 'loja de fora');
    }

    public function test_loja_ve_pedido_de_peca_pelo_local_de_estoque(): void
    {
        $pedido = $this->pedido([
            'user_id' => 900, 'tipo_carga' => 'peca', 'local_destino_id' => 7, 'local_origem_id' => 1,
        ]);

        $this->assertTrue($this->policy->view($this->user('loja', 50, ['estoque_local_id' => 7]), $pedido)->allowed());
        $this->assertTrue($this->policy->view($this->user('loja', 51, ['estoque_local_id' => 8]), $pedido)->denied());
    }

    public function test_loja_sem_local_nao_casa_com_pedido_sem_local(): void
    {
        // null de um lado e null do outro não podem virar "é da sua loja".
        $pedido = $this->pedido(['user_id' => 900, 'tipo_carga' => 'moto']);

        $this->assertTrue($this->policy->view($this->user('loja', 52), $pedido)->denied());
    }

    public function test_validador_ve_so_o_tipo_que_assina(): void
    {
        $moto = $this->pedido(['user_id' => 900, 'tipo_carga' => 'moto']);
        $peca = $this->pedido(['user_id' => 900, 'tipo_carga' => 'peca', 'local_destino_id' => 99]);

        $validaMotos = $this->user('loja', 60, ['valida_motos' => true]);
        $validaPecas = $this->user('loja', 61, ['valida_pecas' => true]);

        $this->assertTrue($this->policy->view($validaMotos, $moto)->allowed());
        $this->assertTrue($this->policy->view($validaMotos, $peca)->denied());
        $this->assertTrue($this->policy->view($validaPecas, $peca)->allowed());
        $this->assertTrue($this->policy->view($validaPecas, $moto)->denied());
    }

    public function test_aprovar_e_de_quem_valida_motos_nao_do_perfil(): void
    {
        $pedido = $this->pedido(['user_id' => 900]);

        $this->assertTrue($this->policy->aprovar($this->user('admin', 1), $pedido)->allowed());
        $this->assertTrue($this->policy->aprovar($this->user('gestor', 2, ['valida_motos' => true]), $pedido)->allowed());
        $this->assertTrue($this->policy->aprovar($this->user('gestor', 3), $pedido)->denied(), 'gestor sem a atribuição');
        $this->assertTrue($this->policy->aprovar($this->user('cd', 4), $pedido)->denied());
        $this->assertTrue($this->policy->aprovar($this->user('loja', 5), $pedido)->denied());
    }

    private function user(string $perfil, int $id, array $atributos = []): User
    {
        return (new User())->forceFill(['id' => $id, 'perfil' => $perfil, ...$atributos]);
    }

    private function pedido(array $atributos): Pedido
    {
        return (new Pedido())->forceFill(['tipo_carga' => 'moto', ...$atributos]);
    }
}
