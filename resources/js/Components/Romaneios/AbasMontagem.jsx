import {
    ArrowPathIcon,
    ClipboardDocumentCheckIcon,
    QrCodeIcon,
    TruckIcon,
    WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

const ATIVA_PADRAO = 'border-brand-600 text-brand-700 bg-brand-50/50';
const CONTADOR_NEUTRO = 'bg-surface-sunken text-content-secondary';

/**
 * Cada aba sabe a própria cor: coleta é tom de alerta; o contador de chassis
 * pendentes fica vermelho quando há algo a bipar e o da composição fica verde
 * quando a carga tem item.
 */
const ABAS = [
    {
        chave: 'expedicao',
        rotulo: 'Motos CD (Saída)',
        icone: TruckIcon,
        contador: (ativa) => (ativa ? 'bg-brand-100 text-brand-800' : CONTADOR_NEUTRO),
    },
    {
        chave: 'pecas',
        rotulo: 'Peças (Basquetas)',
        icone: WrenchScrewdriverIcon,
        contador: (ativa) => (ativa ? 'bg-brand-100 text-brand-800' : CONTADOR_NEUTRO),
    },
    {
        chave: 'coleta',
        rotulo: 'Coletas (Milk Run)',
        icone: ArrowPathIcon,
        ativa: 'border-status-warning-solid text-status-warning-fg bg-status-warning-bg/40',
        contador: (ativa) => (ativa ? 'bg-status-warning-bg text-status-warning-fg' : CONTADOR_NEUTRO),
    },
    {
        chave: 'chassi',
        rotulo: 'Bipar Chassi',
        icone: QrCodeIcon,
        contador: (_ativa, total) => (total > 0 ? 'bg-status-danger-bg text-status-danger-fg' : CONTADOR_NEUTRO),
    },
    {
        chave: 'composicao',
        rotulo: 'Composição da Carga',
        icone: ClipboardDocumentCheckIcon,
        contador: (_ativa, total) => (total > 0 ? 'bg-status-success-bg text-status-success-fg' : CONTADOR_NEUTRO),
    },
];

export default function AbasMontagem({ ativa, onMudar, contagens }) {
    return (
        <div className="border-b border-line">
            <nav role="tablist" aria-label="Abas de Montagem" className="-mb-px flex space-x-2 overflow-x-auto scrollbar-slim">
                {ABAS.map((aba) => {
                    const selecionada = ativa === aba.chave;
                    const total = contagens[aba.chave] ?? 0;
                    const Icone = aba.icone;

                    return (
                        <button
                            key={aba.chave}
                            type="button"
                            role="tab"
                            aria-selected={selecionada}
                            onClick={() => onMudar(aba.chave)}
                            className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition ${
                                selecionada
                                    ? aba.ativa ?? ATIVA_PADRAO
                                    : 'border-transparent text-content-secondary hover:border-line-strong hover:text-content-primary'
                            }`}
                        >
                            <Icone className="h-4 w-4" />
                            {aba.rotulo}
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${aba.contador(selecionada, total)}`}>
                                {total}
                            </span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
