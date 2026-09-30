import { useCallback, useEffect, useState } from 'react';
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

    if (!passo) return null;

    const Icone = passo.icone || SparklesIcon;
    const progresso = Math.round(((indice + 1) / total) * 100);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={`Tour: ${titulo}`}
            className="fixed inset-0 z-[9999]"
        >
            {/*
                O véu é feito de quatro retângulos em volta do alvo, e não de um
                overlay com recorte: assim o botão continuando visível fica
                nítido, sem o serrilhado de um box-shadow gigante, e o clique no
                véu fecha o tour sem nunca clicar no botão por baixo.
            */}
            {area ? (
                <>
                    <Veu style={{ top: 0, left: 0, right: 0, height: Math.max(0, area.top - 6) }} onFechar={onFechar} />
                    <Veu style={{ top: area.top + area.height + 6, left: 0, right: 0, bottom: 0 }} onFechar={onFechar} />
                    <Veu style={{ top: Math.max(0, area.top - 6), left: 0, width: Math.max(0, area.left - 6), height: area.height + 12 }} onFechar={onFechar} />
                    <Veu style={{ top: Math.max(0, area.top - 6), left: area.left + area.width + 6, right: 0, height: area.height + 12 }} onFechar={onFechar} />

                    <div
                        aria-hidden="true"
                        className="pointer-events-none fixed rounded-xl ring-4 ring-brand-500 ring-offset-2 ring-offset-black/40 transition-all duration-300"
                        style={{
                            top: area.top - 6,
                            left: area.left - 6,
                            width: area.width + 12,
                            height: area.height + 12,
                        }}
                    />
                </>
            ) : (
                <Veu style={{ inset: 0 }} onFechar={onFechar} />
            )}

            <Cartao
                area={area}
                passo={passo}
                Icone={Icone}
                titulo={titulo}
                indice={indice}
                total={total}
                progresso={progresso}
                onVoltar={() => setIndice((i) => Math.max(0, i - 1))}
                onAvancar={avancar}
                onFechar={onFechar}
            />
        </div>
    );
}

function Veu({ style, onFechar }) {
    return (
        <div
            onClick={onFechar}
            className="fixed bg-black/70 backdrop-blur-[2px] transition-all duration-300"
            style={style}
        />
    );
}

/**
 * O cartão explicativo.
 *
 * Fica ANCORADO ABAIXO do alvo quando há espaço e acima quando não há, porque um
 * cartão fixo no rodapé cobre exatamente os botões da barra de ações — que é
 * onde mora metade do que o tour precisa explicar.
 */
function Cartao({ area, passo, Icone, titulo, indice, total, progresso, onVoltar, onAvancar, onFechar }) {
    const margem = 16;
    const alturaEstimada = 320;

    let posicao = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

    if (area) {
        const cabeAbaixo = area.top + area.height + alturaEstimada + margem < window.innerHeight;
        const centroX = area.left + area.width / 2;

        posicao = {
            top: cabeAbaixo
                ? area.top + area.height + margem
                : Math.max(margem, area.top - alturaEstimada - margem),
            left: Math.min(
                Math.max(margem + 180, centroX),
                window.innerWidth - margem - 180,
            ),
            transform: 'translateX(-50%)',
        };
    }

    return (
        <div
            className="fixed w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-surface-card shadow-2xl ring-1 ring-line"
            style={posicao}
        >
            <div className="h-1 w-full bg-surface-sunken">
                <div
                    className="h-full bg-brand-600 transition-all duration-300"
                    style={{ width: `${progresso}%` }}
                />
            </div>

            <div className="flex items-start justify-between gap-3 border-b border-line px-4 pb-3 pt-3.5">
                <div className="flex min-w-0 items-start gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <Icone className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-content-muted">
                            {titulo} · {indice + 1} de {total}
                        </p>
                        <h3 className="truncate text-sm font-black text-content-primary">
                            {passo.titulo}
                        </h3>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onFechar}
                    aria-label="Fechar tour"
                    className="shrink-0 rounded-lg p-1 text-content-muted transition hover:bg-surface-sunken hover:text-content-primary"
                >
                    <XMarkIcon className="h-4 w-4" />
                </button>
            </div>

            <div className="max-h-[45vh] space-y-3 overflow-y-auto px-4 py-3.5">
                <p className="text-sm leading-relaxed text-content-secondary">
                    {passo.descricao}
                </p>

                {passo.oQueFaz?.length > 0 && (
                    <ul className="space-y-1.5">
                        {passo.oQueFaz.map((linha, i) => (
                            <li key={i} className="flex gap-2 text-xs leading-relaxed">
                                <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success-fg" />
                                <span className="text-content-secondary">
                                    <b className="text-content-primary">{linha.nome}</b> — {linha.desc}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                {passo.atencao && (
                    <p className="rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2 text-xs font-medium leading-relaxed text-status-warning-fg">
                        {passo.atencao}
                    </p>
                )}

                {passo.dica && (
                    <p className="flex gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-xs leading-relaxed text-content-secondary">
                        <LightBulbIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning-fg" />
                        <span>{passo.dica}</span>
                    </p>
                )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-sunken/50 px-4 py-3">
                <button
                    type="button"
                    onClick={onFechar}
                    className="text-xs font-bold text-content-muted transition hover:text-content-primary"
                >
                    Sair
                </button>

                <div className="flex items-center gap-2">
                    {indice > 0 && (
                        <button
                            type="button"
                            onClick={onVoltar}
                            className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-content-secondary transition hover:bg-surface-card"
                        >
                            <ArrowLeftIcon className="h-3.5 w-3.5" /> Voltar
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onAvancar}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700"
                    >
                        {indice === total - 1 ? 'Concluir' : 'Próximo'}
                        {indice < total - 1 && <ArrowRightIcon className="h-3.5 w-3.5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
