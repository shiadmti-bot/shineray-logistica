import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, router } from '@inertiajs/react';
import { useEffect } from 'react';
import Swal from 'sweetalert2';

export default function PedidosIndex({ auth, pedidos, perfil, filters }) {
    // 1. BLINDAGEM: Garante que 'pedidos' nunca seja null/undefined
    const safePedidos = pedidos || { data: [], links: [], total: 0 };

    const { data, setData, get, processing } = useForm({
        search: filters?.search || '', // Proteção contra filters null
    });

    // --- ATUALIZAÇÃO EM TEMPO REAL ---
    useEffect(() => {
        if (!auth.user?.id || !window.Echo) return;

        // Escuta o canal privado do usuário logado
        const channel = window.Echo.private(`App.Models.User.${auth.user.id}`);

        channel.notification((notification) => {
            // 1. Toca o som (se o navegador permitir)
            try {
                const audio = new Audio('/plim.mp3');
                audio.play().catch(e => console.warn("Áudio bloqueado pelo navegador"));
            } catch(e) {}

            // 2. Mostra o Toast flutuante
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

            // 3. Recarrega a lista de pedidos silenciosamente
            router.reload({ only: ['pedidos'] });
        });

        // Limpeza ao sair da página
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
                                <h3 className="font-bold text-lg">Listagem Geral</h3>
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-500 font-bold border">
                                    {safePedidos.total}
                                </span>
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
                                    className="pl-10 w-full border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 transition-colors"
                                    placeholder="Buscar por ID, Chassi ou Loja..."
                                    value={data.search}
                                    onChange={e => setData('search', e.target.value)}
                                />
                            </div>
                            <button type="submit" className="bg-gray-800 text-white px-5 rounded-lg hover:bg-gray-700 font-bold transition shadow-sm" disabled={processing}>
                                Buscar
                            </button>
                        </form>
                    </div>

                    {/* --- VERSÃO MOBILE (CARDS COM PROGRESSO) --- */}
                    <div className="md:hidden space-y-4">
                        {safePedidos.data && safePedidos.data.map((pedido) => (
                            <Link key={pedido.id} href={route('pedidos.show', pedido.id)} className="block group">
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-red-300 hover:shadow-md transition relative overflow-hidden">
                                    {/* Faixa lateral de status */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getStatusColor(pedido.status)}`}></div>

                                    <div className="flex justify-between items-start mb-3 pl-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-black text-gray-800">#{pedido.id}</span>
                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200">
                                                    {new Date(pedido.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-sm font-semibold text-gray-600 mt-1 truncate max-w-[200px]">
                                                {pedido.user?.filial || pedido.user?.name || 'Usuário Removido'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xs text-gray-400 uppercase font-bold mb-1">Qtd</span>
                                            <span className="text-xl font-black text-red-600 bg-red-50 px-2 py-1 rounded-lg border border-red-100">
                                                {pedido.motos_count || 0}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Barra de Progresso Visual */}
                                    <div className="mt-4 pl-2">
                                        <div className="flex justify-between items-end mb-1">
                                            <StatusBadge status={pedido.status} />
                                            <span className="text-[10px] text-gray-400 font-bold">
                                                Etapa {getStepNumber(pedido.status)} de 4
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full ${getStatusColor(pedido.status)} transition-all duration-1000`} 
                                                style={{ width: `${(getStepNumber(pedido.status) / 4) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* --- VERSÃO DESKTOP (TABELA MODERNA) --- */}
                    <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">ID / Data</th>
                                    <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Loja Solicitante</th>
                                    <th className="px-6 py-4 text-center text-xs font-extrabold text-gray-500 uppercase tracking-wider">Motos</th>
                                    <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider w-1/4">Status & Progresso</th>
                                    <th className="px-6 py-4 text-right text-xs font-extrabold text-gray-500 uppercase tracking-wider">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {safePedidos.data && safePedidos.data.length > 0 ? (
                                    safePedidos.data.map((pedido) => (
                                        <tr key={pedido.id} className="hover:bg-red-50/30 transition duration-150 group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-black text-gray-800">#{pedido.id}</div>
                                                <div className="text-xs text-gray-400 mt-0.5">{new Date(pedido.created_at).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs mr-3">
                                                        {(pedido.user?.filial || (pedido.user?.name ? pedido.user.name[0] : 'X'))}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-gray-700">{pedido.user?.filial || 'Matriz'}</div>
                                                        <div className="text-xs text-gray-500">{pedido.user?.name || <span className="text-red-400 italic">Usuário Removido</span>}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-700 border border-gray-200 group-hover:bg-white group-hover:border-red-200 transition">
                                                    {pedido.motos_count || 0}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {/* Status + Barra de Progresso */}
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex justify-between items-center">
                                                        <StatusBadge status={pedido.status} />
                                                    </div>
                                                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full ${getStatusColor(pedido.status)}`} 
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
                                        <td colSpan="5" className="px-6 py-12 text-center text-gray-400 bg-gray-50/50">
                                            <div className="flex flex-col items-center">
                                                <span className="text-3xl mb-2">📭</span>
                                                <p>Nenhum pedido encontrado.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* PAGINAÇÃO SAFE */}
                    {safePedidos.links && safePedidos.links.length > 3 && (
                        <div className="flex flex-wrap justify-center gap-2 mt-6 pb-8">
                            {safePedidos.links.map((link, k) => (
                                <Link
                                    key={k}
                                    href={link.url}
                                    preserveScroll
                                    className={`px-4 py-2 text-sm font-bold rounded-lg border transition ${
                                        link.active 
                                            ? 'bg-gray-800 text-white border-gray-800 shadow-md' 
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
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

// --- FUNÇÕES AUXILIARES (BLINDADAS) ---

function getStepNumber(status) {
    // Tratamento seguro de string
    const safeStatus = String(status || '').toLowerCase();
    switch(safeStatus) {
        case 'em_analise': return 0.5;
        case 'solicitado': return 1;
        case 'separado': return 2;
        case 'expedido': return 2.5;
        case 'em_transito': return 3;
        case 'concluido': return 4;
        default: return 4; // Se finalizado ou outro status
    }
}

function getStatusColor(status) {
    const safeStatus = String(status || '').toLowerCase();
    switch(safeStatus) {
        case 'em_analise': return 'bg-purple-500';
        case 'solicitado': return 'bg-yellow-500';
        case 'separado': return 'bg-blue-500';
        case 'expedido': return 'bg-indigo-500';
        case 'em_transito': return 'bg-orange-500';
        case 'concluido': return 'bg-green-500';
        case 'cancelado': return 'bg-red-500';
        default: return 'bg-gray-400';
    }
}

function StatusBadge({ status }) {
    // BLINDAGEM PRINCIPAL: Converte null/undefined para string antes de verificar
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
        <span className={`px-2.5 py-1 rounded-md text-[10px] md:text-xs font-bold uppercase border tracking-wide ${config.bg}`}>
            {config.label}
        </span>
    );
}