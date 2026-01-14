import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { usePage } from '@inertiajs/react';

export default function ChatBox({ pedidoId }) {
    const { auth } = usePage().props;
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState(''); // Estado do input
    const [isOpen, setIsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    
    // Lógica de Abas
    const [activeChannel, setActiveChannel] = useState(
        auth.user.perfil === 'gestor' ? 'gestor' : 'cd'
    );

    const messagesEndRef = useRef(null);

    // Carregar mensagens
    useEffect(() => {
        if (isOpen) {
            axios.get(route('chat.index', pedidoId)).then(response => {
                setMessages(response.data);
                scrollToBottom();
                setHasUnread(false);
            });
        }
    }, [isOpen, pedidoId]);

    // WebSocket Listener
    useEffect(() => {
        const channel = window.Echo.private(`chat.pedido.${pedidoId}`);
        
        channel.listen('NewMessage', (e) => {
            setMessages(prev => [...prev, e.message]);
            
            if (!isOpen) {
                setHasUnread(true);
                new Audio('/plim.mp3').play().catch(()=>{}); 
            } else {
                scrollToBottom();
            }
        });

        return () => channel.stopListening('NewMessage');
    }, [pedidoId, isOpen]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        // --- CORREÇÃO AQUI: Enviando 'content' ---
        axios.post(route('chat.store', pedidoId), { 
            content: newMessage, // Nome do campo corrigido
            canal: activeChannel 
        }).then(response => {
            setMessages([...messages, response.data]);
            setNewMessage('');
            scrollToBottom();
        });
    };

    // Filtro por canal
    const filteredMessages = messages.filter(m => m.canal === activeChannel);

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
            
            {isOpen && (
                <div className="bg-white w-full md:w-96 h-[500px] rounded-t-xl rounded-bl-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden mb-4 animate-fade-in-up">
                    
                    {/* Cabeçalho */}
                    <div className="bg-gray-800 p-2">
                        <div className="flex justify-between items-center mb-2 px-2">
                            <h3 className="text-white font-bold flex items-center gap-2">💬 Chat do Pedido</h3>
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white font-bold text-xl">&times;</button>
                        </div>

                        {/* Abas */}
                        {(auth.user.perfil === 'loja' || auth.user.perfil === 'admin') ? (
                            <div className="flex gap-2 bg-gray-700 p-1 rounded-lg">
                                <button 
                                    onClick={() => setActiveChannel('cd')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${activeChannel === 'cd' ? 'bg-blue-600 text-white shadow' : 'text-gray-300 hover:bg-gray-600'}`}
                                >
                                    🏭 CD / Expedição
                                </button>
                                <button 
                                    onClick={() => setActiveChannel('gestor')}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded transition-all ${activeChannel === 'gestor' ? 'bg-purple-600 text-white shadow' : 'text-gray-300 hover:bg-gray-600'}`}
                                >
                                    🛡️ Gestor / Aprovação
                                </button>
                            </div>
                        ) : (
                            <div className={`text-xs font-bold text-center py-1.5 rounded ${auth.user.perfil === 'gestor' ? 'bg-purple-900 text-purple-100' : 'bg-blue-900 text-blue-100'}`}>
                                {auth.user.perfil === 'gestor' ? '🛡️ Canal da Gestão' : '🏭 Canal da Expedição'}
                            </div>
                        )}
                    </div>

                    {/* Lista de Mensagens */}
                    <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-3">
                        {filteredMessages.length === 0 && (
                            <div className="text-center text-gray-400 text-sm mt-10">
                                <p>Nenhuma mensagem neste canal.</p>
                            </div>
                        )}
                        
                        {filteredMessages.map((msg) => {
                            const isMe = msg.user_id === auth.user.id;
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-lg p-3 text-sm shadow-sm ${
                                        isMe 
                                            ? (activeChannel === 'gestor' ? 'bg-purple-100 text-purple-900 rounded-tr-none' : 'bg-blue-100 text-blue-900 rounded-tr-none')
                                            : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                                    }`}>
                                        {!isMe && <p className="text-[10px] font-bold opacity-70 mb-1">{msg.user.name.split(' ')[0]}</p>}
                                        
                                        {/* --- CORREÇÃO AQUI: Exibindo 'content' --- */}
                                        <p>{msg.content}</p> 
                                        
                                        <div className="flex justify-end items-center gap-1 mt-1 opacity-50">
                                            <p className="text-[9px]">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                            {/* Indicador de lido (se read_at não for null) */}
                                            {isMe && (
                                                <span className={`text-[9px] ${msg.read_at ? 'text-blue-500' : ''}`}>
                                                    {msg.read_at ? '✓✓' : '✓'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={sendMessage} className="p-3 bg-white border-t border-gray-200 flex gap-2">
                        <input 
                            type="text" 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={`Escrever...`}
                            className="flex-1 border-gray-300 rounded-full text-sm focus:border-blue-500 focus:ring-blue-500 px-4"
                        />
                        <button 
                            type="submit" 
                            disabled={!newMessage.trim()}
                            className={`p-2 rounded-full text-white transition disabled:opacity-50 ${activeChannel === 'gestor' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            ➤
                        </button>
                    </form>
                </div>
            )}

            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`relative shadow-lg transition-transform hover:scale-105 flex items-center gap-2 px-4 py-3 rounded-full font-bold text-white
                    ${auth.user.perfil === 'gestor' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}
                `}
            >
                {hasUnread && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                <span className="text-xl">💬</span>
                <span className="hidden md:inline">Chat</span>
            </button>
        </div>
    );
}