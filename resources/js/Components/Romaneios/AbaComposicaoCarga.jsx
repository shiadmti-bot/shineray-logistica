import { ClipboardDocumentCheckIcon, TruckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button, Card, EmptyState } from '@/Components/UI';
import { comZeros } from './agrupar';

function BotaoRemover({ onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded p-1 text-content-muted hover:text-status-danger-fg"
            title="Remover da carga"
            aria-label="Remover da carga"
        >
            <XMarkIcon className="h-4 w-4" />
        </button>
    );
}

/** Prévia do manifesto: as paradas da viagem e o que desce em cada uma. */
export default function AbaComposicaoCarga({ paradas, resumo, selecao, onIrParaMotos }) {
    if (resumo.total === 0) {
        return (
            <EmptyState
                icon={ClipboardDocumentCheckIcon}
                title="Nenhum item na carga ainda"
                description="Navegue pelas abas de Motos e Peças e selecione os itens que irão embarcar neste caminhão."
                action={
                    <Button variant="primary" onClick={onIrParaMotos} icon={TruckIcon}>
                        Ir para Motos CD
                    </Button>
                }
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-base font-extrabold text-content-primary">
                        Resumo da Viagem · {resumo.destinos} Parada(s) Programada(s)
                    </h3>
                    <p className="text-xs text-content-secondary">
                        Total de <strong>{resumo.motos} motos</strong> e{' '}
                        <strong>
                            {resumo.basquetas} basquetas ({resumo.pecasUn} peças em {resumo.volumes} vol.)
                        </strong>
                    </p>
                </div>

                <Button variant="secondary" size="sm" onClick={selecao.limpar} icon={XMarkIcon}>
                    Esvaziar Carga
                </Button>
            </div>

            <ol className="space-y-4">
                {Object.entries(paradas).map(([parada, conteudo], index) => (
                    <li key={parada}>
                        <Card padding="none" className="overflow-hidden">
                            <div className="flex items-center justify-between border-b border-line bg-surface-sunken px-5 py-3">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-black text-white">
                                        {index + 1}
                                    </span>
                                    <div>
                                        <h4 className="text-sm font-extrabold text-content-primary">Parada: {parada}</h4>
                                        <p className="text-xs text-content-secondary">
                                            {conteudo.motos.length + conteudo.coletas.length} moto(s) · {conteudo.basquetas.length} basqueta(s)
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="divide-y divide-line p-4 space-y-3">
                                {conteudo.motos.length > 0 && (
                                    <div>
                                        <h5 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-content-muted">
                                            🏍️ Motos de Saída ({conteudo.motos.length}):
                                        </h5>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            {conteudo.motos.map((m) => (
                                                <div
                                                    key={m.id}
                                                    className="flex items-center justify-between rounded-lg bg-surface-sunken p-2.5 text-xs ring-1 ring-line"
                                                >
                                                    <div>
                                                        <span className="font-mono font-bold text-content-primary">{m.chassi}</span>
                                                        <p className="text-content-secondary">
                                                            {m.modelo} · {m.cor} (Ped #{m.pedidoId})
                                                        </p>
                                                    </div>
                                                    <BotaoRemover onClick={() => selecao.alternarMoto(m.id)} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {conteudo.coletas.length > 0 && (
                                    <div>
                                        <h5 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-content-muted">
                                            🔄 Coletas Milk Run ({conteudo.coletas.length}):
                                        </h5>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            {conteudo.coletas.map((m) => (
                                                <div
                                                    key={m.id}
                                                    className="flex items-center justify-between rounded-lg bg-status-warning-bg/30 p-2.5 text-xs ring-1 ring-status-warning-solid/30"
                                                >
                                                    <div>
                                                        <span className="font-mono font-bold text-content-primary">{m.chassi}</span>
                                                        <p className="text-content-secondary">
                                                            {m.modelo} · {m.cor} ({m.origem} ➔ {m.destino})
                                                        </p>
                                                    </div>
                                                    <BotaoRemover onClick={() => selecao.alternarMoto(m.id)} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {conteudo.basquetas.length > 0 && (
                                    <div>
                                        <h5 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-content-muted">
                                            📦 Basquetas de Peças ({conteudo.basquetas.length}):
                                        </h5>
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            {conteudo.basquetas.map((b) => (
                                                <div
                                                    key={b.id}
                                                    className="flex items-center justify-between rounded-lg bg-brand-50/40 p-2.5 text-xs ring-1 ring-brand-500/30"
                                                >
                                                    <div>
                                                        <span className="font-bold text-content-primary">Basqueta #{comZeros(b.id)}</span>
                                                        <p className="text-content-secondary">
                                                            {b.nota ? `NF ${b.nota} · ` : ''}
                                                            {b.total_un} peças · {b.volumes || 1} vol.
                                                        </p>
                                                    </div>
                                                    <BotaoRemover onClick={() => selecao.alternarBasqueta(b.id)} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </li>
                ))}
            </ol>
        </div>
    );
}
