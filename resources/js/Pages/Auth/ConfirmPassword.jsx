import { Head, useForm } from '@inertiajs/react';
import { LockClosedIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

import GuestLayout from '@/Layouts/GuestLayout';
import CampoTexto from '@/Components/Auth/CampoTexto';
import { Button } from '@/Components/UI';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset } = useForm({
        password: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('password.confirm'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout
            titulo="Confirme sua senha"
            descricao="Esta é uma área protegida do sistema. Confirme sua senha para continuar."
        >
            <Head title="Confirmar senha — Shineray By Sabel" />

            <form onSubmit={submit} className="space-y-5">
                <CampoTexto
                    id="password"
                    name="password"
                    type="password"
                    label="Senha de acesso"
                    icone={LockClosedIcon}
                    erro={errors.password}
                    value={data.password}
                    autoComplete="current-password"
                    autoFocus
                    placeholder="••••••••"
                    onChange={(e) => setData('password', e.target.value)}
                />

                <Button
                    type="submit"
                    size="lg"
                    icon={ShieldCheckIcon}
                    loading={processing}
                    className="w-full"
                >
                    {processing ? 'Confirmando…' : 'Confirmar'}
                </Button>
            </form>
        </GuestLayout>
    );
}
