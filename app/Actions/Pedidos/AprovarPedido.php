<?php

namespace App\Actions\Pedidos;

use App\Actions\Pedidos\Concerns\RegistraHistorico;
use App\Exceptions\OperacaoPedidoRecusada;
use App\Models\Pedido;
use App\Models\Schedule;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Aprovação gerencial de uma movimentação de moto.
 *
 * Quem pode aprovar é a PedidoPolicy (`aprovar`) ou o painel do gestor; aqui
 * fica o que acontece quando aprova. As duas portas passam por esta classe —
 * a do gestor com cortes. Extraído de PedidoController::aprovar (v3.5) e
 * unificado com GestorController::aprovar.
 */
final class AprovarPedido
{
    use RegistraHistorico;

    public function __construct(private CancelarPedido $cancelarPedido)
    {
    }

    /**
     * @param  Pedido  $pedido  com `user`, `origem` e `motos` carregados
     * @param  array{rejeitadas?: array<int>, itens_rejeitados?: array<int>, motivos?: array<string|int, string>, justificativa?: string|null}  $opcoes
     * @return bool  false quando os cortes esvaziaram o pedido e ele foi cancelado
     *
     * @throws OperacaoPedidoRecusada
     */
    public function executar(Pedido $pedido, array $opcoes = []): bool
    {
        return DB::transaction(function () use ($pedido, $opcoes) {
            // Relido com trava: dois gestores aprovando ao mesmo tempo não
            // disparam a notificação duas vezes.
            $statusAtual = Pedido::whereKey($pedido->id)->lockForUpdate()->value('status');

            if ($statusAtual !== 'em_analise') {
                throw new OperacaoPedidoRecusada('Este pedido já foi processado.');
            }

            // v3.3: pedidos de peça seguem fluxo próprio (Triagem → Gate 1 → Separação).
            // A aprovação gerencial e a atribuição de chassis são conceitos de moto.
            if ($pedido->tipo_carga === 'peca') {
                throw new OperacaoPedidoRecusada('Pedidos de peça não passam por aprovação gerencial — seguem para triagem e liberação técnica.');
            }

            $motivos = $opcoes['motivos'] ?? [];
            $justificativa = $opcoes['justificativa'] ?? null;

            $cortes = [
                ...$this->cortarMotos($pedido, $opcoes['rejeitadas'] ?? [], $motivos),
                ...$this->cortarItens($pedido, $opcoes['itens_rejeitados'] ?? [], $motivos),
            ];

            if ($cortes !== []) {
                $pedido->refresh();

                // Nada sobrou: o pedido é cancelado pelo mesmo caminho de um
                // cancelamento comum (status, motivo, reservas, aviso à loja,
                // soft delete). O log de auditoria vem antes, para o corte
                // aparecer no histórico do gestor.
                if (! $this->sobrouAlgo($pedido)) {
                    $this->registrarLog(
                        $pedido,
                        'Auditoria Comercial (Gestor)',
                        $this->textoAuditoria("❌ Pedido totalmente cancelado por {$this->nomeGestor()} (todos os itens cortados).", $justificativa, $cortes)
                    );

                    $this->cancelarPedido->executar(
                        $pedido,
                        Auth::user(),
                        'cancelado',
                        'Todos os itens foram cortados na análise comercial.' . ($justificativa ? " Obs: {$justificativa}" : '')
                    );

                    return false;
                }
            }

            $pedido->update(['status' => 'solicitado']);

            $this->anexarPrevisaoRota($pedido);

            if ($cortes !== [] || $justificativa) {
                $this->registrarLog(
                    $pedido,
                    'Auditoria Comercial (Gestor)',
                    $this->textoAuditoria("✅ Autorizado por {$this->nomeGestor()}.", $justificativa, $cortes)
                );
            } else {
                $this->registrarLog($pedido, 'Aprovado', 'Movimentação autorizada pelo Gestor.');
            }

            $previsaoMsg = $pedido->previsao_entrega
                ? ' Previsão de saída: '.Carbon::parse($pedido->previsao_entrega)->format('d/m/Y').'.'
                : '';

            $this->enviarNotificacao(
                $pedido->user,
                'Aprovado ✅',
                "Sua solicitação #{$pedido->id} foi aprovada.{$previsaoMsg}",
                route('pedidos.show', $pedido->id)
            );

            // Transferência: avisa a origem para separar.
            if ($pedido->origem_user_id && $pedido->origem) {
                $modelos = collect($pedido->itens)
                    ->map(function ($i) {
                        $qtd = (int) ($i['quantidade'] ?? 1);
                        $nome = trim(($i['modelo'] ?? '').' '.($i['cor'] ?? ''));

                        return $qtd > 1 ? "{$qtd}x {$nome}" : $nome;
                    })
                    ->filter()
                    ->unique()
                    ->implode(', ');

                $this->enviarNotificacao(
                    $pedido->origem,
                    'Transferência Solicitada 🔁',
                    'Aprovado: Separe as motos'.($modelos ? " ({$modelos})" : '')." para envio à {$pedido->user->filial}. Pedido #{$pedido->id}.",
                    route('pedidos.show', $pedido->id)
                );
            } else {
                // Reposição CD: avisa a equipe do CD
                $this->enviarNotificacao(
                    User::cd()->get(),
                    'Pedido #'.$pedido->id.' Aprovado',
                    'Solicitação aprovada comercialmente e liberada para separação.',
                    route('pedidos.show', $pedido->id)
                );
            }

            // V2.6: pedido genérico — avisa o CD que existem chassis a atribuir.
            $saldoPendente = $pedido->saldoPendente();

            if ($saldoPendente > 0) {
                $this->enviarNotificacao(
                    User::cd()->get(),
                    'Atribuir Chassis 🔢',
                    "Pedido #{$pedido->id} ({$pedido->user->filial}) aprovado com {$saldoPendente} moto(s) sem chassi. Informe os chassis que serão enviados.",
                    route('pedidos.show', $pedido->id)
                );
            }

            return true;
        });
    }

    /**
     * Tira do pedido as motos com chassi que o gestor recusou.
     *
     * Só as motos DESTE pedido: o id vem da requisição, e sem o filtro um id
     * de outro pedido mudava o status daquela moto — ou apagava o cadastro.
     *
     * @return list<string>  linhas do log de auditoria
     */
    private function cortarMotos(Pedido $pedido, array $ids, array $motivos): array
    {
        if ($ids === []) {
            return [];
        }

        $linhas = [];

        foreach ($pedido->motos()->whereKey(array_map('intval', $ids))->get() as $moto) {
            $motivo = $motivos[$moto->id] ?? 'Motivo não informado';
            $linhas[] = "🚫 {$moto->modelo} ({$moto->chassi})\n   ↳ Motivo: {$motivo}";

            $pedido->motos()->detach($moto->id);

            if ($pedido->origem_user_id) {
                // Transferência: a moto é da loja de origem e volta para ela.
                $moto->update(['status' => 'disponivel', 'localizacao_atual' => 'Estoque Loja']);
            } elseif ($moto->pedidos()->exists()) {
                $moto->update(['status' => 'disponivel', 'localizacao_atual' => 'Fábrica/CD']);
            } else {
                // Regra de negócio confirmada com a operação (14/09/2026): sem
                // nenhum outro pedido, o cadastro da moto é apagado — não volta
                // ao estoque. Moto não tem soft delete: a exclusão é definitiva.
                $moto->delete();
            }
        }

        return $linhas;
    }

    /**
     * Tira do pedido as cotas genéricas (modelo/cor/quantidade) recusadas.
     *
     * @return list<string>  linhas do log de auditoria
     */
    private function cortarItens(Pedido $pedido, array $ids, array $motivos): array
    {
        if ($ids === []) {
            return [];
        }

        $linhas = [];

        foreach ($pedido->itensPedido()->whereKey(array_map('intval', $ids))->get() as $item) {
            $motivo = $motivos['item_'.$item->id] ?? $motivos[$item->id] ?? 'Motivo não informado';
            $linhas[] = "🚫 {$item->modelo} ({$item->cor}) - {$item->quantidade} un.\n   ↳ Motivo: {$motivo}";

            $item->delete();
        }

        return $linhas;
    }

    private function sobrouAlgo(Pedido $pedido): bool
    {
        if ($pedido->motos()->exists()) {
            return true;
        }

        if ($pedido->isLegado()) {
            return false;
        }

        return $pedido->saldoPendente() > 0
            || $pedido->itensPedido()->where('quantidade', '>', 0)->exists();
    }

    /** @param  list<string>  $cortes */
    private function textoAuditoria(string $abertura, ?string $justificativa, array $cortes): string
    {
        $texto = $abertura;

        if ($justificativa) {
            $texto .= "\n💬 Obs Geral: \"{$justificativa}\"";
        }

        if ($cortes !== []) {
            $texto .= "\n\n❌ ITENS REJEITADOS:\n".implode("\n", $cortes);
        }

        return $texto;
    }

    private function nomeGestor(): string
    {
        return Auth::user()?->name ?? 'Gestor';
    }

    /**
     * Previsão de entrega pela próxima viagem do calendário que para na loja
     * de destino. É estimativa: falhar aqui não impede a aprovação.
     */
    private function anexarPrevisaoRota(Pedido $pedido): void
    {
        try {
            $proximaRota = Schedule::whereHas('stops', fn ($q) => $q->where('user_id', $pedido->user_id))
                ->where('date', '>=', now()->toDateString())
                ->orderBy('date', 'asc')
                ->first();

            if ($proximaRota) {
                $pedido->update(['previsao_entrega' => $proximaRota->date]);

                $this->registrarLog(
                    $pedido,
                    'Previsão de Rota 📅',
                    'Rota mais próxima encontrada para ' . Carbon::parse($proximaRota->date)->format('d/m/Y') . '. Esta é uma estimativa baseada no calendário.'
                );
            }
        } catch (\Exception $e) {
            Log::warning("Erro ao buscar previsão de rota para pedido #{$pedido->id}: " . $e->getMessage());
        }
    }
}
