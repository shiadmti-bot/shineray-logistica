<?php

namespace Tests\Unit\Policies;

use App\Models\Basqueta;
use App\Models\User;
use App\Policies\BasquetaPolicy;
use Tests\TestCase;

/**
 * A basqueta é do CD até a filial conferir (Gate 2). Quem assina essa
 * conferência é quem RECEBE — não os validadores do Gate 1.
 */
class BasquetaPolicyTest extends TestCase
{
    private BasquetaPolicy $policy;
    private Basqueta $basqueta;

    protected function setUp(): void
    {
        parent::setUp();

        $this->policy = new BasquetaPolicy();
        $this->basqueta = (new Basqueta())->forceFill(['id' => 1, 'estoque_local_id' => 7]);
    }

    public function test_so_a_operacao_central_acompanha_as_basquetas(): void
    {
        foreach (['admin', 'gestor', 'cd'] as $perfil) {
            $this->assertTrue($this->policy->acompanhar($this->user($perfil))->allowed(), $perfil);
        }

        $this->assertTrue($this->policy->acompanhar($this->user('loja', 7))->denied());
    }

    public function test_filial_ve_o_romaneio_so_da_propria_basqueta(): void
    {
        $this->assertTrue($this->policy->view($this->user('loja', 7), $this->basqueta)->allowed());
        $this->assertTrue($this->policy->view($this->user('loja', 8), $this->basqueta)->denied());
    }

    public function test_quem_confere_e_a_filial_de_destino_ou_o_cd(): void
    {
        $this->assertTrue($this->policy->conferir($this->user('loja', 7), $this->basqueta)->allowed());
        $this->assertTrue($this->policy->conferir($this->user('cd'), $this->basqueta)->allowed());
        $this->assertTrue($this->policy->conferir($this->user('admin'), $this->basqueta)->allowed());

        $this->assertTrue($this->policy->conferir($this->user('loja', 8), $this->basqueta)->denied(), 'outra filial');
        $this->assertTrue($this->policy->conferir($this->user('gestor'), $this->basqueta)->denied(), 'gestor audita, não confere');
        $this->assertTrue(
            $this->policy->conferir($this->user('loja', null, ['valida_pecas' => true]), $this->basqueta)->denied(),
            'Validador do Gate 1 não assina o Gate 2 de outra filial.'
        );
    }

    private function user(string $perfil, ?int $localId = null, array $atributos = []): User
    {
        return (new User())->forceFill([
            'id' => random_int(1, 1_000_000),
            'perfil' => $perfil,
            'estoque_local_id' => $localId,
            ...$atributos,
        ]);
    }
}
