<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Regra de negócio recusou uma operação de pedido: estado errado, papel errado
 * para esta etapa. Não é erro de sistema — a mensagem é para o operador.
 *
 * As Actions lançam e o controller decide a resposta, porque cada tela
 * apresenta a recusa do seu jeito (flash de erro, erro de campo).
 */
class OperacaoPedidoRecusada extends RuntimeException
{
}
