<?php

namespace App\Services\Estoque;

use App\Models\Peca;

/**
 * Lançada quando a operação pediu mais do que o local tem disponível.
 * Carrega os números para que a tela mostre "pediu 10, há 4" em vez de um
 * erro genérico.
 */
class EstoqueInsuficienteException extends \RuntimeException
{
    public function __construct(
        public readonly Peca $peca,
        public readonly int $solicitado,
        public readonly int $disponivel,
        public readonly string $localNome = '',
    ) {
        $local = $localNome !== '' ? " em {$localNome}" : '';

        parent::__construct(
            "Estoque insuficiente para {$peca->codigo} ({$peca->descricao}){$local}: "
            . "solicitado {$solicitado}, disponível {$disponivel}."
        );
    }
}
