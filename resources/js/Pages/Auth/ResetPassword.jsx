import { Head, useForm } from '@inertiajs/react';
import { EnvelopeIcon, LockClosedIcon, CheckIcon } from '@heroicons/react/24/outline';

import GuestLayout from '@/Layouts/GuestLayout';
import CampoTexto from '@/Components/Auth/CampoTexto';
import { Button } from '@/Components/UI';

export default function ResetPassword({ token, email }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('password.store'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <GuestLayout
            titulo="Definir nova senha"
            descricao="Escolha uma senha que você não use em outro sistema."
        >
            <Head title="Redefinir senha — Shineray By Sabel" />

            <form onSubmit={submit} className="space-y-5">
                <CampoTexto
                    id="email"
                    name="email"
                    type="email"
                    label="E-mail corporativo"
                    icone={EnvelopeIcon}
                    erro={errors.email}
                    value={data.email}
                    autoComplete="username"
                    onChange={(e) => setData('email', e.target.value)}
                />

                <CampoTexto
                    id="password"
                    name="password"
                    type="password"
                    label="Nova senha"
                    icone={LockClosedIcon}
                    erro={errors.password}
                    value={data.password}
                    autoComplete="new-password"
                    autoFocus
                    placeholder="••••••••"
                    onChange={(e) => setData('password', e.target.value)}
                />

                <CampoTexto
                    id="password_confirmation"
                    name="password_confirmation"
                    type="password"
                    label="Confirme a nova senha"
                    icone={LockClosedIcon}
                    erro={errors.password_confirmation}
                    value={data.password_confirmation}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                />

                <Button
                    type="submit"
                    size="lg"
                    icon={CheckIcon}
                    loading={processing}
                    className="w-full"
                >
                    {processing ? 'Salvando…' : 'Salvar nova senha'}
                </Button>
            </form>
        </GuestLayout>
    );
}
