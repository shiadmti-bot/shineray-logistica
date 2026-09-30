import { Head, Link, useForm } from '@inertiajs/react';
import { EnvelopeIcon, ArrowLeftIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

import GuestLayout from '@/Layouts/GuestLayout';
import CampoTexto from '@/Components/Auth/CampoTexto';
import { Button } from '@/Components/UI';

export default function ForgotPassword({ status }) {
    const { data, setData, post, processing, errors } = useForm({ email: '' });

    const submit = (e) => {
        e.preventDefault();
        post(route('password.email'));
    };

    return (
        <GuestLayout
            titulo="Recuperação de senha"
            descricao="Informe seu e-mail corporativo para receber as instruções de redefinição."
        >
            <Head title="Recuperar senha — Shineray By Sabel" />

            {status && (
                <div className="mb-6 rounded-xl border border-status-success-solid/30 bg-status-success-bg px-4 py-3 text-sm font-medium text-status-success-fg">
                    {status}
                </div>
            )}

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
                    autoFocus
                    placeholder="usuario@shineraybysabel.com.br"
                    onChange={(e) => setData('email', e.target.value)}
                />

                <Button
                    type="submit"
                    size="lg"
                    icon={PaperAirplaneIcon}
                    loading={processing}
                    className="w-full"
                >
                    {processing ? 'Enviando…' : 'Enviar link de redefinição'}
                </Button>

                <div className="text-center">
                    <Link
                        href={route('login')}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-content-muted transition hover:text-brand-600"
                    >
                        <ArrowLeftIcon className="h-3.5 w-3.5" />
                        Voltar para o login
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
