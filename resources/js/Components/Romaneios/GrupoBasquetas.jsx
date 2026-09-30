import { BuildingStorefrontIcon, ChevronDownIcon, ChevronUpIcon, TruckIcon } from '@heroicons/react/24/outline';
import { Button, Card } from '@/Components/UI';
import { comZeros, contarMotos, idsDasMotos } from './agrupar';

/** Uma filial receptora: as basquetas faturadas e liberadas para embarque. */
export default function GrupoBasquetas({ local, basquetas, destinoCompleto, selecao, basquetasAbertas, alternarBasquetaAberta }) {
    const ids = basquetas.map((b) => b.id);
    const grupoSelecionado = ids.length > 0 && ids.every((id) => selecao.basquetaIds.includes(id));
    const selecionadas = ids.filter((id) => selecao.basquetaIds.includes(id)).length;
    const totalPecas = basquetas.reduce((acc, b) => acc + (b.total_un || 0), 0);

    const pedidosDeMoto = destinoCompleto.pedidos;
    const totalMotos = contarMotos(pedidosDeMoto);

    return (
        <Card padding="none" className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-line bg-surface-sunken/80 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-surface-card p-2 text-brand-600 shadow-sm ring-1 ring-line">
                        <BuildingStorefrontIcon className="h-5 w-5" />
                    </span>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-extrabold text-content-primary">{local}</h3>
                            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                                {selecionadas} / {basquetas.length} basquetas ({totalPecas} peças)
                            </span>
                        </div>
                        <p className="text-xs text-content-secondary">
                            Filial Receptora · {basquetas.length} caixa(s) pronta(s)
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant={grupoSelecionado ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={() => selecao.alternarBasquetas(ids)}
                    >
                        {grupoSelecionado ? 'Desmarcar Basquetas' : 'Selecionar Basquetas'}
                    </Button>

                    {pedidosDeMoto.length > 0 && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => selecao.alternarDestino(pedidosDeMoto, basquetas)}
                            className="text-brand-700 hover:text-brand-800"
                        >
                            Tudo ({totalMotos} motos + {basquetas.length} basq.)
                        </Button>
                    )}
                </div>
            </div>

            {/* Carga mista: motos no CD para este mesmo destino */}
            {pedidosDeMoto.length > 0 && (
                <div className="flex items-center justify-between gap-3 border-b border-brand-500/20 bg-brand-50/40 px-5 py-2.5 text-xs">
                    <div className="flex items-center gap-2 text-brand-700">
                        <TruckIcon className="h-4 w-4 shrink-0" />
                        <span>
                            <strong>Carga Mista:</strong> Há <strong>{totalMotos} moto(s)</strong> no CD prontas para{' '}
                            <strong>{local}</strong>.
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => selecao.alternarMotos(idsDasMotos(pedidosDeMoto))}
                        className="font-bold text-brand-700 underline transition hover:opacity-80"
                    >
                        + Incluir Motos no Caminhão
                    </button>
                </div>
            )}

            <div className="divide-y divide-line">
                {basquetas.map((basqueta) => {
                    const marcada = selecao.basquetaIds.includes(basqueta.id);
                    const aberta = basquetasAbertas.includes(basqueta.id);

                    return (
                        <div key={basqueta.id} className="transition hover:bg-surface-sunken/40">
                            <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                                <label className="flex flex-1 cursor-pointer items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={marcada}
                                        onChange={() => selecao.alternarBasqueta(basqueta.id)}
                                        className="h-5 w-5 rounded border-line-strong text-brand-600 focus:ring-brand-500"
                                    />
                                    <span>
                                        <span className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-content-primary">
                                                Basqueta #{comZeros(basqueta.id)}
                                            </span>
                                            {basqueta.nota && (
                                                <span className="rounded bg-surface-sunken px-2 py-0.5 text-xs font-mono font-bold text-content-secondary ring-1 ring-line">
                                                    NF {basqueta.nota}
                                                </span>
                                            )}
                                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                                                {basqueta.total_un} un
                                            </span>
                                        </span>
                                        <span className="block text-xs text-content-secondary">
                                            {basqueta.volumes || 1} volume(s) · {basqueta.itens?.length || 0} SKU(s)
                                        </span>
                                    </span>
                                </label>

                                <button
                                    type="button"
                                    onClick={() => alternarBasquetaAberta(basqueta.id)}
                                    aria-expanded={aberta}
                                    className="rounded p-1.5 text-content-muted hover:bg-surface-sunken hover:text-content-primary"
                                    title={aberta ? 'Recolher itens' : 'Ver peças'}
                                >
                                    {aberta ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                                </button>
                            </div>

                            {aberta && (
                                <div className="border-t border-line bg-surface-sunken px-6 py-3">
                                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-content-muted">
                                        Itens contidos nesta basqueta:
                                    </p>
                                    <div className="divide-y divide-line rounded-lg bg-surface-card ring-1 ring-line">
                                        {(basqueta.itens || []).map((item) => (
                                            <div key={item.id} className="flex items-center justify-between px-4 py-2 text-xs">
                                                <div>
                                                    <span className="font-semibold text-content-primary">{item.descricao}</span>
                                                    <span className="ml-2 font-mono text-[11px] text-content-muted">({item.codigo})</span>
                                                </div>
                                                <span className="font-bold tabular-nums text-content-primary">
                                                    {item.quantidade} {item.unidade}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
