<?php

namespace Tests\Unit\Enums;

use App\Enums\EventoPedido;
use PHPUnit\Framework\TestCase;

/**
 * `pedido_logs.evento` é a chave que o histórico do gestor consulta. Se uma
 * recusa sair de `recusas()`, ela some do relatório de auditoria.
 */
class EventoPedidoTest extends TestCase
{
    public function test_recusas_sao_rejeicao_cancelamento_e_corte(): void
    {
        $this->assertEqualsCanonicalizing(
            ['rejeitado', 'cancelado', 'corte_parcial'],
            EventoPedido::recusas()
        );
    }

    public function test_todo_evento_tem_rotulo_legivel(): void
    {
        foreach (EventoPedido::cases() as $evento) {
            $this->assertNotSame('', trim($evento->rotulo()), "Evento {$evento->value} sem rótulo.");
        }
    }
}
