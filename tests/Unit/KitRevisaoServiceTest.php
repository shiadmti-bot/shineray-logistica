<?php

namespace Tests\Unit;

use App\Services\Pecas\KitRevisaoService;
use PHPUnit\Framework\TestCase;

class KitRevisaoServiceTest extends TestCase
{
    public function test_definicoes_kits_possui_quatro_pacotes_principais(): void
    {
        $definicoes = KitRevisaoService::definicoesKits();

        $this->assertArrayHasKey('revisao_basica', $definicoes);
        $this->assertArrayHasKey('relacao_transmissao', $definicoes);
        $this->assertArrayHasKey('kit_freios', $definicoes);
        $this->assertArrayHasKey('revisao_periodica', $definicoes);
    }

    public function test_estrutura_de_slots_dos_kits_esta_consistente(): void
    {
        $definicoes = KitRevisaoService::definicoesKits();

        foreach ($definicoes as $slug => $def) {
            $this->assertNotEmpty($def['nome']);
            $this->assertNotEmpty($def['subtitulo']);
            $this->assertNotEmpty($def['intervalo']);
            $this->assertNotEmpty($def['badge']);
            $this->assertNotEmpty($def['slots']);

            foreach ($def['slots'] as $slot) {
                $this->assertArrayHasKey('slot_nome', $slot);
                $this->assertArrayHasKey('quantidade', $slot);
                $this->assertArrayHasKey('termos', $slot);
                $this->assertGreaterThan(0, $slot['quantidade']);
                $this->assertIsArray($slot['termos']);
                $this->assertNotEmpty($slot['termos']);
            }
        }
    }

    public function test_obter_kits_retorna_vazio_quando_modelo_nulo(): void
    {
        $kits = KitRevisaoService::obterKitsParaModelo(null);
        $this->assertEmpty($kits);
    }
}
