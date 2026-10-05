<?php

namespace Tests\Unit\Models;

use App\Enums\Perfil;
use App\Models\User;
use Tests\TestCase;

/**
 * As perguntas de permissão do usuário — sem banco, só regra.
 *
 * Perfil diz "que parte do sistema você opera"; as atribuições valida_motos e
 * valida_pecas dizem "o que você assina". São ortogonais de propósito, e o
 * admin herda as duas para que a fila nunca fique sem quem destrave.
 */
class UserPermissoesTest extends TestCase
{
    public function test_tem_perfil_aceita_varios_e_compara_pelo_enum(): void
    {
        $cd = $this->user('cd');

        $this->assertTrue($cd->temPerfil(Perfil::Cd));
        $this->assertTrue($cd->temPerfil(Perfil::Admin, Perfil::Cd));
        $this->assertFalse($cd->temPerfil(Perfil::Admin, Perfil::Gestor));
    }

    public function test_perfil_fora_do_enum_nunca_passa(): void
    {
        $estranho = $this->user('motorista');

        foreach (Perfil::cases() as $perfil) {
            $this->assertFalse($estranho->temPerfil($perfil));
        }
        $this->assertFalse($estranho->isOperacaoCentral());
    }

    public function test_operacao_central(): void
    {
        $this->assertTrue($this->user('admin')->isOperacaoCentral());
        $this->assertTrue($this->user('gestor')->isOperacaoCentral());
        $this->assertTrue($this->user('cd')->isOperacaoCentral());
        $this->assertFalse($this->user('loja')->isOperacaoCentral());
    }

    public function test_quem_valida_motos(): void
    {
        $this->assertTrue($this->user('admin')->podeValidarMotos(), 'Admin herda a atribuição.');
        $this->assertFalse($this->user('gestor')->podeValidarMotos(), 'Perfil gestor sozinho não assina.');
        $this->assertTrue($this->user('gestor', ['valida_motos' => true])->podeValidarMotos());
        $this->assertTrue($this->user('loja', ['valida_motos' => true])->podeValidarMotos());
        $this->assertFalse($this->user('cd')->podeValidarMotos());
    }

    public function test_quem_valida_pecas(): void
    {
        $this->assertTrue($this->user('admin')->podeValidarPecas());
        $this->assertFalse($this->user('cd')->podeValidarPecas());
        $this->assertTrue($this->user('cd', ['valida_pecas' => true])->podeValidarPecas());
        $this->assertTrue($this->user('loja', ['valida_pecas' => true])->podeValidarPecas());
    }

    public function test_atribuicoes_sao_independentes(): void
    {
        $soMotos = $this->user('gestor', ['valida_motos' => true]);
        $soPecas = $this->user('loja', ['valida_pecas' => true]);

        $this->assertFalse($soMotos->podeValidarPecas());
        $this->assertFalse($soPecas->podeValidarMotos());
    }

    public function test_senha_e_token_nunca_serializam(): void
    {
        $user = $this->user('loja', ['password' => 'segredo-123', 'remember_token' => 'abc']);

        $serializado = $user->toArray();

        $this->assertArrayNotHasKey('password', $serializado);
        $this->assertArrayNotHasKey('remember_token', $serializado);
    }

    private function user(string $perfil, array $atributos = []): User
    {
        return (new User())->forceFill(['id' => random_int(1, 1_000_000), 'perfil' => $perfil, ...$atributos]);
    }
}
