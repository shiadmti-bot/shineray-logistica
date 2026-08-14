<?php

namespace App\Services\Estoque;

/**
 * Linha de disponibilidade normalizada, comum a moto e peça.
 *
 * Permite que a tela de criação de pedido renderize os dois tipos com o mesmo
 * componente, sem conhecer a estrutura interna de cada fonte.
 */
class ItemDisponivel implements \JsonSerializable
{
    public function __construct(
        /** Chave de negócio: código da peça, ou "MODELO|COR" para moto. */
        public readonly string $identificador,
        public readonly string $descricao,
        public readonly int $disponivel,
        public readonly ?int $localId = null,
        public readonly ?string $localNome = null,
        /** Dados específicos do tipo (cor, categoria, unidade, pátio...). */
        public readonly array $meta = [],
    ) {
    }

    public function jsonSerialize(): array
    {
        return [
            'identificador' => $this->identificador,
            'descricao'     => $this->descricao,
            'disponivel'    => $this->disponivel,
            'local_id'      => $this->localId,
            'local_nome'    => $this->localNome,
            'meta'          => $this->meta,
        ];
    }
}
