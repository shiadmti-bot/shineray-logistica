<?php

namespace Tests\Unit\Policies;

use App\Models\Devolucao;
use App\Models\User;
use App\Policies\DevolucaoPolicy;
use App\Services\Devolucao\ChecklistMoto;
use Tests\TestCase;

/**
 * Os três portões da devolução, do lado do QUEM.
 *
 * O valor do dossiê vem de as duas conferências serem feitas por lados
 * opostos da entrega: a loja não assina a chegada, o CD não assina a saída.
 */
class DevolucaoPolicyTest extends TestCase
{
    private DevolucaoPolicy $policy;
    private Devolucao $devolucao;

    protected function setUp(): void
    {
        parent::setUp();

        $this->policy = new DevolucaoPolicy();
        $this->devolucao = (new Devolucao())->forceFill(['id' => 1, 'user_id' => 10]);
    }

    public function test_quem_ve_a_devolucao(): void
    {
        foreach (['admin', 'gestor', 'cd'] as $perfil) {
            $this->assertTrue($this->policy->view($this->user($perfil, 99), $this->devolucao)->allowed(), $perfil);
        }

        $this->assertTrue($this->policy->view($this->user('loja', 10), $this->devolucao)->allowed(), 'a loja que abriu');
        $this->assertTrue($this->policy->view($this->user('loja', 11), $this->devolucao)->denied(), 'outra loja');
    }

    public function test_so_a_loja_que_abriu_altera_envia_e_cancela(): void
    {
        $this->assertTrue($this->policy->editar($this->user('loja', 10), $this->devolucao)->allowed());
        $this->assertTrue($this->policy->editar($this->user('admin', 1), $this->devolucao)->allowed(), 'admin por herança');

        // Gestor decide e CD recebe, mas nenhum dos dois edita o documento da loja.
        $this->assertTrue($this->policy->editar($this->user('gestor', 2), $this->devolucao)->denied());
        $this->assertTrue($this->policy->editar($this->user('cd', 3), $this->devolucao)->denied());
        $this->assertTrue($this->policy->editar($this->user('loja', 11), $this->devolucao)->denied());
    }

    public function test_checklist_de_destino_e_do_cd(): void
    {
        $destino = ChecklistMoto::ETAPA_DESTINO;

        $this->assertTrue($this->policy->conferirEtapa($this->user('cd', 3), $this->devolucao, $destino)->allowed());
        $this->assertTrue($this->policy->conferirEtapa($this->user('admin', 1), $this->devolucao, $destino)->allowed());
        $this->assertTrue(
            $this->policy->conferirEtapa($this->user('loja', 10), $this->devolucao, $destino)->denied(),
            'A loja que devolve não assina a chegada da própria moto.'
        );
    }

    public function test_checklist_de_origem_e_da_loja(): void
    {
        $origem = ChecklistMoto::ETAPA_ORIGEM;

        $this->assertTrue($this->policy->conferirEtapa($this->user('loja', 10), $this->devolucao, $origem)->allowed());
        $this->assertTrue(
            $this->policy->conferirEtapa($this->user('cd', 3), $this->devolucao, $origem)->denied(),
            'O CD não preenche a conferência de saída da loja.'
        );
    }

    private function user(string $perfil, int $id): User
    {
        return (new User())->forceFill(['id' => $id, 'perfil' => $perfil]);
    }
}
