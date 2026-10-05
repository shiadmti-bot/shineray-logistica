<?php

namespace Tests\Unit\Enums;

use App\Enums\StatusPedido;
use PHPUnit\Framework\TestCase;

/**
 * Regras puras do ciclo de vida do pedido. (A sincronia com o dicionário
 * visual do front fica em Tests\Feature\StatusPedidoTest.)
 */
class StatusPedidoEnumTest extends TestCase
{
    public function test_so_concluido_rejeitado_e_cancelado_encerram_o_pedido(): void
    {
        $encerrados = array_filter(StatusPedido::cases(), fn (StatusPedido $s) => $s->encerrado());

        $this->assertEqualsCanonicalizing(
            [StatusPedido::Concluido, StatusPedido::Rejeitado, StatusPedido::Cancelado],
            array_values($encerrados)
        );
    }

    public function test_em_andamento_exclui_encerrados_e_mantem_a_ordem_do_fluxo(): void
    {
        $andamento = StatusPedido::emAndamento();

        $this->assertNotContains('concluido', $andamento);
        $this->assertNotContains('rejeitado', $andamento);
        $this->assertNotContains('cancelado', $andamento);

        // A ordem dos cases é a prioridade da listagem (PedidoController::index).
        $this->assertSame('em_analise', $andamento[0]);
        $this->assertSame('no_cd', $andamento[array_key_last($andamento)]);
        $this->assertSame(array_values($andamento), $andamento, 'A lista não pode ter buracos de índice.');
    }

    public function test_valores_sao_unicos(): void
    {
        $valores = array_map(fn (StatusPedido $s) => $s->value, StatusPedido::cases());

        $this->assertSame($valores, array_values(array_unique($valores)));
    }
}
