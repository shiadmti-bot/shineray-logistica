<?php

namespace App\Actions\Pedidos;

use App\Actions\Pedidos\Concerns\RegistraHistorico;
use App\Exceptions\OperacaoPedidoRecusada;
use App\Models\Pedido;
use App\Models\Schedule;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Aprovação gerencial de uma movimentação de moto.
 *
 * Quem pode aprovar é a PedidoPolicy (`aprovar`); aqui fica o que acontece
 * quando aprova. Extraído de PedidoController::aprovar (v3.5).
 */
final class AprovarPedido
{
    use RegistraHistorico;

    /**
     * @param  Pedido  $pedido  com `user` e `origem` carregados
     *
     * @throws OperacaoPedidoRecusada
     */
    public function executar(Pedido $pedido): void
    {
        DB::transaction(function () use ($pedido) {
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

            $pedido->update(['status' => 'solicitado']);

            $this->anexarPrevisaoRota($pedido);

            $this->registrarLog($pedido, 'Aprovado', 'Movimentação autorizada pelo Gestor.');

            $previsaoMsg = $pedido->previsao_entrega
                ? ' Previsão de saída: ' . Carbon::parse($pedido->previsao_entrega)->format('d/m/Y') . '.'
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
                        $nome = trim(($i['modelo'] ?? '') . ' ' . ($i['cor'] ?? ''));

                        return $qtd > 1 ? "{$qtd}x {$nome}" : $nome;
                    })
                    ->filter()
                    ->unique()
                    ->implode(', ');

                $this->enviarNotificacao(
                    $pedido->origem,
                    'Transferência Solicitada 🔁',
                    "Aprovado: Separe as motos ({$modelos}) para envio à {$pedido->user->filial}. Pedido #{$pedido->id}.",
                    route('pedidos.show', $pedido->id)
                );
            }

            // V2.6: pedido genérico — avisa o CD que existem chassis a atribuir.
            $saldoPendente = $pedido->saldoPendente();

            if ($saldoPendente > 0) {
                $this->enviarNotificacao(
                    User::where('perfil', 'cd')->get(),
                    'Atribuir Chassis 🔢',
                    "Pedido #{$pedido->id} ({$pedido->user->filial}) aprovado com {$saldoPendente} moto(s) sem chassi. Informe os chassis que serão enviados.",
                    route('pedidos.show', $pedido->id)
                );
            }
        });
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
