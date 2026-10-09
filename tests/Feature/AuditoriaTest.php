<?php

namespace Tests\Feature;

use App\Models\Pedido;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * A trilha de alterações (activity_log) na tela do admin.
 *
 * Quem pode abrir está na MatrizDeAcessoTest; aqui fica o que a tela recebe.
 */
class AuditoriaTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    public function test_admin_ve_a_alteracao_com_o_tipo_do_registro_e_quem_fez(): void
    {
        $admin = $this->usuario('admin', ['name' => 'Admin Auditor']);
        $this->actingAs($admin);

        // `itens` é uma lista: é o campo que derrubava a tela no front.
        $pedido = Pedido::create([
            'user_id' => $this->usuario('loja')->id,
            'status'  => 'em_analise',
            'itens'   => [['modelo' => 'JET 50', 'cor' => 'PRETA', 'quantidade' => 2]],
        ]);

        $this->get(route('auditoria.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Auditoria')
                ->where('logs.data.0.subject', 'Pedido')
                ->where('logs.data.0.subject_id', $pedido->id)
                ->where('logs.data.0.event', 'created')
                ->where('logs.data.0.causer', ['name' => 'Admin Auditor'])
                ->where('logs.data.0.properties.attributes.itens.0.modelo', 'JET 50')
            );
    }
}
