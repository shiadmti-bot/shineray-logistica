<?php

namespace App\Services;

use App\Models\Moto;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\PedidoLog;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * V2.6 — Atribuição de chassis reais às cotas genéricas de um pedido.
 *
 * A partir da v2.6 a loja pede "5x NEW JEF VERMELHA" sem chassi e o CD informa
 * quais motos físicas está separando. Toda a regra vive aqui para que a tela de
 * detalhes do Pedido (Fluxo A) e a montagem do Romaneio (Fluxo B) se comportem
 * exatamente igual.
 */
class AtribuicaoChassiService
{
    /** Status do pedido em que o CD pode bipar chassis. */
    public const STATUS_ATRIBUIVEIS = ['solicitado', 'separado', 'aguardando_rota', 'rota_confirmada', 'no_cd'];

    public function __construct(private MicroworkService $microwork)
    {
    }

    /**
     * Travas globais de chassi, compartilhadas entre a criação do pedido e a
     * atribuição pelo CD. Lança ValidationException com a mesma mensagem que a
     * operação já conhece.
     *
     * @param array<int, string> $chassis
     */
    public function validarChassisLivres(array $chassis, string $campoErro = 'itens'): void
    {
        $chassis = array_values(array_filter(array_map(
            fn ($c) => trim((string) $c) !== '' ? mb_strtoupper(trim((string) $c)) : null,
            $chassis
        )));

        if (empty($chassis)) {
            return;
        }

        // TRAVA 1: Motos presas em outros pedidos (não concluídos/cancelados/rejeitados)
        $motosEmUso = Moto::whereIn('chassi', $chassis)
            ->whereHas('pedidos', function ($q) {
                $q->whereNotIn('status', ['concluido', 'cancelado', 'rejeitado']);
            })->pluck('chassi')->toArray();

        if (!empty($motosEmUso)) {
            throw ValidationException::withMessages([
                $campoErro => 'CHASSI PRESO: Os seguintes chassis já estão vinculados a outro pedido ativo: ' . implode(', ', $motosEmUso),
            ]);
        }

        // TRAVA 2: Motos historicamente vendidas (ignoradas se voltaram ao estoque por estorno)
        $motosVendidas = Moto::whereIn('chassi', $chassis)
            ->whereNotIn('status', ['estoque_loja', 'estoque_cd', 'disponivel'])
            ->where(function ($query) {
                $query->where('status', 'vendida')
                      ->orWhere('motivo_solicitacao', 'LIKE', '%venda%')
                      ->orWhere('motivo_solicitacao', 'LIKE', '%cliente%')
                      ->orWhereHas('pedidos', function ($q) {
                          $q->where('pedidos.status', 'concluido')
                            ->where(function ($subQ) {
                                $subQ->where('pedido_moto.motivo', 'LIKE', '%venda%')
                                     ->orWhere('pedido_moto.motivo', 'LIKE', '%cliente%');
                            });
                      });
            })->pluck('chassi')->toArray();

        if (!empty($motosVendidas)) {
            throw ValidationException::withMessages([
                $campoErro => 'VENDA JÁ CONFIRMADA: O sistema não permite re-encomendar motos de clientes. Verifique: ' . implode(', ', $motosVendidas),
            ]);
        }
    }

    /**
     * Vincula um chassi físico a uma cota do pedido.
     *
     * @param int|null $pedidoItemId Cota alvo. NULL = bipagem cega: o sistema
     *                               descobre modelo/cor do chassi e casa sozinho.
     * @return array{item: PedidoItem, moto: Moto}
     */
    public function atribuir(Pedido $pedido, string $chassi, ?int $pedidoItemId = null): array
    {
        $chassi = mb_strtoupper(trim($chassi));

        if (mb_strlen($chassi) < 11) {
            throw ValidationException::withMessages([
                'chassi' => "Chassi inválido: '{$chassi}'. Informe ao menos 11 caracteres.",
            ]);
        }

        if (!in_array($pedido->status, self::STATUS_ATRIBUIVEIS, true)) {
            throw ValidationException::withMessages([
                'chassi' => "O pedido #{$pedido->id} está com status '{$pedido->status}' e não aceita atribuição de chassi. " .
                            ($pedido->status === 'em_analise'
                                ? 'Aguarde a aprovação da diretoria.'
                                : 'A carga já saiu ou foi finalizada.'),
            ]);
        }

        return DB::transaction(function () use ($pedido, $chassi, $pedidoItemId) {
            // Trava as cotas do pedido: impede que dois operadores do CD bipem
            // a mesma vaga ao mesmo tempo.
            $itens = $pedido->itensPedido()->lockForUpdate()->get();

            if ($itens->isEmpty()) {
                throw ValidationException::withMessages([
                    'chassi' => "O pedido #{$pedido->id} é um pedido legado (criado antes da v2.6): todos os chassis já foram informados pela loja na criação. Não há cotas a atribuir.",
                ]);
            }

            $item = $pedidoItemId
                ? $this->resolverCotaExplicita($itens, $pedidoItemId, $pedido)
                : $this->resolverCotaPorChassi($itens, $chassi, $pedido);

            // Chassi já bipado neste mesmo pedido?
            if ($pedido->motos()->where('chassi', $chassi)->exists()) {
                throw ValidationException::withMessages([
                    'chassi' => "O chassi {$chassi} já foi atribuído a este pedido.",
                ]);
            }

            $this->validarChassisLivres([$chassi], 'chassi');

            $moto = $this->sincronizarMoto($chassi, $item, $pedido);

            $pedido->motos()->attach($moto->id, [
                'destino'         => mb_strtoupper((string) $item->local),
                'motivo'          => $item->motivo,
                'pedido_item_id'  => $item->id,
            ]);

            $item->increment('qtd_atribuida');
            $item->refresh();

            $this->log(
                $pedido,
                'Chassi Atribuído 🔗',
                "Chassi {$chassi} vinculado à cota {$item->modelo} {$item->cor}. " .
                "Restam {$item->qtd_pendente} de {$item->quantidade} nesta cota."
            );

            return ['item' => $item, 'moto' => $moto];
        });
    }

    /**
     * Desfaz uma atribuição feita por engano (bipou o chassi errado).
     * Só vale para vínculos criados pela v2.6 — itens legados usam o fluxo de corte/estorno.
     */
    public function desatribuir(Pedido $pedido, Moto $moto): void
    {
        DB::transaction(function () use ($pedido, $moto) {
            $vinculo = DB::table('pedido_moto')
                ->where('pedido_id', $pedido->id)
                ->where('moto_id', $moto->id)
                ->lockForUpdate()
                ->first();

            if (!$vinculo) {
                throw ValidationException::withMessages([
                    'chassi' => "O chassi {$moto->chassi} não está vinculado ao pedido #{$pedido->id}.",
                ]);
            }

            if (empty($vinculo->pedido_item_id)) {
                throw ValidationException::withMessages([
                    'chassi' => "O chassi {$moto->chassi} foi informado pela própria loja na criação do pedido. Para removê-lo use a opção 'Cortar' (estorno), não a desatribuição.",
                ]);
            }

            if (!in_array($pedido->status, self::STATUS_ATRIBUIVEIS, true)) {
                throw ValidationException::withMessages([
                    'chassi' => "O pedido #{$pedido->id} está em '{$pedido->status}'. Não é possível desfazer a atribuição nesta etapa.",
                ]);
            }

            $item = PedidoItem::lockForUpdate()->find($vinculo->pedido_item_id);

            $pedido->motos()->detach($moto->id);

            if ($item && $item->qtd_atribuida > 0) {
                $item->decrement('qtd_atribuida');
            }

            // Devolve a moto ao pátio do CD
            $moto->update([
                'status'            => 'estoque_fabrica',
                'loja_atual_id'     => null,
                'romaneio_id'       => null,
                'localizacao_atual' => 'Fábrica/CD (Atribuição desfeita)',
            ]);

            $this->log(
                $pedido,
                'Atribuição Desfeita ↩️',
                "Chassi {$moto->chassi} foi desvinculado do pedido e retornou ao estoque do CD."
            );
        });
    }

    /**
     * Encerra o saldo não atendido de uma cota (ex: pediram 5, o CD só tinha 3).
     * Decisão da diretoria: o pedido segue completo com o que foi separado e o
     * restante é baixado com justificativa registrada.
     */
    public function encerrarSaldo(PedidoItem $item, string $justificativa, ?User $autor = null): PedidoItem
    {
        $autor = $autor ?: Auth::user();

        return DB::transaction(function () use ($item, $justificativa, $autor) {
            $item = PedidoItem::with('pedido')->lockForUpdate()->findOrFail($item->id);
            $pendente = $item->qtd_pendente;

            if ($pendente <= 0) {
                throw ValidationException::withMessages([
                    'justificativa' => 'Esta cota já foi totalmente atendida ou encerrada.',
                ]);
            }

            $item->update([
                'qtd_cancelada'       => $item->qtd_cancelada + $pendente,
                'motivo_cancelamento' => $justificativa,
                'cancelado_por'       => $autor?->id,
                'cancelado_em'        => now(),
            ]);

            $this->log(
                $item->pedido,
                'Saldo Encerrado ✂️',
                "{$pendente}x {$item->modelo} {$item->cor} não serão enviadas. Motivo: {$justificativa}"
            );

            return $item->refresh();
        });
    }

    // ------------------------------------------------------------------
    // Internos
    // ------------------------------------------------------------------

    private function resolverCotaExplicita($itens, int $pedidoItemId, Pedido $pedido): PedidoItem
    {
        $item = $itens->firstWhere('id', $pedidoItemId);

        if (!$item) {
            throw ValidationException::withMessages([
                'chassi' => "Item #{$pedidoItemId} não pertence ao pedido #{$pedido->id}.",
            ]);
        }

        if ($item->qtd_pendente <= 0) {
            throw ValidationException::withMessages([
                'chassi' => "A cota {$item->modelo} {$item->cor} já está completa ({$item->qtd_atribuida} de {$item->quantidade}).",
            ]);
        }

        return $item;
    }

    /**
     * Bipagem cega (Fluxo B): descobre modelo/cor do chassi e casa com a
     * primeira cota pendente compatível do pedido.
     */
    private function resolverCotaPorChassi($itens, string $chassi, Pedido $pedido): PedidoItem
    {
        $info = $this->microwork->getInfoChassi($chassi);

        $modelo = $info['modelo'] ?? null;
        $cor    = $info['cor'] ?? null;

        // Fallback: se o Microwork estiver fora do ar/defasado, usa o cadastro local
        if (!$modelo) {
            $motoLocal = Moto::where('chassi', $chassi)->first();
            $modelo = $motoLocal ? mb_strtoupper(trim((string) $motoLocal->modelo)) : null;
            $cor    = $motoLocal ? mb_strtoupper(trim((string) $motoLocal->cor)) : null;
        }

        if (!$modelo) {
            throw ValidationException::withMessages([
                'chassi' => "Chassi {$chassi} não foi encontrado no estoque do Microwork nem no cadastro local. " .
                            'Confira a digitação ou selecione a cota manualmente na tela do pedido.',
            ]);
        }

        $pendentes = $itens->filter(fn ($i) => $i->qtd_pendente > 0);

        if ($pendentes->isEmpty()) {
            throw ValidationException::withMessages([
                'chassi' => "O pedido #{$pedido->id} já teve todos os chassis atribuídos.",
            ]);
        }

        $match = $pendentes->first(function ($i) use ($modelo, $cor) {
            return $this->mesmoTexto($i->modelo, $modelo) && $this->mesmoTexto($i->cor, $cor);
        });

        if (!$match) {
            $esperado = $pendentes
                ->map(fn ($i) => "{$i->qtd_pendente}x {$i->modelo} {$i->cor}")
                ->implode('; ');

            throw ValidationException::withMessages([
                'chassi' => "O chassi {$chassi} ({$modelo} " . ($cor ?: 'SEM COR') . ") não corresponde a nenhum item pendente do pedido #{$pedido->id}. Pendências: {$esperado}.",
            ]);
        }

        return $match;
    }

    private function mesmoTexto(?string $a, ?string $b): bool
    {
        return mb_strtoupper(trim((string) $a)) === mb_strtoupper(trim((string) $b));
    }

    /**
     * Cria ou sincroniza a Moto física. Espelha a lógica do cenário "Pedido ao CD"
     * do PedidoController::store para que o registro fique idêntico ao fluxo antigo.
     */
    private function sincronizarMoto(string $chassi, PedidoItem $item, Pedido $pedido): Moto
    {
        $moto = Moto::firstOrCreate(
            ['chassi' => $chassi],
            [
                'modelo'            => mb_strtoupper($item->modelo),
                'cor'               => mb_strtoupper($item->cor),
                'status'            => 'separado',
                'localizacao_atual' => "Separado no CD (Pedido #{$pedido->id})",
            ]
        );

        if (!$moto->wasRecentlyCreated) {
            $moto->update([
                'modelo'            => mb_strtoupper($item->modelo),
                'cor'               => mb_strtoupper($item->cor),
                'status'            => 'separado',
                'loja_atual_id'     => null,
                'localizacao_atual' => "Separado no CD (Pedido #{$pedido->id})",
            ]);
        }

        return $moto;
    }

    private function log(?Pedido $pedido, string $titulo, string $descricao): void
    {
        if (!$pedido?->exists) {
            return;
        }

        PedidoLog::create([
            'pedido_id'  => $pedido->id,
            'titulo'     => $titulo,
            'descricao'  => $descricao . ' (Por: ' . (Auth::user()->name ?? 'Sistema') . ')',
        ]);
    }
}
