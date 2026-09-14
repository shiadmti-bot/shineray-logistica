/**
 * Aviso em faixa, com tom semântico.
 *
 * O tom carrega o significado, não a decoração:
 *   warning -> alguém precisa agir agora
 *   info    -> está em curso, é só aguardar
 *   danger  -> algo deu errado
 */
const TONS = {
    warning: {
        caixa: 'border-status-warning-solid bg-status-warning-bg/50',
        marca: 'bg-status-warning-bg text-status-warning-fg',
        titulo: 'text-status-warning-fg',
    },
    info: {
        caixa: 'border-status-info-solid bg-status-info-bg/50',
        marca: 'bg-status-info-bg text-status-info-fg',
        titulo: 'text-status-info-fg',
    },
    danger: {
        caixa: 'border-status-danger-solid bg-status-danger-bg/50',
        marca: 'bg-status-danger-bg text-status-danger-fg',
        titulo: 'text-status-danger-fg',
    },
};

export default function Alert({ tone = 'info', icon: Icon, title, children }) {
    const tom = TONS[tone] ?? TONS.info;

    return (
        <div role="status" className={`flex items-start gap-4 rounded-card border-l-4 p-5 shadow-card ${tom.caixa}`}>
            {Icon && (
                <span className={`shrink-0 rounded-full p-2 ${tom.marca}`}>
                    <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
            )}
            <div>
                <h4 className={`text-sm font-bold uppercase tracking-wide ${tom.titulo}`}>{title}</h4>
                <p className="mt-1 text-sm text-content-secondary">{children}</p>
            </div>
        </div>
    );
}
