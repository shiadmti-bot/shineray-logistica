/** Linha do tempo dos registros do pedido (PedidoLog), do mais recente ao mais antigo. */
export default function HistoricoPedido({ logs = [] }) {
    return (
        <div className="mt-8 pt-6 border-t border-line">
            <h3 className="font-bold text-content-muted text-xs uppercase mb-6 tracking-widest">Linha do Tempo</h3>
            <ol className="space-y-6 pl-2">
                {logs.map((log, i) => (
                    <li key={log.id} className="flex gap-4 relative group">
                        {i !== logs.length - 1 && (
                            <div className="absolute left-[5px] top-6 w-0.5 h-full bg-line group-last:hidden"></div>
                        )}
                        <div className="relative z-10 flex-shrink-0 mt-1">
                            <div className="h-3 w-3 rounded-full bg-line-strong ring-4 ring-surface-card group-hover:bg-status-info-solid transition"></div>
                        </div>
                        <div>
                            <p className="text-xs text-content-muted font-mono mb-0.5">
                                <time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString()}</time>
                            </p>
                            <p className="text-sm font-bold text-content-primary">{log.titulo}</p>
                            <p className="text-sm text-content-secondary leading-relaxed whitespace-pre-line">{log.descricao}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </div>
    );
}
