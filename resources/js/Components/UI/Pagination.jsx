import { Link } from '@inertiajs/react';

const ENTIDADES = { '&laquo;': '«', '&raquo;': '»', '&lsaquo;': '‹', '&rsaquo;': '›', '&amp;': '&' };

/** O paginator do Laravel manda rótulos com entidade HTML ("&laquo; Anterior"). */
const rotulo = (label) => String(label ?? '').replace(/&[a-z]+;/g, (entidade) => ENTIDADES[entidade] ?? entidade);

/**
 * Paginação dos resultados de `paginate()` do Laravel.
 *
 * A mesma lista de links estava reescrita em nove telas, com três variações
 * de estilo e `dangerouslySetInnerHTML` só para desenhar « e ». Aqui o rótulo é
 * decodificado como texto — nada do servidor vira HTML na página.
 *
 * `preserveState` mantém filtros e campos da tela ao trocar de página.
 */
export default function Pagination({ links = [], preserveState = false, className = '' }) {
    if (!links || links.length <= 3) return null;

    const base = 'min-w-[2rem] rounded-md px-2.5 py-1.5 text-center text-sm font-semibold transition';

    return (
        <nav aria-label="Paginação" className={`flex flex-wrap items-center justify-center gap-1 ${className}`}>
            {links.map((link, i) =>
                link.url ? (
                    <Link
                        key={i}
                        href={link.url}
                        preserveState={preserveState}
                        aria-current={link.active ? 'page' : undefined}
                        className={`${base} ${
                            link.active ? 'bg-brand-600 text-white' : 'text-content-secondary hover:bg-surface-sunken'
                        }`}
                    >
                        {rotulo(link.label)}
                    </Link>
                ) : (
                    <span key={i} aria-disabled="true" className={`${base} cursor-not-allowed text-content-muted opacity-50`}>
                        {rotulo(link.label)}
                    </span>
                )
            )}
        </nav>
    );
}
