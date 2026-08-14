import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import { Head, Link } from '@inertiajs/react';

export default function Edit({ auth, mustVerifyEmail, status }) {
    const user = auth.user;

    // Definições visuais V2 (Hub & Spoke)
    const perfilConfig = {
        loja: {
            label: 'PONTO DE VENDA & COLETA',
            bg: 'bg-gradient-to-br from-red-700 to-red-600',
            border: 'border-red-500',
            icon: '🏪',
            role: 'LOJA / FILIAL',
            desc: 'Gerencie os dados de contato da sua filial para facilitar a comunicação com o CD e Transportadores.'
        },
        cd: {
            label: 'HUB LOGÍSTICO / CD',
            bg: 'bg-gradient-to-br from-gray-800 to-slate-900',
            border: 'border-gray-600',
            icon: '🏭',
            role: 'OPERAÇÃO CD',
            desc: 'Perfil operacional de alta prioridade. Mantenha seus dados seguros para auditoria de expedição.'
        },
        admin: {
            label: 'ADMINISTRADOR GLOBAL',
            bg: 'bg-gradient-to-br from-black to-neutral-900',
            border: 'border-gray-700',
            icon: '🛡️',
            role: 'GESTOR DO SISTEMA',
            desc: 'Acesso irrestrito. Utilize senhas fortes e autenticação de dois fatores se disponível.'
        },
        gestor: {
            label: 'GESTOR COMERCIAL',
            bg: 'bg-gradient-to-br from-purple-800 to-indigo-900',
            border: 'border-purple-600',
            icon: '📊',
            role: 'ANÁLISE & APROVAÇÃO',
            desc: 'Visão tática. Seus dados são usados para registrar aprovações de transferências.'
        }
    }[user.perfil] || { 
        label: 'COLABORADOR', 
        bg: 'bg-blue-600', 
        border: 'border-blue-400',
        icon: '👤', 
        role: 'USUÁRIO', 
        desc: 'Bem-vindo ao sistema Shineray Logística.' 
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-bold text-xl text-gray-800 leading-tight">Configurações da Conta</h2>}
        >
            <Head title="Meu Perfil" />

            <div className="py-12 bg-gray-100 min-h-screen pb-32">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-8">

                    {/* --- CARTÃO DE IDENTIDADE V2 (CABEÇALHO) --- */}
                    <div className={`rounded-3xl shadow-xl overflow-hidden text-white relative ${perfilConfig.bg}`}>
                        
                        {/* Background Pattern (Decorativo) */}
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-black opacity-20 rounded-full blur-2xl pointer-events-none"></div>

                        <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-center md:items-start gap-8">

                            {/* Avatar / Ícone com Efeito Glass */}
                            <div className="flex-shrink-0">
                                <div className={`w-24 h-24 flex items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner text-6xl`}>
                                    {perfilConfig.icon}
                                </div>
                            </div>

                            {/* Dados do Usuário */}
                            <div className="text-center md:text-left flex-1 space-y-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/30 border border-white/10 text-[10px] font-bold tracking-widest uppercase">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                    {perfilConfig.label}
                                </div>
                                
                                <div>
                                    <h3 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-white">
                                        {user.name}
                                    </h3>
                                    <p className="text-white/70 font-mono text-sm mt-1">{user.email}</p>
                                </div>

                                {/* Chips de Informação */}
                                <div className="pt-4 flex flex-wrap justify-center md:justify-start gap-3">
                                    <div className="bg-white/10 px-4 py-2 rounded-lg border border-white/5 backdrop-blur-sm">
                                        <span className="block text-[9px] uppercase opacity-60 font-bold">Unidade / Filial</span>
                                        <span className="font-bold text-sm">{user.filial || 'Matriz / Geral'}</span>
                                    </div>
                                    <div className="bg-white/10 px-4 py-2 rounded-lg border border-white/5 backdrop-blur-sm">
                                        <span className="block text-[9px] uppercase opacity-60 font-bold">Perfil de Acesso</span>
                                        <span className="font-mono text-sm">{perfilConfig.role}</span>
                                    </div>
                                    {user.created_at && (
                                        <div className="bg-white/10 px-4 py-2 rounded-lg border border-white/5 backdrop-blur-sm hidden sm:block">
                                            <span className="block text-[9px] uppercase opacity-60 font-bold">Membro Desde</span>
                                            <span className="font-mono text-sm">{new Date(user.created_at).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Ações Rápidas */}
                            <div className="hidden md:flex flex-col gap-3">
                                <Link
                                    href={route('dashboard')}
                                    className="bg-white text-gray-900 px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-gray-50 hover:scale-105 transition transform flex items-center justify-center gap-2 text-sm"
                                >
                                    <span>📊</span> Painel Principal
                                </Link>
                                {user.perfil === 'loja' && (
                                    <Link
                                        href={route('solicitar')}
                                        className="bg-red-900/50 text-white px-6 py-3 rounded-xl font-bold border border-red-400/30 hover:bg-red-900/70 transition flex items-center justify-center gap-2 text-sm backdrop-blur-sm"
                                    >
                                        <span>📝</span> Fazer Pedido
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* Rodapé do Cartão */}
                        <div className="bg-black/20 p-4 px-8 text-center md:text-left text-xs font-medium text-white/80 border-t border-white/5 flex items-center gap-2">
                            <span className="text-lg">💡</span> {perfilConfig.desc}
                        </div>
                    </div>

                    {/* --- ÁREA DE EDIÇÃO (GRID) --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                        {/* Coluna 1: Dados Cadastrais */}
                        <div className="bg-white p-6 sm:p-8 shadow-sm rounded-2xl border border-gray-200 relative overflow-hidden group hover:border-gray-300 transition">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                            
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl shadow-sm">
                                    📝
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 leading-tight">Dados da Conta</h3>
                                    <p className="text-xs text-gray-500">Atualize suas informações básicas.</p>
                                </div>
                            </div>
                            
                            <UpdateProfileInformationForm
                                mustVerifyEmail={mustVerifyEmail}
                                status={status}
                                className="max-w-xl"
                            />
                        </div>

                        {/* Coluna 2: Segurança */}
                        <div className="bg-white p-6 sm:p-8 shadow-sm rounded-2xl border border-gray-200 relative overflow-hidden group hover:border-red-200 transition">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
                            
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xl shadow-sm">
                                    🔒
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 leading-tight">Segurança</h3>
                                    <p className="text-xs text-gray-500">Altere sua senha periodicamente.</p>
                                </div>
                            </div>

                            <UpdatePasswordForm className="max-w-xl" />
                        </div>
                    </div>

                    {/* --- RODAPÉ TÉCNICO --- */}
                    <div className="flex justify-center mt-8">
                        <div className="bg-gray-200 rounded-full px-6 py-2 text-xs text-gray-500 font-mono shadow-inner flex items-center gap-4">
                            <span>Sessão Segura (SSL)</span>
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                            <span>IP: Protegido</span>
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                            <span>V3.0 Logística</span>
                        </div>
                    </div>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}