<?php

namespace Tests\Feature;

use App\Enums\StatusPedido;
use App\Models\Moto;
use App\Models\Pedido;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * StatusPedido é a fonte das listas de status que viviam copiadas — e
 * divergentes — pelo código.
 */
class StatusPedidoTest extends TestCase
{
    use DatabaseTransactions;

    /** Status sem entrada no STATUS_MAP aparece como badge cinza com o nome cru. */
    public function test_todo_status_de_pedido_existe_no_dicionario_do_front()
    {
        $statusMap = file_get_contents(resource_path('js/Components/UI/statusMap.js'));
        preg_match_all('/^\s*([a-z_]+):\s*\{\s*label:/m', $statusMap, $chaves);

        $faltando = array_values(array_diff(array_column(StatusPedido::cases(), 'value'), $chaves[1]));

        $this->assertSame([], $faltando, 'Status sem rótulo em statusMap.js: ' . implode(', ', $faltando));
    }

    public function test_em_andamento_segue_a_ordem_do_fluxo_e_exclui_os_encerrados()
    {
        $ativos = StatusPedido::emAndamento();

        $this->assertSame('em_analise', $ativos[0]);
        $this->assertSame('no_cd', end($ativos));

        foreach (['concluido', 'cancelado', 'rejeitado'] as $encerrado) {
            $this->assertNotContains($encerrado, $ativos);
        }
    }

    /** A lista antiga de "processo ativo" esquecia em_analise, rota_confirmada e coletado. */
    public function test_moto_presa_em_pedido_vivo_nao_aparece_livre_para_transferencia()
    {
        $origem      = $this->loja('Loja Origem Status');
        $solicitante = $this->loja('Loja Solicitante Status');

        $livre = $this->motoDa($origem);

        $presas = [];
        foreach (['em_analise', 'rota_confirmada', 'coletado'] as $status) {
            $moto = $this->motoDa($origem);
            $this->pedidoCom($moto, $solicitante, $origem, $status);
            $presas[] = $moto->id;
        }

        $jaEntregue = $this->motoDa($origem);
        $this->pedidoCom($jaEntregue, $solicitante, $origem, 'concluido');

        $ids = collect(
            $this->actingAs($solicitante)
                ->getJson(route('api.estoque.loja', ['loja_id' => $origem->id]))
                ->assertOk()
                ->json()
        )->pluck('id');

        $this->assertContains($livre->id, $ids);
        $this->assertContains($jaEntregue->id, $ids);

        foreach ($presas as $id) {
            $this->assertNotContains($id, $ids);
        }
    }

    private function loja(string $filial): User
    {
        return User::factory()->create([
            'email'  => 'status_' . uniqid() . '@shineray.com.br',
            'perfil' => 'loja',
            'filial' => $filial,
        ]);
    }

    private function motoDa(User $loja): Moto
    {
        return Moto::create([
            'chassi'        => '9C2STAT' . random_int(1000000, 9999999),
            'modelo'        => 'NEW JEF 125',
            'cor'           => 'PRETA',
            'status'        => 'estoque_loja',
            'loja_atual_id' => $loja->id,
        ]);
    }

    private function pedidoCom(Moto $moto, User $solicitante, User $origem, string $status): void
    {
        Pedido::create([
            'user_id'        => $solicitante->id,
            'origem_user_id' => $origem->id,
            'status'         => $status,
        ])->motos()->attach($moto->id, ['destino' => $solicitante->filial]);
    }
}
