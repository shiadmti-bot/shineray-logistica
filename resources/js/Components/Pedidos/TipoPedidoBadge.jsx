import { ArrowsRightLeftIcon, BuildingOffice2Icon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';

export default function TipoPedidoBadge({ isTransferencia, isPeca = false }) {
    if (isPeca) {
        return (
            <span className="text-[10px] bg-brand-50 text-brand-700 px-2 py-1 rounded border border-brand-200 font-bold uppercase tracking-wide flex items-center gap-1">
                <WrenchScrewdriverIcon className="w-3 h-3" /> Peças · Reposição CD
            </span>
        );
    }

    return isTransferencia ? (
        <span className="text-[10px] bg-status-warning-bg text-status-warning-fg px-2 py-1 rounded border border-status-warning-solid/20 font-bold uppercase tracking-wide flex items-center gap-1">
            <ArrowsRightLeftIcon className="w-3 h-3" /> Transferência
        </span>
    ) : (
        <span className="text-[10px] bg-status-info-bg text-status-info-fg px-2 py-1 rounded border border-status-info-solid/20 font-bold uppercase tracking-wide flex items-center gap-1">
            <BuildingOffice2Icon className="w-3 h-3" /> Reposição CD
        </span>
    );
}
