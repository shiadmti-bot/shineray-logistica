/**
 * Abas de navegação dentro de uma tela.
 *
 * Usado hoje no estoque (Disponíveis / Desmontadas / Paradas) e necessário nas
 * telas novas (Motos / Peças). Controlado pelo pai — não guarda estado próprio,
 * para que a aba ativa possa vir da URL e sobreviver a um refresh.
 *
 * @param {Array<{key:string, label:string, count?:number, icon?:Function}>} tabs
 */
export default function Tabs({ tabs = [], active, onChange, className = '' }) {
    return (
        <div className={`border-b border-line ${className}`}>
            <nav className="-mb-px flex gap-1 overflow-x-auto scrollbar-slim" aria-label="Abas">
                {tabs.map((tab) => {
                    const ativa = tab.key === active;
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => onChange?.(tab.key)}
                            aria-current={ativa ? 'page' : undefined}
                            className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5
                                text-sm font-semibold transition
                                ${
                                    ativa
                                        ? 'border-brand-600 text-brand-700'
                                        : 'border-transparent text-content-secondary hover:border-line-strong hover:text-content-primary'
                                }`}
                        >
                            {Icon && <Icon className="h-4 w-4" />}
                            {tab.label}

                            {tab.count !== undefined && (
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums
                                        ${ativa ? 'bg-brand-50 text-brand-700' : 'bg-surface-sunken text-content-secondary'}`}
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
