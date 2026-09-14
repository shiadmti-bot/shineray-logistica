import { Alert } from '@/Components/UI';
import { CalendarIcon, ClockIcon, ExclamationTriangleIcon, MapPinIcon, TruckIcon } from '@heroicons/react/24/outline';

/** Faixa de embarque parcial: parte das motos saiu, o resto segue no CD. */
export function AvisoEmbarqueParcial({ pedido, papel }) {
    const { motosEmTransito, totalItensSolicitados, totalNaoDespachado } = papel;

    return (
        <div className="rounded-card border-2 border-status-warning-solid/40 bg-status-warning-bg p-5 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-status-warning-fg font-black text-sm uppercase tracking-wide">
                <TruckIcon className="w-5 h-5 text-status-warning-fg" />
                Embarque Parcial em Andamento ({motosEmTransito} de {totalItensSolicitados} unidades despachadas)
            </div>
            <p className="text-xs text-content-secondary leading-relaxed font-medium">
                <strong>{motosEmTransito} motocicleta(s)</strong> deste pedido já estão a caminho da loja na Carga{' '}
                <strong>#{pedido.romaneio_id || 'em trânsito'}</strong>. As{' '}
                <strong>{totalNaoDespachado} unidade(s)</strong> restantes continuam no CD e serão enviadas na próxima
                viagem disponível.
            </p>
            <p className="text-[11px] text-content-muted">
                🔒{' '}
                <em>
                    Conforme a regra da diretoria, o recebimento final com foto do canhoto assinado só será liberado
                    após o despacho integral (100%) das motos solicitadas.
                </em>
            </p>
        </div>
    );
}

/**
 * Avisos de contexto do pedido de moto.
 *
 * Antes eram cinco blocos com paletas próprias (âmbar, azul, rosa, teal,
 * laranja) que não queriam dizer nada. Agora o tom carrega a informação:
 * `warning` = alguém precisa agir, `info` = está em curso, aguarde.
 */
export default function AlertasPedido({ pedido, papel }) {
    const { ehPeca, isTransferencia, souOrigem, souCD, souAdmin } = papel;

    return (
        <>
            {!ehPeca && isTransferencia && pedido.status === 'solicitado' && souOrigem && (
                <Alert tone="warning" icon={ExclamationTriangleIcon} title="Ação necessária: separação pendente">
                    Separe as motos fisicamente e confirme a separação para que fiquem disponíveis para coleta pelo CD.
                </Alert>
            )}

            {!ehPeca && isTransferencia && pedido.status === 'solicitado' && (souCD || souAdmin) && !souOrigem && (
                <Alert tone="info" icon={ClockIcon} title="Aguardando separação da origem">
                    A loja <strong>{pedido.origem?.filial}</strong> precisa separar as motos antes de ficarem
                    disponíveis para coleta.
                </Alert>
            )}

            {!ehPeca && pedido.status === 'aguardando_rota' && (
                <Alert tone="warning" icon={TruckIcon} title="Aguardando rota (agendamento do destino)">
                    Motos separadas. Aguarde o CD definir a rota para a loja de destino no calendário — assim que a
                    entrega final for agendada, a coleta nesta origem é confirmada automaticamente.
                </Alert>
            )}

            {!ehPeca && pedido.status === 'rota_confirmada' && (
                <Alert tone="info" icon={MapPinIcon} title="Rota confirmada">
                    O CD agendou uma viagem que passará na loja de destino. Aguardando a carga ser montada.
                </Alert>
            )}

            {!ehPeca && pedido.status === 'aguardando_coleta' && (
                <Alert tone="warning" icon={ExclamationTriangleIcon} title="Aguardando coleta">
                    Motos separadas e prontas. Aguardando o motorista do CD realizar a coleta na loja de origem.
                </Alert>
            )}

            {pedido.previsao_entrega && !['concluido', 'cancelado'].includes(pedido.status) && (
                <div className="flex items-center gap-4 rounded-card border border-status-success-solid/20 bg-status-success-bg/50 p-4">
                    <span className="shrink-0 rounded-full bg-status-success-bg p-2.5 text-status-success-fg">
                        <CalendarIcon className="h-6 w-6" />
                    </span>
                    <div>
                        <span className="text-xs font-bold uppercase tracking-widest text-status-success-fg">
                            Previsão de saída
                        </span>
                        <div className="mt-0.5 text-lg font-black text-content-primary">
                            {new Date(pedido.previsao_entrega.substring(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', {
                                weekday: 'long',
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                            })}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
