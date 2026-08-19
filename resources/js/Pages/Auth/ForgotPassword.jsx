import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { EnvelopeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function ForgotPassword({ status }) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('password.email'));
    };

    return (
        <GuestLayout>
            <Head title="Recuperar Senha - Shineray By Sabel" />

            <div className="mb-6 text-center">
                <h2 className="text-xl font-black text-content-primary tracking-tight">
                    Recuperação de Senha
                </h2>
                <p className="mt-1 text-xs text-content-secondary leading-relaxed">
                    Informe seu e-mail corporativo para receber as instruções de redefinição de acesso.
                </p>
            </div>

            {status && (
                <div className="mb-5 text-sm font-medium text-status-success-fg bg-status-success-bg p-3.5 rounded-xl border border-status-success-solid/30">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-4">
                <div>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-content-muted group-focus-within:text-brand-600 transition-colors">
                            <EnvelopeIcon className="h-5 w-5" />
                        </div>
                        <TextInput
                            id="email"
                            type="email"
                            name="email"
                            value={data.email}
                            className="block w-full pl-11 pr-4 border-line focus:border-brand-500 focus:ring-brand-500 rounded-xl shadow-sm h-12 transition-all bg-surface-sunken focus:bg-surface-card text-sm"
                            isFocused={true}
                            onChange={(e) => setData('email', e.target.value)}
                            placeholder="usuario@shineray.com"
                        />
                    </div>
                    <InputError message={errors.email} className="mt-1.5" />
                </div>

                <div className="pt-2">
                    <PrimaryButton className="w-full justify-center py-3.5 bg-brand-600 hover:bg-brand-700 text-sm font-bold shadow-md rounded-xl" disabled={processing}>
                        {processing ? 'Enviando link...' : 'Enviar Link de Redefinição'}
                    </PrimaryButton>
                </div>

                <div className="text-center pt-2">
                    <Link
                        href={route('login')}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-content-muted hover:text-brand-600 transition"
                    >
                        <ArrowLeftIcon className="w-3.5 h-3.5" /> Voltar para o Login
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
