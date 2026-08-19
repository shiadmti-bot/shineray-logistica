import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { useRef } from 'react';

export default function UpdatePasswordForm({ className = '' }) {
    const passwordInput = useRef();
    const currentPasswordInput = useRef();

    const {
        data,
        setData,
        errors,
        put,
        reset,
        processing,
        recentlySuccessful,
    } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const updatePassword = (e) => {
        e.preventDefault();

        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (errors) => {
                if (errors.password) {
                    reset('password', 'password_confirmation');
                    passwordInput.current.focus();
                }

                if (errors.current_password) {
                    reset('current_password');
                    currentPasswordInput.current.focus();
                }
            },
        });
    };

    return (
        <section className={className}>
            <form onSubmit={updatePassword} className="space-y-4">
                <div>
                    <InputLabel
                        htmlFor="current_password"
                        value="Senha Atual"
                        className="text-xs font-bold uppercase text-content-secondary mb-1"
                    />

                    <TextInput
                        id="current_password"
                        ref={currentPasswordInput}
                        value={data.current_password}
                        onChange={(e) =>
                            setData('current_password', e.target.value)
                        }
                        type="password"
                        className="block w-full border-line focus:border-brand-500 focus:ring-brand-500 rounded-xl shadow-xs text-sm bg-surface-sunken focus:bg-surface-card"
                        autoComplete="current-password"
                        placeholder="••••••••"
                    />

                    <InputError
                        message={errors.current_password}
                        className="mt-1.5"
                    />
                </div>

                <div>
                    <InputLabel htmlFor="password" value="Nova Senha" className="text-xs font-bold uppercase text-content-secondary mb-1" />

                    <TextInput
                        id="password"
                        ref={passwordInput}
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        type="password"
                        className="block w-full border-line focus:border-brand-500 focus:ring-brand-500 rounded-xl shadow-xs text-sm bg-surface-sunken focus:bg-surface-card"
                        autoComplete="new-password"
                        placeholder="••••••••"
                    />

                    <InputError message={errors.password} className="mt-1.5" />
                </div>

                <div>
                    <InputLabel
                        htmlFor="password_confirmation"
                        value="Confirmar Nova Senha"
                        className="text-xs font-bold uppercase text-content-secondary mb-1"
                    />

                    <TextInput
                        id="password_confirmation"
                        value={data.password_confirmation}
                        onChange={(e) =>
                            setData('password_confirmation', e.target.value)
                        }
                        type="password"
                        className="block w-full border-line focus:border-brand-500 focus:ring-brand-500 rounded-xl shadow-xs text-sm bg-surface-sunken focus:bg-surface-card"
                        autoComplete="new-password"
                        placeholder="••••••••"
                    />

                    <InputError
                        message={errors.password_confirmation}
                        className="mt-1.5"
                    />
                </div>

                <div className="flex items-center gap-4 pt-2">
                    <PrimaryButton className="bg-brand-600 hover:bg-brand-700 rounded-xl font-bold py-2.5 px-5 text-xs shadow-xs" disabled={processing}>
                        {processing ? 'Salvando...' : 'Alterar Senha'}
                    </PrimaryButton>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out duration-300"
                        enterFrom="opacity-0 translate-y-1"
                        leave="transition ease-in-out duration-300"
                        leaveTo="opacity-0"
                    >
                        <p className="text-xs font-bold text-status-success-fg flex items-center gap-1">
                            <span>✅</span> Senha alterada com sucesso!
                        </p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}
