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
    SparklesIcon
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
        <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-gradient-to-br from-surface-sunken via-surface-card to-surface-sunken relative overflow-hidden selection:bg-brand-500 selection:text-white">
            <Head title="Acesso ao Sistema - Shineray By Sabel" />

            {/* Efeitos de Iluminação Interativa e Profundidade no Fundo */}
            <div className="absolute top-1/4 -left-32 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none animate-pulse duration-1000"></div>
            <div className="absolute bottom-1/4 -right-32 w-[30rem] h-[30rem] bg-brand-600/10 rounded-full blur-3xl pointer-events-none animate-pulse duration-700"></div>
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-brand-500/10 rounded-full blur-2xl pointer-events-none"></div>

            {/* Container Principal com Espaçamento Harmonioso */}
            <div className="w-full max-w-md relative z-10 space-y-6">
                
                {/* Header com Logo e Efeito de Destaque */}
                <div className="text-center">
                    <div className="inline-block group transition-all duration-300 transform hover:-translate-y-1">
                        <div className="bg-surface-card/95 backdrop-blur-md px-8 py-4 rounded-3xl shadow-xl border border-line flex items-center justify-center gap-3 mx-auto transition-all duration-300 group-hover:border-brand-500/50 group-hover:shadow-2xl group-hover:shadow-brand-900/10">
                            <img 
                                src="/img/logo.png" 
                                alt="Logo Shineray By Sabel" 
                                className="h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-105" 
                            />
                        </div>
                    </div>
                </div>

                {/* Card de Login com Acabamento Glass e Borda Interativa */}
                <div className="w-full bg-surface-card/95 backdrop-blur-md px-8 sm:px-10 py-10 shadow-2xl rounded-3xl border border-line relative overflow-hidden transition-all duration-300 hover:border-line-strong">
                    {/* Faixa decorativa superior com gradiente animado */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-700 via-brand-500 to-brand-700"></div>

                    {/* Cabeçalho do Card */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-[11px] font-black uppercase tracking-wider mb-2 shadow-xs transition-transform duration-200 hover:scale-105">
                            <ShieldCheckIcon className="w-3.5 h-3.5" /> Portal de Acesso Corporativo
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-content-primary tracking-tight">
                            Logística Integrada
                        </h1>
                        <p className="text-xs text-content-secondary mt-1.5">
                            Informe suas credenciais para acessar o painel
                        </p>
                    </div>

                    {status && (
                        <div className="mb-6 text-sm text-status-success-fg bg-status-success-bg p-3.5 rounded-2xl border border-status-success-solid/30 flex items-center gap-2.5 animate-fadeIn">
                            <span className="text-lg">✅</span> {status}
                        </div>
                    )}

                    <form onSubmit={submit} className="space-y-6">
                        
                        {/* E-MAIL */}
                        <div className="space-y-1.5">
                            <InputLabel htmlFor="email" value="E-mail Corporativo" className="text-content-secondary font-bold text-xs uppercase" />
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-content-muted group-focus-within:text-brand-600 transition-colors duration-200">
                                    <EnvelopeIcon className="h-5 w-5" />
                                </div>
                                <TextInput
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={data.email}
                                    className="block w-full pl-11 pr-4 border-line focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 rounded-2xl shadow-xs h-12 transition-all duration-200 bg-surface-sunken focus:bg-surface-card text-sm"
                                    autoComplete="username"
                                    isFocused={true}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="usuario@shineray.com"
                                />
                            </div>
                            <InputError message={errors.email} className="mt-1" />
                        </div>

                        {/* SENHA */}
                        <div className="space-y-1.5">
                            <InputLabel htmlFor="password" value="Senha de Acesso" className="text-content-secondary font-bold text-xs uppercase" />
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-content-muted group-focus-within:text-brand-600 transition-colors duration-200">
                                    <LockClosedIcon className="h-5 w-5" />
                                </div>
                                
                                <TextInput
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={data.password}
                                    className="block w-full pl-11 pr-12 border-line focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 rounded-2xl shadow-xs h-12 transition-all duration-200 bg-surface-sunken focus:bg-surface-card text-sm"
                                    autoComplete="current-password"
                                    onChange={(e) => setData('password', e.target.value)}
                                    placeholder="••••••••"
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-content-muted hover:text-brand-600 active:scale-95 transition-all duration-200 focus:outline-none"
                                    title={showPassword ? "Ocultar senha" : "Ver senha"}
                                >
                                    {showPassword ? (
                                        <EyeSlashIcon className="w-5 h-5" />
                                    ) : (
                                        <EyeIcon className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                            <InputError message={errors.password} className="mt-1" />
                        </div>

                        {/* OPÇÕES INTERATIVAS */}
                        <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center cursor-pointer select-none group">
                                <Checkbox
                                    name="remember"
                                    checked={data.remember}
                                    onChange={(e) => setData('remember', e.target.checked)}
                                    className="text-brand-600 focus:ring-brand-500 rounded border-line w-4 h-4 transition-transform group-hover:scale-105"
                                />
                                <span className="ms-2 text-xs font-medium text-content-secondary group-hover:text-content-primary transition-colors">
                                    Manter conectado
                                </span>
                            </label>

                            {canResetPassword && (
                                <Link
                                    href={route('password.request')}
                                    className="text-xs font-bold text-brand-600 hover:text-brand-700 hover:underline transition-colors"
                                >
                                    Esqueceu a senha?
                                </Link>
                            )}
                        </div>

                        {/* BOTÃO DE ENTRAR COM EFEITO INTERATIVO */}
                        <div className="pt-2">
                            <PrimaryButton 
                                className="w-full justify-center py-4 bg-gradient-to-r from-brand-600 via-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 active:scale-[0.98] focus:ring-4 focus:ring-brand-500/25 text-sm font-black shadow-lg hover:shadow-xl hover:shadow-brand-600/30 transition-all duration-200 rounded-2xl gap-2 tracking-wide cursor-pointer" 
                                disabled={processing}
                            >
                                {processing ? (
                                    <span className="flex items-center gap-2">
                                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                                        <span>Autenticando...</span>
                                    </span>
                                ) : (
                                    <>
                                        <span>Entrar no Sistema</span>
                                        <ArrowRightIcon className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                                    </>
                                )}
                            </PrimaryButton>
                        </div>
                    </form>
                </div>

                {/* Rodapé e Versão */}
                <div className="text-center text-xs text-content-muted space-y-2">
                    <p>&copy; {new Date().getFullYear()} Shineray By Sabel • Logística & Distribuição</p>
                    <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-content-muted uppercase tracking-widest">
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