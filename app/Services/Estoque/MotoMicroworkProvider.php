<?php

namespace App\Services\Estoque;

use App\Services\MicroworkService;

/**
 * Adapta o MicroworkService (motos) à interface comum de estoque.
 *
 * Não reimplementa nada: toda a regra de pátios, chassis indisponíveis e
 * agregação continua no MicroworkService, que segue sendo usado diretamente
 * pelo código atual. Este adaptador existe para que telas novas consigam
 * consultar moto e peça pela mesma porta.
 */
class MotoMicroworkProvider implements StockProviderInterface
{
    public function __construct(private readonly MicroworkService $microwork)
    {
    }

    public function tipo(): string
    {
        return 'moto';
    }

    /**
     * Moto disponível vive no CD (o Microwork é o estoque do CD), então
     * $localId é aceito por contrato mas não particiona o resultado.
     *
     * @return array<int, ItemDisponivel>
     */
    public function disponivel(?int $localId = null): array
    {
        return array_map(
            fn (array $linha) => new ItemDisponivel(
                identificador: $linha['modelo'] . '|' . $linha['cor'],
                descricao: trim($linha['modelo'] . ' ' . $linha['cor']),
                disponivel: (int) $linha['disponivel'],
                localId: $localId,
                meta: [
                    'modelo' => $linha['modelo'],
                    'cor'    => $linha['cor'],
                ],
            ),
            $this->microwork->getEstoqueDisponivelAgregado()
        );
    }

    /** Identificador no formato "MODELO|COR". */
    public function disponivelDe(string $identificador, ?int $localId = null): int
    {
        [$modelo, $cor] = array_pad(explode('|', $identificador, 2), 2, '');

        foreach ($this->microwork->getEstoqueDisponivelAgregado() as $linha) {
            if ($linha['modelo'] === $modelo && $linha['cor'] === $cor) {
                return (int) $linha['disponivel'];
            }
        }

        return 0;
    }

    public function sincronizar(): SyncResult
    {
        return $this->microwork->syncEstoqueFromApi()
            ? SyncResult::ok()
            : SyncResult::falha('Falha ao sincronizar estoque de motos com o Microwork.');
    }

    public function suportaSincronizacao(): bool
    {
        return true;
    }
}
