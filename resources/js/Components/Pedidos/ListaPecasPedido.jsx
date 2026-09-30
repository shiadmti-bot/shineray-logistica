import {
    CheckCircleIcon,
    ClockIcon,
    CubeIcon,
    ExclamationTriangleIcon,
    WrenchScrewdriverIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';

function StatusItemPeca({ item }) {
    const liberada = !!item.confirmado_em;
    const recusada = !!item.recusa_motivo && !liberada;
    const identificada = !!item.peca_id;
    const base = 'inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide border';

    if (recusada) {
        return (
            <span className={`${base} bg-status-danger-bg text-status-danger-fg border-status-danger-solid/20`}>
                <XCircleIcon className="w-3.5 h-3.5" /> Recusado Pós-Venda
            </span>
        );
    }

    if (liberada) {
        return (
            <span className={`${base} bg-status-success-bg text-status-success-fg border-status-success-solid/20`}>
                <CheckCircleIcon className="w-3.5 h-3.5" /> Liberado (Gate 1)
            </span>
        );
    }

    if (identificada) {
        return (
            <span className={`${base} bg-status-info-bg text-status-info-fg border-status-info-solid/20`}>
                <ClockIcon className="w-3.5 h-3.5" /> Aguard. Liberação
            </span>
        );
    }

    return (
        <span className={`${base} bg-status-warning-bg text-status-warning-fg border-status-warning-solid/20`}>
            <ClockIcon className="w-3.5 h-3.5" /> Em Atendimento
        </span>
    );
}

/** Itens de um pedido de peça, com o estado de cada um no Gate 1 e na separação. */
export default function ListaPecasPedido({ itens }) {
    const unidades = itens.reduce((acc, c) => acc + Math.max(0, (c.quantidade || 0) - (c.qtd_cancelada || 0)), 0);

    return (
        <div className="bg-surface-card rounded-card shadow-sm border border-line overflow-hidden">
            <div className="px-6 py-4 bg-surface-sunken/80 border-b border-line flex justify-between items-center backdrop-blur-sm">
                <h3 className="font-black text-content-primary text-sm uppercase tracking-wide flex items-center gap-2">
                    <WrenchScrewdriverIcon className="w-5 h-5 text-content-secondary" />
                    Peças Solicitadas
                </h3>
                <span className="bg-surface-inverted text-content-inverted text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                    {unidades} Unidades ({itens.length} {itens.length === 1 ? 'item' : 'itens'})
                </span>
            </div>

            <div className="divide-y divide-line">
                {itens.map((item, idx) => (
                    <div
                        key={item.id || idx}
                        className="group p-5 flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-surface-sunken transition duration-150 ease-in-out"
                    >
                        <div className="flex items-center gap-5 flex-1 w-full md:w-auto">
                            <div className="h-14 w-14 rounded-card bg-surface-card border border-line flex items-center justify-center text-content-muted shadow-sm flex-shrink-0 group-hover:scale-105 transition">
                                <CubeIcon className="w-6 h-6 text-brand-600" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-extrabold text-content-primary text-base">
                                        {item.quantidade}x {item.peca?.descricao || item.descricao_solicitada || 'Peça não identificada'}
                                    </h4>
                                    {item.peca?.codigo ? (
                                        <span className="font-mono text-xs text-status-info-fg bg-status-info-bg/50 px-2 py-0.5 rounded border border-status-info-solid/20 font-bold tracking-wider">
                                            {item.peca.codigo}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-status-warning-fg bg-status-warning-bg/50 px-2 py-0.5 rounded border border-status-warning-solid/20 font-bold uppercase tracking-wide">
                                            Aguardando SKU (CD)
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary">
                                    {item.peca?.unidade && (
                                        <span className="font-semibold uppercase tracking-wide text-[11px] bg-surface-card px-2 py-0.5 rounded border border-line">
                                            UN: {item.peca.unidade}
                                        </span>
                                    )}
                                    {item.preco_unitario && (
                                        <span className="text-content-muted text-[11px]">
                                            Preço unit.: <strong>R$ {Number(item.preco_unitario).toFixed(2)}</strong>
                                        </span>
                                    )}
                                    {item.basqueta && (
                                        <span className="inline-flex items-center gap-1 font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-200 text-[11px]">
                                            🧺 Basqueta #{item.basqueta.id}
                                        </span>
                                    )}
                                </div>
                                {item.motivo && (
                                    <p className="text-[11px] text-content-muted font-medium">
                                        Motivo: <span className="text-content-secondary">{item.motivo}</span>
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4 md:pl-6 md:border-l border-line">
                            <div className="flex flex-col items-start md:items-end">
                                <span className="text-[9px] font-bold text-content-muted uppercase tracking-widest mb-1">
                                    Status Item
                                </span>
                                <StatusItemPeca item={item} />
                                <span className="text-[10px] text-content-muted font-bold mt-1">
                                    Separado: {item.qtd_atribuida || 0}/{item.quantidade}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}

                {itens.length === 0 && (
                    <div className="p-8 text-center text-content-secondary">
                        <ExclamationTriangleIcon className="w-12 h-12 mx-auto text-content-muted mb-3" />
                        <p className="font-bold text-content-secondary text-lg">Nenhuma peça encontrada neste pedido.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
