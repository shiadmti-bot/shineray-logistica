import { InboxIcon } from '@heroicons/react/24/outline';

/**
 * Estado vazio.
 *
 * Uma lista vazia hoje aparece como uma tabela sem linhas, o que o usuário lê
 * como erro de carregamento. Dizer explicitamente que não há registros — e
 * oferecer a ação seguinte — evita chamado de suporte.
 */
export default function EmptyState({
    title = 'Nada por aqui',
    description,
    icon: Icon = InboxIcon,
    action,
    className = '',
}) {
    return (
        <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
            <span className="rounded-full bg-surface-sunken p-3">
                <Icon className="h-7 w-7 text-content-muted" />
            </span>

            <h3 className="mt-4 text-sm font-bold text-content-primary">{title}</h3>

            {description && (
                <p className="mt-1 max-w-sm text-sm text-content-secondary">{description}</p>
            )}

            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}
