/**
 * Abas de navegação dentro de uma tela.
 *
 * Usado hoje no estoque (Disponíveis / Desmontadas / Paradas) e necessário nas
 * telas novas (Motos / Peças). Controlado pelo pai — não guarda estado próprio,
 * para que a aba ativa possa vir da URL e sobreviver a um refresh.
 *
 * Acessibilidade (WAI-ARIA, ativação manual): container role="tablist", cada
 * botão role="tab" com aria-selected. Setas, Home e End só movem o foco; Enter
 * ou Espaço ativam. Ativação automática não serve aqui: em várias telas trocar
 * de aba é uma visita ao servidor (router.get), e cada seta viraria requisição.
 *
 * Sem aria-controls: as abas filtram o conteúdo abaixo, não alternam painéis
 * com id próprio — apontar para um id inexistente é pior que omitir.
 *
 * @param {Array<{key:string, label:string, count?:number, icon?:Function}>} tabs
 * @param {string} [label] nome do grupo para leitores de tela
 */
import { useId, useRef, useCallback } from 'react';

export default function Tabs({ tabs = [], active, onChange, className = '', label = 'Abas' }) {
    const baseId = useId();
    const tabRefs = useRef([]);

    const handleKeyDown = useCallback(
        (e, index) => {
            let next;
            if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
            else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
            else if (e.key === 'Home') next = 0;
            else if (e.key === 'End') next = tabs.length - 1;
            else return;

            e.preventDefault();
            tabRefs.current[next]?.focus();
        },
        [tabs.length],
    );

    return (
        <div className={`border-b border-line ${className}`}>
            <nav
                className="-mb-px flex gap-1 overflow-x-auto scrollbar-slim"
                role="tablist"
                aria-label={label}
            >
                {tabs.map((tab, index) => {
                    const ativa = tab.key === active;
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.key}
                            ref={(el) => (tabRefs.current[index] = el)}
                            id={`${baseId}-tab-${tab.key}`}
                            type="button"
                            role="tab"
                            aria-selected={ativa}
                            tabIndex={ativa ? 0 : -1}
                            onClick={() => onChange?.(tab.key)}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5
                                text-sm font-semibold transition
                                ${
                                    ativa
                                        ? 'border-brand-600 text-brand-700'
                                        : 'border-transparent text-content-secondary hover:border-line-strong hover:text-content-primary'
                                }`}
                        >
                            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
                            {tab.label}

                            {tab.count !== undefined && (
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums
                                        ${ativa ? 'bg-brand-50 text-brand-700' : 'bg-surface-sunken text-content-secondary'}`}
                                    aria-label={`${tab.count} itens`}
                                >
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
