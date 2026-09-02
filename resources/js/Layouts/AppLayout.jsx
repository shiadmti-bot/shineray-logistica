import { useState, useEffect, Fragment } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { Menu, Transition } from '@headlessui/react';
import {
    Bars3Icon,
    XMarkIcon,
    Cog6ToothIcon,
    ArrowRightOnRectangleIcon,
    ChevronDownIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';

import Toast from '@/Components/Toast';
import NotificationBell from '@/Components/NotificationBell';
import GuidedTour from '@/Components/GuidedTour';
import useOneSignal from '@/Hooks/useOneSignal';
import { navegacaoPara } from './navigation';

/**
 * SHELL DE APLICAÇÃO — topbar repaginada (v3).
 *
 * NAVEGAÇÃO EM UMA LINHA SÓ
 * Com Motos + Peças + Logística + Gestão, listar cada tela na horizontal daria
 * ~14 itens e quebraria abaixo de 1400px. A saída é agrupar: as seções de
 * `navigation.js` viram menus suspensos, e só os itens soltos (Início,
 * Calendário, Ajuda) ficam como link direto. A barra cabe em qualquer largura
 * e cada tela continua mostrando a que módulo pertence.
 *
 * UM SHELL PARA TODAS AS TELAS
 * AuthenticatedLayout é um adaptador sobre este arquivo, então as 22 telas
 * legadas e as novas usam exatamente a mesma moldura. Alterar a navegação aqui
 * muda o sistema inteiro.
 *
 * `contained` liga o container padrão do conteúdo. Telas legadas passam false
 * (via AuthenticatedLayout) porque trazem o próprio fundo e espaçamento.
 */
export default function AppLayout({ user, header, children, contained = true }) {
    const { props, url } = usePage();
    const currentUser = user || props.auth?.user;

    useOneSignal(props.config?.onesignal_app_id, currentUser);

    const [menuMobileAberto, setMenuMobileAberto] = useState(false);

    // Fecha o menu mobile ao navegar — sem isso ele cobre a tela nova.
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

    const secoes = navegacaoPara(currentUser);
    const contadores = props.navCounts ?? {};

    const contarSecao = (secao) =>
        secao.items.reduce((t, i) => t + (i.badge ? contadores[i.badge] ?? 0 : 0), 0);

    const secaoAtiva = (secao) => secao.items.some((i) => isCurrent(i.match ?? i.route));

    /* ---------- Link direto na barra ---------- */
    const LinkBarra = ({ item }) => {
        const ativo = isCurrent(item.match ?? item.route);
        const Icon = item.icon;

        return (
            <Link
                data-tour={item.key}
                href={safeRoute(item.route, item.params)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition
                    ${ativo ? 'bg-white/20 text-white shadow-sm' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
            >
                <Icon className="h-[18px] w-[18px]" />
                <span className="hidden xl:inline">{item.label}</span>
            </Link>
        );
    };

    /* ---------- Seção como menu suspenso ---------- */
    const MenuSecao = ({ secao }) => {
        const ativa = secaoAtiva(secao);
        const total = contarSecao(secao);

        return (
            <Menu as="div" data-tour={secao.id} className="relative">
                <Menu.Button
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition
                        ${ativa ? 'bg-white/20 text-white shadow-sm' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
                >
                    {secao.label}

                    {total > 0 && (
                        <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black tabular-nums text-brand-700">
                            {total}
                        </span>
                    )}

                    <ChevronDownIcon className="h-3.5 w-3.5 opacity-70" />
                </Menu.Button>

                <Transition
                    as={Fragment}
                    enter="transition ease-out duration-150"
                    enterFrom="opacity-0 -translate-y-1"
                    enterTo="opacity-100 translate-y-0"
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <Menu.Items className="absolute left-0 z-overlay mt-1.5 w-64 origin-top-left overflow-hidden rounded-xl bg-surface-card shadow-overlay ring-1 ring-line focus:outline-none">
                        <div className="border-b border-line bg-surface-sunken px-3 py-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-content-muted">
                                {secao.label}
                            </p>
                        </div>

                        <div className="p-1.5">
                            {secao.items.map((item) => {
                                const ativo = isCurrent(item.match ?? item.route);
                                const Icon = item.icon;
                                const contador = item.badge ? contadores[item.badge] : null;

                                return (
                                    <Menu.Item key={item.key}>
                                        {({ active }) => (
                                            <Link
                                                href={safeRoute(item.route, item.params)}
                                                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition
                                                    ${
                                                        ativo
                                                            ? 'bg-brand-50 text-brand-700'
                                                            : active
                                                              ? 'bg-surface-sunken text-content-primary'
                                                              : 'text-content-secondary'
                                                    }`}
                                            >
                                                <Icon
                                                    className={`h-[18px] w-[18px] shrink-0 ${
                                                        ativo ? 'text-brand-600' : 'text-content-muted'
                                                    }`}
                                                />
                                                <span className="flex-1 truncate">{item.label}</span>

                                                {contador > 0 && (
                                                    <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-white">
                                                        {contador}
                                                    </span>
                                                )}
                                            </Link>
                                        )}
                                    </Menu.Item>
                                );
                            })}
                        </div>
                    </Menu.Items>
                </Transition>
            </Menu>
        );
    };

    return (
        <div className="flex min-h-screen flex-col bg-surface-page font-sans">
            <Toast />
            <GuidedTour user={currentUser} />

            {/* ================= TOPBAR ================= */}
            <nav className="sticky top-0 z-topbar bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700 shadow-lg print:hidden">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between gap-3">
                        {/* --- Marca --- */}
                        <Link href="/" data-tour="brand" className="flex shrink-0 items-center gap-2.5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1.5 shadow-md transition hover:scale-105">
                                <img src="/img/logo.png" alt="Shineray" className="h-6 w-auto object-contain" />
                            </div>
                            <div className="hidden leading-none text-white sm:block">
                                <span className="block text-sm font-black uppercase tracking-widest">By Sabel</span>
                                <span className="block text-[9px] font-light uppercase tracking-[0.15em] opacity-70">
                                    Logística &amp; Distribuição
                                </span>
                            </div>
                        </Link>

                        {/* --- Navegação (desktop) --- */}
                        <div className="hidden flex-1 items-center gap-1 lg:flex">
                            {secoes.map((secao) =>
                                secao.label ? (
                                    <MenuSecao key={secao.id} secao={secao} />
                                ) : (
                                    secao.items.map((item) => <LinkBarra key={item.key} item={item} />)
                                )
                            )}
                        </div>

                        {/* --- Ações --- */}
                        <div className="flex shrink-0 items-center gap-1.5">
                            <div data-tour="notificacoes">
                                <NotificationBell />
                            </div>

                            {/* Conta */}
                            <div data-tour="perfil">
                                <Menu as="div" className="relative">
                                    <Menu.Button className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-2.5 text-sm font-bold text-white transition hover:bg-white/20">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-black text-brand-700">
                                            {currentUser.name.charAt(0).toUpperCase()}
                                        </span>
                                        <span className="hidden max-w-[8rem] truncate sm:inline">
                                            {currentUser.name.split(' ')[0]}
                                        </span>
                                        <ChevronDownIcon className="h-3.5 w-3.5 opacity-70" />
                                    </Menu.Button>

                                <Transition
                                    as={Fragment}
                                    enter="transition ease-out duration-150"
                                    enterFrom="opacity-0 -translate-y-1"
                                    enterTo="opacity-100 translate-y-0"
                                    leave="transition ease-in duration-100"
                                    leaveFrom="opacity-100"
                                    leaveTo="opacity-0"
                                >
                                    <Menu.Items className="absolute right-0 z-overlay mt-1.5 w-60 origin-top-right overflow-hidden rounded-xl bg-surface-card shadow-overlay ring-1 ring-line focus:outline-none">
                                        <div className="border-b border-line bg-surface-sunken px-4 py-3">
                                            <p className="truncate text-sm font-bold text-content-primary">
                                                {currentUser.name}
                                            </p>
                                            <p className="mt-0.5 text-xs text-content-secondary">
                                                Perfil:{' '}
                                                <strong className="uppercase text-brand-600">
                                                    {currentUser.perfil}
                                                </strong>
                                            </p>
                                            <p className="truncate text-xs text-content-muted">
                                                {currentUser.filial || 'Matriz'}
                                            </p>
                                        </div>

                                        <div className="p-1.5 space-y-0.5">
                                            <Menu.Item>
                                                <button
                                                    type="button"
                                                    onClick={() => window.dispatchEvent(new CustomEvent('start-guided-tour'))}
                                                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-content-secondary hover:bg-brand-50 hover:text-brand-700 transition cursor-pointer"
                                                >
                                                    <SparklesIcon className="h-[18px] w-[18px] text-brand-600" />
                                                    Tour Guiado
                                                </button>
                                            </Menu.Item>

                                            <Menu.Item>
                                                <Link
                                                    href={safeRoute('profile.edit')}
                                                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-content-secondary hover:bg-surface-sunken"
                                                >
                                                    <Cog6ToothIcon className="h-[18px] w-[18px] text-content-muted" />
                                                    Configurações
                                                </Link>
                                            </Menu.Item>

                                            <Menu.Item>
                                                <Link
                                                    href={safeRoute('logout')}
                                                    method="post"
                                                    as="button"
                                                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-bold text-brand-600 hover:bg-brand-50"
                                                >
                                                    <ArrowRightOnRectangleIcon className="h-[18px] w-[18px]" />
                                                    Sair do Sistema
                                                </Link>
                                            </Menu.Item>
                                        </div>
                                    </Menu.Items>
                                </Transition>
                            </Menu>
                            </div>

                            {/* Hambúrguer (mobile) */}
                            <button
                                type="button"
                                onClick={() => setMenuMobileAberto((v) => !v)}
                                className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white lg:hidden"
                                aria-label="Abrir menu"
                            >
                                {menuMobileAberto ? (
                                    <XMarkIcon className="h-6 w-6" />
                                ) : (
                                    <Bars3Icon className="h-6 w-6" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- Navegação (mobile) --- */}
                {menuMobileAberto && (
                    <div className="border-t border-white/10 bg-brand-900/95 backdrop-blur lg:hidden">
                        <div className="max-h-[70vh] space-y-4 overflow-y-auto scrollbar-slim px-4 py-4">
                            {secoes.map((secao) => (
                                <div key={secao.id}>
                                    {secao.label && (
                                        <p className="px-1 pb-1.5 text-[10px] font-black uppercase tracking-widest text-white/40">
                                            {secao.label}
                                        </p>
                                    )}

                                    <div className="space-y-0.5">
                                        {secao.items.map((item) => {
                                            const ativo = isCurrent(item.match ?? item.route);
                                            const Icon = item.icon;
                                            const contador = item.badge ? contadores[item.badge] : null;

                                            return (
                                                <Link
                                                    key={item.key}
                                                    href={safeRoute(item.route, item.params)}
                                                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition
                                                        ${
                                                            ativo
                                                                ? 'bg-white/20 text-white'
                                                                : 'text-white/70 hover:bg-white/10 hover:text-white'
                                                        }`}
                                                >
                                                    <Icon className="h-5 w-5 shrink-0" />
                                                    <span className="flex-1">{item.label}</span>

                                                    {contador > 0 && (
                                                        <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black tabular-nums text-brand-700">
                                                            {contador}
                                                        </span>
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </nav>

            {/* ================= CONTEÚDO ================= */}
            {header && (
                <header className="border-b border-line bg-surface-card print:hidden">
                    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">{header}</div>
                </header>
            )}

            <main className={`flex-grow ${contained ? 'mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8' : ''}`}>
                {children}
            </main>
        </div>
    );
}
