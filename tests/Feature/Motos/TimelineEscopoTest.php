<?php

namespace Tests\Feature\Motos;

use App\Models\Moto;
use App\Models\PedidoLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * A linha do tempo do chassi segue o mesmo escopo do estoque de motos.
 *
 * Antes a busca aceitava qualquer pedaço de chassi de qualquer loja e
 * devolvia os logs dos pedidos de outras filiais, com motivos e fotos de
 * avaria — o que PedidoPolicy nega na tela do pedido.
 */
class TimelineEscopoTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    private User $dona;
    private User $deFora;
    private Moto $moto;

    protected function setUp(): void
    {
        parent::setUp();

        $this->dona   = $this->usuario('loja', ['filial' => 'Loja Dona/PA']);
        $this->deFora = $this->usuario('loja', ['filial' => 'Loja Curiosa/PA']);

        [$pedido, $this->moto] = $this->pedidoComMoto($this->dona, 'concluido', 'estoque_loja');
        $this->moto->update(['loja_atual_id' => $this->dona->id]);

        PedidoLog::create([
            'pedido_id' => $pedido->id,
            'titulo'    => 'Concluído',
            'descricao' => 'Recebida com avaria no farol — negociação interna.',
        ]);
    }

    public function test_loja_le_a_linha_do_tempo_da_propria_moto(): void
    {
        $this->actingAs($this->dona)
            ->get(route('motos.timeline', ['chassi' => $this->moto->chassi]))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Motos/Timeline')
                ->where('moto.chassi', $this->moto->chassi)
                ->has('timeline', 2) // o log do pedido + a entrada no sistema
            );
    }

    public function test_loja_de_fora_nao_le_a_linha_do_tempo_alheia(): void
    {
        $this->actingAs($this->deFora)
            ->get(route('motos.timeline', ['chassi' => $this->moto->chassi]))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('moto', null)
                ->where('timeline', [])
            );
    }

    public function test_pedaco_do_chassi_nao_vaza_moto_de_outra_loja(): void
    {
        $this->actingAs($this->deFora)
            ->get(route('motos.timeline', ['chassi' => substr($this->moto->chassi, -6)]))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('moto', null));
    }

    public function test_operacao_central_le_qualquer_linha_do_tempo(): void
    {
        foreach (['cd', 'gestor', 'admin'] as $perfil) {
            $this->actingAs($this->usuario($perfil))
                ->get(route('motos.timeline', ['chassi' => $this->moto->chassi]))
                ->assertInertia(fn (AssertableInertia $page) => $page->where('moto.chassi', $this->moto->chassi));
        }
    }

    public function test_a_tela_recebe_so_os_dados_da_moto(): void
    {
        $resposta = $this->actingAs($this->usuario('cd'))
            ->get(route('motos.timeline', ['chassi' => $this->moto->chassi]));

        $moto = $resposta->viewData('page')['props']['moto'];

        $this->assertEqualsCanonicalizing(
            ['id', 'chassi', 'modelo', 'cor', 'status', 'localizacao_atual'],
            array_keys($moto)
        );
        $resposta->assertDontSee($this->dona->email);
    }
}
