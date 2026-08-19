import { useState, useEffect } from 'react';
import { usePage, Link, router } from '@inertiajs/react';
import Swal from 'sweetalert2';

export default function NotificationBell() {
    const { auth } = usePage().props;
    // Carrega as notificações iniciais vindas do backend (compartilhadas via Inertia Middleware ou API)
    // Para simplificar, vamos assumir que você injetou 'notifications' via HandleInertiaRequests ou vamos buscar via API simples.
    // **DICA:** A forma mais simples é iniciar vazio e deixar o realtime preencher, ou passar via props.
    // Vamos usar um estado local para gerenciar.
    
    const [notifications, setNotifications] = useState(auth.user.notifications || []); // Requer ajuste no HandleInertiaRequests
    const [unreadCount, setUnreadCount] = useState(auth.user.unread_count || 0);
    const [isOpen, setIsOpen] = useState(false);

    // Configuração do Toast do SweetAlert2
    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });

    useEffect(() => {
        // CONEXÃO WEBSOCKET
        // O canal padrão de notificações do Laravel é App.Models.User.{id}
        window.Echo.private(`App.Models.User.${auth.user.id}`)
            .notification((notification) => {
                
                // 1. Toca o som
                const audio = new Audio('/plim.mp3');
                audio.play().catch(()=>{});

                // 2. Mostra o Toast na tela
                Toast.fire({
                    icon: 'info',
                    title: notification.titulo,
                    text: notification.mensagem
                });

                // 3. Adiciona na lista do sininho
                setNotifications(prev => [
                    {
                        id: Date.now(), // ID temporário
                        data: {
                            titulo: notification.titulo,
                            mensagem: notification.mensagem,
                            link: notification.link
                        },
                        created_at: 'Agora mesmo',
                        read_at: null
                    },
                    ...prev
                ]);

                // 4. Incrementa contador
                setUnreadCount(prev => prev + 1);
            });
    }, []);

    const markAsRead = () => {
        if (unreadCount > 0) {
            router.post(route('notificacoes.ler'), {}, { preserveScroll: true });
            setUnreadCount(0);
        }
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative">
            {/* ÍCONE DO SINO */}
            <button 
                onClick={markAsRead} 
                className="relative rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>

                {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 h-4 w-4 bg-surface-card text-brand-700 text-[10px] font-black flex items-center justify-center rounded-full shadow-sm ring-2 ring-brand-800">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* DROPDOWN DE NOTIFICAÇÕES */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 md:w-96 bg-surface-card rounded-lg shadow-xl border border-line z-50 overflow-hidden">
                    <div className="bg-surface-sunken px-4 py-3 border-b flex justify-between items-center">
                        <h3 className="text-sm font-bold text-content-secondary">Notificações</h3>
                        <span className="text-xs text-content-muted">Últimas atualizações</span>
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-6 text-center text-content-muted text-sm">
                                Nenhuma notificação por enquanto.
                            </div>
                        ) : (
                            <ul>
                                {notifications.map((notif, index) => (
                                    <li key={index} className={`border-b hover:bg-surface-sunken transition ${!notif.read_at ? 'bg-status-info-bg' : ''}`}>
                                        <Link 
                                            href={notif.data.link} 
                                            className="block px-4 py-3"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <p className="text-sm font-bold text-content-primary">{notif.data.titulo}</p>
                                            <p className="text-xs text-content-secondary mt-1 line-clamp-2">{notif.data.mensagem}</p>
                                            <p className="text-[10px] text-content-muted mt-2 flex items-center gap-1">
                                                <span>🕒</span> {notif.created_at || 'Recentemente'}
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
                    onClick={() => setIsOpen(false)}
                ></div>
            )}
        </div>
    );
}