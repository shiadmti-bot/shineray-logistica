<?php

namespace Tests\Unit\Enums;

use App\Enums\Perfil;
use PHPUnit\Framework\TestCase;

/**
 * Os quatro perfis são a base de toda autorização do sistema (rotas,
 * policies, escopos). Um valor a mais ou a menos aqui muda quem acessa o quê.
 */
class PerfilTest extends TestCase
{
    public function test_existem_exatamente_os_quatro_perfis_do_banco(): void
    {
        // users.perfil é ENUM('admin','cd','loja','gestor') no banco.
        $this->assertEqualsCanonicalizing(['admin', 'gestor', 'cd', 'loja'], Perfil::valores());
    }

    public function test_operacao_central_e_admin_gestor_e_cd_mas_nao_loja(): void
    {
        $central = Perfil::operacaoCentral();

        $this->assertContains(Perfil::Admin, $central);
        $this->assertContains(Perfil::Gestor, $central);
        $this->assertContains(Perfil::Cd, $central);
        $this->assertNotContains(Perfil::Loja, $central);
    }

    public function test_perfil_desconhecido_nao_vira_perfil_valido(): void
    {
        $this->assertNull(Perfil::tryFrom('motorista'));
        $this->assertNull(Perfil::tryFrom(''));
        $this->assertNull(Perfil::tryFrom('ADMIN'), 'A comparação é exata: maiúscula não é o mesmo perfil.');
    }
}
