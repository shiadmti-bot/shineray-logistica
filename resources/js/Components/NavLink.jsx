import { Link } from '@inertiajs/react';

export default function NavLink({
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
            className={
                'inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium leading-5 transition duration-150 ease-in-out focus:outline-none ' +
                (isActive
                    ? 'border-status-info-solid/60 text-content-primary focus:border-status-info-fg '
                    : 'border-transparent text-content-muted hover:border-line-strong hover:text-content-secondary focus:border-line-strong focus:text-content-secondary ') +
                className
            }
        >
            {children}
        </Link>
    );
}