<?php

namespace App\Services\Estoque;

/**
 * Fonte de verdade de disponibilidade de estoque.
 *
 * Existe para desacoplar as telas da ORIGEM do dado. Hoje moto vem do cache do
 * Microwork e peça vem do banco local; quando o relatório de peças do Microwork
 * estiver disponível, basta trocar o provider registrado no container — nenhum
 * controller ou tela muda.
 *
 * A interface é deliberadamente estreita. Moto (serializada por chassi) e peça
 * (fungível por saldo) têm mecânicas de baixa diferentes demais para
 * compartilharem métodos de escrita; o que elas realmente têm em comum é
 * "o que está disponível" e "atualize-se com a fonte externa".
 */
interface StockProviderInterface
{
    /** 'moto' ou 'peca'. */
    public function tipo(): string;

    /**
     * O que está disponível, agregado e pronto para exibição.
     *
     * @param  int|null  $localId  Local de estoque; null = todos os locais.
     * @return array<int, ItemDisponivel>
     */
    public function disponivel(?int $localId = null): array;

    /**
     * Disponibilidade de um item específico.
     */
    public function disponivelDe(string $identificador, ?int $localId = null): int;

    /**
     * Puxa dados da fonte externa e atualiza o estoque local.
     * Providers sem fonte externa devem retornar um SyncResult ignorado.
     */
    public function sincronizar(): SyncResult;

    public function suportaSincronizacao(): bool;
}
