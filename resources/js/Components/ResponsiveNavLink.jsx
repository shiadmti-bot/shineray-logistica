import { Link } from '@inertiajs/react';

export default function ResponsiveNavLink({
    active = false,
    className = '',
    children,
    ...props
}) {
    // BLINDAGEM: Garante que active seja sempre booleano
    const isActive = Boolean(active);

    return (
        <Link
            {...props}
            className={`flex w-full items-start border-l-4 py-2 pe-4 ps-3 ${
                isActive
                    ? 'border-status-info-solid/60 bg-status-info-bg text-status-info-fg focus:border-status-info-fg focus:bg-status-info-bg focus:text-status-info-fg'
                    : 'border-transparent text-content-secondary hover:border-line-strong hover:bg-surface-sunken hover:text-content-primary focus:border-line-strong focus:bg-surface-sunken focus:text-content-primary'
            } text-base font-medium transition duration-150 ease-in-out focus:outline-none ${className}`}
        >
            {children}
        </Link>
    );
}