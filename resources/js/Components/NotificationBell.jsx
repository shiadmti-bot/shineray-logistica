import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { Link } from '@inertiajs/react';
import axios from 'axios';
import Swal from 'sweetalert2';
import useNotificacoesTempoReal from '@/Hooks/useNotificacoesTempoReal';

const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 4000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
    },
});

/**
 * Sininho da topbar.
 *
 * Vive no layout persistente e monta uma vez só. Por isso busca a lista sob
 * demanda (NotificacaoController) em vez de recebê-la nas props de toda
 * navegação — eram duas consultas a mais por clique — e dali em diante é
 * alimentado pelo tempo real.
 *
 * É o único lugar que toca som e mostra o toast de uma notificação. As telas
 * que ouvem o mesmo canal só recarregam os próprios dados.
 */
export default function NotificationBell() {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef(null);
    const panelId = useId();

    useEffect(() => {
        axios
            .get(route('notificacoes.index'))
            .then(({ data }) => {
                setNotifications(data.itens ?? []);
                setUnreadCount(data.nao_lidas ?? 0);
            })
            .catch(() => {});
    }, []);

    // Fecha com Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen]);

    useNotificacoesTempoReal((notificacao) => {
        try {
            new Audio('/plim.mp3').play().catch(() => {});
        } catch { /* sem audio */ }

        Toast.fire({
            icon: 'info',
            title: notificacao.titulo || 'Nova notificação',
            text: notificacao.mensagem,
        });

        setNotifications((anteriores) => [
            {
                id: notificacao.id ?? `tempo-real-${Date.now()}`,
                data: {
                    titulo: notificacao.titulo,
                    mensagem: notificacao.mensagem,
                    link: notificacao.link,
                },
                quando: 'Agora mesmo',
                read_at: null,
            },
            ...anteriores,
        ]);

        setUnreadCount((total) => total + 1);
    });

    const markAsRead = useCallback(() => {
        if (unreadCount > 0) {
            axios.post(route('notificacoes.ler')).catch(() => {});
            setUnreadCount(0);
        }
        setIsOpen((prev) => !prev);
    }, [unreadCount]);

    return (
        <div className="relative">
            {/* ÍCONE DO SINO */}
            <button
                onClick={markAsRead}
                aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                aria-controls={panelId}
                className="relative rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>

                {unreadCount > 0 && (
                    <span
                        className="absolute top-0.5 right-0.5 h-4 w-4 bg-surface-card text-brand-700 text-[10px] font-black flex items-center justify-center rounded-full shadow-sm ring-2 ring-brand-800"
                        aria-hidden="true"
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* DROPDOWN DE NOTIFICAÇÕES */}
            {isOpen && (
                <div
                    id={panelId}
                    ref={panelRef}
                    role="dialog"
                    aria-label="Painel de notificações"
                    className="absolute right-0 mt-2 w-80 md:w-96 bg-surface-card rounded-lg shadow-xl border border-line z-50 overflow-hidden"
                >
                    <div className="bg-surface-sunken px-4 py-3 border-b flex justify-between items-center">
                        <h3 className="text-sm font-bold text-content-secondary">Notificações</h3>
                        <span className="text-xs text-content-muted">Últimas atualizações</span>
                    </div>

                    <div className="max-h-80 overflow-y-auto" role="list">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-content-muted text-sm">
                                Nenhuma notificação por enquanto.
                            </div>
                        ) : (
                            <ul>
                                {notifications.map((notif) => (
                                    <li key={notif.id} role="listitem" className={`border-b hover:bg-surface-sunken transition ${!notif.read_at ? 'bg-status-info-bg' : ''}`}>
                                        <Link
                                            href={notif.data.link}
                                            className="block px-4 py-3"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <p className="text-sm font-bold text-content-primary">{notif.data.titulo || 'Notificação'}</p>
                                            <p className="text-xs text-content-secondary mt-1 line-clamp-2">{notif.data.mensagem}</p>
                                            <p className="text-[10px] text-content-muted mt-2 flex items-center gap-1">
                                                <span aria-hidden="true">🕒</span> {notif.quando || 'Recentemente'}
                                            </p>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="bg-surface-sunken p-2 text-center border-t">
                            <button onClick={() => setNotifications([])} className="text-xs text-status-info-fg hover:underline">
                                Limpar lista
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* OVERLAY PARA FECHAR AO CLICAR FORA */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    aria-hidden="true"
                    onClick={() => setIsOpen(false)}
                ></div>
            )}
        </div>
    );
}
