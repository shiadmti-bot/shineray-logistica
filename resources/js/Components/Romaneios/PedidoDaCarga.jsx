import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { StatusBadge } from '@/Components/UI';
import CaixaSelecao from './CaixaSelecao';
import { comZeros } from './agrupar';

/**
 * Um pedido na mesa de montagem: marca todas as motos de uma vez ou abre a
 * lista para escolher chassi a chassi. Serve à expedição e à coleta.
 */
export default function PedidoDaCarga({
    pedido,
    motoIds,
    expandido,
    subtitulo,
    rotuloMotos,
    onAlternarPedido,
    onAlternarMoto,
    onAlternarExpandido,
}) {
    const motos = pedido.motos || [];
    const selecionadas = motos.filter((m) => motoIds.includes(m.id)).length;
    const todas = motos.length > 0 && motos.length === selecionadas;

    const aoTeclar = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onAlternarPedido();
        }
    };

    return (
        <div className="transition hover:bg-surface-sunken/40">
            <div className="flex items-center justify-between gap-4 px-5 py-3">
                <div
                    role="checkbox"
                    tabIndex={0}
                    aria-checked={todas ? true : selecionadas > 0 ? 'mixed' : false}
                    onClick={onAlternarPedido}
                    onKeyDown={aoTeclar}
                    className="flex flex-1 cursor-pointer items-center gap-3"
                >
                    <CaixaSelecao todas={todas} alguma={selecionadas > 0} />

                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-content-primary">Pedido #{comZeros(pedido.id)}</span>
                            <StatusBadge status={pedido.status} size="sm" />
                        </div>
                        <p className="text-xs text-content-secondary">{subtitulo}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-content-primary">
                        {selecionadas} / {motos.length} motos
                    </span>
                    <button
                        type="button"
                        onClick={onAlternarExpandido}
                        aria-expanded={expandido}
                        className="rounded p-1.5 text-content-muted hover:bg-surface-sunken hover:text-content-primary"
                        title={expandido ? 'Recolher motos' : 'Ver motos'}
                    >
                        {expandido ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {expandido && (
                <div className="border-t border-line bg-surface-sunken px-6 py-3">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-content-muted">{rotuloMotos}</p>
                    <div className="space-y-1.5">
                        {motos.map((moto) => {
                            const marcada = motoIds.includes(moto.id);

                            return (
                                <label
                                    key={moto.id}
                                    className={`flex cursor-pointer items-center justify-between rounded-md p-2.5 transition ${
                                        marcada ? 'bg-surface-card ring-1 ring-brand-500' : 'hover:bg-surface-card'
                                    }`}
                                >
                                    <span className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={marcada}
                                            onChange={() => onAlternarMoto(moto.id)}
                                            className="h-4 w-4 rounded border-line-strong text-brand-600 focus:ring-brand-500"
                                        />
                                        <span>
                                            <span className="font-mono text-xs font-bold text-content-primary">{moto.chassi}</span>
                                            <span className="ml-2 text-xs font-semibold text-content-secondary">
                                                {moto.modelo} · {moto.cor}
                                            </span>
                                        </span>
                                    </span>
                                    <StatusBadge status={moto.status} size="sm" />
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
