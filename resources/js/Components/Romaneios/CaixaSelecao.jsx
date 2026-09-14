/** Caixa de seleção de três estados: nenhuma, parte ou todas as motos do pedido. */
export default function CaixaSelecao({ todas, alguma }) {
    return (
        <div
            aria-hidden="true"
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                todas
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : alguma
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-line-strong bg-surface-card'
            }`}
        >
            {todas && (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
            )}
            {!todas && alguma && <div className="h-2 w-2 rounded-xs bg-brand-600" />}
        </div>
    );
}
