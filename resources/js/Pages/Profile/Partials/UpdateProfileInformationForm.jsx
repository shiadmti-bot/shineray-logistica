import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';

export default function UpdateProfileInformation({
    mustVerifyEmail,
    status,
    className = '',
}) {
    const user = usePage().props.auth.user;

    const { data, setData, patch, errors, processing, recentlySuccessful } =
        useForm({
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
                <div>
                    <InputLabel htmlFor="name" value="Nome Completo" className="text-xs font-bold uppercase text-content-secondary mb-1" />

                    <TextInput
                        id="name"
                        className="block w-full border-line focus:border-brand-500 focus:ring-brand-500 rounded-xl shadow-xs text-sm bg-surface-sunken focus:bg-surface-card"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        required
                        isFocused
                        autoComplete="name"
                    />

                    <InputError className="mt-1.5" message={errors.name} />
                </div>

                <div>
                    <InputLabel htmlFor="email" value="E-mail de Acesso" className="text-xs font-bold uppercase text-content-secondary mb-1" />

                    <TextInput
                        id="email"
                        type="email"
                        className="block w-full border-line focus:border-brand-500 focus:ring-brand-500 rounded-xl shadow-xs text-sm bg-surface-sunken focus:bg-surface-card"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        required
                        autoComplete="username"
                    />

                    <InputError className="mt-1.5" message={errors.email} />
                </div>

                {mustVerifyEmail && user.email_verified_at === null && (
                    <div className="bg-status-warning-bg p-3 rounded-xl border border-status-warning-solid/20">
                        <p className="text-xs text-status-warning-fg">
                            Seu endereço de e-mail ainda não foi verificado.{' '}
                            <Link
                                href={route('verification.send')}
                                method="post"
                                as="button"
                                className="font-bold underline hover:text-status-warning-fg"
                            >
                                Clique aqui para reenviar o e-mail de verificação.
                            </Link>
                        </p>

                        {status === 'verification-link-sent' && (
                            <div className="mt-2 text-xs font-bold text-status-success-fg">
                                Um novo link de verificação foi enviado para seu e-mail.
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-4 pt-2">
                    <PrimaryButton className="bg-brand-600 hover:bg-brand-700 rounded-xl font-bold py-2.5 px-5 text-xs shadow-xs" disabled={processing}>
                        {processing ? 'Salvando...' : 'Salvar Alterações'}
                    </PrimaryButton>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out duration-300"
                        enterFrom="opacity-0 translate-y-1"
                        leave="transition ease-in-out duration-300"
                        leaveTo="opacity-0"
                    >
                        <p className="text-xs font-bold text-status-success-fg flex items-center gap-1">
                            <span>✅</span> Informações atualizadas com sucesso!
                        </p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}
