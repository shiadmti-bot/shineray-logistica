import { MapPinIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { Button, Card } from '@/Components/UI';
import PedidoDaCarga from './PedidoDaCarga';
import { idsDasMotos } from './agrupar';

/**
 * Um destino da expedição do CD: os pedidos de moto para aquela filial e,
 * se houver basqueta pronta para o mesmo lugar, o convite à carga mista.
 *
 * `destinoCompleto` é o destino sem o filtro de busca — "Tudo" seleciona o
 * destino inteiro, não só o que a busca deixou visível.
 */
export default function GrupoExpedicao({ local, pedidos, destinoCompleto, selecao, pedidosAbertos, alternarPedidoAberto }) {
    const todasMotos = idsDasMotos(pedidos);
    const grupoSelecionado = todasMotos.length > 0 && todasMotos.every((id) => selecao.motoIds.includes(id));
    const motosSelecionadas = todasMotos.filter((id) => selecao.motoIds.includes(id)).length;

    const basquetas = destinoCompleto.basquetas;
    const basquetasSelecionadas = basquetas.filter((b) => selecao.basquetaIds.includes(b.id)).length;

    return (
        <Card padding="none" className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-line bg-surface-sunken/80 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-surface-card p-2 text-brand-600 shadow-sm ring-1 ring-line">
                        <MapPinIcon className="h-5 w-5" />
                    </span>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-extrabold text-content-primary">{local}</h3>
                            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                                {motosSelecionadas} / {todasMotos.length} motos
                            </span>
                        </div>
                        <p className="text-xs text-content-secondary">Destino Final · {pedidos.length} pedido(s)</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant={grupoSelecionado ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={() => selecao.alternarMotos(todasMotos)}
                    >
                        {grupoSelecionado ? 'Desmarcar Motos' : 'Selecionar Motos'}
                    </Button>

                    {basquetas.length > 0 && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => selecao.alternarDestino(destinoCompleto.pedidos, basquetas)}
                            className="text-brand-700 hover:text-brand-800"
                        >
                            Tudo ({todasMotos.length} motos + {basquetas.length} basq.)
                        </Button>
                    )}
                </div>
            </div>

            {/* Cross-docking: motos e peças para o mesmo destino */}
            {basquetas.length > 0 && (
                <div className="flex items-center justify-between gap-3 border-b border-status-info-solid/20 bg-status-info-bg/40 px-5 py-2.5 text-xs">
                    <div className="flex items-center gap-2 text-status-info-fg">
                        <WrenchScrewdriverIcon className="h-4 w-4 shrink-0" />
                        <span>
                            <strong>Carga Mista:</strong> Há <strong>{basquetas.length} basqueta(s)</strong> de peças
                            prontas para <strong>{local}</strong>.
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => selecao.alternarBasquetas(basquetas.map((b) => b.id))}
                        className="font-bold text-status-info-fg underline transition hover:opacity-80"
                    >
                        {basquetasSelecionadas === basquetas.length ? 'Desmarcar Peças' : `+ Incluir ${basquetas.length} Basqueta(s)`}
                    </button>
                </div>
            )}

            <div className="divide-y divide-line">
                {pedidos.map((pedido) => (
                    <PedidoDaCarga
                        key={pedido.id}
                        pedido={pedido}
                        motoIds={selecao.motoIds}
                        expandido={pedidosAbertos.includes(pedido.id)}
                        subtitulo={`Solicitante: ${pedido.user?.name || 'Cliente'}`}
                        rotuloMotos="Motos disponíveis neste pedido:"
                        onAlternarPedido={() => selecao.alternarMotos(idsDasMotos([pedido]))}
                        onAlternarMoto={selecao.alternarMoto}
                        onAlternarExpandido={() => alternarPedidoAberto(pedido.id)}
                    />
                ))}
            </div>
        </Card>
    );
}
