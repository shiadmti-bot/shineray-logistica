<?php

namespace Tests\Feature\Motos;

use App\Models\Moto;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

class CensoPatioTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    private User $loja1;
    private User $loja2;
    private User $admin;
    private Moto $motoLoja1;
    private Moto $motoLoja2;
    private Moto $motoCd;

    protected function setUp(): void
    {
        parent::setUp();

        $this->loja1 = $this->usuario('loja', ['filial' => 'Loja Belem/PA']);
        $this->loja2 = $this->usuario('loja', ['filial' => 'Loja Castanhal/PA']);
        $this->admin = $this->usuario('admin', ['filial' => 'Matriz']);

        $this->motoLoja1 = $this->moto('estoque_loja', ['loja_atual_id' => $this->loja1->id]);
        $this->motoLoja2 = $this->moto('estoque_loja', ['loja_atual_id' => $this->loja2->id]);
        $this->motoCd    = $this->moto('estoque_fabrica', ['loja_atual_id' => null]);
    }

    public function test_loja_acessa_censo_do_proprio_patio_sem_poder_trocar(): void
    {
        $this->actingAs($this->loja1)
            ->get(route('motos.censo'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Motos/Censo')
                ->where('localAtual.id', $this->loja1->id)
                ->where('localAtual.tipo', 'loja')
                ->where('podeTrocarUnidade', false)
            );
    }

    public function test_admin_acessa_censo_cd_matriz_por_padrao_e_pode_trocar(): void
    {
        $this->actingAs($this->admin)
            ->get(route('motos.censo'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Motos/Censo')
                ->where('localAtual.tipo', 'cd')
                ->where('podeTrocarUnidade', true)
                ->has('lojas')
                ->has('catalogoGeral')
            );
    }

    public function test_admin_pode_selecionar_loja_especifica(): void
    {
        $this->actingAs($this->admin)
            ->get(route('motos.censo', ['loja_id' => $this->loja2->id]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Motos/Censo')
                ->where('localAtual.id', $this->loja2->id)
                ->where('localAtual.tipo', 'loja')
            );
    }

    public function test_catalogo_geral_contem_chassis_para_deteccao_de_intrusas(): void
    {
        $this->actingAs($this->loja1)
            ->get(route('motos.censo'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Motos/Censo')
                ->has('catalogoGeral')
            );
    }

    public function test_usuario_nao_autenticado_e_redirecionado(): void
    {
        $this->get(route('motos.censo'))
            ->assertRedirect(route('login'));
    }
}
