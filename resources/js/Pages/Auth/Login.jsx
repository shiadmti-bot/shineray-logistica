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

    // Estado do "Olhinho" da senha
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
        // --- LAYOUT MODERNO INTEGRADO ---
        <div className="min-h-screen flex flex-col sm:justify-center items-center pt-6 sm:pt-0 bg-gradient-to-br from-red-900 to-red-600">
            <Head title="Login - Shineray Logística" />

            {/* LOGO ANIMADA */}
            <div className="mb-6 transform hover:scale-105 transition-transform duration-500">
                <div className="bg-white p-4 rounded-full shadow-2xl flex items-center justify-center w-28 h-28 border-4 border-red-800">
                    <img 
                        src="/img/logo.png" 
                        alt="Logo Shineray" 
                        className="w-20 h-auto object-contain" 
                    />
                </div>
            </div>

            {/* CARD DE LOGIN */}
            <div className="w-full sm:max-w-md mt-4 px-8 py-8 bg-white shadow-2xl overflow-hidden sm:rounded-2xl border-b-8 border-red-800 relative">
                
                {/* Cabeçalho do Card */}
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Acesso Restrito</h2>
                    <p className="text-sm text-red-600 font-bold tracking-widest uppercase mt-1">Shineray By Sabel Logística</p>
                </div>

                {status && <div className="mb-4 font-medium text-sm text-green-600 bg-green-50 p-3 rounded border border-green-200 text-center">{status}</div>}

                <form onSubmit={submit} className="space-y-5">
                    
                    {/* EMAIL */}
                    <div>
                        <InputLabel htmlFor="email" value="E-mail Corporativo" className="text-gray-700 font-bold" />
                        <div className="relative mt-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-400">📧</span>
                            </div>
                            <TextInput
                                id="email"
                                type="email"
                                name="email"
                                value={data.email}
                                className="block w-full pl-10 border-gray-300 focus:border-red-500 focus:ring-red-500 rounded-lg shadow-sm"
                                autoComplete="username"
                                isFocused={true}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder="seu.nome@shineray.com"
                            />
                        </div>
                        <InputError message={errors.email} className="mt-2" />
                    </div>

                    {/* SENHA COM OLHINHO */}
                    <div>
                        <InputLabel htmlFor="password" value="Senha de Acesso" className="text-gray-700 font-bold" />
                        <div className="relative mt-1">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-400">🔒</span>
                            </div>
                            
                            <TextInput
                                id="password"
                                type={showPassword ? "text" : "password"} // Alterna o tipo
                                name="password"
                                value={data.password}
                                className="block w-full pl-10 pr-10 border-gray-300 focus:border-red-500 focus:ring-red-500 rounded-lg shadow-sm"
                                autoComplete="current-password"
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder="••••••••"
                            />

                            {/* Botão Mostrar/Ocultar */}
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-600 transition-colors focus:outline-none"
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

                    <div className="flex items-center justify-between mt-4">
                        <label className="flex items-center">
                            <Checkbox
                                name="remember"
                                checked={data.remember}
                                onChange={(e) => setData('remember', e.target.checked)}
                                className="text-red-600 focus:ring-red-500"
                            />
                            <span className="ms-2 text-sm text-gray-600">Manter conectado</span>
                        </label>

                        {canResetPassword && (
                            <Link
                                href={route('password.request')}
                                className="text-sm text-red-600 hover:text-red-800 hover:underline font-semibold"
                            >
                                Esqueceu?
                            </Link>
                        )}
                    </div>

                    <div className="pt-2">
                        <PrimaryButton 
                            className="w-full justify-center py-3 bg-red-700 hover:bg-red-800 focus:ring-red-500 text-lg shadow-lg transform hover:-translate-y-0.5 transition-all" 
                            disabled={processing}
                        >
                            {processing ? 'Autenticando...' : 'ENTRAR NO SISTEMA'}
                        </PrimaryButton>
                    </div>
                </form>
            </div>

            <div className="mt-8 text-red-200 text-xs opacity-70">
                &copy; {new Date().getFullYear()} Shineray Sabel. Uso exclusivo interno.
            </div>
        </div>
    );
}