import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, router } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import Swal from 'sweetalert2';

export default function PedidosIndex({ auth, pedidos, perfil, filters }) {
    // 1. BLINDAGEM: Garante objeto padrão
    const safePedidos = pedidos || { data: [], links: [], total: 0 };

    const { data, setData, get, processing } = useForm({
        search: filters?.search || '',
    });

    // Ref para o áudio (evita recriar o objeto a cada render)
    const audioRef = useRef(typeof window !== 'undefined' ? new Audio('/plim.mp3') : null);

    // --- ATUALIZAÇÃO EM TEMPO REAL ---
    useEffect(() => {
        if (!auth.user?.id || !window.Echo) return;

        const channel = window.Echo.private(`App.Models.User.${auth.user.id}`);

        channel.notification((notification) => {
            // Toca som
            if (audioRef.current) {
                audioRef.current.play().catch(() => {}); // Ignora erro de autoplay
            }

            // Toast
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 4000,
                timerProgressBar: true
            });

            Toast.fire({
                icon: 'info',
                title: 'Atualização',
                text: notification.mensagem || 'Status do pedido atualizado.'
            });

            // Reload silencioso
            router.reload({ only: ['pedidos'] });
        });

        return () => {
            channel.stopListening('Notification');
        };
    }, [auth.user?.id]);

    const handleSearch = (e) => {
        e.preventDefault();
        get(route('pedidos.index'), {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const clearSearch = () => {
        setData('search', '');
        // Dispara a limpeza imediata
        router.get(route('pedidos.index'), {}, { preserveState: true });
    };

    // --- LÓGICA DE EXIBIÇÃO INTELIGENTE (CORRIGE DUPLICIDADE) ---
    const renderLojaInfo = (user) => {
        if (!user) return <span className="text-red-400 italic">Usuário Removido</span>;

        const nome = user.name || '';
        const filial = user.filial || '';
        
        // Verifica se é redundante (Ex: Nome="Filial Belém", Filial="Belém")
        const isRedundant = filial && nome.toLowerCase().includes(filial.toLowerCase());
        const isMatriz = filial === 'Matriz';

        return (
            <div>
                <div className="text-sm font-bold text-gray-900">{nome}</div>
                
                {/* Só mostra a filial se NÃO for redundante e NÃO for Matriz */}
                {filial && !isRedundant && !isMatriz && (
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        {filial}
                    </div>
                )}
            </div>
        );
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-xl text-gray-800">Gerenciamento de Pedidos</h2>}>
            <Head title="Pedidos" />

            <div className="py-8 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6 px-4">
                    
                    {/* --- CABEÇALHO E FILTROS --- */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center transition-all hover:shadow-md">
                        {perfil === 'loja' ? (
                            <Link href={route('solicitar')} className="w-full md:w-auto bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-lg font-bold shadow hover:from-red-700 hover:to-red-800 transform hover:-translate-y-0.5 transition flex items-center justify-center gap-2">
                                <span>➕</span> Novo Pedido
                            </Link>
                        ) : (
                            <div className="flex items-center gap-2 text-gray-600">
                                <span className="text-2xl">📋</span>
                                <div>
                                    <h3 className="font-bold text-lg leading-none">Listagem Geral</h3>
                                    <span className="text-xs text-gray-400 font-medium">Total de registros: {safePedidos.total}</span>
                                </div>
                            </div>
                        )}
                        
                        <form onSubmit={handleSearch} className="flex w-full md:w-auto gap-2 relative">
                            <div className="relative w-full md:w-80">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input 
                                    type="text" 
                                    className="pl-10 pr-10 w-full border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 transition-colors"
                                    placeholder="Buscar ID, Chassi ou Loja..."
                                    value={data.search}
                                    onChange={e => setData('search', e.target.value)}
                                />
                                {/* Botão Limpar Busca */}
                                {data.search && (
                                    <button 
                                        type="button" 
                                        onClick={clearSearch}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-500 transition"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            <button type="submit" className="bg-gray-800 text-white px-5 rounded-lg hover:bg-gray-700 font-bold transition shadow-sm" disabled={processing}>
                                Buscar
                            </button>
                        </form>
                    </div>

                    {/* --- VERSÃO MOBILE --- */}
                    <div className="md:hidden space-y-4">
                        {safePedidos.data && safePedidos.data.map((pedido) => (
                            <Link key={pedido.id} href={route('pedidos.show', pedido.id)} className="block group">
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-red-300 transition relative overflow-hidden">
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getStatusColor(pedido.status)}`}></div>

                                    <div className="flex justify-between items-start mb-2 pl-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-black text-gray-800">#{pedido.id}</span>
                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200">
                                                    {new Date(pedido.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="mt-1">
                                                {/* Reutiliza a lógica visual limpa */}
                                                <span className="text-sm font-semibold text-gray-600 block truncate max-w-[200px]">
                                                    {pedido.user?.name || 'Usuário Removido'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-[10px] text-gray-400 uppercase font-bold">Qtd</span>
                                            <span className="text-lg font-black text-red-600">
                                                {pedido.motos_count || 0}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-3 pl-2">
                                        <div className="flex justify-between items-end mb-1">
                                            <StatusBadge status={pedido.status} />
                                        </div>
                                        <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden mt-2">
                                            <div 
                                                className={`h-full ${getStatusColor(pedido.status)}`} 
                                                style={{ width: `${(getStepNumber(pedido.status) / 4) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* --- VERSÃO DESKTOP --- */}
                    <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">ID / Data</th>
                                    <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Loja Solicitante</th>
                                    <th className="px-6 py-4 text-center text-xs font-extrabold text-gray-500 uppercase tracking-wider">Motos</th>
                                    <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider w-1/4">Status</th>
                                    <th className="px-6 py-4 text-right text-xs font-extrabold text-gray-500 uppercase tracking-wider">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {safePedidos.data && safePedidos.data.length > 0 ? (
                                    safePedidos.data.map((pedido) => (
                                        <tr key={pedido.id} className="hover:bg-red-50/20 transition duration-150 group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-black text-gray-800">#{pedido.id}</div>
                                                <div className="text-xs text-gray-400 mt-0.5">{new Date(pedido.created_at).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    {/* Avatar / Ícone */}
                                                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300 flex items-center justify-center text-gray-600 font-bold text-xs mr-3 shadow-sm">
                                                        {(pedido.user?.name ? pedido.user.name.substring(0, 2).toUpperCase() : 'XX')}
                                                    </div>
                                                    
                                                    {/* Info Inteligente (Sem duplicidade) */}
                                                    {renderLojaInfo(pedido.user)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold bg-gray-50 text-gray-700 border border-gray-200 group-hover:bg-white group-hover:border-red-200 transition">
                                                    {pedido.motos_count || 0}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex justify-between items-center">
                                                        <StatusBadge status={pedido.status} />
                                                    </div>
                                                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full ${getStatusColor(pedido.status)} transition-all duration-700`} 
                                                            style={{ width: `${(getStepNumber(pedido.status) / 4) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <Link 
                                                    href={route('pedidos.show', pedido.id)} 
                                                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-900 font-bold border border-indigo-100 hover:border-indigo-300 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
                                                >
                                                    Detalhes <span>→</span>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-16 text-center text-gray-400 bg-gray-50/30">
                                            <div className="flex flex-col items-center animate-pulse">
                                                <span className="text-4xl mb-3">🔍</span>
                                                <p className="font-medium">Nenhum pedido encontrado com estes filtros.</p>
                                                <button onClick={clearSearch} className="text-red-500 text-sm mt-2 hover:underline">Limpar filtros</button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* PAGINAÇÃO */}
                    {safePedidos.links && safePedidos.links.length > 3 && (
                        <div className="flex flex-wrap justify-center gap-2 mt-6 pb-8">
                            {safePedidos.links.map((link, k) => (
                                <Link
                                    key={k}
                                    href={link.url}
                                    preserveScroll
                                    className={`px-3 py-2 text-sm font-bold rounded-lg border transition ${
                                        link.active 
                                            ? 'bg-gray-900 text-white border-gray-900 shadow-md transform scale-105' 
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    } ${!link.url ? 'opacity-50 cursor-not-allowed hidden' : ''}`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// --- HELPERS ---

function getStepNumber(status) {
    const safeStatus = String(status || '').toLowerCase();
    switch(safeStatus) {
        case 'em_analise': return 0.5;
        case 'solicitado': return 1;
        case 'separado': return 2;
        case 'expedido': return 2.5;
        case 'em_transito': return 3;
        case 'concluido': return 4;
        default: return 4;
    }
}

function getStatusColor(status) {
    const safeStatus = String(status || '').toLowerCase();
    const colors = {
        'em_analise': 'bg-purple-500',
        'solicitado': 'bg-yellow-500',
        'separado': 'bg-blue-500',
        'expedido': 'bg-indigo-500',
        'em_transito': 'bg-orange-500',
        'concluido': 'bg-green-500',
        'cancelado': 'bg-red-500',
    };
    return colors[safeStatus] || 'bg-gray-400';
}

function StatusBadge({ status }) {
    const safeStatus = String(status || 'desconhecido').toLowerCase();

    const config = {
        'em_analise': { label: 'Em Análise',  bg: 'bg-purple-100 text-purple-800 border-purple-200' },
        'solicitado': { label: 'Aguardando CD', bg: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
        'separado':   { label: 'Separado',    bg: 'bg-blue-100 text-blue-800 border-blue-200' },
        'expedido':   { label: 'Em Carga',    bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
        'em_transito':{ label: 'Em Trânsito', bg: 'bg-orange-100 text-orange-800 border-orange-200' },
        'concluido':  { label: 'Entregue',    bg: 'bg-green-100 text-green-800 border-green-200' },
        'cancelado':  { label: 'Cancelado',   bg: 'bg-red-100 text-red-800 border-red-200' },
    }[safeStatus] || { label: safeStatus.toUpperCase().replace('_', ' '), bg: 'bg-gray-100 text-gray-600' };

    return (
        <span className={`px-2.5 py-1 rounded-md text-[10px] md:text-xs font-bold uppercase border tracking-wide whitespace-nowrap ${config.bg}`}>
            {config.label}
        </span>
    );
}