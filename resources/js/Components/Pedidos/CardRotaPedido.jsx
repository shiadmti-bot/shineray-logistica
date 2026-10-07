import { Link } from '@inertiajs/react';
import {
    ArrowDownOnSquareIcon,
    ArrowUpOnSquareIcon,
    CalendarIcon,
    DocumentTextIcon,
    PaperClipIcon,
} from '@heroicons/react/24/outline';

/** Data vinda como 'AAAA-MM-DD...' exibida sem o deslocamento de fuso do navegador. */
const dataLocal = (valor) => new Date(valor.substring(0, 10) + 'T12:00:00');

/**
 * Cargas do pedido. Num embarque parcial cada moto viaja numa carga e
 * `pedido.romaneio_id` guarda só a última — mostrar só ela escondia a carga
 * anterior, que ainda estava na estrada. Pedido encerrado fica só com o
 * romaneio_id: depois do recebimento a moto pode ter seguido em outra carga.
 */
const cargasDoPedido = (pedido) => {
    const ativo = !['concluido', 'cancelado', 'rejeitado'].includes(pedido.status);
    const ids = [pedido.romaneio_id, ...(ativo ? (pedido.motos || []).map((m) => m.romaneio_id) : [])];
    return [...new Set(ids.filter(Boolean))].sort((a, b) => a - b);
};

/** Origem, destino e dados logísticos do pedido. */
export default function CardRotaPedido({ pedido, destinoFinalLabel }) {
    const cargas = cargasDoPedido(pedido);

    return (
        <div className="bg-surface-card rounded-card shadow-sm border border-line overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
            {/* Origem */}
            <div className="p-6 bg-surface-sunken/50">
                <h3 className="text-xs font-bold text-content-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                    <ArrowUpOnSquareIcon className="w-4 h-4 text-status-info-fg" /> Origem (Sai De)
                </h3>
                <div className="text-lg font-bold text-content-primary leading-tight">
                    {pedido.origem ? pedido.origem.filial : 'Centro de Distribuição'}
                </div>
                <div className="text-sm text-content-secondary mt-1 font-medium">
                    {pedido.origem?.name || 'Matriz Shineray By Sabel'}
                </div>

                {pedido.previsao_coleta && (
                    <div className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-status-warning-fg bg-status-warning-bg px-3 py-1.5 rounded-full border border-status-warning-solid/20">
                        <CalendarIcon className="w-4 h-4" /> Previsão Coleta:{' '}
                        {dataLocal(pedido.previsao_coleta).toLocaleDateString()}
                    </div>
                )}
            </div>

            {/* Destino */}
            <div className="p-6">
                <h3 className="text-xs font-bold text-content-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                    <ArrowDownOnSquareIcon className="w-4 h-4 text-status-success-fg" /> Destino (Vai Para)
                </h3>
                <div className="text-lg font-bold text-content-primary leading-tight">{destinoFinalLabel}</div>
                <div className="text-sm text-content-secondary mt-1 font-medium">
                    Solicitado por: {pedido.user.name}
                </div>

                {pedido.previsao_entrega && (
                    <div className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-status-success-fg bg-status-success-bg px-3 py-1.5 rounded-full border border-status-success-solid/20">
                        <CalendarIcon className="w-4 h-4" /> Previsão Saída:{' '}
                        {dataLocal(pedido.previsao_entrega).toLocaleDateString('pt-BR')}
                    </div>
                )}
            </div>

            {/* Info logística */}
            <div className="p-6 bg-surface-sunken/50 flex flex-col justify-center gap-1">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-content-muted uppercase tracking-wide">Data Criação</span>
                    <span className="text-sm font-bold text-content-secondary">
                        {new Date(pedido.created_at).toLocaleDateString()}
                    </span>
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-line">
                    <span className="text-xs font-bold text-content-muted uppercase tracking-wide">
                        {cargas.length > 1 ? 'Cargas' : 'Carga'}
                    </span>
                    {cargas.length > 0 ? (
                        <div className="flex flex-wrap justify-end gap-1">
                            {cargas.map((id) => (
                                <Link
                                    key={id}
                                    href={route('romaneios.show', id)}
                                    className="flex items-center gap-1 bg-status-info-solid text-white px-2 py-1 rounded text-xs font-bold hover:brightness-95 transition"
                                >
                                    <DocumentTextIcon className="w-4 h-4" /> #{id}
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <span className="text-xs italic text-content-muted">Aguardando...</span>
                    )}
                </div>

                {pedido.comprovante_url && (
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-line">
                        <span className="text-xs font-bold text-content-muted uppercase tracking-wide">Comprovante</span>
                        <a
                            href={pedido.comprovante_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 bg-status-success-bg text-status-success-fg px-2 py-1 rounded text-xs font-bold hover:brightness-95 transition"
                        >
                            <PaperClipIcon className="w-4 h-4" /> Ver Anexo
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
