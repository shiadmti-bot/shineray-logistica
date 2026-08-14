import { useState, useEffect } from 'react';
import { Link, usePage } from '@inertiajs/react';
import {
    Bars3Icon,
    XMarkIcon,
    Cog6ToothIcon,
    ArrowRightOnRectangleIcon,
    ChevronLeftIcon,
} from '@heroicons/react/24/outline';

import Dropdown from '@/Components/Dropdown';
import Toast from '@/Components/Toast';
import NotificationBell from '@/Components/NotificationBell';
import useOneSignal from '@/Hooks/useOneSignal';
import { navegacaoPara } from './navigation';

/**
 * SHELL DE APLICAÇÃO (v3)
 *
 * Substitui a topbar horizontal por navegação lateral agrupada em seções.
 * Motivo: com Motos + Peças + Logística o menu horizontal passaria de ~8 para
 * ~14 itens e quebraria em qualquer tela menor que 1400px. A lateral escala
 * verticalmente e mostra a qual módulo cada tela pertence.
 *
 * CONVIVÊNCIA: AuthenticatedLayout continua existindo e funcionando. As telas
 * migram para cá uma a uma; nada quebra enquanto os dois coexistem.
 *
 * A largura da sidebar é persistida em localStorage — o CD trabalha o dia
 * inteiro na mesma tela e recolher o menu a cada navegação seria irritante.
 */
export default function AppLayout({ user, header, children }) {
    const { props, url } = usePage();
    const currentUser = user || props.auth?.user;

    useOneSignal(props.config?.onesignal_app_id);

    const [menuMobileAberto, setMenuMobileAberto] = useState(false);
    const [recolhida, setRecolhida] = useState(false);

    // Restaura a preferência antes da primeira pintura útil.
    useEffect(() => {
        setRecolhida(localStorage.getItem('sidebar:recolhida') === '1');
    }, []);

    const alternarRecolhida = () => {
        setRecolhida((atual) => {
            localStorage.setItem('sidebar:recolhida', atual ? '0' : '1');
            return !atual;
        });
    };

    // Fecha o menu mobile ao navegar — sem isso ele fica aberto por cima da
    // tela nova depois de clicar num link.
    useEffect(() => {
        setMenuMobileAberto(false);
    }, [url]);

    if (!currentUser) {
        if (typeof window !== 'undefined') window.location.href = '/login';
        return null;
    }

    // route() vem do Ziggy via <head>; pode não existir em telas de erro.
    const safeRoute = (name, params) => {
        try {
            return route(name, params);
        } catch {
            return '#';
        }
    };

    const isCurrent = (pattern) => {
        try {
            return route().current(pattern);
        } catch {
            return false;
        }
    };

    const secoes = navegacaoPara(currentUser.perfil);
    const contadores = props.navCounts ?? {};

    const ItemNav = ({ item }) => {
        const ativo = isCurrent(item.match ?? item.route);
        const Icon = item.icon;
        const contador = item.badge ? contadores[item.badge] : null;

        return (
            <Link
                href={safeRoute(item.route)}
                title={recolhida ? item.label : undefined}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition
                    ${
                        ativo
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'text-red-100/80 hover:bg-white/10 hover:text-white'
                    }`}
            >
                <Icon className="h-5 w-5 shrink-0" />

                {!recolhida && <span className="truncate">{item.label}</span>}

                {contador > 0 && (
                    <span
                        className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums
                            ${ativo ? 'bg-white text-brand-700' : 'bg-brand-500 text-white'}
                            ${recolhida ? 'absolute -right-0.5 -top-0.5 ml-0' : ''}`}
                    >
                        {contador}
                    </span>
                )}
            </Link>
        );
    };

    const conteudoSidebar = (
        <>
            {/* Marca */}
            <div className="flex h-20 shrink-0 items-center gap-3 px-4">
                <Link href="/" className="shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-2 shadow-lg transition hover:scale-105">
                        <img src="/img/logo.png" alt="Shineray" className="h-6 w-auto object-contain" />
                    </div>
                </Link>

                {!recolhida && (
                    <div className="min-w-0 leading-tight text-white">
                        <span className="block truncate text-sm font-black uppercase tracking-widest">
                            By Sabel
                        </span>
                        <span className="block truncate text-[10px] font-light uppercase tracking-widest opacity-70">
                            Logística &amp; Distribuição
                        </span>
                    </div>
                )}
            </div>

            {/* Navegação */}
            <nav className="flex-1 space-y-5 overflow-y-auto scrollbar-slim px-3 pb-4">
                {secoes.map((secao) => (
                    <div key={secao.id}>
                        {secao.label && !recolhida && (
                            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-red-200/50">
                                {secao.label}
                            </p>
                        )}
                        {secao.label && recolhida && <div className="mx-2 mb-2 border-t border-white/10" />}

                        <div className="space-y-0.5">
                            {secao.items.map((item) => (
                                <ItemNav key={item.key} item={item} />
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Recolher — apenas desktop */}
            <button
                type="button"
                onClick={alternarRecolhida}
                className="hidden shrink-0 items-center gap-2 border-t border-white/10 px-4 py-3 text-xs font-semibold text-red-100/70 transition hover:bg-white/5 hover:text-white lg:flex"
            >
                <ChevronLeftIcon className={`h-4 w-4 transition-transform ${recolhida ? 'rotate-180' : ''}`} />
                {!recolhida && 'Recolher menu'}
            </button>
        </>
    );

    const larguraSidebar = recolhida ? 'lg:w-sidebar-collapsed' : 'lg:w-sidebar';
    const margemConteudo = recolhida ? 'lg:pl-sidebar-collapsed' : 'lg:pl-sidebar';

    return (
        <div className="min-h-screen bg-surface-page font-sans">
            <Toast />

            {/* --- SIDEBAR DESKTOP --- */}
            <aside
                className={`fixed inset-y-0 left-0 z-sidebar hidden flex-col bg-gradient-to-b from-brand-900 to-brand-700
                    shadow-xl transition-[width] duration-200 lg:flex ${larguraSidebar} print:hidden`}
            >
                {conteudoSidebar}
            </aside>

            {/* --- SIDEBAR MOBILE (drawer) --- */}
            {menuMobileAberto && (
                <div className="fixed inset-0 z-overlay lg:hidden print:hidden">
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setMenuMobileAberto(false)}
                        aria-hidden="true"
                    />
                    <aside className="absolute inset-y-0 left-0 flex w-sidebar animate-slide-in-right flex-col bg-gradient-to-b from-brand-900 to-brand-700 shadow-2xl">
                        <button
                            type="button"
                            onClick={() => setMenuMobileAberto(false)}
                            className="absolute right-3 top-6 rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                            aria-label="Fechar menu"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                        {conteudoSidebar}
                    </aside>
                </div>
            )}

            {/* --- ÁREA PRINCIPAL --- */}
            <div className={`transition-[padding] duration-200 ${margemConteudo}`}>
                {/* Topbar */}
                <header className="sticky top-0 z-topbar flex h-topbar items-center gap-3 border-b border-line bg-surface-card/95 px-4 backdrop-blur sm:px-6 print:hidden">
                    <button
                        type="button"
                        onClick={() => setMenuMobileAberto(true)}
                        className="-ml-1 rounded-lg p-2 text-content-secondary transition hover:bg-surface-sunken lg:hidden"
                        aria-label="Abrir menu"
                    >
                        <Bars3Icon className="h-6 w-6" />
                    </button>

                    <div className="min-w-0 flex-1">
                        {header && (
                            <div className="truncate text-sm font-bold text-content-primary">{header}</div>
                        )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <NotificationBell />

                        <Dropdown>
                            <Dropdown.Trigger>
                                <button
                                    type="button"
                                    className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-sm font-bold text-content-primary transition hover:bg-surface-sunken"
                                >
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-black text-white">
                                        {currentUser.name.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="hidden sm:inline">{currentUser.name.split(' ')[0]}</span>
                                </button>
                            </Dropdown.Trigger>

                            <Dropdown.Content>
                                <div className="border-b border-line bg-surface-sunken px-4 py-3 text-xs">
                                    <div className="font-bold text-content-primary">{currentUser.name}</div>
                                    <div className="mt-1 text-content-secondary">
                                        Perfil: <strong className="uppercase text-brand-600">{currentUser.perfil}</strong>
                                    </div>
                                    <div className="mt-0.5 truncate text-content-muted">
                                        {currentUser.filial || 'Matriz'}
                                    </div>
                                </div>

                                <Dropdown.Link href={safeRoute('profile.edit')} className="flex items-center gap-2">
                                    <Cog6ToothIcon className="h-4 w-4" /> Configurações
                                </Dropdown.Link>

                                <Dropdown.Link
                                    href={safeRoute('logout')}
                                    method="post"
                                    as="button"
                                    className="flex items-center gap-2 font-bold text-brand-600"
                                >
                                    <ArrowRightOnRectangleIcon className="h-4 w-4" /> Sair do Sistema
                                </Dropdown.Link>
                            </Dropdown.Content>
                        </Dropdown>
                    </div>
                </header>

                <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            </div>
        </div>
    );
}
