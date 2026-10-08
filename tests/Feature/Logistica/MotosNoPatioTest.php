<?php

namespace Tests\Feature\Logistica;

use App\Actions\Pedidos\RegredirRotasVencidas;
use App\Models\Romaneio;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * Mudança de status em massa só alcança moto que ainda está no pátio.
 *
 * Num embarque parcial o pedido segue em 'separado' ou 'rota_confirmada' com
 * parte das motos já na estrada. Separar, confirmar/rebaixar rota e a rota
 * vencida faziam `motos()->update(...)` no pedido inteiro, e a moto do
 * caminhão voltava a um status de pátio — reaparecendo na mesa de montagem.
 */
class MotosNoPatioTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    private User $cd;
    private User $loja;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();

        $this->cd   = $this->usuario('cd', ['filial' => 'CD Matriz']);
        $this->loja = $this->usuario('loja', ['filial' => 'Loja Patio/PA']);
    }

    public function test_rota_vencida_nao_devolve_ao_patio_a_moto_que_esta_na_estrada(): void
    {
        $pedido = $this->pedidoMoto($this->loja, 'rota_confirmada', null, [
            'previsao_entrega' => now()->subDays(2)->toDateString(),
        ]);
        $naEstrada = $this->vincular($pedido, $this->moto('transito_loja'));
        $noPatio = $this->vincular($pedido, $this->moto('rota_confirmada'));

        app(RegredirRotasVencidas::class)->executar();

        $this->assertSame('separado', $pedido->fresh()->status);
        $this->assertSame('separado', $noPatio->fresh()->status);
        $this->assertSame('transito_loja', $naEstrada->fresh()->status, 'A moto do caminhão não volta a "separado".');
    }

    public function test_confirmar_rota_no_calendario_nao_mexe_na_moto_que_ja_saiu(): void
    {
        $pedido = $this->pedidoMoto($this->loja, 'separado');
        $expedida = $this->vincular($pedido, $this->moto('expedido'));
        $noPatio = $this->vincular($pedido, $this->moto('separado'));

        $this->actingAs($this->cd)
            ->post(route('calendar.store'), [
                'date'   => now()->addDays(2)->toDateString(),
                'status' => 'confirmed',
                'stops'  => [$this->loja->id],
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame('rota_confirmada', $pedido->fresh()->status);
        $this->assertSame('rota_confirmada', $noPatio->fresh()->status);
        $this->assertSame('expedido', $expedida->fresh()->status);
    }

    public function test_separar_nao_mexe_na_moto_que_ja_saiu(): void
    {
        $pedido = $this->pedidoMoto($this->loja, 'solicitado');
        $naEstrada = $this->vincular($pedido, $this->moto('transito_loja'));
        $noPatio = $this->vincular($pedido, $this->moto('estoque_fabrica'));

        $this->actingAs($this->cd)
            ->post(route('pedidos.separar', $pedido->id))
            ->assertSessionHasNoErrors();

        $this->assertSame('separado', $noPatio->fresh()->status, 'Moto do pátio do CD continua sendo separada.');
        $this->assertSame('transito_loja', $naEstrada->fresh()->status);
    }

    /**
     * 'aguardando_coleta' dentro de uma carga ABERTA já é frete; sem carga, ou
     * com o vínculo antigo de uma carga encerrada, ainda é pátio.
     */
    public function test_aguardando_coleta_so_e_patio_fora_de_carga_aberta(): void
    {
        $aberta = $this->carga('aberto');
        $encerrada = $this->carga('concluido');

        $pedido = $this->pedidoMoto($this->loja, 'aguardando_rota', $this->usuario('loja'));
        $naCarga = $this->vincular($pedido, $this->moto('aguardando_coleta', ['romaneio_id' => $aberta->id]));
        $semCarga = $this->vincular($pedido, $this->moto('aguardando_coleta'));
        $vinculoAntigo = $this->vincular($pedido, $this->moto('aguardando_coleta', ['romaneio_id' => $encerrada->id]));

        $this->assertEqualsCanonicalizing(
            [$semCarga->id, $vinculoAntigo->id],
            $pedido->motosNoPatio()->pluck('motos.id')->all()
        );
        $this->assertNotContains($naCarga->id, $pedido->motosNoPatio()->pluck('motos.id')->all());
    }

    private function vincular($pedido, $moto)
    {
        $pedido->motos()->attach($moto->id, ['destino' => 'Loja Patio/PA']);

        return $moto;
    }

    private function carga(string $status): Romaneio
    {
        return Romaneio::create([
            'user_id' => $this->cd->id, 'status' => $status,
            'motorista' => 'JOAO', 'placa' => 'ABC1D23', 'rota' => 'BR-316',
        ]);
    }
}
