<?php

namespace Tests\Unit\Models;

use App\Models\Romaneio;
use Tests\TestCase;

class RomaneioCapacidadeTest extends TestCase
{
    public function test_romaneio_possui_campos_fillable_tipo_e_capacidade_veiculo(): void
    {
        $romaneio = new Romaneio();
        $fillable = $romaneio->getFillable();

        $this->assertContains('tipo_veiculo', $fillable);
        $this->assertContains('capacidade_veiculo', $fillable);
        $this->assertContains('ordem_paradas', $fillable);
        $this->assertContains('telefone_motorista', $fillable);
    }

    public function test_romaneio_cast_capacidade_veiculo_e_ordem_paradas(): void
    {
        $romaneio = new Romaneio([
            'tipo_veiculo'       => '3_4',
            'capacidade_veiculo' => '16',
            'ordem_paradas'      => ['Castanhal', 'Capanema', 'Bragança'],
        ]);

        $this->assertEquals('3_4', $romaneio->tipo_veiculo);
        $this->assertSame(16, $romaneio->capacidade_veiculo);
        $this->assertIsArray($romaneio->ordem_paradas);
        $this->assertCount(3, $romaneio->ordem_paradas);
        $this->assertEquals('Castanhal', $romaneio->ordem_paradas[0]);
    }

    public function test_romaneio_aceita_capacidade_personalizada_e_presets(): void
    {
        $carreta = new Romaneio([
            'tipo_veiculo'       => 'carreta',
            'capacidade_veiculo' => '60',
        ]);
        $this->assertEquals('carreta', $carreta->tipo_veiculo);
        $this->assertSame(60, $carreta->capacidade_veiculo);

        $custom = new Romaneio([
            'tipo_veiculo'       => 'outro',
            'capacidade_veiculo' => 25,
        ]);
        $this->assertEquals('outro', $custom->tipo_veiculo);
        $this->assertSame(25, $custom->capacidade_veiculo);
    }

    public function test_romaneio_status_default_e_motorista_default(): void
    {
        $romaneio = new Romaneio();
        $this->assertEquals('aberto', $romaneio->status);
        $this->assertEquals('Motorista Não Informado', $romaneio->motorista);
    }
}
