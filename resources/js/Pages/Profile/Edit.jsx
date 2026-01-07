import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import { Head, Link } from '@inertiajs/react';

export default function Edit({ auth, mustVerifyEmail, status }) {
    const user = auth.user;

    // Definições visuais por perfil
    const perfilConfig = {
        loja: {
            label: 'LOJA / REVENDA AUTORIZADA',
            bg: 'bg-gradient-to-r from-red-700 to-red-500',
            icon: '🏪',
            desc: 'Gerencie os dados de contato da sua filial e mantenha sua senha segura.'
        },
        cd: {
            label: 'OPERAÇÃO CD & LOGÍSTICA',
            bg: 'bg-gradient-to-r from-gray-800 to-gray-700',
            icon: '🏭',
            desc: 'Perfil operacional. Mantenha seus dados atualizados para auditoria.'
        },
        admin: {
            label: 'ADMINISTRADOR DO SISTEMA',
            bg: 'bg-gradient-to-r from-black to-gray-900',
            icon: '🛡️',
            desc: 'Acesso total. Utilize senhas fortes para garantir a segurança do sistema.'
        }
    }[user.perfil] || { label: 'USUÁRIO', bg: 'bg-blue-600', icon: '👤', desc: '' };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-bold text-xl text-gray-800 leading-tight">Meu Perfil</h2>}
        >
            <Head title="Perfil" />

            <div className="py-12 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">

                    {/* --- CARTÃO DE IDENTIDADE (CABEÇALHO) --- */}
                    <div className={`rounded-2xl shadow-lg overflow-hidden text-white ${perfilConfig.bg}`}>
                        <div className="p-8 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-6">

                            {/* Ícone / Avatar */}
                            <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm border-2 border-white/30">
                                <span className="text-5xl">{perfilConfig.icon}</span>
                            </div>

                            {/* Dados do Usuário */}
                            <div className="text-center md:text-left flex-1">
                                <div className="text-xs font-bold tracking-widest uppercase opacity-75 mb-1">
                                    {perfilConfig.label}
                                </div>
                                <h3 className="text-3xl font-black tracking-tight">{user.name}</h3>
                                <p className="text-white/80 font-mono text-sm mt-1">{user.email}</p>

                                {/* Informações Específicas */}
                                <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-4">
                                    <div className="bg-black/30 px-4 py-2 rounded-lg border border-white/10">
                                        <span className="block text-[10px] uppercase opacity-60">Filial / Local</span>
                                        <span className="font-bold">{user.filial || 'Matriz Administrativa'}</span>
                                    </div>
                                    <div className="bg-black/30 px-4 py-2 rounded-lg border border-white/10">
                                        <span className="block text-[10px] uppercase opacity-60">ID do Usuário</span>
                                        <span className="font-mono">#{String(user.id).padStart(4, '0')}</span>
                                    </div>
                                    <div className="bg-black/30 px-4 py-2 rounded-lg border border-white/10">
                                        <span className="block text-[10px] uppercase opacity-60">Status</span>
                                        <span className="font-bold text-green-400 flex items-center gap-1">
                                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Ativo
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Botão de Ação Rápida */}
                            <div className="hidden md:block">
                                <Link
                                    href={route('dashboard')}
                                    className="bg-white text-gray-900 px-6 py-3 rounded-lg font-bold shadow hover:bg-gray-100 transition flex items-center gap-2"
                                >
                                    Voltar ao Painel ➜
                                </Link>
                            </div>
                        </div>

                        {/* Barra de Descrição */}
                        <div className="bg-black/20 p-4 text-center md:text-left text-sm font-medium text-white/90 border-t border-white/10">
                            {perfilConfig.desc}
                        </div>
                    </div>

                    {/* --- GRID DE FORMULÁRIOS --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Coluna 1: Dados Cadastrais */}
                        <div className="p-4 sm:p-8 bg-white shadow sm:rounded-lg border-t-4 border-blue-500">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                                <span className="text-2xl">📝</span>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Informações da Conta</h3>
                                    <p className="text-sm text-gray-500">Atualize seu nome e e-mail de contato.</p>
                                </div>
                            </div>
                            <UpdateProfileInformationForm
                                mustVerifyEmail={mustVerifyEmail}
                                status={status}
                                className="max-w-xl"
                            />
                        </div>

                        {/* Coluna 2: Segurança */}
                        <div className="p-4 sm:p-8 bg-white shadow sm:rounded-lg border-t-4 border-red-600">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                                <span className="text-2xl">🔒</span>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Segurança da Senha</h3>
                                    <p className="text-sm text-gray-500">Recomendamos senhas longas com símbolos.</p>
                                </div>
                            </div>
                            <UpdatePasswordForm className="max-w-xl" />
                        </div>
                    </div>

                    {/* Rodapé da Página */}
                    <div className="text-center text-xs text-gray-400 mt-8">
                        <p>Último acesso: {new Date().toLocaleString('pt-BR')}</p>
                        <p>IP: Protegido pelo sistema.</p>
                    </div>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}