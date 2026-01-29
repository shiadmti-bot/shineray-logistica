import OneSignal from 'react-onesignal';
import axios from 'axios';
import { useState, useEffect, useRef } from 'react';
import Dropdown from '@/Components/Dropdown';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import Toast from '@/Components/Toast';
import { Link, usePage } from '@inertiajs/react';

export default function Authenticated({ user, header, children }) {
    const { props } = usePage();
    // Garante que temos o usuário
    const currentUser = user || props.auth.user; 
    
    const [showingNavigationDropdown, setShowingNavigationDropdown] = useState(false);
    const oneSignalInit = useRef(false);

    // --- EFEITO DO ONESIGNAL BLINDADO ---
    useEffect(() => {
        const runOneSignal = async () => {
            if (oneSignalInit.current || typeof window === 'undefined') return;
            oneSignalInit.current = true;

            try {
                await OneSignal.init({ 
                    appId: "a114f37e-c4b7-4fb4-a580-51d78c8bfa57", 
                    allowLocalhostAsSecureOrigin: true, 
                    notifyButton: { enable: true }, 
                });

                // Prompt Seguro
                try {
                    if (OneSignal.Slidedown) {
                        OneSignal.Slidedown.promptPush();
                    } else if (typeof OneSignal.ShowSlidedownPrompt === 'function') {
                        OneSignal.ShowSlidedownPrompt();
                    }
                } catch(e) { /* Ignora erro de prompt */ }

                // Listener de Inscrição
                OneSignal.User.PushSubscription.addEventListener("change", async (event) => {
                    if (event.current.optedIn) {
                        const userId = await OneSignal.User.getOnesignalId();
                        if (userId) {
                            axios.post('/user/onesignal', { onesignal_id: userId }).catch(() => {});
                        }
                    }
                });

            } catch (error) {
                console.warn("OneSignal bloqueado ou falhou:", error);
            }
        };

        runOneSignal();
    }, []);

    // Proteção contra usuário nulo
    if (!currentUser) {
        if (typeof window !== 'undefined') window.location.href = '/login';
        return null;
    }

    // Função segura para rotas (evita quebra se a rota não existir no Ziggy)
    const safeRoute = (name, params = undefined) => {
        try {
            // @ts-ignore
            return route(name, params);
        } catch (e) {
            return '#';
        }
    };

    const isCurrent = (name) => {
        try { return route().current(name); } catch(e) { return false; }
    }

    // Componente NavLink Interno
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
                            {/* Logo */}
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

                            {/* Menu Desktop */}
                            <div className="hidden space-x-8 sm:-my-px sm:ml-10 sm:flex items-center h-20">
                                <CustomNavLink href={safeRoute('dashboard')} active={isCurrent('dashboard')}>
                                    Dashboard
                                </CustomNavLink>

                                <CustomNavLink href={safeRoute('manual')} active={isCurrent('manual')}>
                                    ❓ Ajuda
                                </CustomNavLink>

                                {/* LOJA */}
                                {currentUser.perfil === 'loja' && (
                                    <>
                                        <CustomNavLink href={safeRoute('solicitar')} active={isCurrent('solicitar')}>➕ Nova Solicitação</CustomNavLink>
                                        <CustomNavLink href={safeRoute('pedidos.index')} active={isCurrent('pedidos.*')}>📦 Meus Pedidos</CustomNavLink>
                                    </>
                                )}

                                {/* CD / ADMIN / GESTOR */}
                                {['cd', 'admin', 'gestor'].includes(currentUser.perfil) && (
                                    <>
                                        <CustomNavLink href={safeRoute('pedidos.index')} active={isCurrent('pedidos.*')}>
                                            {currentUser.perfil === 'cd' ? '📋 Conferência' : '📊 Auditoria'}
                                        </CustomNavLink>
                                        
                                        {currentUser.perfil === 'cd' && (
                                            <CustomNavLink href={safeRoute('romaneios.create')} active={isCurrent('romaneios.create')}>🚛 Expedição</CustomNavLink>
                                        )}

                                        <CustomNavLink href={safeRoute('romaneios.index')} active={isCurrent('romaneios.*')}>
                                            {currentUser.perfil === 'cd' ? '🗂 Histórico' : '🚛 Cargas'}
                                        </CustomNavLink>

                                        {['admin', 'gestor'].includes(currentUser.perfil) && (
                                            <CustomNavLink href={safeRoute('motos.index')} active={isCurrent('motos.*')}>🏍 Chassis</CustomNavLink>
                                        )}
                                        
                                        {currentUser.perfil === 'admin' && (
                                            <CustomNavLink href={safeRoute('users.index')} active={isCurrent('users.*')}>👥 Usuários</CustomNavLink>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Dropdown User */}
                        <div className="hidden sm:flex sm:items-center sm:ml-6">
                            <div className="ml-3 relative">
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <span className="inline-flex rounded-md shadow-sm">
                                            <button type="button" className="inline-flex items-center px-4 py-2 border border-transparent text-sm leading-4 font-bold rounded-full text-red-700 bg-white hover:bg-gray-100 focus:outline-none transition ease-in-out duration-150 shadow-sm">
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
                                        <Dropdown.Link href={safeRoute('logout')} method="post" as="button">Sair</Dropdown.Link>
                                    </Dropdown.Content>
                                </Dropdown>
                            </div>
                        </div>

                        {/* Hamburger */}
                        <div className="-mr-2 flex items-center sm:hidden">
                            <button onClick={() => setShowingNavigationDropdown((previousState) => !previousState)} className="inline-flex items-center justify-center p-2 rounded-md text-red-100 hover:text-white hover:bg-red-700 focus:outline-none transition duration-150 ease-in-out">
                                <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                                    <path className={!showingNavigationDropdown ? 'inline-flex' : 'hidden'} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                    <path className={showingNavigationDropdown ? 'inline-flex' : 'hidden'} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                <div className={(showingNavigationDropdown ? 'block' : 'hidden') + ' sm:hidden bg-red-800 border-t border-red-700'}>
                    <div className="pt-2 pb-3 space-y-1">
                        <ResponsiveNavLink href={safeRoute('dashboard')} active={isCurrent('dashboard')} className="text-white">Dashboard</ResponsiveNavLink>
                        {/* Links simplificados para mobile */}
                        <ResponsiveNavLink href={safeRoute('pedidos.index')} className="text-red-100 hover:text-white">Pedidos / Conferência</ResponsiveNavLink>
                        {currentUser.perfil === 'cd' && <ResponsiveNavLink href={safeRoute('romaneios.index')} className="text-red-100 hover:text-white">Cargas</ResponsiveNavLink>}
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

            {header && (
                <header className="bg-white shadow z-30 relative print:hidden">
                    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex items-center gap-4">
                        <button onClick={() => window.history.back()} className="p-2 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 shadow-sm" title="Voltar">
                            ⬅
                        </button>
                        <div className="flex-1">{header}</div>
                    </div>
                </header>
            )}

            <main className="flex-grow">{children}</main>

            <footer className="bg-gray-900 text-white pt-10 pb-6 print:hidden">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-gray-500 text-sm">&copy; {new Date().getFullYear()} Shineray By Sabel.</p>
                </div>
            </footer>
        </div>
    );
}