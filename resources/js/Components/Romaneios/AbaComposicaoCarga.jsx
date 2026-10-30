import { useMemo } from 'react';
import {
    ChevronDownIcon,
    ChevronUpIcon,
    ClipboardDocumentCheckIcon,
    TruckIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { Button, Card, EmptyState } from '@/Components/UI';
import { comZeros } from './agrupar';
import TermometroOcupacao from './TermometroOcupacao';

function BotaoRemover({ onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded p-1 text-content-muted hover:text-status-danger-fg transition"
            title="Remover item da carga"
            aria-label="Remover item da carga"
        >
            <XMarkIcon className="h-4 w-4" />
        </button>
    );
}

/**
 * Aba de Composição da Carga com Sequenciamento LIFO (Last-In, First-Out).
 * Permite reordenar a sequência de entrega e orienta a equipe de doca e o motorista
 * sobre a posição correta de estivagem no caminhão.
 */
export default function AbaComposicaoCarga({
    paradas = {},
    ordemParadas = [],
    onReordenarParadas,
    resumo,
    selecao,
    onIrParaMotos,
}) {
    // Lista ordenada de nomes de paradas
    const paradasOrdenadas = useMemo(() => {
        const todasChaves = Object.keys(paradas);
        if (!ordemParadas || ordemParadas.length === 0) {
            return todasChaves;
        }

        const ordenadas = ordemParadas.filter((chave) => todasChaves.includes(chave));
        const restantes = todasChaves.filter((chave) => !ordenadas.includes(chave));
        return [...ordenadas, ...restantes];
    }, [paradas, ordemParadas]);

    const totalParadas = paradasOrdenadas.length;

    const moverParada = (index, direcao) => {
        const novoIndex = index + direcao;
        if (novoIndex < 0 || novoIndex >= totalParadas) return;

        const novaLista = [...paradasOrdenadas];
        const item = novaLista[index];
        novaLista[index] = novaLista[novoIndex];
        novaLista[novoIndex] = item;

        if (onReordenarParadas) {
            onReordenarParadas(novaLista);
        }
    };

    if (resumo.total === 0 || totalParadas === 0) {
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
            {/* Cabeçalho do Resumo */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-base font-extrabold text-content-primary">
                        Composição da Viagem · {totalParadas} Parada(s) Programada(s)
                    </h3>
                    <p className="text-xs text-content-secondary">
                        Total de <strong>{resumo.motos} moto(s)</strong> e{' '}
                        <strong>
                            {resumo.basquetas} basqueta(s) ({resumo.pecasUn} peças em {resumo.volumes} vol.)
                        </strong>
                    </p>
                </div>

                <Button variant="secondary" size="sm" onClick={selecao.limpar} icon={XMarkIcon}>
                    Esvaziar Carga
                </Button>
            </div>

            {/* Termômetro de Ocupação da Carga */}
            <TermometroOcupacao
                motos={resumo.motos}
                basquetas={resumo.basquetas}
                capacidade={resumo.capacidade || 16}
                tipoVeiculo={resumo.tipoVeiculo || '3_4'}
                variante="padrao"
            />

            {/* Painel Didático de Estivagem LIFO */}
            <div className="rounded-xl border border-brand-500/30 bg-gradient-to-r from-brand-500/10 via-surface-card to-surface-card p-4 sm:p-5 shadow-xs">
                <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 rounded-lg bg-brand-600 p-2 text-white shadow-xs">
                        <TruckIcon className="h-6 w-6" />
                    </span>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-extrabold text-content-primary">
                                Regra de Estivagem LIFO (Last-In, First-Out)
                            </h4>
                            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-black uppercase text-brand-800">
                                Logística Inteligente
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-content-secondary leading-relaxed">
                            Organize a sequência das paradas de acordo com o trajeto da viagem. A estivagem no caminhão
                            é <strong>inversa</strong> à ordem de entrega: a <strong>última parada</strong> deve ser carregada
                            primeiro no <em>fundo do baú</em>, e a <strong>1ª parada</strong> fica próxima à <em>porta traseira</em> para descida imediata sem necessidade de remanejar motos na estrada.
                        </p>

                        {/* Diagrama Esquemático do Caminhão */}
                        <div className="mt-4 rounded-lg border border-line bg-surface-sunken p-3">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-content-muted mb-2 flex items-center justify-between">
                                <span>🚛 Perfil do Caminhão (Ordem Física de Carregamento na Doca):</span>
                                <span className="text-[10px] font-semibold text-brand-700">Fundo ➔ Porta</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                {/* Fundo do Caminhão */}
                                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-center">
                                    <span className="text-[10px] font-black uppercase tracking-wide text-amber-800 block">
                                        1º a Entrar no CD (Fundo / Cabine)
                                    </span>
                                    <span className="mt-0.5 text-xs font-extrabold text-content-primary block truncate">
                                        {totalParadas > 1 ? `${totalParadas}ª Parada: ${paradasOrdenadas[totalParadas - 1]}` : 'Carga única'}
                                    </span>
                                    <span className="text-[10px] text-content-muted block">
                                        Última a descarregar na estrada
                                    </span>
                                </div>

                                {/* Meio do Caminhão */}
                                <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-2.5 text-center">
                                    <span className="text-[10px] font-black uppercase tracking-wide text-blue-800 block">
                                        Intermediárias (Meio do Baú)
                                    </span>
                                    <span className="mt-0.5 text-xs font-extrabold text-content-primary block">
                                        {totalParadas > 2 ? `${totalParadas - 2} parada(s) no trajeto` : 'Fluxo Direto'}
                                    </span>
                                    <span className="text-[10px] text-content-muted block">
                                        Descarregamento sequencial
                                    </span>
                                </div>

                                {/* Porta do Caminhão */}
                                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-center">
                                    <span className="text-[10px] font-black uppercase tracking-wide text-emerald-800 block">
                                        Último a Entrar (Porta de Saída 🚪)
                                    </span>
                                    <span className="mt-0.5 text-xs font-extrabold text-content-primary block truncate">
                                        1ª Parada: {paradasOrdenadas[0]}
                                    </span>
                                    <span className="text-[10px] text-content-muted block">
                                        Primeira a descarregar ao abrir o baú
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista Sequencial de Paradas Reordenáveis */}
            <ol className="space-y-4">
                {paradasOrdenadas.map((paradaNome, index) => {
                    const conteudo = paradas[paradaNome] || { motos: [], basquetas: [], coletas: [] };
                    const isPrimeira = index === 0;
                    const isUltima = index === totalParadas - 1 && totalParadas > 1;

                    return (
                        <li key={paradaNome}>
                            <Card padding="none" className="overflow-hidden border border-line shadow-xs">
                                {/* Topo da Parada: Ordem, Ações Subir/Descer e Badge LIFO */}
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-sunken px-4 py-3 sm:px-5">
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-black text-white shadow-xs">
                                            {index + 1}º
                                        </span>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="text-sm font-extrabold text-content-primary">
                                                    {paradaNome}
                                                </h4>
                                                {isPrimeira && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 border border-emerald-300">
                                                        🚪 Porta Traseira (1ª Descarga / Último Embarque)
                                                    </span>
                                                )}
                                                {isUltima && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-black text-amber-800 border border-amber-300">
                                                        🚛 Fundo do Baú (Última Descarga / 1º Embarque)
                                                    </span>
                                                )}
                                                {!isPrimeira && !isUltima && totalParadas > 2 && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-300">
                                                        📦 Meio do Caminhão ({index + 1}ª Parada)
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-content-secondary mt-0.5">
                                                {conteudo.motos.length + conteudo.coletas.length} moto(s) · {conteudo.basquetas.length} basqueta(s) de peças
                                            </p>
                                        </div>
                                    </div>

                                    {/* Botões de Reordenação da Parada */}
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            disabled={isPrimeira}
                                            onClick={() => moverParada(index, -1)}
                                            className={`inline-flex items-center gap-1 rounded-lg border border-line bg-surface-card px-2.5 py-1 text-xs font-bold text-content-primary transition ${
                                                isPrimeira
                                                    ? 'cursor-not-allowed opacity-30 text-content-muted'
                                                    : 'hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300'
                                            }`}
                                            title="Mover parada para cima (descarregar mais cedo / porta do caminhão)"
                                        >
                                            <ChevronUpIcon className="h-4 w-4" />
                                            <span>Subir</span>
                                        </button>

                                        <button
                                            type="button"
                                            disabled={index === totalParadas - 1}
                                            onClick={() => moverParada(index, 1)}
                                            className={`inline-flex items-center gap-1 rounded-lg border border-line bg-surface-card px-2.5 py-1 text-xs font-bold text-content-primary transition ${
                                                index === totalParadas - 1
                                                    ? 'cursor-not-allowed opacity-30 text-content-muted'
                                                    : 'hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300'
                                            }`}
                                            title="Mover parada para baixo (descarregar mais tarde / fundo do baú)"
                                        >
                                            <ChevronDownIcon className="h-4 w-4" />
                                            <span>Descer</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Conteúdo da Parada */}
                                <div className="divide-y divide-line p-4 space-y-3">
                                    {conteudo.motos.length > 0 && (
                                        <div>
                                            <h5 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-content-muted">
                                                🏍️ Motos de Expedição ({conteudo.motos.length}):
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
                    );
                })}
            </ol>
        </div>
    );
}
