import AppLayout from '@/Layouts/AppLayout';
import { PageHeader } from '@/Components/UI';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import { Head, Link } from '@inertiajs/react';
import { 
    UserCircleIcon, 
    BuildingStorefrontIcon, 
    ShieldCheckIcon, 
    CalendarDaysIcon,
    KeyIcon,
    IdentificationIcon,
    CheckBadgeIcon,
    ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';

export default function Edit({ auth, mustVerifyEmail, status }) {
    const user = auth.user;

    const perfilConfig = {
        loja: {
            label: 'PONTO DE VENDA & FILIAL',
            bg: 'bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800',
            icon: '🏪',
            role: 'LOJA / FILIAL',
            desc: 'Gerencie os dados cadastrais da sua filial para comunicação e pedidos de reposição com o Centro de Distribuição.'
        },
        cd: {
            label: 'HUB LOGÍSTICO / CD',
            bg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950',
            icon: '🏭',
            role: 'OPERAÇÃO CD',
            desc: 'Perfil operacional do Centro de Distribuição. Mantenha seus dados seguros para auditoria de expedição e romaneios.'
        },
        admin: {
            label: 'ADMINISTRADOR GLOBAL',
            bg: 'bg-gradient-to-br from-neutral-950 via-slate-900 to-neutral-900',
            icon: '🛡️',
            role: 'GESTOR DO SISTEMA',
            desc: 'Acesso irrestrito de governança, parametrização de estoque, regras de separação e segurança do ecossistema.'
        },
        gestor: {
            label: 'GESTOR REGIONAL / COMERCIAL',
            bg: 'bg-gradient-to-br from-brand-900 via-slate-900 to-brand-800',
            icon: '📊',
            role: 'ANÁLISE & APROVAÇÃO',
            desc: 'Acesso tático e gerencial para aprovações de pedidos de motos, cortes parciais e auditoria de BI.'
        }
    }[user.perfil] || { 
        label: 'COLABORADOR', 
        bg: 'bg-gradient-to-br from-slate-800 to-slate-900', 
        icon: '👤', 
        role: 'USUÁRIO', 
        desc: 'Bem-vindo ao sistema Shineray By Sabel Logística.' 
    };

    return (
        <AppLayout user={auth.user}>
            <Head title="Meu Perfil - Shineray By Sabel" />
            <PageHeader
                title="Configurações da Conta"
                description="Gerencie seus dados de acesso, preferências corporativas e credenciais de segurança."
                breadcrumbs={[
                    { label: 'Início', href: route('dashboard') },
                    { label: 'Meu Perfil' },
                ]}
            />

            <div className="space-y-8">

                {/* --- CARTÃO DE IDENTIDADE V3 --- */}
                <div className={`rounded-3xl shadow-2xl overflow-hidden text-white relative border border-white/10 ${perfilConfig.bg}`}>
                    
                    {/* Efeitos de Iluminação de Fundo */}
                    <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-60 h-60 bg-black/40 rounded-full blur-2xl pointer-events-none"></div>

                    <div className="relative p-6 sm:p-10 flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8">

                        {/* Avatar com Efeito Glass */}
                        <div className="flex-shrink-0">
                            <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl text-5xl sm:text-6xl">
                                {perfilConfig.icon}
                            </div>
                        </div>

                        {/* Dados do Usuário */}
                        <div className="text-center md:text-left flex-1 space-y-2">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 border border-white/15 text-[11px] font-black tracking-wider uppercase">
                                <span className="w-2 h-2 rounded-full bg-status-success-solid animate-pulse"></span>
                                {perfilConfig.label}
                            </div>
                            
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                                    {user.name}
                                </h2>
                                <p className="text-white/70 font-mono text-xs sm:text-sm mt-0.5">{user.email}</p>
                            </div>

                            {/* Chips de Informação */}
                            <div className="pt-3 flex flex-wrap justify-center md:justify-start gap-2.5">
                                <div className="bg-white/10 px-3.5 py-2 rounded-xl border border-white/10 backdrop-blur-sm flex items-center gap-2">
                                    <BuildingStorefrontIcon className="w-4 h-4 text-white/70" />
                                    <div>
                                        <span className="block text-[9px] uppercase text-white/60 font-bold">Unidade / Filial</span>
                                        <span className="font-bold text-xs">{user.filial || 'Matriz / Geral'}</span>
                                    </div>
                                </div>
                                <div className="bg-white/10 px-3.5 py-2 rounded-xl border border-white/10 backdrop-blur-sm flex items-center gap-2">
                                    <ShieldCheckIcon className="w-4 h-4 text-white/70" />
                                    <div>
                                        <span className="block text-[9px] uppercase text-white/60 font-bold">Perfil</span>
                                        <span className="font-mono text-xs font-bold">{perfilConfig.role}</span>
                                    </div>
                                </div>
                                {user.created_at && (
                                    <div className="bg-white/10 px-3.5 py-2 rounded-xl border border-white/10 backdrop-blur-sm hidden sm:flex items-center gap-2">
                                        <CalendarDaysIcon className="w-4 h-4 text-white/70" />
                                        <div>
                                            <span className="block text-[9px] uppercase text-white/60 font-bold">Membro Desde</span>
                                            <span className="font-mono text-xs font-bold">{new Date(user.created_at).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Ações Rápidas */}
                        <div className="flex flex-row md:flex-col gap-2.5 w-full md:w-auto justify-center">
                            <Link
                                href={route('dashboard')}
                                className="bg-white text-slate-900 px-5 py-2.5 rounded-xl font-bold shadow-md hover:bg-slate-100 transition flex items-center justify-center gap-2 text-xs"
                            >
                                <span>Painel Principal</span>
                                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                            </Link>
                            {user.perfil === 'loja' && (
                                <Link
                                    href={route('solicitar')}
                                    className="bg-brand-600/80 text-white px-5 py-2.5 rounded-xl font-bold border border-white/20 hover:bg-brand-600 transition flex items-center justify-center gap-2 text-xs backdrop-blur-sm"
                                >
                                    <span>Fazer Pedido</span>
                                    <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Rodapé Informativo do Cartão */}
                    <div className="bg-black/25 px-6 sm:px-10 py-3 text-center md:text-left text-xs font-medium text-white/80 border-t border-white/10 flex items-center gap-2">
                        <span className="text-sm">💡</span> {perfilConfig.desc}
                    </div>
                </div>

                {/* --- ÁREA DE EDIÇÃO (GRID) --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Coluna 1: Dados Cadastrais */}
                    <div className="bg-surface-card p-6 sm:p-8 shadow-card rounded-3xl border border-line relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-600 to-brand-500"></div>
                        
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shadow-xs">
                                <IdentificationIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-content-primary leading-tight">Dados Cadastrais</h3>
                                <p className="text-xs text-content-secondary">Atualize seu nome de exibição e e-mail.</p>
                            </div>
                        </div>
                        
                        <UpdateProfileInformationForm
                            mustVerifyEmail={mustVerifyEmail}
                            status={status}
                        />
                    </div>

                    {/* Coluna 2: Segurança */}
                    <div className="bg-surface-card p-6 sm:p-8 shadow-card rounded-3xl border border-line relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-700 to-slate-900"></div>
                        
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-surface-sunken text-content-primary flex items-center justify-center shadow-xs border border-line">
                                <KeyIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-content-primary leading-tight">Segurança da Conta</h3>
                                <p className="text-xs text-content-secondary">Recomendamos alterar sua senha periodicamente.</p>
                            </div>
                        </div>

                        <UpdatePasswordForm />
                    </div>
                </div>

                {/* --- RODAPÉ TÉCNICO --- */}
                <div className="flex justify-center pt-2">
                    <div className="bg-surface-card border border-line rounded-full px-5 py-2 text-[11px] text-content-muted font-bold shadow-xs flex items-center gap-3">
                        <span className="flex items-center gap-1 text-status-success-fg font-black">
                            <CheckBadgeIcon className="w-4 h-4" /> Sessão Segura
                        </span>
                        <span className="w-1 h-1 bg-line-strong rounded-full"></span>
                        <span>Protocolo TLS 1.3</span>
                        <span className="w-1 h-1 bg-line-strong rounded-full"></span>
                        <span>Shineray By Sabel V3.0</span>
                    </div>
                </div>

            </div>
        </AppLayout>
    );
}