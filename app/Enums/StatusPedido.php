<?php

namespace App\Enums;

/**
 * Status de um Pedido (`pedidos.status`), na ordem do fluxo.
 *
 * A ORDEM DOS CASES É REGRA: é a prioridade da listagem de pedidos
 * (PedidoController::index). Status novo entra na posição dele no fluxo, não
 * no fim do arquivo.
 *
 * O dicionário visual do front (`STATUS_MAP` em Components/UI/statusMap.js)
 * precisa conhecer todos estes valores — StatusPedidoTest falha se um status
 * existir aqui e não lá, que é como nasce um badge cinza "Aguardando Rota".
 *
 * Sem cast no model, pelo mesmo motivo de Perfil.
 */
enum StatusPedido: string
{
    case EmAnalise             = 'em_analise';
    case Solicitado            = 'solicitado';
    case EmAtendimento         = 'em_atendimento';
    case AguardandoConfirmacao = 'aguardando_confirmacao';
    case Aprovado              = 'aprovado';
    case Separado              = 'separado';
    case AguardandoRota        = 'aguardando_rota';
    case RotaConfirmada        = 'rota_confirmada';
    case AguardandoColeta      = 'aguardando_coleta';
    case Coletado              = 'coletado';
    case Expedido              = 'expedido';
    case EmTransito            = 'em_transito';
    case EmTransitoCd          = 'em_transito_cd';
    case NoCd                  = 'no_cd';
    case Concluido             = 'concluido';
    case Rejeitado             = 'rejeitado';
    case Cancelado             = 'cancelado';

    public function encerrado(): bool
    {
        return in_array($this, [self::Concluido, self::Rejeitado, self::Cancelado], true);
    }

    /**
     * Status em que o pedido ainda ocupa a mercadoria, na ordem do fluxo.
     *
     * @return list<string>
     */
    public static function emAndamento(): array
    {
        return array_values(array_map(
            fn (self $status) => $status->value,
            array_filter(self::cases(), fn (self $status) => ! $status->encerrado())
        ));
    }
}
