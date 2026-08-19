import { useEffect, useState } from 'react';
import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, Link, useForm } from '@inertiajs/react';
import { 
    EnvelopeIcon, 
    LockClosedIcon, 
    EyeIcon, 
    EyeSlashIcon,
    ArrowRightIcon,
    ShieldCheckIcon,
    TruckIcon
} from '@heroicons/react/24/outline';

export default function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        return () => {
            reset('password');
        };
    }, []);

    const submit = (e) => {
        e.preventDefault();
        post(route('login'));
    };

    return (
        <div className="min-h-screen flex flex-col justify-center items-center px-4 py-10 bg-gradient-to-br from-surface-sunken via-surface-card to-surface-sunken relative overflow-hidden">
            <Head title="Acesso ao Sistema - Shineray By Sabel" />

            {/* Efeitos de Iluminação e Profundidade */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none"></div>

            {/* Container Principal */}
            <div className="w-full max-w-md relative z-10">
                
                {/* Header com Logo */}
                <div className="text-center mb-8">
                    <div className="inline-block transition-transform duration-300 hover:scale-105">
                        <div className="bg-surface-card px-8 py-4 rounded-2xl shadow-lg border border-line flex items-center justify-center gap-3 mx-auto">
                            <img 
                                src="/img/logo.png" 
                                alt="Logo Shineray By Sabel" 
                                className="h-12 w-auto object-contain" 
                            />
                        </div>
                    </div>
                </div>

                {/* Card de Login */}
                <div className="w-full bg-surface-card/95 backdrop-blur-md px-8 py-10 shadow-2xl rounded-3xl border border-line relative overflow-hidden">
                    {/* Faixa decorativa superior */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-700 via-brand-500 to-brand-700"></div>

                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-[11px] font-black uppercase tracking-wider mb-2">
                            <ShieldCheckIcon className="w-3.5 h-3.5" /> Portal de Acesso
                        </div>
                        <h1 className="text-2xl font-black text-content-primary tracking-tight">
                            Logística Integrada
                        </h1>
                        <p className="text-xs text-content-secondary mt-1">
                            Informe suas credenciais corporativas
                        </p>
                    </div>

                    {status && (
                        <div className="mb-6 text-sm text-status-success-fg bg-status-success-bg p-3.5 rounded-xl border border-status-success-solid/30 flex items-center gap-2">
                            <span className="text-lg">✅</span> {status}
                        </div>
                    )}

                    <form onSubmit={submit} className="space-y-5">
                        
                        {/* E-MAIL */}
                        <div>
                            <InputLabel htmlFor="email" value="E-mail Corporativo" className="text-content-secondary font-bold text-xs uppercase mb-1.5" />
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
                                    autoComplete="username"
                                    isFocused={true}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="usuario@shineray.com"
                                />
                            </div>
                            <InputError message={errors.email} className="mt-1.5" />
                        </div>

                        {/* SENHA */}
                        <div>
                            <InputLabel htmlFor="password" value="Senha de Acesso" className="text-content-secondary font-bold text-xs uppercase mb-1.5" />
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-content-muted group-focus-within:text-brand-600 transition-colors">
                                    <LockClosedIcon className="h-5 w-5" />
                                </div>
                                
                                <TextInput
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={data.password}
                                    className="block w-full pl-11 pr-11 border-line focus:border-brand-500 focus:ring-brand-500 rounded-xl shadow-sm h-12 transition-all bg-surface-sunken focus:bg-surface-card text-sm"
                                    autoComplete="current-password"
                                    onChange={(e) => setData('password', e.target.value)}
                                    placeholder="••••••••"
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-content-muted hover:text-content-primary transition-colors focus:outline-none"
                                    title={showPassword ? "Ocultar senha" : "Ver senha"}
                                >
                                    {showPassword ? (
                                        <EyeSlashIcon className="w-5 h-5" />
                                    ) : (
                                        <EyeIcon className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                            <InputError message={errors.password} className="mt-1.5" />
                        </div>

                        {/* OPÇÕES */}
                        <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center cursor-pointer select-none">
                                <Checkbox
                                    name="remember"
                                    checked={data.remember}
                                    onChange={(e) => setData('remember', e.target.checked)}
                                    className="text-brand-600 focus:ring-brand-500 rounded border-line w-4 h-4"
                                />
                                <span className="ms-2 text-xs font-medium text-content-secondary">Manter conectado</span>
                            </label>

                            {canResetPassword && (
                                <Link
                                    href={route('password.request')}
                                    className="text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline"
                                >
                                    Esqueceu a senha?
                                </Link>
                            )}
                        </div>

                        {/* BOTÃO DE SUBMIT */}
                        <div className="pt-3">
                            <PrimaryButton 
                                className="w-full justify-center py-3.5 bg-brand-600 hover:bg-brand-700 focus:ring-brand-500 text-sm font-bold shadow-md hover:shadow-lg transition-all rounded-xl gap-2" 
                                disabled={processing}
                            >
                                {processing ? (
                                    <span className="flex items-center gap-2">
                                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                        Autenticando...
                                    </span>
                                ) : (
                                    <>
                                        <span>Entrar no Sistema</span>
                                        <ArrowRightIcon className="w-4 h-4" />
                                    </>
                                )}
                            </PrimaryButton>
                        </div>
                    </form>
                </div>

                {/* Rodapé e Versão */}
                <div className="mt-8 text-center text-xs text-content-muted">
                    <p>&copy; {new Date().getFullYear()} Shineray By Sabel</p>
                    <div className="mt-2 flex items-center justify-center gap-2 text-[10px] font-bold text-content-muted uppercase tracking-widest">
                        <span>Sistema V3.0</span>
                        <span>•</span>
                        <span>Hub & Spoke</span>
                        <span>•</span>
                        <span>Milk Run</span>
                    </div>
                </div>
            </div>
        </div>
    );
}