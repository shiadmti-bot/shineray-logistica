import { useEffect } from 'react';
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
        <div className="min-h-screen flex items-center justify-center bg-gray-100 relative overflow-hidden">
            <Head title="Acesso ao Sistema" />

            {/* Fundo Decorativo (Onda Vermelha) */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-red-700 rounded-b-[50px] shadow-2xl z-0"></div>

            {/* Card de Login */}
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl z-10 overflow-hidden m-4">
                
                {/* Cabeçalho do Card */}
                <div className="bg-white p-8 pb-0 flex flex-col items-center">
                    {/* LOGO DA SHINERAY */}
                    <img src="/img/logo.png" alt="Shineray" className="h-24 object-contain mb-4" />
                    
                    <h2 className="text-2xl font-extrabold text-gray-800 uppercase tracking-wide">
                        Shineray <span className="text-red-600">By Sabel</span>
                    </h2>
                    <p className="text-sm text-gray-500 font-medium mt-1">Sistema Integrado de Logística</p>
                </div>

                {/* Formulário */}
                <form onSubmit={submit} className="p-8 pt-6">
                    
                    {status && <div className="mb-4 font-medium text-sm text-green-600 text-center">{status}</div>}

                    <div className="space-y-5">
                        {/* Email */}
                        <div>
                            <InputLabel htmlFor="email" value="E-mail Corporativo" className="text-gray-700 font-bold" />
                            <TextInput
                                id="email"
                                type="email"
                                name="email"
                                value={data.email}
                                className="mt-1 block w-full border-gray-300 rounded-lg focus:border-red-500 focus:ring-red-500 shadow-sm py-3"
                                autoComplete="username"
                                isFocused={true}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder="ex: loja@shineray.com"
                            />
                            <InputError message={errors.email} className="mt-2" />
                        </div>

                        {/* Senha */}
                        <div>
                            <InputLabel htmlFor="password" value="Senha" className="text-gray-700 font-bold" />
                            <TextInput
                                id="password"
                                type="password"
                                name="password"
                                value={data.password}
                                className="mt-1 block w-full border-gray-300 rounded-lg focus:border-red-500 focus:ring-red-500 shadow-sm py-3"
                                autoComplete="current-password"
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder="••••••••"
                            />
                            <InputError message={errors.password} className="mt-2" />
                        </div>
                    </div>

                    {/* Lembrar-me e Esqueci Senha */}
                    <div className="flex items-center justify-between mt-6">
                        <label className="flex items-center">
                            <Checkbox
                                name="remember"
                                checked={data.remember}
                                onChange={(e) => setData('remember', e.target.checked)}
                                className="text-red-600 focus:ring-red-500 rounded border-gray-300"
                            />
                            <span className="ms-2 text-sm text-gray-600">Lembrar acesso</span>
                        </label>

                        {canResetPassword && (
                            <Link
                                href={route('password.request')}
                                className="underline text-sm text-gray-500 hover:text-red-600 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                Esqueceu a senha?
                            </Link>
                        )}
                    </div>

                    {/* Botão Entrar */}
                    <div className="mt-8">
                        <PrimaryButton 
                            className="w-full justify-center py-4 bg-red-700 hover:bg-red-800 focus:bg-red-800 active:bg-red-900 text-base font-bold uppercase tracking-wider shadow-lg transform transition hover:scale-[1.02]" 
                            disabled={processing}
                        >
                            {processing ? 'Entrando...' : 'Acessar Painel'}
                        </PrimaryButton>
                    </div>

                    {/* Rodapé do Card */}
                    <div className="mt-6 text-center border-t border-gray-100 pt-4">
                        <p className="text-xs text-gray-400">
                            &copy; {new Date().getFullYear()} Sabel Logística. Todos os direitos reservados.
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}