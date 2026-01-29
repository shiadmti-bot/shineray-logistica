import OneSignal from 'react-onesignal';
import axios from 'axios';
import { useState, useEffect, useRef } from 'react'; // Adicionado useRef
import Dropdown from '@/Components/Dropdown';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import Toast from '@/Components/Toast';
import { Link, usePage } from '@inertiajs/react';

export default function Authenticated({ user, header, children }) {
    const { props } = usePage();
    // 1. Garante que temos o usuário (do prop direto ou do page prop)
    const currentUser = user || props.auth.user; 
    
    const [showingNavigationDropdown, setShowingNavigationDropdown] = useState(false);
    
    // 2. REF para impedir inicialização dupla do OneSignal (Causa comum de erro)
    const oneSignalInit = useRef(false);

    // --- EFEITO DO ONESIGNAL BLINDADO ---
    useEffect(() => {
        const runOneSignal = async () => {
            // Se já rodou uma vez, para aqui imediatamente.
            if (oneSignalInit.current) return;
            oneSignalInit.current = true;

            try {
                // Verificação de segurança para não rodar fora do navegador
                if (typeof window === 'undefined') return;

                await OneSignal.init({ 
                    appId: "a114f37e-c4b7-4fb4-a580-51d78c8bfa57", 
                    allowLocalhostAsSecureOrigin: true, 
                    notifyButton: { enable: true }, 
                });

                // Tenta mostrar o prompt de forma segura (compatível com versões novas e velhas)
                try {
                    if (OneSignal.Slidedown) {
                        OneSignal.Slidedown.promptPush();
                    } else if (typeof OneSignal.ShowSlidedownPrompt === 'function') {
                        OneSignal.ShowSlidedownPrompt();
                    }
                } catch(e) { 
                    console.warn('Prompt OneSignal ignorado (bloqueador de anúncios ou erro interno):', e); 
                }

                // Listener de inscrição
                OneSignal.User.PushSubscription.addEventListener("change", async (event) => {
                    if (event.current.optedIn) {
                        const userId = await OneSignal.User.getOnesignalId();
                        if (userId) {
                            await axios.post('/user/onesignal', { onesignal_id: userId }).catch(() => {});
                            console.log("OneSignal ID Sincronizado");
                        }
                    }
                });

            } catch (error) {
                console.warn("OneSignal não carregou (provavelmente AdBlock):", error);
            }
        };

        runOneSignal();
    }, []);

    // 3. SE NÃO TIVER USUÁRIO, REDIRECIONA (Evita Tela Branca)
    if (!currentUser) {
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
        return null;
    }

    // 4. FUNÇÃO SEGURA DE ROTA (Evita crash se o Ziggy falhar)
    const safeRoute = (name, params = undefined) => {
        try {
            // @ts-ignore
            return route(name, params);
        } catch (e) {
            // console.warn(`Rota não encontrada: ${name}`);
            return '#';
        }
    };

    // 5. VERIFICAÇÃO SEGURA DE ROTA ATIVA
    const isCurrent = (name) => {
        try { return route().current(name); } catch(e) { return false; }
    }

    const CustomNavLink = ({ active, href, children }) => (
        <Link
            href={href}
            className={`inline-flex items-center px-1 pt-1 border-b-4 text-sm font-bold leading-5 transition duration-150 ease-in-out h-full
            ${active 
                ? 'border-white text-white' 
                : 'border-transparent text-red-100 hover:text-white hover:border-red-200'
            }`}
        >
            {children}
        </Link>
    );

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            
            <Toast />

            <nav className="bg-gradient-to-r from-red-800 to-red-600 shadow-lg border-b border-red-900 z-40 print:hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20">
                        <div className="flex">
                            {/* Logo + Marca */}
                            <div className="shrink-0 flex items-center gap-3">
                                <Link href="/">
                                    <div className="bg-white p-2 rounded-full shadow-md w-14 h-14 flex items-center justify-center">
                                        <img src="/img/logo.png" alt="Shineray" className="h-8 w-auto object-contain" />
                                    </div>
                                </Link>
                                <div className="hidden md:block leading-tight text-white">
                                    <span className="block font-black uppercase tracking-widest text-lg">Shineray</span>
                                    <span className="block text-xs font-light tracking-wide opacity-90">By Sabel Logística</span>
                                </div>
                            </div>

                            {/* Menu de Navegação (Desktop) - USANDO SAFEROUTE */}
                            <div className="hidden space-x-8 sm:-my-px sm:ml-10 sm:flex items-center h-20">
                                <CustomNavLink href={safeRoute('dashboard')} active={isCurrent('dashboard')}>
                                    Dashboard
                                </CustomNavLink>

                                <CustomNavLink href={safeRoute('manual')} active={isCurrent('manual')}>
                                    ❓ Ajuda / Manual
                                </CustomNavLink>

                                {/* Links da LOJA */}
                                {currentUser.perfil === 'loja' && (
                                    <>
                                        <CustomNavLink href={safeRoute('solicitar')} active={isCurrent('solicitar')}>
                                            ➕ Nova Solicitação
                                        </CustomNavLink>
                                        <CustomNavLink href={safeRoute('pedidos.index')} active={isCurrent('pedidos.*')}>
                                            📦 Meus Pedidos
                                        </CustomNavLink>
                                    </>
                                )}

                                {/* Links GERAIS (CD, ADMIN, GESTOR) */}
                                {['cd', 'admin', 'gestor'].includes(currentUser.perfil) && (
                                    <>
                                        {/* Conferência/Auditoria */}
                                        <CustomNavLink href={safeRoute('pedidos.index')} active={isCurrent('pedidos.*')}>
                                            {currentUser.perfil === 'cd' ? '📋 Conferência' : '📊 Auditoria Pedidos'}
                                        </CustomNavLink>

                                        {/* CD Específico */}
                                        {currentUser.perfil === 'cd' && (
                                            <CustomNavLink href={safeRoute('romaneios.create')} active={isCurrent('romaneios.create')}>
                                                🚛 Expedição
                                            </CustomNavLink>
                                        )}

                                        {/* Cargas (Todos menos Loja) */}
                                        <CustomNavLink href={safeRoute('romaneios.index')} active={isCurrent('romaneios.*')}>
                                            {currentUser.perfil === 'cd' ? '🗂 Histórico Cargas' : '🚛 Auditoria Cargas'}
                                        </CustomNavLink>

                                        {/* Motos (Apenas Admin/Gestor) */}
                                        {['admin', 'gestor'].includes(currentUser.perfil) && (
                                            <CustomNavLink href={safeRoute('motos.index')} active={isCurrent('motos.*')}>
                                                🏍 Base Chassis
                                            </CustomNavLink>
                                        )}
                                        
                                        {/* Usuários (Apenas Admin) */}
                                        {currentUser.perfil === 'admin' && (
                                            <CustomNavLink href={safeRoute('users.index')} active={isCurrent('users.*')}>
                                                👥 Usuários
                                            </CustomNavLink>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Dropdown do Usuário */}
                        <div className="hidden sm:flex sm:items-center sm:ml-6">
                            <div className="ml-3 relative">
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <span className="inline-flex rounded-md shadow-sm">
                                            <button
                                                type="button"
                                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm leading-4 font-bold rounded-full text-red-700 bg-white hover:bg-gray-100 focus:outline-none transition ease-in-out duration-150 shadow-sm"
                                            >
                                                {currentUser.name}
                                                <svg className="ml-2 -mr-0.5 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </span>
                                    </Dropdown.Trigger>

                                    <Dropdown.Content>
                                        <div className="px-4 py-2 text-xs text-gray-500 border-b font-mono uppercase bg-gray-50">
                                            Perfil: <strong>{currentUser.perfil}</strong>
                                        </div>
                                        <div className="px-4 py-2 text-xs text-gray-400 border-b">
                                            {currentUser.filial || 'Matriz'}
                                        </div>
                                        <Dropdown.Link href={safeRoute('profile.edit')}>Meu Perfil</Dropdown.Link>
                                        <Dropdown.Link href={safeRoute('logout')} method="post" as="button">
                                            Sair do Sistema
                                        </Dropdown.Link>
                                    </Dropdown.Content>
                                </Dropdown>
                            </div>
                        </div>

                        {/* Botão Mobile (Hamburger) */}
                        <div className="-mr-2 flex items-center sm:hidden">
                            <button
                                onClick={() => setShowingNavigationDropdown((previousState) => !previousState)}
                                className="inline-flex items-center justify-center p-2 rounded-md text-red-100 hover:text-white hover:bg-red-700 focus:outline-none transition duration-150 ease-in-out"
                            >
                                <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                    <path className={!showingNavigationDropdown ? 'inline-flex' : 'hidden'} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                    <path className={showingNavigationDropdown ? 'inline-flex' : 'hidden'} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Menu Mobile */}
                <div className={(showingNavigationDropdown ? 'block' : 'hidden') + ' sm:hidden bg-red-800 border-t border-red-700'}>
                    <div className="pt-2 pb-3 space-y-1">
                        <ResponsiveNavLink href={safeRoute('dashboard')} active={isCurrent('dashboard')} className="text-white">
                            Dashboard
                        </ResponsiveNavLink>
                        
                        {/* Mobile LOJA */}
                        {currentUser.perfil === 'loja' && (
                            <>
                                <ResponsiveNavLink href={safeRoute('solicitar')} className="text-red-100 hover:text-white">Nova Solicitação</ResponsiveNavLink>
                                <ResponsiveNavLink href={safeRoute('pedidos.index')} className="text-red-100 hover:text-white">Meus Pedidos</ResponsiveNavLink>
                            </>
                        )}

                        {/* Mobile GERAL (CD, ADMIN, GESTOR) */}
                        {['cd', 'admin', 'gestor'].includes(currentUser.perfil) && (
                            <>
                                <ResponsiveNavLink href={safeRoute('pedidos.index')} className="text-red-100 hover:text-white">
                                    {currentUser.perfil === 'cd' ? 'Conferência' : 'Auditoria Pedidos'}
                                </ResponsiveNavLink>
                                
                                {currentUser.perfil === 'cd' && (
                                    <ResponsiveNavLink href={safeRoute('romaneios.create')} className="text-red-100 hover:text-white">Expedição</ResponsiveNavLink>
                                )}

                                <ResponsiveNavLink href={safeRoute('romaneios.index')} className="text-red-100 hover:text-white">
                                    {currentUser.perfil === 'cd' ? 'Histórico Cargas' : 'Auditoria Cargas'}
                                </ResponsiveNavLink>

                                {['admin', 'gestor'].includes(currentUser.perfil) && (
                                     <ResponsiveNavLink href={safeRoute('motos.index')} className="text-red-100 hover:text-white">Base Chassis</ResponsiveNavLink>
                                )}
                                
                                {currentUser.perfil === 'admin' && (
                                    <ResponsiveNavLink href={safeRoute('users.index')} className="text-red-100 hover:text-white">Gestão Usuários</ResponsiveNavLink>
                                )}
                            </>
                        )}
                    </div>

                    <div className="pt-4 pb-1 border-t border-red-700">
                        <div className="px-4">
                            <div className="font-medium text-base text-white">{currentUser.name}</div>
                            <div className="font-medium text-sm text-red-200">{currentUser.email}</div>
                        </div>
                        <div className="mt-3 space-y-1">
                            <ResponsiveNavLink href={safeRoute('profile.edit')} className="text-red-100 hover:text-white">Perfil</ResponsiveNavLink>
                            <ResponsiveNavLink href={safeRoute('logout')} method="post" as="button" className="text-red-100 hover:text-white">Sair</ResponsiveNavLink>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Cabeçalho da Página (Breadcrumb/Title) */}
            {header && (
                <header className="bg-white shadow z-30 relative print:hidden">
                    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex items-center gap-4">
                        <button 
                                onClick={() => window.history.back()}
                                className="p-2 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-all shadow-sm group"
                                title="Voltar para página anterior"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 group-hover:-translate-x-1 transition-transform">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                </svg>
                            </button>
                        <div className="flex-1">
                            {header}
                        </div>
                    </div>
                </header>
            )}

            {/* CONTEÚDO PRINCIPAL (Flex Grow empurra o footer) */}
            <main className="flex-grow">
                {children}
            </main>

            {/* --- RODAPÉ PROFISSIONAL --- */}
            <footer className="bg-gray-900 text-white pt-10 pb-6 print:hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 border-b border-gray-700 pb-8">
                        
                        {/* Coluna 1: Marca */}
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="bg-white p-1 rounded-full w-8 h-8 flex items-center justify-center">
                                    <img src="/img/logo.png" className="h-4 w-auto" alt="Logo Footer" />
                                </div>
                                <span className="font-bold text-xl tracking-wider uppercase">Shineray by Sabel</span>
                            </div>
                            <p className="text-gray-400 text-sm">
                                Sistema integrado de gestão logística e expedição.
                                Conectando lojas e centro de distribuição com eficiência.
                            </p>
                        </div>

                        {/* Coluna 2: Links Rápidos (SAFE ROUTE) */}
                        <div>
                            <h4 className="font-bold text-gray-200 mb-4 uppercase text-sm">Navegação</h4>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li><Link href={safeRoute('dashboard')} className="hover:text-red-500 transition">Dashboard</Link></li>
                                {currentUser.perfil === 'loja' && <li><Link href={safeRoute('solicitar')} className="hover:text-red-500 transition">Nova Solicitação</Link></li>}
                                {currentUser.perfil === 'cd' && <li><Link href={safeRoute('romaneios.index')} className="hover:text-red-500 transition">Romaneios</Link></li>}
                            </ul>
                        </div>

                        {/* Coluna 3: Suporte */}
                        <div>
                            <h4 className="font-bold text-gray-200 mb-4 uppercase text-sm">Suporte TI</h4>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li className="flex items-center gap-2">
                                    <span>📩</span> shiadmti@gmail.com
                                </li>
                                <li className="flex items-center gap-2">
                                    <span>📞</span> (91) 98492-8535 (Ramal TI)
                                </li>
                                <li className="mt-2 text-xs text-gray-600">
                                    Versão do Sistema: 3.0 (Shineray Admin)
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="text-center text-xs text-gray-500 flex flex-col md:flex-row justify-between items-center">
                        <p>&copy; {new Date().getFullYear()} Shineray By Sabel. Todos os direitos reservados.</p>
                        <p className="mt-2 md:mt-0">Desenvolvido pela Equipe de TI Interna.</p>
                    </div>
                </div>
            </footer>

        </div>
    );
}