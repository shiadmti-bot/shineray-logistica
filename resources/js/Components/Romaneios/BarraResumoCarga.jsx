import TermometroOcupacao from './TermometroOcupacao';

function Indicador({ rotulo, valor, unidade, className = 'flex' }) {
    return (
        <div className={`${className} flex-col`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">{rotulo}</span>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black leading-none text-white">{valor}</span>
                <span className="text-xs font-semibold text-white/50">{unidade}</span>
            </div>
        </div>
    );
}

/** Barra fixa da mesa de embarque: o que já está no caminhão, o termômetro de ocupação e o botão de gerar carga. */
export default function BarraResumoCarga({
    resumo,
    processando,
    romaneioId,
    capacidadeVeiculo = 16,
    tipoVeiculo = '3_4',
    onVerComposicao,
}) {
    const capacidadeFinal = resumo.capacidade || capacidadeVeiculo || 16;
    const tipoFinal = resumo.tipoVeiculo || tipoVeiculo || '3_4';

    return (
        <div className="fixed bottom-0 left-0 z-topbar w-full border-t border-white/10 bg-surface-inverted p-3 sm:p-4 text-content-inverted shadow-2xl safe-area-bottom">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 md:flex-row">
                <div className="flex w-full items-center justify-between gap-4 md:w-auto md:justify-start">
                    <div className="flex items-center gap-4 sm:gap-6" aria-live="polite">
                        <Indicador rotulo="Motos" valor={resumo.motos} unidade="un" />
                        <Indicador rotulo="Peças (Basquetas)" valor={resumo.basquetas} unidade={`cx (${resumo.pecasUn} un)`} />
                        <Indicador rotulo="Destinos" valor={resumo.destinos} unidade="parada(s)" className="hidden md:flex" />
                    </div>

                    <div className="hidden h-10 w-px bg-white/20 lg:block" />

                    {/* Termômetro de Ocupação da Carga Animado */}
                    <TermometroOcupacao
                        motos={resumo.motos}
                        basquetas={resumo.basquetas}
                        capacidade={capacidadeFinal}
                        tipoVeiculo={tipoFinal}
                        variante="barra_fixa"
                        className="hidden md:flex"
                    />

                    <button
                        type="button"
                        onClick={onVerComposicao}
                        className="hidden text-xs font-bold text-white/80 underline transition hover:text-white xl:block whitespace-nowrap"
                    >
                        Ver Composição ↗
                    </button>
                </div>

                {/* Termômetro visível em telas pequenas / mobile */}
                <div className="w-full md:hidden">
                    <TermometroOcupacao
                        motos={resumo.motos}
                        basquetas={resumo.basquetas}
                        capacidade={capacidadeFinal}
                        tipoVeiculo={tipoFinal}
                        variante="barra_fixa"
                        className="w-full"
                    />
                </div>

                <div className="flex w-full items-center justify-end gap-3 md:w-auto">
                    <button
                        type="submit"
                        disabled={processando || resumo.total === 0}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 sm:px-8 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40 md:w-auto ${
                            processando ? 'animate-pulse' : ''
                        }`}
                    >
                        {processando ? (
                            <>
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                                Salvando Manifesto...
                            </>
                        ) : (
                            <>
                                <span aria-hidden="true">🚀</span>
                                {romaneioId ? `Adicionar à Carga #${romaneioId}` : `Gerar Carga (${resumo.total} itens)`}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
