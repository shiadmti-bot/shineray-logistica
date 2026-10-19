<?php

namespace App\Enums;

/**
 * Módulos que podem ser ligados e desligados pelo admin (Gestão > Módulos).
 *
 * Só entra aqui o que pode ser liberado aos poucos sem quebrar o resto do
 * sistema. O núcleo — pedidos de moto, cargas, calendário — não é opcional:
 * desligá-lo pararia a operação, e não há tela que mostre isso como escolha.
 *
 * Desligar um módulo CONGELA o fluxo dele: as rotas respondem com o aviso de
 * módulo desativado (middleware `modulo:`) e o menu esconde as entradas. Os
 * registros que já existem continuam consultáveis onde aparecem em outras
 * telas, como a lista de pedidos.
 */
enum Modulo: string
{
    case PedidosPecas = 'pedidos_pecas';
    case Devolucoes   = 'devolucoes';

    public function rotulo(): string
    {
        return match ($this) {
            self::PedidosPecas => 'Pedidos de peças',
            self::Devolucoes   => 'Devoluções de motos',
        };
    }

    public function descricao(): string
    {
        return match ($this) {
            self::PedidosPecas => 'Solicitação de peças pelas lojas, triagem e liberação pelo Pós-Venda, separação, '
                . 'basquetas, embarque, recebimento, pendências e indicadores. O catálogo, a consulta de onde '
                . 'encontrar e o estoque de peças continuam disponíveis com o módulo desligado.',
            self::Devolucoes => 'Devolução de motos da loja para o CD, com checklist nas duas pontas, '
                . 'aprovação da diretoria e conferência no recebimento.',
        };
    }

    /** Estado sem registro no banco — ver config/modulos.php. */
    public function padrao(): bool
    {
        return (bool) config("modulos.{$this->value}", true);
    }
}
