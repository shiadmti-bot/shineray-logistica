import OneSignal from 'react-onesignal';
import axios from 'axios';
import { useState, useEffect, useRef } from 'react';
import Dropdown from '@/Components/Dropdown';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import Toast from '@/Components/Toast';
import { Link, usePage } from '@inertiajs/react';
import { 
    HomeIcon, 
    CalendarIcon, 
    PlusCircleIcon, 
    ArchiveBoxIcon, 
    TruckIcon, 
    ClipboardDocumentListIcon, 
    FolderIcon, 
    CubeIcon, 
    UsersIcon, 
    QuestionMarkCircleIcon, 
    BookOpenIcon,
    ChartBarIcon, 
    Cog6ToothIcon,  // Settings
    ArrowRightOnRectangleIcon, // Logout
    EnvelopeIcon,
    PhoneIcon,
    ClockIcon,
    PresentationChartLineIcon
} from '@heroicons/react/24/outline';

export default function Authenticated({ user, header, children }) {
    const { props } = usePage();
    
    // 1. Garante que temos o usuário (prioridade para prop direta, fallback para page prop)
    const currentUser = user || props.auth.user; 
    
    const [showingNavigationDropdown, setShowingNavigationDropdown] = useState(false);
    
    // 2. REF para impedir inicialização dupla do OneSignal
    const oneSignalInit = useRef(false);

    // --- EFEITO DO ONESIGNAL BLINDADO ---
    useEffect(() => {
        const runOneSignal = async () => {
            if (oneSignalInit.current || typeof window === 'undefined') return;
            oneSignalInit.current = true;

            try {
                // Pega ID do Backend (via Inertia Middleware)
                const appId = props.config?.onesignal_app_id || "a114f37e-c4b7-4fb4-a580-51d78c8bfa57"; // Fallback se falhar

                await OneSignal.init({ 
                    appId: appId, 
                    allowLocalhostAsSecureOrigin: true, 
                    notifyButton: { enable: true }, 
                });

                try {
                    if (OneSignal.Slidedown) {
                        OneSignal.Slidedown.promptPush();
                    } else if (typeof OneSignal.ShowSlidedownPrompt === 'function') {
                        OneSignal.ShowSlidedownPrompt();
                    }
                } catch(e) { /* Silencia erros de bloqueadores */ }

                OneSignal.User.PushSubscription.addEventListener("change", async (event) => {
                    if (event.current.optedIn) {
                        const userId = await OneSignal.User.getOnesignalId();
                        if (userId) {
                            axios.post('/user/onesignal', { onesignal_id: userId }).catch(() => {});
                        }
                    }
                });

            } catch (error) {
                console.warn("OneSignal status:", error);
            }
        };

        runOneSignal();
    }, []);

    // 3. SE NÃO TIVER USUÁRIO, REDIRECIONA
    if (!currentUser) {
        if (typeof window !== 'undefined') window.location.href = '/login';
        return null;
    }

    // 4. HELPER: ROTA SEGURA
    const safeRoute = (name, params = undefined) => {
        try {
            // @ts-ignore
            return route(name, params);
        } catch (e) {
            return '#';
        }
    };

    // 5. HELPER: VERIFICA ROTA ATIVA
    const isCurrent = (name) => {
        try { return route().current(name); } catch(e) { return false; }
    }

    // Componente de Link Customizado (Visual V2)
    const CustomNavLink = ({ active, href, children }) => (
        <Link
            href={href}
            className={`inline-flex items-center px-2 pt-1 border-b-4 text-sm font-bold leading-5 transition duration-150 ease-in-out h-full gap-1
            ${active 
                ? 'border-white text-white bg-white/10' 
                : 'border-transparent text-red-100 hover:text-white hover:border-red-300 hover:bg-white/5'
            }`}
        >
            {children}
        </Link>
    );

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
            
            <Toast />

            {/* --- BARRA DE NAVEGAÇÃO --- */}
            <nav className="bg-gradient-to-r from-red-900 to-red-700 shadow-xl border-b border-red-900 z-50 print:hidden relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20">
                        <div className="flex">
                            {/* Logo + Marca */}
                            <div className="shrink-0 flex items-center gap-3">
                                <Link href="/">
                                    <div className="bg-white p-2 rounded-xl shadow-lg w-14 h-14 flex items-center justify-center transition hover:scale-105 hover:rotate-3">
                                        <img src="/img/logo.png" alt="Shineray" className="h-8 w-auto object-contain" />
                                    </div>
                                </Link>
                                <div className="hidden md:block leading-tight text-white">
                                    <span className="block font-black uppercase tracking-widest text-lg">BY SABEL</span>
                                    <span className="block text-[10px] font-light tracking-widest opacity-80 uppercase">Logística & Distribuição</span>
                                </div>
                            </div>

                            {/* --- MENU DESKTOP --- */}
                            <div className="hidden space-x-1 sm:-my-px sm:ml-6 sm:flex items-center h-20">
                                
                                {/* 1. DASHBOARD (TODOS) */}
                                <CustomNavLink href={safeRoute('dashboard')} active={isCurrent('dashboard')}>
                                    <HomeIcon className="w-5 h-5" /> Dashboard
                                </CustomNavLink>

                                {/* 2. CALENDÁRIO (NOVO V2 - TODOS) */}
                                <CustomNavLink href={safeRoute('calendar.index')} active={isCurrent('calendar.*')}>
                                    <CalendarIcon className="w-5 h-5" /> Calendário
                                </CustomNavLink>

                                {/* 3. BI (ADMIN/GESTOR) */}
                                {['admin', 'gestor'].includes(currentUser.perfil) && (
                                    <CustomNavLink href={safeRoute('bi.index')} active={isCurrent('bi.*')}>
                                        <PresentationChartLineIcon className="w-5 h-5" /> BI Logística
                                    </CustomNavLink>
                                )}

                                {/* 3. LINKS ESPECÍFICOS POR PERFIL */}
                                
                                {/* LOJA */}
                                {currentUser.perfil === 'loja' && (
                                    <>
                                        <CustomNavLink href={safeRoute('solicitar')} active={isCurrent('solicitar')}>
                                            <PlusCircleIcon className="w-5 h-5" /> Nova Solicitação
                                        </CustomNavLink>
                                        <CustomNavLink href={safeRoute('motos.index')} active={isCurrent('motos.*')}>
                                            <CubeIcon className="w-5 h-5" /> Estoque
                                        </CustomNavLink>
                                        <CustomNavLink href={safeRoute('pedidos.index')} active={isCurrent('pedidos.*')}>
                                            <ArchiveBoxIcon className="w-5 h-5" /> Meus Pedidos
                                        </CustomNavLink>
                                    </>
                                )}

                                {/* CD (Operacional) */}
                                {currentUser.perfil === 'cd' && (
                                    <>
                                        <CustomNavLink href={safeRoute('romaneios.create')} active={isCurrent('romaneios.create')}>
                                            <TruckIcon className="w-5 h-5" /> Expedição
                                        </CustomNavLink>
                                        <CustomNavLink href={safeRoute('pedidos.index')} active={isCurrent('pedidos.*')}>
                                            <ClipboardDocumentListIcon className="w-5 h-5" /> Conferência
                                        </CustomNavLink>
                                        <CustomNavLink href={safeRoute('romaneios.index')} active={isCurrent('romaneios.index')}>
                                            <FolderIcon className="w-5 h-5" /> Cargas
                                        </CustomNavLink>
                                        <CustomNavLink href={safeRoute('motos.index')} active={isCurrent('motos.*')}>
                                            <CubeIcon className="w-5 h-5" /> Estoque
                                        </CustomNavLink>
                                    </>
                                )}

                                {/* GESTOR / ADMIN */}
                                {['admin', 'gestor'].includes(currentUser.perfil) && (
                                    <>
                                        <CustomNavLink href={safeRoute('pedidos.index')} active={isCurrent('pedidos.*')}>
                                            <ChartBarIcon className="w-5 h-5" /> Pedidos
                                        </CustomNavLink>
                                        <CustomNavLink href={safeRoute('romaneios.index')} active={isCurrent('romaneios.*')}>
                                            <TruckIcon className="w-5 h-5" /> Cargas
                                        </CustomNavLink>
                                        <CustomNavLink href={safeRoute('motos.index')} active={isCurrent('motos.*')}>
                                            <CubeIcon className="w-5 h-5" /> Estoque
                                        </CustomNavLink>
                                    </>
                                )}

                                {/* ADMIN MASTER */}
                                {currentUser.perfil === 'admin' && (
                                    <CustomNavLink href={safeRoute('users.index')} active={isCurrent('users.*')}>
                                        <UsersIcon className="w-5 h-5" /> Usuários
                                    </CustomNavLink>
                                )}

                                {/* 4. AJUDA (TODOS) */}
                                <CustomNavLink href={safeRoute('manual')} active={isCurrent('manual')}>
                                    <QuestionMarkCircleIcon className="w-5 h-5" /> Ajuda
                                </CustomNavLink>
                            </div>
                        </div>

                        {/* Dropdown do Usuário */}
                        <div className="hidden sm:flex sm:items-center sm:ml-6">
                            <div className="ml-3 relative">
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <span className="inline-flex rounded-md shadow-sm">
                                            <button type="button" className="inline-flex items-center px-4 py-2 border border-transparent text-sm leading-4 font-bold rounded-full text-red-900 bg-white hover:bg-gray-100 focus:outline-none transition ease-in-out duration-150 shadow-md">
                                                {currentUser.name.split(' ')[0]}
                                                <svg className="ml-2 -mr-0.5 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </span>
                                    </Dropdown.Trigger>

                                    <Dropdown.Content>
                                        <div className="px-4 py-3 text-xs text-gray-500 border-b font-mono uppercase bg-gray-50">
                                            <div className="font-bold text-gray-800">{currentUser.name}</div>
                                            <div className="mt-1">Perfil: <strong className="text-red-600">{currentUser.perfil}</strong></div>
                                            <div className="mt-1 truncate">{currentUser.filial || 'Matriz'}</div>
                                        </div>
                                        <Dropdown.Link href={safeRoute('profile.edit')} className="flex items-center gap-2">
                                            <Cog6ToothIcon className="w-4 h-4" /> Configurações
                                        </Dropdown.Link>
                                        <Dropdown.Link href={safeRoute('logout')} method="post" as="button" className="text-red-600 font-bold flex items-center gap-2">
                                            <ArrowRightOnRectangleIcon className="w-4 h-4" /> Sair do Sistema
                                        </Dropdown.Link>
                                    </Dropdown.Content>
                                </Dropdown>
                            </div>
                        </div>

                        {/* Botão Mobile (Hamburger) */}
                        <div className="-mr-2 flex items-center sm:hidden">
                            <button onClick={() => setShowingNavigationDropdown((previousState) => !previousState)} className="inline-flex items-center justify-center p-2 rounded-md text-red-100 hover:text-white hover:bg-red-800 focus:outline-none transition duration-150 ease-in-out">
                                <svg className="h-8 w-8" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                    <path className={!showingNavigationDropdown ? 'inline-flex' : 'hidden'} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                    <path className={showingNavigationDropdown ? 'inline-flex' : 'hidden'} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- MENU MOBILE --- */}
                <div className={(showingNavigationDropdown ? 'block' : 'hidden') + ' sm:hidden bg-red-900 border-t border-red-800 shadow-inner'}>
                    <div className="pt-2 pb-3 space-y-1">
                        <ResponsiveNavLink href={safeRoute('dashboard')} active={isCurrent('dashboard')} className="text-white bg-red-800/50 flex items-center gap-2">
                            <HomeIcon className="w-5 h-5" /> Dashboard
                        </ResponsiveNavLink>
                        
                        <ResponsiveNavLink href={safeRoute('calendar.index')} active={isCurrent('calendar.*')} className="text-white flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5" /> Calendário Logístico
                        </ResponsiveNavLink>

                        {['admin', 'gestor'].includes(currentUser.perfil) && (
                            <ResponsiveNavLink href={safeRoute('bi.index')} active={isCurrent('bi.*')} className="text-yellow-300 font-bold flex items-center gap-2 bg-white/10">
                                <PresentationChartLineIcon className="w-5 h-5" /> BI Executivo
                            </ResponsiveNavLink>
                        )}

                        {/* Mobile LOJA */}
                        {currentUser.perfil === 'loja' && (
                            <>
                                <ResponsiveNavLink href={safeRoute('solicitar')} className="text-red-100 flex items-center gap-2">
                                    <PlusCircleIcon className="w-5 h-5" /> Nova Solicitação
                                </ResponsiveNavLink>
                                <ResponsiveNavLink href={safeRoute('motos.index')} className="text-red-100 flex items-center gap-2">
                                    <CubeIcon className="w-5 h-5" /> Estoque
                                </ResponsiveNavLink>
                                <ResponsiveNavLink href={safeRoute('pedidos.index')} className="text-red-100 flex items-center gap-2">
                                    <ArchiveBoxIcon className="w-5 h-5" /> Meus Pedidos
                                </ResponsiveNavLink>
                            </>
                        )}

                        {/* Mobile CD */}
                        {currentUser.perfil === 'cd' && (
                            <>
                                <ResponsiveNavLink href={safeRoute('romaneios.create')} className="text-red-100 flex items-center gap-2">
                                    <TruckIcon className="w-5 h-5" /> Expedição
                                </ResponsiveNavLink>
                                <ResponsiveNavLink href={safeRoute('pedidos.index')} className="text-red-100 flex items-center gap-2">
                                    <ClipboardDocumentListIcon className="w-5 h-5" /> Conferência
                                </ResponsiveNavLink>
                                <ResponsiveNavLink href={safeRoute('romaneios.index')} className="text-red-100 flex items-center gap-2">
                                    <FolderIcon className="w-5 h-5" /> Histórico Cargas
                                </ResponsiveNavLink>
                                <ResponsiveNavLink href={safeRoute('motos.index')} className="text-red-100 flex items-center gap-2">
                                    <CubeIcon className="w-5 h-5" /> Estoque
                                </ResponsiveNavLink>
                            </>
                        )}

                        {/* Mobile ADMIN/GESTOR */}
                        {['admin', 'gestor'].includes(currentUser.perfil) && (
                            <>
                                <ResponsiveNavLink href={safeRoute('pedidos.index')} className="text-red-100 flex items-center gap-2">
                                    <ChartBarIcon className="w-5 h-5" /> Auditoria Pedidos
                                </ResponsiveNavLink>
                                <ResponsiveNavLink href={safeRoute('romaneios.index')} className="text-red-100 flex items-center gap-2">
                                    <TruckIcon className="w-5 h-5" /> Auditoria Cargas
                                </ResponsiveNavLink>
                                <ResponsiveNavLink href={safeRoute('motos.index')} className="text-red-100 flex items-center gap-2">
                                    <CubeIcon className="w-5 h-5" /> Estoque
                                </ResponsiveNavLink>
                            </>
                        )}
                        
                        {currentUser.perfil === 'admin' && (
                            <ResponsiveNavLink href={safeRoute('users.index')} className="text-red-100 flex items-center gap-2">
                                <UsersIcon className="w-5 h-5" /> Usuários
                            </ResponsiveNavLink>
                        )}

                        <ResponsiveNavLink href={safeRoute('manual')} className="text-yellow-300 flex items-center gap-2">
                            <BookOpenIcon className="w-5 h-5" /> Ajuda / Manual
                        </ResponsiveNavLink>
                    </div>

                    <div className="pt-4 pb-4 border-t border-red-800 bg-red-950/30">
                        <div className="px-4 flex items-center gap-3">
                            <div className="bg-white text-red-900 rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg">
                                {currentUser.name.charAt(0)}
                            </div>
                            <div>
                                <div className="font-medium text-base text-white">{currentUser.name}</div>
                                <div className="font-medium text-sm text-red-300">{currentUser.email}</div>
                            </div>
                        </div>
                        <div className="mt-3 space-y-1">
                            <ResponsiveNavLink href={safeRoute('profile.edit')} className="text-red-200 flex items-center gap-2">
                                <Cog6ToothIcon className="w-5 h-5" /> Perfil
                            </ResponsiveNavLink>
                            <ResponsiveNavLink href={safeRoute('logout')} method="post" as="button" className="text-red-200 flex items-center gap-2">
                                <ArrowRightOnRectangleIcon className="w-5 h-5" /> Sair
                            </ResponsiveNavLink>
                        </div>
                    </div>
                </div>
            </nav>

            {/* --- CABEÇALHO DA PÁGINA --- */}
            {header && (
                <header className="bg-white shadow z-30 relative print:hidden">
                    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex items-center gap-4">
                        <button onClick={() => window.history.back()} className="p-2 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all shadow-sm group" title="Voltar">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 group-hover:-translate-x-1 transition-transform">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                        </button>
                        <div className="flex-1">{header}</div>
                    </div>
                </header>
            )}

            {/* --- CONTEÚDO PRINCIPAL --- */}
            <main className="flex-grow">
                {children}
            </main>

            {/* --- RODAPÉ V2 (BY SABEL LOGÍSTICA) --- */}
            <footer className="bg-gray-900 text-white pt-12 pb-8 print:hidden mt-auto border-t-4 border-red-900 relative">
                {/* Elemento Decorativo */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -mt-1">
                    <div className="w-20 h-1 bg-red-600 rounded-b-lg shadow-[0_0_10px_rgba(220,38,38,0.8)]"></div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-10 border-b border-gray-800 pb-10">
                        
                        {/* COLUNA 1: IDENTIDADE */}
                        <div>
                            <div className="flex items-center gap-3 mb-5">
                                <div className="bg-white p-1.5 rounded flex items-center justify-center h-10 w-10">
                                    <img src="/img/logo.png" className="h-auto w-full object-contain" alt="Logo Footer" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-black text-xl tracking-widest uppercase text-white leading-none">By Sabel</span>
                                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-[0.35em]">Logística</span>
                                </div>
                            </div>
                            <p className="text-gray-500 text-sm leading-relaxed max-w-xs border-l-2 border-gray-700 pl-3">
                                Sistema integrado de gestão de estoque, transferências (Milk Run) e expedição (Hub & Spoke).
                            </p>
                        </div>

                        {/* COLUNA 2: NAVEGAÇÃO */}
                        <div>
                            <h4 className="font-bold text-white mb-5 uppercase text-xs tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 bg-red-600 rounded-full"></span> Acesso Rápido
                            </h4>
                            <ul className="space-y-3 text-sm text-gray-400">
                                <li>
                                    <Link href={route('dashboard')} className="hover:text-red-500 transition flex items-center gap-2 group">
                                        <HomeIcon className="w-4 h-4 opacity-50 group-hover:opacity-100 transition" /> Dashboard Geral
                                    </Link>
                                </li>
                                <li>
                                    <Link href={route('pedidos.index')} className="hover:text-red-500 transition flex items-center gap-2 group">
                                        <ArchiveBoxIcon className="w-4 h-4 opacity-50 group-hover:opacity-100 transition" /> Meus Pedidos
                                    </Link>
                                </li>
                                <li>
                                    <Link href={route('manual')} className="hover:text-red-500 transition flex items-center gap-2 group">
                                        <QuestionMarkCircleIcon className="w-4 h-4 opacity-50 group-hover:opacity-100 transition" /> Central de Ajuda
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        {/* COLUNA 3: SUPORTE & CRÉDITOS */}
                        <div>
                            <h4 className="font-bold text-white mb-5 uppercase text-xs tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Suporte Técnico
                            </h4>
                            <ul className="space-y-4 text-sm text-gray-400">
                                <li className="flex items-start gap-3">
                                    <div className="bg-gray-800 p-2 rounded text-red-400 mt-0.5">
                                        <EnvelopeIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <span className="block text-xs text-gray-500 uppercase font-bold">E-mail</span>
                                        <a href="mailto:ti@shineraybysabel.com.br" className="hover:text-white transition">ti@shineraybysabel.com.br</a>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="bg-gray-800 p-2 rounded text-green-400 mt-0.5">
                                        <PhoneIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <span className="block text-xs text-gray-500 uppercase font-bold">Telefone / WhatsApp</span>
                                        <span className="hover:text-white transition font-mono">(91) 98492-8535</span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="bg-gray-800 p-2 rounded text-blue-400 mt-0.5">
                                        <ClockIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <span className="block text-xs text-gray-500 uppercase font-bold">Horário de Atendimento</span>
                                        <span className="text-gray-300">Seg - Sex: 08:00 às 18:00</span>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* RODAPÉ INFERIOR (CRÉDITOS) */}
                    <div className="flex flex-col md:flex-row justify-between items-center text-xs text-gray-600 gap-4">
                        <p>&copy; {new Date().getFullYear()} By Sabel Logística. Todos os direitos reservados. <span className="opacity-50 ml-2">v2.5</span></p>
                        
                        <div className="flex items-center gap-3 bg-gray-800/50 px-4 py-2 rounded-full border border-gray-800">
                            <span className="text-gray-500 uppercase tracking-wider font-bold text-[10px]">Desenvolvimento & Arquitetura</span>
                            <span className="text-gray-300 font-bold">Délcio Farias Dias Neto</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}