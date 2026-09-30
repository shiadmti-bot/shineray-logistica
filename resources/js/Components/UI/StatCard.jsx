import { Link } from '@inertiajs/react';

/**
 * Indicador numérico do topo das telas (KPI).
 *
 * Consolida os três formatos de card de número que existem hoje em
 * Dashboard.jsx, BI/Index.jsx e Gestor/Dashboard.jsx.
 *
 * Vira link automaticamente quando recebe `href` — é o padrão do dashboard:
 * clicar no número leva à lista filtrada.
 */
export default function StatCard({
    label,
    value,
    icon: Icon,
    tone = 'neutral',
    hint,
    href,
    loading = false,
    className = '',
}) {
    const tones = {
        neutral: 'text-content-secondary bg-status-neutral-bg',
        info:    'text-status-info-fg    bg-status-info-bg',
        success: 'text-status-success-fg bg-status-success-bg',
        warning: 'text-status-warning-fg bg-status-warning-bg',
        danger:  'text-status-danger-fg  bg-status-danger-bg',
        brand:   'text-brand-700         bg-brand-50',
    };

    const conteudo = (
        <>
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
                    {label}
                </p>
                {Icon && (
                    <span className={`shrink-0 rounded-lg p-2 ${tones[tone]}`}>
                        <Icon className="h-5 w-5" />
                    </span>
                )}
            </div>

            <div className="mt-3">
                {loading ? (
                    <div className="h-9 w-16 animate-pulse rounded bg-surface-sunken" />
                ) : (
                    <p className="text-3xl font-black leading-none text-content-primary tabular-nums">
                        {value ?? 0}
                    </p>
                )}
                {hint && <p className="mt-1.5 text-xs text-content-muted">{hint}</p>}
            </div>
        </>
    );

    const base = `block bg-surface-card rounded-card shadow-card ring-1 ring-line p-5 transition ${className}`;

    if (href) {
        return (
            <Link
                href={href}
                className={`${base} hover:shadow-card-hover hover:ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand-500`}
            >
                {conteudo}
            </Link>
        );
    }

    return <div className={base}>{conteudo}</div>;
}
