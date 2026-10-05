<?php

namespace Tests\Feature\Logistica;

use App\Models\Romaneio;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * Montar e desfazer carga — as travas que a mesa de montagem já sugeria.
 *
 * A tela só oferece cargas ABERTAS, só lista motos PRONTAS e só deixa desfazer
 * carga que NÃO SAIU. O servidor não conferia nenhuma das três.
 */
class RomaneioTravasTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    private User $cd;
    private User $loja;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();

        $this->cd   = $this->usuario('cd', ['filial' => 'CD Matriz']);
        $this->loja = $this->usuario('loja', ['filial' => 'Loja Carga/PA']);
    }

    public function test_carga_pronta_e_montada(): void
    {
        [$pedido, $moto] = $this->pedidoComMoto($this->loja, 'separado', 'separado');

        $this->actingAs($this->cd)
            ->post(route('romaneios.store'), $this->novaCarga([$moto->id]))
            ->assertSessionHasNoErrors();

        $moto->refresh();
        $this->assertSame('expedido', $moto->status);
        $this->assertNotNull($moto->romaneio_id);
        $this->assertSame('expedido', $pedido->fresh()->status);
    }

    public function test_pedido_sem_aprovacao_nao_vai_para_a_carga(): void
    {
        // Moto "pronta" num pedido que o gestor ainda não aprovou: só por requisição forjada.
        [$pedido, $moto] = $this->pedidoComMoto($this->loja, 'em_analise', 'separado');
        $cargasAntes = Romaneio::count();

        $this->actingAs($this->cd)
            ->post(route('romaneios.store'), $this->novaCarga([$moto->id]))
            ->assertSessionHasErrors('motos_ids');

        $this->assertSame('em_analise', $pedido->fresh()->status, 'O pedido pulava a aprovação direto para expedido.');
        $this->assertSame('separado', $moto->fresh()->status);
        $this->assertSame($cargasAntes, Romaneio::count(), 'Não pode nascer carga vazia.');
    }

    public function test_moto_que_nao_esta_pronta_nao_arrasta_o_pedido(): void
    {
        [$pedido, $moto] = $this->pedidoComMoto($this->loja, 'separado', 'solicitado');

        $this->actingAs($this->cd)
            ->post(route('romaneios.store'), $this->novaCarga([$moto->id]))
            ->assertSessionHasErrors('motos_ids');

        $this->assertSame('separado', $pedido->fresh()->status);
        $this->assertNull($moto->fresh()->romaneio_id);
    }

    public function test_pedido_concluido_nao_e_reaberto_por_carga_nova(): void
    {
        [$pedido, $moto] = $this->pedidoComMoto($this->loja, 'concluido', 'disponivel');

        $this->actingAs($this->cd)
            ->post(route('romaneios.store'), $this->novaCarga([$moto->id]))
            ->assertSessionHasErrors('motos_ids');

        $this->assertSame('concluido', $pedido->fresh()->status);
    }

    public function test_nao_se_adiciona_item_em_carga_que_ja_saiu(): void
    {
        $naEstrada = Romaneio::create([
            'user_id' => $this->cd->id, 'status' => 'em_transito', 'motorista' => 'JOAO', 'placa' => 'ABC1D23', 'rota' => 'BR-316',
        ]);
        [$pedido, $moto] = $this->pedidoComMoto($this->loja, 'separado', 'separado');

        $this->actingAs($this->cd)
            ->post(route('romaneios.store'), ['romaneio_id' => $naEstrada->id, 'motos_ids' => [$moto->id]])
            ->assertSessionHasErrors('romaneio_id');

        $this->assertNull($moto->fresh()->romaneio_id);
        $this->assertSame('separado', $pedido->fresh()->status);
    }

    public function test_item_entra_em_carga_ainda_aberta(): void
    {
        $aberta = Romaneio::create([
            'user_id' => $this->cd->id, 'status' => 'aberto', 'motorista' => 'JOAO', 'placa' => 'ABC1D23', 'rota' => 'BR-316',
        ]);
        [, $moto] = $this->pedidoComMoto($this->loja, 'separado', 'separado');

        $this->actingAs($this->cd)
            ->post(route('romaneios.store'), ['romaneio_id' => $aberta->id, 'motos_ids' => [$moto->id]])
            ->assertSessionHasNoErrors();

        $this->assertSame($aberta->id, (int) $moto->fresh()->romaneio_id);
    }

    public function test_carga_na_estrada_nao_pode_ser_desfeita(): void
    {
        $naEstrada = Romaneio::create([
            'user_id' => $this->cd->id, 'status' => 'em_transito', 'motorista' => 'JOAO', 'placa' => 'ABC1D23', 'rota' => 'BR-316',
        ]);
        [$pedido, $moto] = $this->pedidoComMoto($this->loja, 'em_transito', 'transito_loja');
        $moto->update(['romaneio_id' => $naEstrada->id]);

        $this->actingAs($this->cd)
            ->delete(route('romaneios.destroy', $naEstrada->id))
            ->assertSessionHasErrors('erro');

        $this->assertNotNull(Romaneio::find($naEstrada->id));
        $this->assertSame('transito_loja', $moto->fresh()->status, 'A moto estava no caminhão — não volta a "separado".');
        $this->assertSame('em_transito', $pedido->fresh()->status);
    }

    public function test_carga_aberta_continua_podendo_ser_desfeita(): void
    {
        $aberta = Romaneio::create([
            'user_id' => $this->cd->id, 'status' => 'aberto', 'motorista' => 'JOAO', 'placa' => 'ABC1D23', 'rota' => 'BR-316',
        ]);
        [$pedido, $moto] = $this->pedidoComMoto($this->loja, 'expedido', 'expedido');
        $moto->update(['romaneio_id' => $aberta->id]);

        $this->actingAs($this->cd)
            ->delete(route('romaneios.destroy', $aberta->id))
            ->assertSessionHasNoErrors();

        $this->assertNull(Romaneio::find($aberta->id));
        $this->assertSame('separado', $moto->fresh()->status);
        $this->assertSame('separado', $pedido->fresh()->status);
    }

    public function test_loja_nao_mexe_em_carga(): void
    {
        [, $moto] = $this->pedidoComMoto($this->loja, 'separado', 'separado');

        $this->actingAs($this->loja)
            ->post(route('romaneios.store'), $this->novaCarga([$moto->id]))
            ->assertForbidden();
    }

    /** @param list<int> $motos */
    private function novaCarga(array $motos): array
    {
        return ['motorista' => 'Joao', 'placa' => 'abc1d23', 'rota_nome' => 'BR-316', 'motos_ids' => $motos];
    }
}
