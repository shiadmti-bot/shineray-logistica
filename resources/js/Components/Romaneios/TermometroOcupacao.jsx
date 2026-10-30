import { useMemo } from 'react';
import {
    ExclamationTriangleIcon,
    ShieldCheckIcon,
    TruckIcon,
} from '@heroicons/react/24/outline';
import { calcularOcupacaoCarga, PRESETS_VEICULOS } from '@/Lib/veiculos';

/**
 * Termômetro Visual de Ocupação da Carga da Mesa de Romaneios.
 *
 * Exibe a ocupação percentual e física do veículo considerando a equivalência de volume
 * (1 moto = 1 unidade; cada 2 basquetas = 1 unidade de moto).
 * Alerta em âmbar quando a carga atinge > 90% e vermelho pulsante com aviso de sobrecarga (> 100%).
 */
export default function TermometroOcupacao({
    motos = 0,
    basquetas = 0,
    capacidade = 16,
    tipoVeiculo = '3_4',
    nomeVeiculo = null,
    variante = 'padrao', // 'padrao' | 'cabecalho' | 'barra_fixa' | 'compacto'
    className = '',
}) {
    const ocupacao = useMemo(
        () => calcularOcupacaoCarga(motos, basquetas, capacidade),
        [motos, basquetas, capacidade]
    );

    const preset = useMemo(
        () => PRESETS_VEICULOS.find((p) => p.id === tipoVeiculo),
        [tipoVeiculo]
    );

    const nomeDoVeiculo = nomeVeiculo || preset?.nome || 'Veículo';
    const iconeDoVeiculo = preset?.icone || '🚚';

    // Barra limitada a 100% visualmente (o excesso é indicado no texto e no alerta)
    const larguraBarra = Math.min(100, ocupacao.percentual);

    // Cores e estilos de acordo com o status (verde <= 90%, âmbar > 90%, vermelho > 100%)
    const cores = {
        verde: {
            barra: 'bg-gradient-to-r from-emerald-500 to-teal-400',
            trilho: 'bg-emerald-950/20',
            badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300',
            textoDestaque: 'text-emerald-600 dark:text-emerald-400',
            borda: 'border-emerald-500/30',
        },
        ambar: {
            barra: 'bg-gradient-to-r from-amber-500 to-amber-600',
            trilho: 'bg-amber-950/20',
            badgeBg: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300',
            textoDestaque: 'text-amber-600 dark:text-amber-400',
            borda: 'border-amber-500/40',
        },
        vermelho: {
            barra: 'bg-gradient-to-r from-red-600 to-rose-600 animate-pulse',
            trilho: 'bg-red-950/30',
            badgeBg: 'bg-red-100 text-red-900 border-red-400 animate-pulse dark:bg-red-900/40 dark:text-red-200',
            textoDestaque: 'text-red-600 dark:text-red-400 font-black',
            borda: 'border-red-500/60 shadow-red-500/20 shadow-md',
        },
    }[ocupacao.status];

    // VARIANTE: BARRA FIXA DO RODAPÉ (BarraResumoCarga)
    if (variante === 'barra_fixa') {
        return (
            <div className={`flex flex-col gap-1.5 min-w-[240px] max-w-sm ${className}`}>
                <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-bold text-white/90">
                        <span aria-hidden="true">{iconeDoVeiculo}</span>
                        <span>{nomeDoVeiculo}</span>
                        <span className="text-white/50 text-[11px]">({ocupacao.capacidade} motos)</span>
                    </span>
                    <span
                        className={`text-xs font-black ${
                            ocupacao.status === 'vermelho'
                                ? 'text-rose-400'
                                : ocupacao.status === 'ambar'
                                ? 'text-amber-300'
                                : 'text-emerald-400'
                        }`}
                    >
                        {ocupacao.totalFormatado} / {ocupacao.capacidade} motos ({ocupacao.percentual}%)
                    </span>
                </div>

                {/* Barra de Progresso com Transição Animada */}
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${cores.barra}`}
                        style={{ width: `${larguraBarra}%` }}
                    />
                </div>

                {/* Linha de status auxiliar */}
                <div className="flex items-center justify-between text-[10px] text-white/60">
                    <span>
                        {ocupacao.motos} moto(s) + {ocupacao.basquetas} basq. ({ocupacao.volumeBasquetas} eq.)
                    </span>
                    {ocupacao.sobrecarga ? (
                        <span className="font-extrabold text-rose-400 flex items-center gap-0.5">
                            <ExclamationTriangleIcon className="h-3 w-3" />
                            Sobrecarga: +{ocupacao.excessoFormatado} moto(s)
                        </span>
                    ) : (
                        <span className="text-white/60">
                            Livre: {ocupacao.disponivelFormatado} moto(s)
                        </span>
                    )}
                </div>
            </div>
        );
    }

    // VARIANTE: CABEÇALHO / BANNER DESTACADO (Topo da Mesa de Romaneios)
    if (variante === 'cabecalho') {
        return (
            <div
                className={`rounded-xl border p-4 sm:p-5 transition-all bg-surface-card ${cores.borda} ${className}`}
            >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl shadow-xs ring-1 ring-brand-500/20">
                            {iconeDoVeiculo}
                        </span>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-black text-content-primary">
                                    Termômetro de Ocupação da Carga
                                </h3>
                                <span className="rounded-md bg-surface-sunken px-2 py-0.5 text-xs font-bold text-content-secondary ring-1 ring-line">
                                    {nomeDoVeiculo} ({ocupacao.capacidade} motos)
                                </span>
                                {ocupacao.sobrecarga && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-0.5 text-xs font-black uppercase text-white shadow-xs">
                                        <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                                        Sobrecarga (+{ocupacao.excessoFormatado} moto(s))
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-xs text-content-secondary">
                                Equivalência física: <strong>1 moto = 1 unidade</strong> · <strong>cada 2 basquetas = 1 moto eq.</strong>
                            </p>
                        </div>
                    </div>

                    <div className="text-right flex flex-col sm:items-end">
                        <div className="flex items-baseline gap-1.5 sm:justify-end">
                            <span className="text-2xl font-black text-content-primary">
                                {ocupacao.totalFormatado}
                            </span>
                            <span className="text-sm font-bold text-content-muted">
                                / {ocupacao.capacidade} motos
                            </span>
                            <span
                                className={`ml-1.5 rounded-full px-2.5 py-0.5 text-xs font-extrabold border ${cores.badgeBg}`}
                            >
                                {ocupacao.percentual}% ocupado
                            </span>
                        </div>
                        <span className="text-[11px] text-content-muted mt-0.5">
                            {ocupacao.motos} moto(s) + {ocupacao.basquetas} basqueta(s) ({ocupacao.volumeBasquetas} moto eq.)
                        </span>
                    </div>
                </div>

                {/* Barra de Progresso com Marcas Visuais */}
                <div className="mt-4">
                    <div className="relative h-4 w-full overflow-hidden rounded-full bg-surface-sunken ring-1 ring-line shadow-inner">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${cores.barra}`}
                            style={{ width: `${larguraBarra}%` }}
                        />
                        {/* Linha indicadora de 90% da capacidade */}
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-amber-600/60 z-10"
                            style={{ left: '90%' }}
                            title="Alerta de 90% da capacidade"
                        />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-content-muted">
                        <span className="flex items-center gap-1">
                            <ShieldCheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                            {ocupacao.sobrecarga ? (
                                <strong className="text-red-600">Limite excedido! Reduza itens da carga.</strong>
                            ) : (
                                <span>Espaço livre: <strong>{ocupacao.disponivelFormatado} moto(s)</strong></span>
                            )}
                        </span>
                        <span className="text-[10px]">
                            Capacidade Total: <strong>{ocupacao.capacidade} motos</strong>
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // VARIANTE: COMPACTO (Para Cards de Lista ou Menus Laterais)
    if (variante === 'compacto') {
        return (
            <div className={`space-y-1 ${className}`}>
                <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-content-secondary flex items-center gap-1">
                        <span>{iconeDoVeiculo}</span>
                        <span>Ocupação ({ocupacao.capacidade} motos):</span>
                    </span>
                    <span className={`font-bold ${cores.textoDestaque}`}>
                        {ocupacao.totalFormatado} / {ocupacao.capacidade} ({ocupacao.percentual}%)
                    </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken ring-1 ring-line">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${cores.barra}`}
                        style={{ width: `${larguraBarra}%` }}
                    />
                </div>
            </div>
        );
    }

    // VARIANTE: PADRÃO
    return (
        <div className={`rounded-xl border border-line bg-surface-card p-4 shadow-xs ${className}`}>
            <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                    <TruckIcon className="h-5 w-5 text-brand-600" />
                    <span className="text-sm font-extrabold text-content-primary">
                        Ocupação do {nomeDoVeiculo}
                    </span>
                </div>
                <span className={`text-xs font-black ${cores.textoDestaque}`}>
                    {ocupacao.totalFormatado} / {ocupacao.capacidade} motos ({ocupacao.percentual}%)
                </span>
            </div>

            <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-sunken ring-1 ring-line">
                <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${cores.barra}`}
                    style={{ width: `${larguraBarra}%` }}
                />
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-content-secondary">
                <span>
                    {ocupacao.motos} moto(s) · {ocupacao.basquetas} basqueta(s)
                </span>
                {ocupacao.sobrecarga ? (
                    <span className="font-bold text-red-600 flex items-center gap-1">
                        <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                        Sobrecarga: +{ocupacao.excessoFormatado} moto(s)
                    </span>
                ) : (
                    <span>Livre: {ocupacao.disponivelFormatado} moto(s)</span>
                )}
            </div>
        </div>
    );
}
