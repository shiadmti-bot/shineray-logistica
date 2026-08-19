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
        <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-gradient-to-br from-brand-950 via-brand-700 to-brand-800 relative overflow-hidden selection:bg-brand-900 selection:text-white">
            <Head title="Acesso ao Sistema - Shineray By Sabel" />

            {/* ================= EFEITOS DEGRADÊ EM BRANCO & ILUMINAÇÃO ================= */}
            {/* Halos de luz branca em degradê translúcido para alto contraste */}
            <div className="absolute -top-40 -left-40 w-[36rem] h-[36rem] bg-gradient-to-br from-white/30 via-white/10 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse duration-1000"></div>
            <div className="absolute -bottom-40 -right-40 w-[40rem] h-[40rem] bg-gradient-to-tl from-white/25 via-white/10 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse duration-700"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[52rem] h-[52rem] bg-radial from-white/15 via-white/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

            {/* Partículas flutuantes brancas e brilhos geométricos */}
            <div className="absolute top-12 left-[15%] w-2.5 h-2.5 bg-white/80 rounded-full blur-[0.5px] animate-ping duration-1000 pointer-events-none"></div>
            <div className="absolute top-1/3 left-[8%] w-3 h-3 bg-white/60 rounded-full blur-[1px] animate-pulse duration-700 pointer-events-none"></div>
            <div className="absolute top-2/3 left-[12%] w-1.5 h-1.5 bg-white/90 rounded-full blur-[0.5px] animate-bounce duration-1000 pointer-events-none"></div>
            
            <div className="absolute top-16 right-[18%] w-2 h-2 bg-white/80 rounded-full blur-[0.5px] animate-pulse duration-1000 pointer-events-none"></div>
            <div className="absolute top-1/2 right-[10%] w-3.5 h-3.5 bg-white/50 rounded-full blur-[1px] animate-ping duration-700 pointer-events-none"></div>
            <div className="absolute bottom-20 right-[15%] w-2 h-2 bg-white/90 rounded-full blur-[0.5px] animate-pulse duration-500 pointer-events-none"></div>

            {/* Linhas geométricas sutis de luz branca */}
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px] opacity-15 pointer-events-none"></div>

            {/* Container Principal */}
            <div className="w-full max-w-md relative z-10 space-y-6">
                
                {/* Header com Logo em Destaque */}
                <div className="text-center">
                    <div className="inline-block group transition-all duration-300 transform hover:-translate-y-1">
                        <div className="bg-white px-8 py-4 rounded-3xl shadow-2xl shadow-black/30 border border-white/80 flex items-center justify-center gap-3 mx-auto transition-all duration-300 group-hover:scale-105 group-hover:shadow-white/20">
                            <img 
                                src="/img/logo.png" 
                                alt="Logo Shineray By Sabel" 
                                className="h-12 w-auto object-contain transition-transform duration-300" 
                            />
                        </div>
                    </div>
                </div>

                {/* Card de Login em Branco Puro com Alto Contraste */}
                <div className="w-full bg-white px-8 sm:px-10 py-10 shadow-2xl shadow-black/50 rounded-3xl border border-white relative overflow-hidden transition-all duration-300">
                    {/* Faixa decorativa superior */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-700 via-brand-500 to-brand-700"></div>

                    {/* Cabeçalho do Card */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-[11px] font-black uppercase tracking-wider mb-2 shadow-xs transition-transform duration-200 hover:scale-105">
                            <ShieldCheckIcon className="w-3.5 h-3.5" /> Portal de Acesso Corporativo
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                            Logística Integrada
                        </h1>
                        <p className="text-xs text-gray-500 mt-1.5 font-medium">
                            Informe suas credenciais para acessar o painel
                        </p>
                    </div>

                    {status && (
                        <div className="mb-6 text-sm text-emerald-800 bg-emerald-50 p-3.5 rounded-2xl border border-emerald-300 flex items-center gap-2.5 animate-fadeIn">
                            <span className="text-lg">✅</span> {status}
                        </div>
                    )}

                    <form onSubmit={submit} className="space-y-6">
                        
                        {/* E-MAIL */}
                        <div className="space-y-1.5">
                            <InputLabel htmlFor="email" value="E-mail Corporativo" className="text-gray-800 font-bold text-xs uppercase" />
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-600 transition-colors duration-200">
                                    <EnvelopeIcon className="h-5 w-5" />
                                </div>
                                <TextInput
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={data.email}
                                    className="block w-full pl-11 pr-4 border-gray-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 rounded-2xl shadow-xs h-12 transition-all duration-200 bg-gray-50 focus:bg-white text-gray-900 text-sm placeholder:text-gray-400"
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
                            <InputLabel htmlFor="password" value="Senha de Acesso" className="text-gray-800 font-bold text-xs uppercase" />
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-brand-600 transition-colors duration-200">
                                    <LockClosedIcon className="h-5 w-5" />
                                </div>
                                
                                <TextInput
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={data.password}
                                    className="block w-full pl-11 pr-12 border-gray-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 rounded-2xl shadow-xs h-12 transition-all duration-200 bg-gray-50 focus:bg-white text-gray-900 text-sm placeholder:text-gray-400"
                                    autoComplete="current-password"
                                    onChange={(e) => setData('password', e.target.value)}
                                    placeholder="••••••••"
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-brand-600 active:scale-95 transition-all duration-200 focus:outline-none"
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
                                    className="text-brand-600 focus:ring-brand-500 rounded border-gray-300 w-4 h-4 transition-transform group-hover:scale-105"
                                />
                                <span className="ms-2 text-xs font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
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
                                className="w-full justify-center py-4 bg-gradient-to-r from-brand-600 via-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 active:scale-[0.98] focus:ring-4 focus:ring-brand-500/25 text-sm font-black text-white shadow-lg hover:shadow-xl hover:shadow-brand-600/40 transition-all duration-200 rounded-2xl gap-2 tracking-wide cursor-pointer" 
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

                {/* Rodapé e Versão com Contraste Branco */}
                <div className="text-center text-xs text-white/90 space-y-2">
                    <p className="font-medium drop-shadow-sm">&copy; {new Date().getFullYear()} Shineray By Sabel • Logística & Distribuição</p>
                    <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-white/70 uppercase tracking-widest drop-shadow-sm">
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