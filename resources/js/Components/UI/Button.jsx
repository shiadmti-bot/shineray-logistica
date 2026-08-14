import { Link } from '@inertiajs/react';

/**
 * Botão único do sistema.
 *
 * Hoje existem PrimaryButton, SecondaryButton e DangerButton separados, e boa
 * parte das telas ignora os três e escreve <button className="bg-red-600 ...">
 * na mão. Este componente cobre os casos com uma prop `variant` e serve tanto
 * <button> quanto <Link> do Inertia (via `href`), que é o que faltava e levava
 * à duplicação.
 */
export default function Button({
    children,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconRight = false,
    href,
    loading = false,
    disabled = false,
    className = '',
    ...props
}) {
    const variantes = {
        primary:   'bg-brand-600 text-white shadow-sm hover:bg-brand-700 focus-visible:outline-brand-600',
        secondary: 'bg-surface-card text-content-primary ring-1 ring-inset ring-line-strong hover:bg-surface-sunken focus-visible:outline-brand-600',
        danger:    'bg-status-danger-solid text-white shadow-sm hover:brightness-95 focus-visible:outline-status-danger-solid',
        success:   'bg-status-success-solid text-white shadow-sm hover:brightness-95 focus-visible:outline-status-success-solid',
        ghost:     'text-content-secondary hover:bg-surface-sunken hover:text-content-primary focus-visible:outline-brand-600',
    };

    const tamanhos = {
        sm: 'px-2.5 py-1.5 text-xs gap-1.5',
        md: 'px-3.5 py-2 text-sm gap-2',
        lg: 'px-5 py-2.5 text-sm gap-2',
    };

    const inativo = disabled || loading;

    const classes = `inline-flex items-center justify-center rounded-lg font-semibold transition
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
        ${variantes[variant]} ${tamanhos[size]}
        ${inativo ? 'pointer-events-none opacity-60' : ''} ${className}`;

    const conteudo = (
        <>
            {loading && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
            )}
            {!loading && Icon && !iconRight && <Icon className="h-4 w-4" />}
            {children}
            {!loading && Icon && iconRight && <Icon className="h-4 w-4" />}
        </>
    );

    if (href && !inativo) {
        return (
            <Link href={href} className={classes} {...props}>
                {conteudo}
            </Link>
        );
    }

    return (
        <button type="button" disabled={inativo} className={classes} {...props}>
            {conteudo}
        </button>
    );
}
