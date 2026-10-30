import { useState } from 'react';
import {
    BoltIcon,
    SparklesIcon,
    Cog6ToothIcon,
    ShieldCheckIcon,
    WrenchScrewdriverIcon,
    PlusIcon,
    CheckIcon,
    ClockIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/Components/UI';

/**
 * Componente de Kits Frequentes de Revisão e Giro Rápido para Oficinas.
 *
 * Apresenta cards interativos com pacotes pré-configurados de peças para a moto
 * selecionada, permitindo que mecânicos e atendentes de pós-venda adicionem
 * todos os itens necessários para uma revisão completa com apenas 1 clique.
 */
export default function KitsRevisaoRapida({
    kits = [],
    modeloLabel = '',
    onAdicionarKit,
}) {
    const [expandido, setExpandido] = useState(true);
    const [kitAdicionadoRecente, setKitAdicionadoRecente] = useState(null);

    if (!kits || kits.length === 0) {
        return null;
    }

    const handleAdicionar = (kit) => {
        if (onAdicionarKit) {
            onAdicionarKit(kit);
            setKitAdicionadoRecente(kit.id);
            setTimeout(() => {
                setKitAdicionadoRecente((prev) => (prev === kit.id ? null : prev));
            }, 2000);
        }
    };

    const getIconeComponent = (icone) => {
        switch (icone) {
            case 'sparkles':
                return SparklesIcon;
            case 'cog':
                return Cog6ToothIcon;
            case 'shield-check':
                return ShieldCheckIcon;
            case 'wrench-screwdriver':
            default:
                return WrenchScrewdriverIcon;
        }
    };

    const getBadgeClasses = (cor) => {
        switch (cor) {
            case 'amber':
                return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
            case 'blue':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
            case 'rose':
                return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
            case 'emerald':
                return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
            default:
                return 'bg-surface-sunken text-content-secondary border-line';
        }
    };

    return (
        <section
            data-tour="pecas-solicitar.kits"
            aria-label="Kits de Revisão Rápida"
            className="mb-6 rounded-card border border-brand-500/20 bg-gradient-to-b from-brand-500/5 via-surface-card to-surface-card p-4 shadow-card ring-1 ring-brand-500/10 transition-all"
        >
            {/* Header da Seção */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                        <BoltIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold text-content-primary sm:text-base">
                                Kits Rápidos de Revisão
                            </h2>
                            {modeloLabel && (
                                <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 text-xs font-bold text-brand-700 dark:text-brand-300">
                                    {modeloLabel}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-content-secondary">
                            Pacotes de alta frequência para troca e manutenção preventiva. Adicione todos os itens ao pedido de uma vez.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setExpandido(!expandido)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-content-secondary hover:bg-surface-sunken hover:text-content-primary"
                >
                    {expandido ? (
                        <>
                            <span>Ocultar kits</span>
                            <ChevronUpIcon className="h-4 w-4" />
                        </>
                    ) : (
                        <>
                            <span>Mostrar kits ({kits.length})</span>
                            <ChevronDownIcon className="h-4 w-4" />
                        </>
                    )}
                </button>
            </div>

            {/* Grid dos Kits */}
            {expandido && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {kits.map((kit) => {
                        const Icone = getIconeComponent(kit.icone);
                        const recente = kitAdicionadoRecente === kit.id;

                        return (
                            <div
                                key={kit.id}
                                className="flex flex-col justify-between rounded-xl border border-line bg-surface-card p-4 shadow-sm transition-all hover:border-brand-500/40 hover:shadow-md"
                            >
                                <div>
                                    {/* Cabeçalho do Card */}
                                    <div className="flex items-start justify-between gap-2">
                                        <span
                                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getBadgeClasses(
                                                kit.badge_cor
                                            )}`}
                                        >
                                            {kit.badge}
                                        </span>

                                        <div className="text-content-muted">
                                            <Icone className="h-5 w-5" />
                                        </div>
                                    </div>

                                    {/* Título e Subtítulo */}
                                    <h3 className="mt-2 text-sm font-bold text-content-primary">
                                        {kit.nome}
                                    </h3>
                                    <p className="mt-0.5 text-[11px] leading-relaxed text-content-secondary line-clamp-2">
                                        {kit.descricao}
                                    </p>

                                    {/* Intervalo Recomendado */}
                                    <div className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-content-muted">
                                        <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                                        <span>{kit.intervalo}</span>
                                    </div>

                                    {/* Lista de Itens do Kit */}
                                    <div className="mt-3.5 space-y-2 border-t border-line/80 pt-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
                                            Itens Inclusos ({kit.total_itens})
                                        </p>

                                        <ul className="space-y-1.5 text-xs">
                                            {kit.itens.map((item, idx) => (
                                                <li
                                                    key={idx}
                                                    className="flex items-start justify-between gap-2 rounded bg-surface-sunken/60 p-1.5"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-bold text-brand-600 dark:text-brand-400">
                                                                {item.quantidade}x
                                                            </span>
                                                            <span className="truncate font-medium text-content-primary" title={item.descricao}>
                                                                {item.slot_nome}
                                                            </span>
                                                        </div>

                                                        {item.identificado ? (
                                                            <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-content-muted">
                                                                <span>SKU {item.codigo}</span>
                                                                {item.tem_estoque ? (
                                                                    <span className="inline-flex items-center gap-0.5 text-status-success-fg">
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-status-success-solid" />
                                                                        CD
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-content-muted">
                                                                        sob separação
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-status-warning-fg">
                                                                <InformationCircleIcon className="h-3 w-3" />
                                                                Triagem CD
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="shrink-0 text-right">
                                                        {item.preco_unitario != null ? (
                                                            <span className="font-semibold text-content-primary">
                                                                {Number(
                                                                    item.preco_unitario * item.quantidade
                                                                ).toLocaleString('pt-BR', {
                                                                    style: 'currency',
                                                                    currency: 'BRL',
                                                                })}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-content-muted">
                                                                —
                                                            </span>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                {/* Rodapé com Preço Total e Ação */}
                                <div className="mt-4 border-t border-line pt-3">
                                    <div className="mb-2.5 flex items-baseline justify-between">
                                        <span className="text-xs text-content-muted">Total Estimado</span>
                                        <span className="text-base font-extrabold text-content-primary">
                                            {kit.preco_total_estimado != null
                                                ? Number(kit.preco_total_estimado).toLocaleString('pt-BR', {
                                                      style: 'currency',
                                                      currency: 'BRL',
                                                  })
                                                : 'Sob consulta'}
                                        </span>
                                    </div>

                                    <Button
                                        className="w-full font-bold shadow-sm"
                                        size="sm"
                                        variant={recente ? 'success' : 'primary'}
                                        icon={recente ? CheckIcon : PlusIcon}
                                        onClick={() => handleAdicionar(kit)}
                                    >
                                        {recente
                                            ? 'Adicionado ao Pedido! ✓'
                                            : `Adicionar Kit (+${kit.total_itens} itens)`}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
