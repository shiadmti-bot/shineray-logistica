<?php

namespace App\Services\Estoque;

use App\Models\Peca;
use App\Models\PecaEstoque;

/**
 * Disponibilidade de peças a partir do estoque do próprio sistema.
 *
 * É o provider padrão enquanto o Microwork não expuser peças por API: o CD
 * alimenta o saldo por entrada manual / importação e este provider responde
 * às telas. Quando o relatório externo existir, PecaMicroworkProvider assume
 * a sincronização e este continua servindo a leitura.
 */
class PecaLocalProvider implements StockProviderInterface
{
    public function tipo(): string
    {
        return 'peca';
    }

    /**
     * @return array<int, ItemDisponivel>
     */
    public function disponivel(?int $localId = null): array
    {
        $query = PecaEstoque::query()
            ->with(['peca', 'local'])
            ->comDisponivel()
            ->whereHas('peca', fn ($q) => $q->where('ativo', true));

        if ($localId !== null) {
            $query->where('local_id', $localId);
        }

        return $query->get()
            ->map(fn (PecaEstoque $e) => new ItemDisponivel(
                identificador: $e->peca->codigo,
                descricao: $e->peca->descricao,
                disponivel: $e->disponivel,
                localId: $e->local_id,
                localNome: $e->local?->nome,
                meta: [
                    'peca_id'          => $e->peca_id,
                    'unidade'          => $e->peca->unidade,
                    'categoria'        => $e->peca->categoria,
                    'saldo'            => $e->saldo,
                    'reservado'        => $e->saldo_reservado,
                    'abaixo_do_minimo' => $e->abaixoDoMinimo(),
                ],
            ))
            ->sortBy('descricao')
            ->values()
            ->all();
    }

    public function disponivelDe(string $identificador, ?int $localId = null): int
    {
        $peca = Peca::where('codigo', $identificador)->first();

        if (! $peca) {
            return 0;
        }

        $query = PecaEstoque::where('peca_id', $peca->id);

        if ($localId !== null) {
            $query->where('local_id', $localId);
        }

        return $query->get()->sum(fn (PecaEstoque $e) => $e->disponivel);
    }

    public function sincronizar(): SyncResult
    {
        return SyncResult::naoSuportado(
            'Estoque de peças é alimentado localmente. Configure PecaMicroworkProvider para sincronizar com o Microwork.'
        );
    }

    public function suportaSincronizacao(): bool
    {
        return false;
    }
}
