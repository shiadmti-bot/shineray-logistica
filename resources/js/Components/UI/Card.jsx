/**
 * Contêiner padrão de conteúdo.
 *
 * Substitui o `bg-white rounded-xl shadow p-6` repetido nas telas atuais —
 * ajustar elevação, raio ou espaçamento passa a ser uma mudança só.
 */
export default function Card({
    children,
    title,
    subtitle,
    actions,
    padding = 'md',
    className = '',
    bodyClassName = '',
}) {
    const paddings = {
        none: '',
        sm: 'p-4',
        md: 'p-5 sm:p-6',
        lg: 'p-6 sm:p-8',
    };

    const temCabecalho = title || subtitle || actions;

    return (
        <section
            className={`bg-surface-card rounded-card shadow-card ring-1 ring-line overflow-hidden ${className}`}
        >
            {temCabecalho && (
                <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                        {title && (
                            <h2 className="text-base font-bold text-content-primary truncate">
                                {title}
                            </h2>
                        )}
                        {subtitle && (
                            <p className="mt-0.5 text-sm text-content-secondary">{subtitle}</p>
                        )}
                    </div>
                    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
                </header>
            )}

            <div className={`${paddings[padding]} ${bodyClassName}`}>{children}</div>
        </section>
    );
}
