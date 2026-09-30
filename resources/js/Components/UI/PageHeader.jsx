import { Link } from '@inertiajs/react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

/**
 * Cabeçalho de página: título, trilha de navegação e ações primárias.
 *
 * Padroniza o topo de todas as telas — hoje cada página monta o seu, com
 * tamanhos e espaçamentos diferentes.
 *
 * @param {Array<{label:string, href?:string}>} breadcrumbs
 */
export default function PageHeader({
    title,
    description,
    breadcrumbs = [],
    actions,
    className = '',
}) {
    return (
        <div className={`mb-6 ${className}`}>
            {breadcrumbs.length > 0 && (
                <nav aria-label="Trilha de navegação" className="mb-2">
                    <ol className="flex flex-wrap items-center gap-1 text-xs text-content-muted">
                        {breadcrumbs.map((item, i) => {
                            const ultimo = i === breadcrumbs.length - 1;

                            return (
                                <li key={`${item.label}-${i}`} className="flex items-center gap-1">
                                    {item.href && !ultimo ? (
                                        <Link
                                            href={item.href}
                                            className="hover:text-content-primary transition"
                                        >
                                            {item.label}
                                        </Link>
                                    ) : (
                                        <span
                                            className={ultimo ? 'font-medium text-content-secondary' : ''}
                                            aria-current={ultimo ? 'page' : undefined}
                                        >
                                            {item.label}
                                        </span>
                                    )}
                                    {!ultimo && <ChevronRightIcon className="h-3 w-3" />}
                                </li>
                            );
                        })}
                    </ol>
                </nav>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl font-black tracking-tight text-content-primary sm:text-2xl">
                        {title}
                    </h1>
                    {description && (
                        <p className="mt-1 text-sm text-content-secondary">{description}</p>
                    )}
                </div>

                {actions && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
                )}
            </div>
        </div>
    );
}
