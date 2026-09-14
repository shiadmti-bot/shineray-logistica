import { useEffect, useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    EnvelopeIcon,
    LockClosedIcon,
    EyeIcon,
    EyeSlashIcon,
    ArrowRightIcon,
} from '@heroicons/react/24/outline';

import GuestLayout from '@/Layouts/GuestLayout';
import CampoTexto from '@/Components/Auth/CampoTexto';
import { Button } from '@/Components/UI';

/**
 * Porta de entrada do sistema.
 *
 * Era a última tela no scaffolding do Breeze e, por ser a primeira que todo
 * usuário vê todo dia, também a única que não se parecia com o resto do
 * sistema. A casca de marca e a regra de cor vivem em GuestLayout; aqui fica
 * só o formulário.
 */
export default function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const [mostrarSenha, setMostrarSenha] = useState(false);

    useEffect(() => () => reset('password'), [reset]);

    const submit = (e) => {
        e.preventDefault();
        post(route('login'));
    };

    return (
        <GuestLayout
            titulo="Logística Integrada"
            descricao="Informe suas credenciais para acessar o painel."
        >
            <Head title="Acesso ao Sistema — Shineray By Sabel" />

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

                <CampoTexto
                    id="password"
                    name="password"
                    type={mostrarSenha ? 'text' : 'password'}
                    label="Senha de acesso"
                    icone={LockClosedIcon}
                    erro={errors.password}
                    value={data.password}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    onChange={(e) => setData('password', e.target.value)}
                    acaoDireita={
                        <button
                            type="button"
                            onClick={() => setMostrarSenha((v) => !v)}
                            aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                            className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3.5 text-content-muted transition hover:text-brand-600 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        >
                            {mostrarSenha ? (
                                <EyeSlashIcon className="h-5 w-5" />
                            ) : (
                                <EyeIcon className="h-5 w-5" />
                            )}
                        </button>
                    }
                />

                <div className="flex items-center justify-between">
                    <label className="flex cursor-pointer select-none items-center gap-2">
                        <input
                            type="checkbox"
                            name="remember"
                            checked={data.remember}
                            onChange={(e) => setData('remember', e.target.checked)}
                            className="h-4 w-4 rounded border-line-strong bg-surface-card text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-xs font-medium text-content-secondary">
                            Manter conectado
                        </span>
                    </label>

                    {canResetPassword && (
                        <Link
                            href={route('password.request')}
                            className="text-xs font-semibold text-brand-600 transition hover:text-brand-700 hover:underline"
                        >
                            Esqueceu a senha?
                        </Link>
                    )}
                </div>

                {/*
                    type="submit" é obrigatório: o Button do kit nasce como
                    type="button" e, sem isso, o Enter no campo de senha não
                    envia o formulário.
                */}
                <Button
                    type="submit"
                    size="lg"
                    icon={ArrowRightIcon}
                    iconRight
                    loading={processing}
                    className="w-full"
                >
                    {processing ? 'Autenticando…' : 'Entrar no sistema'}
                </Button>
            </form>
        </GuestLayout>
    );
}
