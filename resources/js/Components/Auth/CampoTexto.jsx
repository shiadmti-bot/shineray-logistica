/**
 * Campo de texto das telas de acesso (V3).
 *
 * Substitui o trio InputLabel + TextInput + InputError do scaffolding do
 * Breeze. Existe por um motivo concreto: a classe do input tem dez utilitários
 * e aparecia copiada em seis telas. Toda vez que uma delas era ajustada, as
 * outras cinco ficavam para trás — foi assim que Login, ForgotPassword e
 * Register acabaram com três aparências diferentes para o mesmo campo.
 *
 * Tudo aqui é token (`surface-*`, `content-*`, `line`), então o campo segue o
 * tema do usuário sem precisar de variante `dark:`: o tema troca as variáveis
 * CSS, e as classes continuam as mesmas.
 */
import { forwardRef } from 'react';

/*
 * forwardRef porque a tela de troca de senha devolve o foco ao campo que
 * errou (`passwordInput.current.focus()`). Sem encaminhar, a ref apontaria
 * para o wrapper e o `.focus()` quebraria em silêncio — o usuário erraria a
 * senha e o cursor não voltaria para o campo.
 */
const CampoTexto = forwardRef(function CampoTexto({
    id,
    label,
    icone: Icone,
    erro,
    acaoDireita,
    className = '',
    ...props
}, ref) {
    const temIcone = Boolean(Icone);

    return (
        <div className={className}>
            {label && (
                <label
                    htmlFor={id}
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-content-secondary"
                >
                    {label}
                </label>
            )}

            <div className="group relative">
                {temIcone && (
                    <Icone
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-3.5 my-auto h-5 w-5 text-content-muted transition group-focus-within:text-brand-600"
                    />
                )}

                <input
                    ref={ref}
                    id={id}
                    className={`block h-12 w-full rounded-xl border bg-surface-sunken text-sm text-content-primary
                        placeholder:text-content-muted transition
                        focus:bg-surface-card focus:ring-2 focus:ring-brand-500/20
                        ${temIcone ? 'pl-11' : 'pl-4'}
                        ${acaoDireita ? 'pr-12' : 'pr-4'}
                        ${erro
                            ? 'border-status-danger-solid/60 focus:border-status-danger-solid'
                            : 'border-line-strong focus:border-brand-500'}`}
                    aria-invalid={erro ? 'true' : undefined}
                    aria-describedby={erro ? `${id}-erro` : undefined}
                    {...props}
                />

                {acaoDireita}
            </div>

            {erro && (
                <p id={`${id}-erro`} className="mt-1.5 text-xs font-medium text-status-danger-fg">
                    {erro}
                </p>
            )}
        </div>
    );
});

export default CampoTexto;
