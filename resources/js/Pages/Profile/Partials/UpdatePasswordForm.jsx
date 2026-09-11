import { useRef } from 'react';
import { Transition } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { CheckIcon, LockClosedIcon } from '@heroicons/react/24/outline';

import CampoTexto from '@/Components/Auth/CampoTexto';
import { Button } from '@/Components/UI';

export default function UpdatePasswordForm({ className = '' }) {
    const campoSenha = useRef();
    const campoSenhaAtual = useRef();

    const { data, setData, errors, put, reset, processing, recentlySuccessful } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const atualizarSenha = (e) => {
        e.preventDefault();

        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            /*
             * Devolver o foco ao campo que errou é o que depende do
             * forwardRef em CampoTexto. Sem ele, `.focus()` cairia no wrapper
             * e o usuário erraria a senha sem o cursor voltar.
             */
            onError: (erros) => {
                if (erros.password) {
                    reset('password', 'password_confirmation');
                    campoSenha.current?.focus();
                }

                if (erros.current_password) {
                    reset('current_password');
                    campoSenhaAtual.current?.focus();
                }
            },
        });
    };

    return (
        <section className={className}>
            <form onSubmit={atualizarSenha} className="space-y-4">
                <CampoTexto
                    id="current_password"
                    name="current_password"
                    type="password"
                    label="Senha atual"
                    icone={LockClosedIcon}
                    ref={campoSenhaAtual}
                    erro={errors.current_password}
                    value={data.current_password}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    onChange={(e) => setData('current_password', e.target.value)}
                />

                <CampoTexto
                    id="password"
                    name="password"
                    type="password"
                    label="Nova senha"
                    icone={LockClosedIcon}
                    ref={campoSenha}
                    erro={errors.password}
                    value={data.password}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    onChange={(e) => setData('password', e.target.value)}
                />

                <CampoTexto
                    id="password_confirmation"
                    name="password_confirmation"
                    type="password"
                    label="Confirmar nova senha"
                    icone={LockClosedIcon}
                    erro={errors.password_confirmation}
                    value={data.password_confirmation}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                />

                <div className="flex items-center gap-4 pt-1">
                    <Button type="submit" loading={processing}>
                        {processing ? 'Salvando…' : 'Alterar senha'}
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
                            Senha alterada
                        </p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}
