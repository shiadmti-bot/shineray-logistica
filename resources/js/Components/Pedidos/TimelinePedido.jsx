import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { etapasDoPedido } from './etapasDoPedido';

const TOM_BADGE = {
    warning: 'bg-status-warning-bg text-status-warning-fg border border-status-warning-solid/30',
    success: 'bg-status-success-bg text-status-success-fg border border-status-success-solid/30',
    danger: 'bg-status-danger-bg text-status-danger-fg border border-status-danger-solid/30',
    info: 'bg-brand-50 text-brand-700 border border-brand-200',
};

const TOM_CARD = {
    warning: 'bg-status-warning-bg/60 border-status-warning-solid/40 text-status-warning-fg',
    success: 'bg-status-success-bg/60 border-status-success-solid/40 text-status-success-fg',
    danger: 'bg-status-danger-bg/60 border-status-danger-solid/40 text-status-danger-fg',
    info: 'bg-status-info-bg/60 border-status-info-solid/40 text-status-info-fg',
};

/** Barra de etapas do pedido e o cartão explicativo da etapa atual. */
export default function TimelinePedido({ status, isTransferencia, isEmbarqueParcial = false, isPeca = false, peca = null, pedido = null }) {
    const { steps, activeStepId, activeStepWeight, infoEtapa } = etapasDoPedido({
        status,
        isTransferencia,
        isEmbarqueParcial,
        isPeca,
        peca,
        pedido,
    });

    const cancelado = status === 'cancelado';
    const concluido = status === 'concluido';

    const activeIndex = cancelado ? -1 : concluido ? steps.length - 1 : Math.max(0, steps.findIndex((s) => s.id === activeStepId));
    const percentConcluido = cancelado ? 0 : concluido ? 100 : Math.round((activeIndex / (steps.length - 1)) * 100);
    const seteEtapas = steps.length === 7;

    return (
        <div className="bg-surface-card rounded-2xl border border-line p-5 md:p-6 shadow-sm space-y-6">
            {/* Cabeçalho do progresso */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-4">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-brand-50 text-brand-700">
                        <ClockIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-content-primary tracking-tight">
                            Progresso do Pedido {isPeca ? 'de Peças' : isTransferencia ? 'de Transferência' : 'de Motos'}
                        </h3>
                        <p className="text-xs text-content-muted">
                            Acompanhe cada fase desde a solicitação inicial até a entrada no estoque da filial
                        </p>
                    </div>
                </div>

                {infoEtapa && (
                    <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider self-start sm:self-auto ${
                            TOM_BADGE[infoEtapa.tom] ?? TOM_BADGE.info
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                        {infoEtapa.badge}
                    </span>
                )}
            </div>

            {/* Barra de etapas */}
            <div className="relative pt-2 pb-3">
                <div className={`hidden ${seteEtapas ? 'lg:block' : 'md:block'} absolute left-8 right-8 top-[28px] h-1.5 bg-line rounded-full -z-0`}></div>
                {!cancelado && (
                    <div
                        className={`hidden ${seteEtapas ? 'lg:block' : 'md:block'} absolute left-8 top-[28px] h-1.5 bg-status-success-solid rounded-full transition-all duration-700 ease-out z-0`}
                        style={{ width: `calc(${Math.min(percentConcluido, 100)}% - 20px)` }}
                    ></div>
                )}

                <ol
                    className={`grid grid-cols-2 sm:grid-cols-3 ${seteEtapas ? 'md:grid-cols-4 lg:grid-cols-7' : 'md:grid-cols-6'} gap-3 md:gap-2 relative z-10`}
                >
                    {steps.map((step) => {
                        const feita = !cancelado && (concluido || step.weight < activeStepWeight);
                        const atual = !cancelado && !concluido && step.id === activeStepId;
                        const StepIcon = step.icon;

                        return (
                            <li
                                key={step.id}
                                aria-current={atual ? 'step' : undefined}
                                className={`flex flex-col items-center text-center p-2 rounded-xl transition-all ${
                                    atual ? 'bg-brand-50/60 ring-2 ring-brand-600/20' : ''
                                }`}
                            >
                                <div
                                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs shadow-sm transition-all duration-300 ${
                                        feita
                                            ? 'bg-status-success-solid text-white'
                                            : atual
                                              ? 'bg-brand-600 text-white shadow-md ring-4 ring-brand-600/20 scale-105'
                                              : 'bg-surface-card border-2 border-line text-content-muted'
                                    }`}
                                >
                                    {feita ? <CheckCircleIcon className="w-6 h-6" /> : <StepIcon className="w-5 h-5" />}
                                </div>

                                <div className="mt-2 space-y-0.5 w-full">
                                    <p
                                        className={`text-xs font-black tracking-tight leading-tight truncate ${
                                            atual ? 'text-brand-700' : feita ? 'text-content-primary' : 'text-content-muted'
                                        }`}
                                    >
                                        {step.label}
                                    </p>
                                    {step.sub && (
                                        <p className="text-[10px] font-bold text-content-muted uppercase tracking-wider truncate">
                                            {step.sub}
                                        </p>
                                    )}
                                    <span
                                        className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded truncate max-w-full ${
                                            atual ? 'bg-brand-100 text-brand-800' : 'bg-surface-sunken text-content-secondary'
                                        }`}
                                    >
                                        {step.ator}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </div>

            {/* Cartão explicativo da etapa atual */}
            {infoEtapa && (
                <div
                    className={`p-4 md:p-5 rounded-xl border flex flex-col sm:flex-row items-start gap-4 transition-all ${
                        TOM_CARD[infoEtapa.tom] ?? TOM_CARD.info
                    }`}
                >
                    <div className="p-2.5 rounded-xl bg-surface-card shrink-0 shadow-sm border border-line">
                        <ClockIcon className="w-6 h-6 text-content-primary" />
                    </div>

                    <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm md:text-base font-black text-content-primary flex items-center gap-2">
                                <span>📍</span>
                                <span>Etapa Atual: {infoEtapa.titulo}</span>
                            </h4>
                            <span className="text-xs font-bold text-content-secondary bg-surface-card px-2.5 py-1 rounded-lg border border-line shadow-2xs">
                                Responsável: <strong className="text-content-primary">{infoEtapa.ator}</strong>
                            </span>
                        </div>

                        <p className="text-xs md:text-sm text-content-secondary leading-relaxed">{infoEtapa.descricao}</p>

                        <div className="flex items-start gap-2 pt-1 text-xs font-medium text-content-primary">
                            <span className="font-bold shrink-0">⚡ Próximo passo:</span>
                            <span className="text-content-secondary">{infoEtapa.proximo}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
