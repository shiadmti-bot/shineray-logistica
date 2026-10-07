<?php

namespace Tests\Unit\Models;

use App\Models\Moto;
use App\Models\Pedido;
use App\Models\Romaneio;
use Tests\TestCase;

class RomaneioFechamentoTest extends TestCase
{
    public function test_carga_com_moto_em_transito_nao_pode_fechar(): void
    {
        $moto = (new Moto())->forceFill(['status' => 'transito_loja']);
        $pedido = (new Pedido())->forceFill(['status' => 'em_transito']);
        $moto->setRelation('pedidos', collect([$pedido]));

        $romaneio = (new Romaneio())->forceFill(['status' => 'em_transito']);
        $romaneio->setRelation('motos', collect([$moto]));
        $romaneio->setRelation('itens', collect([]));

        $this->assertFalse($romaneio->podeFechar());
        $this->assertCount(1, $romaneio->motosNaEstrada());
    }

    public function test_carga_com_todos_pedidos_concluidos_pode_fechar(): void
    {
        $moto = (new Moto())->forceFill(['status' => 'estoque_loja']);
        $pedido = (new Pedido())->forceFill(['status' => 'concluido']);
        $moto->setRelation('pedidos', collect([$pedido]));

        $romaneio = (new Romaneio())->forceFill(['status' => 'em_transito']);
        $romaneio->setRelation('motos', collect([$moto]));
        $romaneio->setRelation('itens', collect([]));

        $this->assertTrue($romaneio->podeFechar());
        $this->assertCount(0, $romaneio->motosNaEstrada());
    }

    public function test_carga_com_pedido_cancelado_pode_fechar(): void
    {
        $moto = (new Moto())->forceFill(['status' => 'estoque_fabrica']);
        $pedido = (new Pedido())->forceFill(['status' => 'cancelado']);
        $moto->setRelation('pedidos', collect([$pedido]));

        $romaneio = (new Romaneio())->forceFill(['status' => 'em_transito']);
        $romaneio->setRelation('motos', collect([$moto]));
        $romaneio->setRelation('itens', collect([]));

        $this->assertTrue($romaneio->podeFechar());
        $this->assertCount(0, $romaneio->motosNaEstrada());
    }
}
