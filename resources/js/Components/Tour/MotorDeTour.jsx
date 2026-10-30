import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    CheckCircleIcon,
    LightBulbIcon,
    SparklesIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

/**
 * O motor do tour: holofote, posicionamento e navegação entre passos.
 *
 * SÓ MECÂNICA, NENHUM CONTEÚDO. Os passos entram como dado (ver
 * Components/Tour/passos.js), e é isso que permite existir um tour por módulo
 * sem duplicar o holofote quatro vezes. Antes da v3.7 havia um único componente
 * de 710 linhas com os passos escritos dentro dele, todos apontando para a
 * BARRA DE NAVEGAÇÃO — ou seja, o tour explicava onde ficam os menus e nunca o
 * que cada botão dentro do módulo faz.
 *
 * PASSO SEM ALVO NA TELA NÃO É ERRO. Um botão pode não existir para aquele
 * perfil, ou depender do estado do pedido. Quando o seletor não casa, o passo
 * vira um cartão centralizado em vez de um holofote perdido no canto — e um
 * passo marcado `exigeAlvo` é PULADO, porque explicar um botão que a pessoa não
 * tem na tela é pior do que não explicar.
 */
/**
 * O primeiro elemento do seletor que está REALMENTE na tela.
 *
 * Quase toda tela do sistema tem o mesmo conteúdo duas vezes — um bloco
 * `hidden md:grid` para desktop e outro `md:hidden` para celular — e as duas
 * cópias carregam a mesma âncora. `querySelector` devolveria sempre a primeira
 * em ordem de documento, que no celular é a versão oculta; um elemento com
 * `display:none` mede 0x0, e o holofote sairia como um quadrado de nada no
 * canto superior esquerdo. Medir e escolher o que tem área resolve os dois
 * layouts sem precisar de seletor diferente por tamanho de tela.
 */
function alvoVisivel(seletor) {
    for (const el of document.querySelectorAll(seletor)) {
        const r = el.getBoundingClientRect();

        if (r.width > 0 && r.height > 0) {
            return el;
        }
    }

    return null;
}

export default function MotorDeTour({ titulo, passos = [], onFechar, onConcluir }) {
    const [indice, setIndice] = useState(0);
    const [area, setArea] = useState(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Passos cujo alvo é obrigatório e não está na tela saem da lista: a
    // numeração ("3 de 7") tem de bater com o que a pessoa realmente vai ver.
    const [visiveis, setVisiveis] = useState(passos);

    useEffect(() => {
        setVisiveis(passos.filter((passo) => !passo.exigeAlvo || !passo.alvo || alvoVisivel(passo.alvo)));
        setIndice(0);
    }, [passos]);

    const passo = visiveis[indice];
    const total = visiveis.length;

    const recalcular = useCallback(() => {
        const el = passo?.alvo ? alvoVisivel(passo.alvo) : null;

        if (!el) {
            setArea(null);
            return;
        }

        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

        const r = el.getBoundingClientRect();
        setArea({ top: r.top, left: r.left, width: r.width, height: r.height });
    }, [passo]);

    useEffect(() => {
        // O scrollIntoView acima é suave: medir na hora pegaria a posição antiga.
        const t = setTimeout(recalcular, 220);

        window.addEventListener('resize', recalcular);
        window.addEventListener('scroll', recalcular, true);

        return () => {
            clearTimeout(t);
            window.removeEventListener('resize', recalcular);
            window.removeEventListener('scroll', recalcular, true);
        };
    }, [recalcular]);

    const avancar = () => {
        if (indice < total - 1) {
            setIndice((i) => i + 1);
            return;
        }

        onConcluir?.();
        onFechar?.();
    };

    // Setas e Esc: quem está aprendendo a tela costuma estar com a mão no
    // teclado. Sem lista de dependências de propósito — o handler precisa ver o
    // `indice` desta renderização, e não o da primeira.
    useEffect(() => {
        const aoTeclar = (e) => {
            if (e.key === 'Escape') onFechar?.();
            if (e.key === 'ArrowRight') avancar();
            if (e.key === 'ArrowLeft') setIndice((i) => Math.max(0, i - 1));
        };

        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    });

    if (!passo || !mounted) return null;

    const Icone = passo.icone || SparklesIcon;
    const progresso = Math.round(((indice + 1) / total) * 100);

    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
    const isMobile = viewportWidth < 640;
    const CARD_WIDTH = isMobile ? viewportWidth - 32 : Math.min(460, viewportWidth - 32);

    let cardLeft = '50%';
    let cardTop = '50%';
    let cardTransform = 'translate(-50%, -50%)';
    let arrowLeft = '50%';
    let showArrow = false;
    let arrowPos = 'top';

    if (area) {
        showArrow = true;
        const targetCenter = area.left + (area.width / 2);

        if (isMobile) {
            // Mobile: posiciona em faixa flutuante segura evitando cobrir o elemento alvo
            const alvoNaMetadeSuperior = area.top < (viewportHeight / 2);
            cardLeft = '16px';
            cardTransform = 'none';

            if (alvoNaMetadeSuperior) {
                const idealTop = Math.max(area.top + area.height + 14, viewportHeight / 2 - 40);
                cardTop = `${Math.min(idealTop, viewportHeight - 340)}px`;
                arrowPos = 'top';
            } else {
                cardTop = '16px';
                arrowPos = 'bottom';
            }
            arrowLeft = `${Math.max(24, Math.min(targetCenter - 16, CARD_WIDTH - 24))}px`;
        } else {
            // Desktop: centralização matemática com clamp sobre o elemento
            const idealLeft = targetCenter - (CARD_WIDTH / 2);
            const clampedLeft = Math.max(16, Math.min(idealLeft, viewportWidth - CARD_WIDTH - 16));
            cardLeft = `${clampedLeft}px`;
            cardTransform = 'none';

            const espacoAbaixo = viewportHeight - (area.top + area.height);
            if (espacoAbaixo >= 320) {
                cardTop = `${Math.min(area.top + area.height + 14, viewportHeight - 340)}px`;
                arrowPos = 'top';
            } else {
                cardTop = `${Math.max(16, area.top - 360)}px`;
                arrowPos = 'bottom';
            }

            const relArrow = targetCenter - clampedLeft;
            arrowLeft = `${Math.max(24, Math.min(relArrow, CARD_WIDTH - 24))}px`;
        }
    }

    const modalContent = (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={`Tour: ${titulo}`}
            className="fixed inset-0 select-none overflow-hidden"
            style={{ zIndex: 99999 }}
        >
            {/* Backdrop escurecido com recorte cirúrgico (SVG Mask) - 100% de nitidez sobre o elemento alvo */}
            <svg
                className="fixed inset-0 w-full h-full cursor-pointer transition-all duration-300"
                style={{ zIndex: 99997 }}
                onClick={onFechar}
            >
                <defs>
                    <mask id="modulo-tour-spotlight-mask">
                        {/* Fundo branco = visível */}
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        
                        {/* Recorte preto = 100% transparente sobre o alvo */}
                        {area && (
                            <rect
                                x={area.left - 6}
                                y={area.top - 6}
                                width={area.width + 12}
                                height={area.height + 12}
                                rx="12"
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="rgba(11, 26, 43, 0.82)"
                    mask="url(#modulo-tour-spotlight-mask)"
                />
            </svg>

            {/* Moldura de destaque com anel pulsante */}
            {area && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none fixed rounded-xl transition-all duration-300"
                    style={{
                        top: `${area.top - 6}px`,
                        left: `${area.left - 6}px`,
                        width: `${area.width + 12}px`,
                        height: `${area.height + 12}px`,
                        zIndex: 99998,
                    }}
                >
                    <div className="absolute inset-0 rounded-xl ring-2 ring-brand-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]" />
                </div>
            )}

            {/* Botão Fechar Rápido Fixo no Topo Direito */}
            <button
                type="button"
                onClick={onFechar}
                className="fixed top-4 right-4 px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold backdrop-blur-md shadow-lg transition cursor-pointer"
                style={{ zIndex: 100000 }}
            >
                Fechar Ajuda ✕
            </button>

            {/* Cartão Explicativo Responsivo com Bico / Ponteiro */}
            <div
                className="fixed transition-all duration-300 p-2 sm:p-0"
                style={{
                    top: cardTop,
                    left: cardLeft,
                    transform: cardTransform,
                    width: `${CARD_WIDTH}px`,
                    zIndex: 99999,
                }}
            >
                <div className="relative overflow-hidden rounded-3xl bg-surface-card border border-line shadow-2xl shadow-black/60">
                    {/* Bico apontador conectado ao alvo */}
                    {showArrow && arrowPos === 'top' && (
                        <div
                            className="absolute -top-2 w-4 h-4 bg-surface-card border-t border-l border-line rotate-45"
                            style={{ left: arrowLeft, transform: 'translateX(-50%) rotate(45deg)' }}
                        />
                    )}
                    {showArrow && arrowPos === 'bottom' && (
                        <div
                            className="absolute -bottom-2 w-4 h-4 bg-surface-card border-b border-r border-line rotate-45"
                            style={{ left: arrowLeft, transform: 'translateX(-50%) rotate(45deg)' }}
                        />
                    )}

                    {/* Barra de Progresso em Degradê */}
                    <div className="h-1.5 w-full bg-surface-sunken">
                        <div
                            className="h-full bg-gradient-to-r from-brand-600 to-brand-500 transition-all duration-300"
                            style={{ width: `${progresso}%` }}
                        />
                    </div>

                    {/* Cabeçalho */}
                    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 shadow-xs">
                                <Icone className="h-5 w-5 text-brand-600" />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-widest text-brand-600">
                                    {titulo} · Passo {indice + 1} de {total}
                                </span>
                                <h3 className="text-base font-black text-content-primary leading-tight mt-0.5">
                                    {passo.titulo}
                                </h3>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onFechar}
                            aria-label="Fechar tour"
                            className="rounded-lg p-1.5 text-content-muted hover:bg-surface-sunken hover:text-content-primary transition cursor-pointer"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Conteúdo com rolagem contida */}
                    <div className="max-h-[min(480px,calc(100vh-160px))] space-y-4 overflow-y-auto px-5 py-4 scrollbar-slim">
                        <p className="text-sm leading-relaxed text-content-secondary font-medium">
                            {passo.descricao}
                        </p>

                        {passo.oQueFaz?.length > 0 && (
                            <div className="bg-surface-sunken/60 p-3.5 rounded-2xl border border-line space-y-2">
                                <p className="text-xs font-black text-content-primary flex items-center gap-1.5 uppercase tracking-wide">
                                    <span>⚙️</span> O que você faz neste passo:
                                </p>
                                <ul className="space-y-1.5">
                                    {passo.oQueFaz.map((linha, i) => (
                                        <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                                            <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-status-success-fg" />
                                            <span className="text-content-secondary">
                                                <strong className="text-content-primary">{linha.nome}:</strong> {linha.desc}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {passo.atencao && (
                            <div className="rounded-2xl border border-status-warning-border bg-status-warning-bg/60 p-3.5 flex items-start gap-2.5">
                                <span className="text-base shrink-0">⚠️</span>
                                <p className="text-xs font-semibold leading-relaxed text-status-warning-fg">
                                    {passo.atencao}
                                </p>
                            </div>
                        )}

                        {passo.dica && (
                            <div className="rounded-2xl bg-brand-50/70 border border-brand-200 p-3.5 flex items-start gap-2.5">
                                <LightBulbIcon className="h-5 w-5 shrink-0 text-brand-600 mt-0.5" />
                                <div className="text-xs text-brand-950 font-medium leading-relaxed">
                                    <strong className="text-brand-700">Dica:</strong> {passo.dica}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Rodapé com Ações */}
                    <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-sunken/40 px-5 py-3.5">
                        <button
                            type="button"
                            onClick={onFechar}
                            className="text-xs font-bold text-content-muted hover:text-content-primary transition cursor-pointer"
                        >
                            Sair
                        </button>

                        <div className="flex items-center gap-2">
                            {indice > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setIndice((i) => Math.max(0, i - 1))}
                                    className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface-card px-3.5 py-2 text-xs font-bold text-content-secondary hover:text-content-primary hover:bg-surface-sunken transition cursor-pointer"
                                >
                                    <ArrowLeftIcon className="h-3.5 w-3.5" /> Voltar
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={avancar}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-xs font-black shadow-md hover:shadow-brand-600/30 active:scale-95 transition cursor-pointer"
                            >
                                <span>{indice === total - 1 ? 'Concluir' : 'Próximo'}</span>
                                {indice < total - 1 ? (
                                    <ArrowRightIcon className="h-3.5 w-3.5" />
                                ) : (
                                    <CheckCircleIcon className="h-3.5 w-3.5" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
