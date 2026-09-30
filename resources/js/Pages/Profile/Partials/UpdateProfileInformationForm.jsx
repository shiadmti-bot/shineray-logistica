import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';
import { CheckIcon } from '@heroicons/react/24/outline';

import CampoTexto from '@/Components/Auth/CampoTexto';
import { Button } from '@/Components/UI';

export default function UpdateProfileInformation({
    mustVerifyEmail,
    status,
    className = '',
}) {
    const user = usePage().props.auth.user;

    const { data, setData, patch, errors, processing, recentlySuccessful } = useForm({
        name: user.name,
        email: user.email,
    });

    const submit = (e) => {
        e.preventDefault();
        patch(route('profile.update'));
    };

    return (
        <section className={className}>
            <form onSubmit={submit} className="space-y-4">
                <CampoTexto
                    id="name"
                    name="name"
                    label="Nome completo"
                    erro={errors.name}
                    value={data.name}
                    autoComplete="name"
                    required
                    autoFocus
                    onChange={(e) => setData('name', e.target.value)}
                />

                <CampoTexto
                    id="email"
                    name="email"
                    type="email"
                    label="E-mail de acesso"
                    erro={errors.email}
                    value={data.email}
                    autoComplete="username"
                    required
                    onChange={(e) => setData('email', e.target.value)}
                />

                {mustVerifyEmail && user.email_verified_at === null && (
                    <div className="rounded-xl border border-status-warning-solid/25 bg-status-warning-bg p-3">
                        <p className="text-xs text-status-warning-fg">
                            Seu e-mail ainda não foi verificado.{' '}
                            <Link
                                href={route('verification.send')}
                                method="post"
                                as="button"
                                className="font-semibold underline"
                            >
                                Reenviar o e-mail de verificação.
                            </Link>
                        </p>

                        {status === 'verification-link-sent' && (
                            <p className="mt-2 text-xs font-semibold text-status-success-fg">
                                Um novo link foi enviado para o seu e-mail.
                            </p>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-4 pt-1">
                    {/* type="submit": o Button do kit nasce como type="button". */}
                    <Button type="submit" loading={processing}>
                        {processing ? 'Salvando…' : 'Salvar alterações'}
                    </Button>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out duration-300"
                        enterFrom="opacity-0 translate-y-1"
                        leave="transition ease-in-out duration-300"
                        leaveTo="opacity-0"
                    >
                        <p className="flex items-center gap-1 text-xs font-semibold text-status-success-fg">
                            <CheckIcon className="h-4 w-4" />
                            Informações atualizadas
                        </p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}
