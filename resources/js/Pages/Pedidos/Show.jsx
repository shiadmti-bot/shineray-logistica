import { useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import { ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/outline';

import ChatBox from '@/Components/ChatBox';
// v3: painel do fluxo de peça. Só renderiza quando o pedido é de peça.
import PainelAtendimentoPecas from '@/Components/Pecas/PainelAtendimento';
import { Button, PageHeader, StatusBadge } from '@/Components/UI';
import useNotificacoesTempoReal from '@/Hooks/useNotificacoesTempoReal';

import AcoesPedido from '@/Components/Pedidos/AcoesPedido';
import AlertasPedido, { AvisoEmbarqueParcial } from '@/Components/Pedidos/AlertasPedido';
import AvisoRecusa from '@/Components/Pedidos/AvisoRecusa';
import CardRotaPedido from '@/Components/Pedidos/CardRotaPedido';
import ConferenciaEntrega from '@/Components/Pedidos/ConferenciaEntrega';
import HistoricoPedido from '@/Components/Pedidos/HistoricoPedido';
import ListaMotosPedido from '@/Components/Pedidos/ListaMotosPedido';
import ListaPecasPedido from '@/Components/Pedidos/ListaPecasPedido';
import PainelAtribuicaoChassi from '@/Components/Pedidos/PainelAtribuicaoChassi';
import TimelinePedido from '@/Components/Pedidos/TimelinePedido';
import TipoPedidoBadge from '@/Components/Pedidos/TipoPedidoBadge';
import { rejeitarPedido } from '@/Components/Pedidos/acoes';
import { derivarPedido } from '@/Components/Pedidos/derivarPedido';

/**
 * Detalhe do pedido.
 *
 * Até a v3.4 era um arquivo de quase 2.000 linhas com toda a tela, as regras de
 * exibição e 24 diálogos. Agora a página só compõe: quem vê o quê sai de
 * `derivarPedido`, e cada bloco da tela é um painel em Components/Pedidos.
 */
export default function PedidoShow({ auth, pedido, atribuicao = null, peca = null, recusa = null }) {
    const papel = useMemo(
        () => derivarPedido({ pedido, user: auth.user, atribuicao, peca }),
        [pedido, auth.user, atribuicao, peca]
    );

    const { ehPeca, isTransferencia, isEmbarqueParcial, motosEmTransito, totalItensSolicitados } = papel;

    // O sininho toca e avisa; esta tela só recarrega quando o aviso é dela.
    useNotificacoesTempoReal((notificacao) => {
        if (notificacao.link?.includes(`/pedidos/${pedido.id}`)) {
            router.reload({ only: ['pedido'] });
        }
    });

    const aguardandoRecebimento =
        !ehPeca && ['em_transito', 'em_transito_cd'].includes(pedido.status) && papel.ehDestinatarioFinal;

    return (
        <>
            <Head title={`Pedido #${pedido.id}`} />

            <div className="space-y-6 pb-28">
                <PageHeader
                    title={`Pedido #${pedido.id}`}
                    breadcrumbs={[
                        { label: ehPeca ? 'Peças' : 'Motos' },
                        { label: 'Pedidos', href: route('pedidos.index') },
                        { label: `#${pedido.id}` },
                    ]}
                    actions={
                        <div className="flex items-center gap-2">
                            {ehPeca && peca?.pode_cancelar && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={XCircleIcon}
                                    onClick={() => rejeitarPedido(pedido.id)}
                                    className="!text-status-danger-fg hover:!bg-status-danger-bg border-status-danger-border"
                                >
                                    Cancelar Pedido
                                </Button>
                            )}
                            <TipoPedidoBadge isTransferencia={isTransferencia} isPeca={ehPeca} />
                            {isEmbarqueParcial ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-status-warning-bg text-status-warning-fg ring-1 ring-inset ring-status-warning-solid/20 shadow-xs">
                                    <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                    Embarque Parcial ({motosEmTransito}/{totalItensSolicitados})
                                </span>
                            ) : (
                                <StatusBadge status={pedido.status} />
                            )}
                        </div>
                    }
                    className="mb-0"
                />

                {/*
                    Primeiro bloco de propósito: num pedido recusado, "por quê"
                    é a única pergunta que importa, e ela ficava enterrada na
                    linha do tempo, no fim da página. Em pedido ativo `recusa`
                    é null e nada disto renderiza.
                */}
                <AvisoRecusa recusa={recusa} />

                {isEmbarqueParcial && <AvisoEmbarqueParcial pedido={pedido} papel={papel} />}

                {peca?.ativo && <PainelAtendimentoPecas pedido={pedido} peca={peca} />}

                <CardRotaPedido pedido={pedido} destinoFinalLabel={papel.destinoFinalLabel} />

                <AlertasPedido pedido={pedido} papel={papel} />

                <TimelinePedido
                    status={pedido.status}
                    isTransferencia={isTransferencia}
                    isEmbarqueParcial={isEmbarqueParcial}
                    isPeca={ehPeca}
                    peca={peca}
                    pedido={pedido}
                />

                {papel.cotasPendentes.length > 0 && (
                    <PainelAtribuicaoChassi
                        pedido={pedido}
                        cotasPendentes={papel.cotasPendentes}
                        saldoPendente={papel.saldoPendente}
                        podeAtribuir={papel.podeAtribuir}
                    />
                )}

                {ehPeca ? (
                    <ListaPecasPedido itens={pedido.itens_pedido || []} />
                ) : (
                    <ListaMotosPedido pedido={pedido} papel={papel} />
                )}

                <AcoesPedido pedido={pedido} peca={peca} papel={papel} />

                <HistoricoPedido logs={pedido.logs} />
            </div>

            {aguardandoRecebimento && <ConferenciaEntrega pedido={pedido} papel={papel} />}

            <ChatBox pedidoId={pedido.id} />
        </>
    );
}
