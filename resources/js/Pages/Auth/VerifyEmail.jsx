import { Head, Link, useForm } from '@inertiajs/react';
import { EnvelopeIcon } from '@heroicons/react/24/outline';

import GuestLayout from '@/Layouts/GuestLayout';
import { Button } from '@/Components/UI';

export default function VerifyEmail({ status }) {
    const { post, processing } = useForm({});

    const submit = (e) => {
        e.preventDefault();
        post(route('verification.send'));
    };

    const linkEnviado = status === 'verification-link-sent';

    return (
        <GuestLayout
            titulo="Confirme seu e-mail"
            descricao="Enviamos um link de verificação para o e-mail cadastrado. Abra o link para liberar seu acesso."
        >
            <Head title="Verificar e-mail — Shineray By Sabel" />

            {linkEnviado && (
                <div className="mb-6 rounded-xl border border-status-success-solid/30 bg-status-success-bg px-4 py-3 text-sm font-medium text-status-success-fg">
                    Um novo link de verificação foi enviado para o seu e-mail.
                </div>
            )}

            <p className="mb-6 text-sm text-content-secondary">
                Não recebeu? Verifique a caixa de spam antes de pedir outro — e confirme
                com a TI se o endereço cadastrado está correto.
            </p>

            <form onSubmit={submit} className="space-y-4">
                <Button
                    type="submit"
                    size="lg"
                    icon={EnvelopeIcon}
                    loading={processing}
                    className="w-full"
                >
                    {processing ? 'Enviando…' : 'Reenviar e-mail de verificação'}
                </Button>

                <div className="text-center">
                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="text-xs font-semibold text-content-muted transition hover:text-brand-600"
                    >
                        Sair da conta
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
