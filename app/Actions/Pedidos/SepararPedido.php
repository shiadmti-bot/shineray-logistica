<?php

namespace App\Actions\Pedidos;

use App\Actions\Pedidos\Concerns\RegistraHistorico;
use App\Enums\Perfil;
use App\Exceptions\OperacaoPedidoRecusada;
use App\Models\Pedido;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Confirmação da separação física das motos.
 *
 * Quem separa depende do tipo: numa transferência é a loja de ORIGEM; numa
 * reposição é o CD. E para onde o pedido vai depois também: coleta direta,
 * espera de rota (interior) ou rota já confirmada. Extraído de
 * PedidoController::marcarSeparado (v3.5).
 */
final class SepararPedido
{
    use RegistraHistorico;

    /**
     * @param  Pedido  $pedido  com `origem` carregada
     *
     * @throws OperacaoPedidoRecusada
     */
    public function executar(Pedido $pedido, User $user): void
    {
        // v3.3: peças têm separação própria em PecaAtendimentoController::separar,
        // com reserva de estoque e basqueta. Este fluxo só muda status — faria o
        // pedido avançar sem contabilizar saldo.
        if ($pedido->tipo_carga === 'peca') {
            throw new OperacaoPedidoRecusada('Pedidos de peça são separados pela tela de Atendimento de Peças.');
        }

        DB::transaction(function () use ($pedido, $user) {
            // Relido com trava: dois cliques simultâneos não separam duas vezes.
            $statusAtual = Pedido::whereKey($pedido->id)->lockForUpdate()->value('status');

            if ($statusAtual !== 'solicitado') {
                throw new OperacaoPedidoRecusada('Status inválido para separação.');
            }

            // V2.6: não é possível separar enquanto houver cotas sem chassi atribuído.
            $saldoPendente = $pedido->saldoPendente();

            if ($saldoPendente > 0) {
                throw new OperacaoPedidoRecusada(
                    "ATRIBUIÇÃO PENDENTE: Ainda faltam {$saldoPendente} chassi(s) neste pedido. Informe os chassis que serão enviados (ou encerre o saldo em falta) antes de confirmar a separação."
                );
            }

            // Só é transferência de verdade se a origem é uma loja: reposição do
            // CD não pode cair na coleta.
            $isTransferencia = $pedido->origem_user_id && $pedido->origem && $pedido->origem->isLoja();

            [$novoStatus, $msgLog] = $isTransferencia
                ? $this->destinoDaTransferencia($pedido, $user)
                : $this->destinoDaReposicao($pedido, $user);

            $pedido->update(['status' => $novoStatus]);
            $pedido->motos()->update(['status' => $novoStatus]);

            $this->registrarLog($pedido, 'Separado 📦', $msgLog);

            // Avisa o CD que existe carga pronta numa loja aguardando frete.
            if ($isTransferencia) {
                $this->enviarNotificacao(
                    User::comPerfil(Perfil::Cd)->get(),
                    $novoStatus === 'aguardando_rota' ? 'Aguardando Rota 🚚' : 'Coleta Pronta 🚚',
                    "Loja {$pedido->origem->filial} separou as motos do pedido #{$pedido->id}. Pode agendar coleta.",
                    route('romaneios.create')
                );
            }
        });
    }

    /** @return array{0: string, 1: string} novo status e texto da linha do tempo */
    private function destinoDaTransferencia(Pedido $pedido, User $user): array
    {
        if ($user->id !== $pedido->origem_user_id && ! $user->isAdmin()) {
            throw new OperacaoPedidoRecusada("Apenas a loja de origem ({$pedido->origem->filial}) pode confirmar a separação desta moto.");
        }

        // Rota anexada na aprovação: pula direto para confirmada.
        if ($pedido->previsao_entrega != null) {
            return ['rota_confirmada', "Separado na origem ({$pedido->origem->filial}). Rota já estava previamente confirmada para entrega."];
        }

        if ($pedido->origem->is_interior && $pedido->created_at >= Pedido::INTERIOR_AGUARDA_ROTA_DESDE) {
            return ['aguardando_rota', "Separado na origem ({$pedido->origem->filial}). Aguardando a Matriz/CD definir uma rota de coleta."];
        }

        return ['aguardando_coleta', "Separado na origem ({$pedido->origem->filial}). Aguardando coleta direta."];
    }

    /** @return array{0: string, 1: string} novo status e texto da linha do tempo */
    private function destinoDaReposicao(Pedido $pedido, User $user): array
    {
        $destino = $pedido->previsao_entrega != null
            ? ['rota_confirmada', 'Separado no CD. Rota já havia sido confirmada pelo calendário.']
            // Para o CD, continua separado até virar romaneio.
            : ['separado', 'Separado no estoque do CD. Pronto para embarque.'];

        if (! $user->temPerfil(Perfil::Cd, Perfil::Admin)) {
            throw new OperacaoPedidoRecusada('Apenas o CD pode separar pedidos de reposição.');
        }

        return $destino;
    }
}
