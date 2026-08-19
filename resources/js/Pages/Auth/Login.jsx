import { useEffect, useState } from 'react';
import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    // Estado para alternar visualização da senha
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
        // --- FUNDO: Gradiente Vermelho Intenso (Identidade V2) ---
        <div className="min-h-screen flex flex-col justify-center items-center pt-6 sm:pt-0 bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600">
            <Head title="Login - BySabel Logística" />

            {/* --- ÁREA DA LOGO (Adaptada para formato Retangular) --- */}
            {/* Usamos um container branco largo para acomodar o Caminhão + Texto "By Sabel" */}
            <div className="mb-8 transform hover:scale-105 transition-transform duration-500 ease-out">
                <div className="bg-surface-card px-8 py-4 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.3)] flex items-center justify-center border-b-4 border-brand-900/30">
                    <img 
                        src="/img/logo.png" 
                        alt="Logo Shineray By Sabel" 
                        className="h-16 w-auto object-contain" 
                    />
                </div>
            </div>

            {/* --- CARD DE LOGIN --- */}
            <div className="w-full sm:max-w-md px-8 py-10 bg-surface-card shadow-2xl overflow-hidden sm:rounded-3xl border-t-4 border-brand-600 relative">
                
                {/* Elemento Decorativo de Fundo */}
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-brand-50 rounded-full blur-2xl opacity-50 pointer-events-none"></div>

                {/* Cabeçalho */}
                <div className="text-center mb-8 relative z-10">
                    <h2 className="text-2xl font-black text-content-primary uppercase tracking-tighter">
                        Acesso ao Sistema
                    </h2>
                    <p className="text-xs text-brand-600 font-bold tracking-[0.3em] uppercase mt-1">
                        Logística Integrada
                    </p>
                </div>

                {/* Mensagem de Status (Feedback) */}
                {status && (
                    <div className="mb-6 font-medium text-sm text-status-success-fg bg-status-success-bg p-3 rounded-lg border border-status-success-solid/30 flex items-center gap-2 animate-pulse">
                        <span className="text-lg">✅</span> {status}
                    </div>
                )}

                <form onSubmit={submit} className="space-y-6 relative z-10">
                    
                    {/* INPUT: EMAIL */}
                    <div>
                        <InputLabel htmlFor="email" value="Usuário / E-mail" className="text-content-secondary font-bold text-xs uppercase ml-1 mb-1" />
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-brand-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                                </svg>
                            </div>
                            <TextInput
                                id="email"
                                type="email"
                                name="email"
                                value={data.email}
                                className="block w-full pl-10 border-line-strong focus:border-brand-500 focus:ring-brand-500 rounded-xl shadow-sm h-12 transition-all bg-surface-sunken focus:bg-surface-card"
                                autoComplete="username"
                                isFocused={true}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder="ex: logistica@shineray.com"
                            />
                        </div>
                        <InputError message={errors.email} className="mt-2" />
                    </div>

                    {/* INPUT: SENHA */}
                    <div>
                        <InputLabel htmlFor="password" value="Senha" className="text-content-secondary font-bold text-xs uppercase ml-1 mb-1" />
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-brand-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-content-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            
                            <TextInput
                                id="password"
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={data.password}
                                className="block w-full pl-10 pr-10 border-line-strong focus:border-brand-500 focus:ring-brand-500 rounded-xl shadow-sm h-12 transition-all bg-surface-sunken focus:bg-surface-card"
                                autoComplete="current-password"
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder="••••••••"
                            />

                            {/* Botão Ver Senha */}
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-content-muted hover:text-brand-600 transition-colors focus:outline-none"
                                title={showPassword ? "Ocultar senha" : "Ver senha"}
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        <InputError message={errors.password} className="mt-2" />
                    </div>

                    {/* OPÇÕES: Manter Conectado / Esqueci Senha */}
                    <div className="flex items-center justify-between mt-4">
                        <label className="flex items-center cursor-pointer group select-none">
                            <Checkbox
                                name="remember"
                                checked={data.remember}
                                onChange={(e) => setData('remember', e.target.checked)}
                                className="text-brand-600 focus:ring-brand-500 rounded border-line-strong w-4 h-4"
                            />
                            <span className="ms-2 text-sm text-content-secondary group-hover:text-brand-700 transition">Manter conectado</span>
                        </label>

                        {canResetPassword && (
                            <Link
                                href={route('password.request')}
                                className="text-xs font-bold text-status-danger-fg hover:text-brand-700 hover:underline"
                            >
                                Esqueceu a senha?
                            </Link>
                        )}
                    </div>

                    {/* BOTÃO DE AÇÃO */}
                    <div className="pt-2">
                        <PrimaryButton 
                            className="w-full justify-center py-4 bg-gradient-to-r from-brand-700 to-brand-600 hover:from-brand-800 hover:to-brand-700 focus:ring-brand-500 text-lg shadow-lg hover:shadow-brand-900/30 transform hover:-translate-y-0.5 transition-all duration-200 rounded-xl" 
                            disabled={processing}
                        >
                            {processing ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Validando...
                                </span>
                            ) : (
                                'ACESSAR PAINEL'
                            )}
                        </PrimaryButton>
                    </div>
                </form>
            </div>

            {/* RODAPÉ */}
            <div className="mt-8 flex flex-col items-center gap-2 opacity-80 text-white">
                <p className="text-xs font-light tracking-wide">
                    &copy; {new Date().getFullYear()} BySabel Logística.
                </p>
                <div className="flex gap-3 text-[10px] text-brand-200 uppercase font-bold tracking-widest border-t border-brand-700 pt-2">
                    <span>V3.0</span>
                    <span>•</span>
                    <span>Hub & Spoke</span>
                    <span>•</span>
                    <span>Milk Run</span>
                </div>
            </div>
        </div>
    );
}