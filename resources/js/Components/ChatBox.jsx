import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { usePage } from '@inertiajs/react';

export default function ChatBox({ pedidoId }) {
    const { auth } = usePage().props;
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isOpen, setIsOpen] = useState(false); // Começa fechado
    const [hasUnread, setHasUnread] = useState(false);
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);

    // Som de notificação (Coloque um arquivo 'plim.mp3' na pasta public/)
    const playSound = () => {
        const audio = new Audio('/plim.mp3');
        audio.play().catch(e => console.log("Som bloqueado pelo navegador"));
    };

    // 1. Carregar mensagens antigas ao abrir
    useEffect(() => {
        if (isOpen) {
            axios.get(route('chat.index', pedidoId)).then(response => {
                setMessages(response.data);
                scrollToBottom();
                markAsRead();
            });
            setHasUnread(false);
        }
    }, [isOpen]);

    // 2. Conexão WebSocket (Laravel Reverb)
    // 2. Conexão WebSocket (Pusher)
    useEffect(() => {
        const channel = window.Echo.private(`chat.pedido.${pedidoId}`);

        channel.listen('MessageSent', (e) => {
            // --- CORREÇÃO AQUI ---
            // Se o ID de quem mandou for IGUAL ao meu ID, eu ignoro.
            // (Porque o meu React já mostrou essa mensagem antes de enviar)
            if (e.user_id === auth.user.id) {
                return; 
            }
            // ---------------------

            setMessages(prev => [...prev, { ...e, is_me: false }]);
            
            if (!isOpen) {
                setHasUnread(true);
                playSound();
            } else {
                scrollToBottom();
                markAsRead();
                playSound(); 
            }
        });

        return () => {
            window.Echo.leave(`chat.pedido.${pedidoId}`);
        };
    }, [pedidoId, isOpen]);

    // Enviar Mensagem
    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        // Otimistic UI: Adiciona na tela antes de confirmar
        const tempId = Date.now();
        const msgText = newMessage;
        
        setMessages(prev => [...prev, {
            id: tempId,
            content: msgText,
            is_me: true,
            created_at: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            read_at: null,
            sending: true // Flag para mostrar reloginho
        }]);

        setNewMessage('');
        scrollToBottom();

        try {
            await axios.post(route('chat.store', pedidoId), { content: msgText });
            // Atualiza status de enviado (remove o reloginho)
            setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, sending: false } : msg));
        } catch (error) {
            console.error("Erro ao enviar", error);
        }
    };

    const markAsRead = () => {
        axios.post(route('chat.read', pedidoId));
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    return (
        <div className={`fixed bottom-4 right-4 z-50 flex flex-col items-end transition-all ${isOpen ? 'w-80 sm:w-96' : 'w-auto'}`}>
            
            {/* BOTÃO FLUTUANTE (ABRIR/FECHAR) */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`shadow-lg flex items-center gap-2 px-4 py-3 rounded-full transition-all text-white font-bold ${hasUnread ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                <span className="text-xl">💬</span>
                {isOpen ? 'Fechar Chat' : (hasUnread ? 'Nova Mensagem!' : 'Chat do Pedido')}
            </button>

            {/* JANELA DO CHAT */}
            {isOpen && (
                <div className="bg-white w-full mt-2 rounded-lg shadow-2xl border border-gray-200 overflow-hidden flex flex-col" style={{ height: '450px' }}>
                    
                    {/* Cabeçalho */}
                    <div className="bg-gray-100 p-3 border-b flex justify-between items-center">
                        <div>
                            <h4 className="font-bold text-gray-700">Chat do Pedido #{pedidoId}</h4>
                            <p className="text-xs text-gray-500">Tire suas dúvidas aqui</p>
                        </div>
                        <div className="h-2 w-2 rounded-full bg-green-500" title="Online"></div>
                    </div>

                    {/* Área de Mensagens */}
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3" ref={chatContainerRef}>
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.is_me ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-lg p-3 relative shadow-sm ${msg.is_me ? 'bg-blue-100 text-blue-900 rounded-tr-none' : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'}`}>
                                    
                                    {/* Nome do remetente (se não for eu) */}
                                    {!msg.is_me && <p className="text-[10px] font-bold text-orange-600 mb-1">{msg.user_name}</p>}
                                    
                                    <p className="text-sm">{msg.content}</p>
                                    
                                    {/* Rodapé da mensagem: Hora + Ticks */}
                                    <div className="flex justify-end items-center gap-1 mt-1">
                                        <span className="text-[10px] text-gray-400">{msg.created_at}</span>
                                        
                                        {/* Lógica dos Ticks (Só mostra nas minhas mensagens) */}
                                        {msg.is_me && (
                                            <span>
                                                {msg.sending ? (
                                                    <span className="text-gray-400">🕒</span> // Relógio (Enviando)
                                                ) : msg.read_at ? (
                                                    <span className="text-blue-500 font-bold text-[10px]">✓✓</span> // Azul (Lido)
                                                ) : (
                                                    <span className="text-gray-400 font-bold text-[10px]">✓✓</span> // Cinza (Entregue)
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={sendMessage} className="p-3 bg-white border-t flex gap-2">
                        <input 
                            type="text" 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Digite sua mensagem..." 
                            className="flex-1 border-gray-300 rounded-full text-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                        <button type="submit" className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 pl-0.5">
                                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                            </svg>
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}