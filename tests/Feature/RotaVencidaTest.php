<?php

namespace Tests\Feature;

use App\Models\Moto;
use App\Models\Pedido;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Rota confirmada que venceu sem o caminhão sair (v3.5).
 */
class RotaVencidaTest extends TestCase
{
    use DatabaseTransactions;

    /** A listagem gravava no banco a cada GET; agora só lê. */
    public function test_listar_pedidos_nao_altera_status_de_ninguem()
    {
        $loja = $this->loja();
        $vencido = $this->pedidoComRota($loja, now()->subDays(2));

        $this->actingAs($loja)->get(route('pedidos.index'))->assertOk();

        $this->assertSame('rota_confirmada', $vencido->fresh()->status);
    }

    public function test_comando_devolve_reposicao_vencida_para_separado_e_poupa_rota_futura()
    {
        $loja = $this->loja();
        $vencido = $this->pedidoComRota($loja, now()->subDays(2));
        $futuro = $this->pedidoComRota($loja, now()->addDays(3));

        $moto = Moto::create([
            'chassi' => '9C2ROTA' . random_int(1000000, 9999999),
            'modelo' => 'JET 50',
            'cor'    => 'PRETA',
            'status' => 'rota_confirmada',
        ]);
        $vencido->motos()->attach($moto->id, ['destino' => 'Loja Rota']);

        $this->artisan('pedidos:regredir-rotas')->assertSuccessful();

        $vencido->refresh();
        $this->assertSame('separado', $vencido->status);
        $this->assertNull($vencido->previsao_entrega);
        $this->assertSame('separado', $moto->fresh()->status);
        $this->assertTrue($vencido->logs()->where('titulo', 'Rota Vencida 🕰️')->exists());

        $this->assertSame('rota_confirmada', $futuro->fresh()->status);
    }

    private function loja(): User
    {
        return User::factory()->create([
            'email'  => 'rota_' . uniqid() . '@shineray.com.br',
            'perfil' => 'loja',
            'filial' => 'Loja Rota',
        ]);
    }

    private function pedidoComRota(User $loja, $data): Pedido
    {
        return Pedido::create([
            'user_id'          => $loja->id,
            'status'           => 'rota_confirmada',
            'previsao_entrega' => $data->toDateString(),
        ]);
    }
}
