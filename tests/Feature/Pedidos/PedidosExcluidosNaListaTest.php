<?php

namespace Tests\Feature\Pedidos;

use App\Models\Pedido;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * Pedido excluído na lista: só o recusado.
 *
 * A v3.6 passou a listar pedidos excluídos para a loja achar o recusado e
 * ler o motivo. Mas a v2.6 excluía pedido sem trocar o status (rejeição do
 * gestor, corte total, cancelamento pela loja), e esses voltaram ao topo da
 * lista como "Em Análise", vazios. Ver Pedido::comRecusados.
 */
class PedidosExcluidosNaListaTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    private User $loja;
    private Pedido $ativo;
    private Pedido $recusado;
    private Pedido $excluidoNaV26;

    protected function setUp(): void
    {
        parent::setUp();

        $this->loja = $this->usuario('loja', ['filial' => 'Loja Lista/PA']);

        $this->ativo = $this->pedidoMoto($this->loja, 'solicitado');

        // Recusa da v3: status de recusa + soft delete (CancelarPedido).
        $this->recusado = $this->pedidoMoto($this->loja, 'rejeitado', null, ['motivo_rejeicao' => 'Sem giro']);
        $this->recusado->delete();

        // O que a v2.6 deixava: excluído com o status de quando estava ativo.
        $this->excluidoNaV26 = $this->pedidoMoto($this->loja, 'em_analise');
        $this->excluidoNaV26->delete();
    }

    public function test_lista_mostra_o_recusado_e_esconde_o_excluido_sem_status_de_recusa(): void
    {
        $this->actingAs($this->loja)
            ->get(route('pedidos.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('pedidos.data', fn ($pedidos) => collect($pedidos)->pluck('id')->sort()->values()->all()
                    === collect([$this->ativo->id, $this->recusado->id])->sort()->values()->all())
                ->where('tipoCounts.all', 2)
            );
    }

    public function test_historico_da_loja_no_inicio_conta_o_mesmo_que_a_lista(): void
    {
        $this->actingAs($this->loja)
            ->get(route('dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page->where('stats.meus_pedidos', 2));
    }

    /** Pelo link direto, o excluído antigo continua abrindo para consulta. */
    public function test_excluido_sem_status_de_recusa_ainda_abre_pelo_link(): void
    {
        $this->actingAs($this->loja)
            ->get(route('pedidos.show', $this->excluidoNaV26->id))
            ->assertOk();
    }
}
