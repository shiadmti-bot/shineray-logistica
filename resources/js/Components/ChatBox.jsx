import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { usePage } from '@inertiajs/react';

export default function ChatBox({ pedidoId }) {
    const { auth } = usePage().props;
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState(''); 
    const [isOpen, setIsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const textareaRef = useRef(null);
    const messagesEndRef = useRef(null);

    // Lógica de Abas (Canais)
    const [activeChannel, setActiveChannel] = useState(
        auth.user.perfil === 'gestor' ? 'gestor' : 'cd'
    );

    // --- CARREGAMENTO INICIAL ---
    useEffect(() => {
        axios.get(route('chat.index', pedidoId)).then(response => {
            const msgs = response.data;
            setMessages(msgs);
            // Verifica não lidas de OUTROS
            const unreadCount = msgs.filter(m => m.user_id !== auth.user.id && !m.read_at).length;
            if (unreadCount > 0) setHasUnread(true);
        });
    }, [pedidoId]);

    // --- MARCAR COMO LIDO AO ABRIR ---
    useEffect(() => {
        if (isOpen && hasUnread) {
            axios.post(route('chat.markRead', pedidoId));
            setHasUnread(false);
            setMessages(prev => prev.map(m => 
                (m.user_id !== auth.user.id && !m.read_at) ? { ...m, read_at: new Date().toISOString() } : m
            ));
        }
        if (isOpen) scrollToBottom();
    }, [isOpen]);

    // --- REALTIME (WEBSOCKET) ---
    useEffect(() => {
        const channel = window.Echo.private(`chat.pedido.${pedidoId}`);
        channel.listen('NewMessage', (e) => {
            setMessages(prev => [...prev, e.message]);
            if (!isOpen) { 
                if(e.message.user_id !== auth.user.id) {
                    setHasUnread(true); 
                    new Audio('/plim.mp3').play().catch(()=>{});
                }
            } else {
                if(e.message.user_id !== auth.user.id) axios.post(route('chat.markRead', pedidoId));
                scrollToBottom();
            }
        });
        return () => channel.stopListening('NewMessage');
    }, [pedidoId, isOpen]);

    // --- HELPERS ---
    const scrollToBottom = () => {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };

    const handleInput = (e) => {
        setNewMessage(e.target.value);
        // Auto-Resize
        e.target.style.height = 'auto';
        e.target.style.height = (e.target.scrollHeight) + 'px';
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(e);
        }
    };

    const sendMessage = (e) => {
        if(e) e.preventDefault();
        if (!newMessage.trim()) return;

        axios.post(route('chat.store', pedidoId), { 
            content: newMessage, 
            canal: activeChannel 
        }).then(response => {
            setMessages([...messages, response.data]);
            setNewMessage('');
            if(textareaRef.current) textareaRef.current.style.height = 'auto'; // Reset height
            scrollToBottom();
        });
    };

    // --- AGRUPAMENTO POR DATA ---
    const groupedMessages = messages
        .filter(m => m.canal === activeChannel)
        .reduce((groups, msg) => {
            const date = new Date(msg.created_at).toLocaleDateString('pt-BR', { 
                day: 'numeric', month: 'long', year: 'numeric' 
            });
            if (!groups[date]) groups[date] = [];
            groups[date].push(msg);
            return groups;
        }, {});

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 font-sans">
            
            {/* JANELA DO CHAT */}
            {isOpen && (
                <div className="bg-white w-[90vw] md:w-96 rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-fade-in-up md:mb-2 transition-all duration-300 transform origin-bottom-right">
                    
                    {/* HEADER */}
                    <div className="bg-white p-4 border-b border-gray-100 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm">Chat do Pedido #{pedidoId}</h3>
                                    <span className="text-[10px] uppercase font-bold text-green-500 tracking-wider">Online</span>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-red-500 transition p-2 rounded-full hover:bg-gray-50">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        {/* SELETOR DE CANAIS (ABAS) */}
                        <div className="flex p-1 bg-gray-100 rounded-lg">
                            {(auth.user.perfil === 'loja' || auth.user.perfil === 'admin') ? (
                                <>
                                    <button onClick={() => setActiveChannel('cd')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeChannel === 'cd' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>🏭 Expedição</button>
                                    <button onClick={() => setActiveChannel('gestor')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeChannel === 'gestor' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>🛡️ Gestão</button>
                                </>
                            ) : (
                                <div className={`w-full py-1.5 text-xs font-bold text-center rounded-md ${activeChannel === 'gestor' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {activeChannel === 'gestor' ? '🛡️ Canal da Gestão' : '🏭 Canal da Expedição'}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* LISTA DE MENSAGENS */}
                    <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-6 h-[400px]">
                        {Object.keys(groupedMessages).length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                                <p className="text-xs font-medium">Nenhuma mensagem ainda.</p>
                            </div>
                        )}
                        
                        {Object.keys(groupedMessages).map((date) => (
                            <div key={date} className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-px bg-gray-200 flex-1"></div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2">{date}</span>
                                    <div className="h-px bg-gray-200 flex-1"></div>
                                </div>
                                {groupedMessages[date].map((msg) => {
                                    const isMe = msg.user_id === auth.user.id;
                                    return (
                                        <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                            {/* AVATAR */}
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm flex-shrink-0
                                                ${isMe ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-gray-400 to-gray-500'}
                                            `}>
                                                {msg.user.name.substring(0,2).toUpperCase()}
                                            </div>

                                            {/* BALÃO */}
                                            <div className={`relative max-w-[75%] p-3 text-sm shadow-sm transition-all hover:shadow-md
                                                ${isMe 
                                                    ? (activeChannel === 'gestor' ? 'bg-purple-600 text-white rounded-2xl rounded-tr-sm' : 'bg-blue-600 text-white rounded-2xl rounded-tr-sm')
                                                    : 'bg-white text-gray-700 border border-gray-100 rounded-2xl rounded-tl-sm'
                                                }
                                            `}>
                                                {!isMe && <p className="text-[10px] font-bold opacity-70 mb-1 text-gray-500 uppercase">{msg.user.name.split(' ')[0]}</p>}
                                                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                                
                                                <div className={`flex justify-end items-center gap-1 mt-1 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                                                    <span className="text-[9px]">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                    {isMe && (
                                                        <span className={`text-[10px] ${msg.read_at ? 'text-white font-bold' : 'opacity-60'}`}>
                                                            {msg.read_at ? '✓✓' : '✓'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* INPUT AREA */}
                    <div className="p-3 bg-white border-t border-gray-100">
                        <form onSubmit={sendMessage} className="flex gap-2 items-end bg-gray-50 p-1.5 rounded-3xl border border-gray-200 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all">
                            <textarea 
                                ref={textareaRef}
                                value={newMessage}
                                onChange={handleInput}
                                onKeyDown={handleKeyDown}
                                placeholder="Digite sua mensagem..."
                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-700 placeholder-gray-400 resize-none max-h-32 py-2 px-3 overflow-y-auto"
                                rows="1"
                            />
                            <button 
                                type="submit" 
                                disabled={!newMessage.trim()}
                                className={`p-2.5 rounded-full text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                                    ${activeChannel === 'gestor' ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700' : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'}
                                `}
                            >
                                <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
                            </button>
                        </form>
                        <p className="text-[9px] text-center text-gray-400 mt-2">Enter envia • Shift+Enter quebra linha</p>
                    </div>
                </div>
            )}

            {/* BOTÃO FLUTUANTE (FAB) */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`relative shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center w-14 h-14 rounded-full text-white
                    ${auth.user.perfil === 'gestor' ? 'bg-gradient-to-br from-purple-600 to-purple-800' : 'bg-gradient-to-br from-blue-600 to-blue-800'}
                `}
            >
                {hasUnread && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
                    </span>
                )}
                {isOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                )}
            </button>
        </div>
    );
}