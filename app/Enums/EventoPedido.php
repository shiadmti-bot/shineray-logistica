<?php

namespace App\Enums;

/**
 * O que aconteceu num pedido — a coluna `pedido_logs.evento`.
 *
 * POR QUE ISTO EXISTE: até a v3.6 a linha do tempo era só `titulo` e
 * `descricao`, texto livre montado por interpolação. Consequência prática: o
 * histórico do gestor filtrava rejeições com `titulo LIKE 'Auditoria
 * Comercial%'` e, por isso, NUNCA mostrava uma rejeição total — o título dela
 * é "Rejeitado ❌". Quem rejeitou também não era consultável: o nome ficava
 * costurado no meio da frase ("... (Por: Fulano)").
 *
 * `titulo`/`descricao` continuam sendo o que a tela mostra. `evento` é o que o
 * banco consulta. Título é texto de interface e vai mudar; evento é chave e
 * não muda.
 *
 * Sem cast no model, pelo mesmo motivo de StatusPedido e Perfil: o valor que
 * circula é a string, e o enum é a lista autoritativa dela.
 */
enum EventoPedido: string
{
    case Criado          = 'criado';
    case Aprovado        = 'aprovado';
    case CortouItens     = 'corte_parcial';
    case Rejeitado       = 'rejeitado';
    case Cancelado       = 'cancelado';
    case Separado        = 'separado';
    case Embarcado       = 'embarcado';
    case Recebido        = 'recebido';
    case Concluido       = 'concluido';
    case Observacao      = 'observacao';

    /**
     * Eventos em que alguém DESFEZ algo — o que o histórico de rejeição mostra.
     *
     * @return list<string>
     */
    public static function recusas(): array
    {
        return [
            self::Rejeitado->value,
            self::Cancelado->value,
            self::CortouItens->value,
        ];
    }

    public function rotulo(): string
    {
        return match ($this) {
            self::Criado      => 'Criado',
            self::Aprovado    => 'Aprovado',
            self::CortouItens => 'Corte parcial',
            self::Rejeitado   => 'Rejeitado',
            self::Cancelado   => 'Cancelado',
            self::Separado    => 'Separado',
            self::Embarcado   => 'Embarcado',
            self::Recebido    => 'Recebido',
            self::Concluido   => 'Concluído',
            self::Observacao  => 'Observação',
        };
    }
}
