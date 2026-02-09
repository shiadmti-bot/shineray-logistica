import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, router } from '@inertiajs/react';
import { useEffect } from 'react';
import Swal from 'sweetalert2';

export default function PedidosIndex({ auth, pedidos, perfil, filters }) {
    
    // 1. BLINDAGEM DE DADOS (Evita tela branca se vier vazio)
    const safePedidos = pedidos || { data: [], links: [], total: 0 };

    // 2. LÓGICA V2: Separar fluxos
    // Transferências que EU (Loja Origem) preciso preparar para o caminhão
    const transferenciasAEnviar = safePedidos.data.filter(p => 
        p.origem_user_id === auth.user.id && 
        ['solicitado', 'aprovado', 'separado', 'aguardando_coleta'].includes(p.status)
    );

    // Lista Principal (Histórico + Entradas)
    const listaPrincipal = safePedidos.data; 

    const { data, setData, get, processing } = useForm({
        search: filters?.search || '',
    });

    // --- NOTIFICAÇÕES REAL-TIME ---
    useEffect(() => {
        if (!auth.user?.id || !window.Echo) return;
        const channel = window.Echo.private(`App.Models.User.${auth.user.id}`);
        
        channel.notification((notification) => {
            try { const audio = new Audio('/plim.mp3'); audio.play().catch(() => {}); } catch (e) {}
            
            const Toast = Swal.mixin({
                toast: true, position: 'top-end', showConfirmButton: false, timer: 4000, timerProgressBar: true
            });
            
            Toast.fire({
                icon: 'info',
                title: 'Atualização Logística',
                text: notification.mensagem || 'Status atualizado.'
            });
            router.reload({ only: ['pedidos'] });
        });

        return () => channel.stopListening('Notification');
    }, [auth.user?.id]);

    const handleSearch = (e) => {
        e.preventDefault();
        get(route('pedidos.index'), { preserveState: true, preserveScroll: true });
    };

    const clearSearch = () => {
        setData('search', '');
        router.get(route('pedidos.index'), {}, { preserveState: true });
    };

    // --- RENDERIZADOR: ORIGEM / DESTINO ---
    const renderOrigemDestino = (pedido) => {
        const souOrigem = pedido.origem_user_id === auth.user.id;
        
        if (souOrigem) {
            return (
                <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Destino (Enviar Para):</span>
                    <div className="flex items-center gap-1 text-orange-700">
                        <span className="text-lg">➔</span>
                        <span className="text-sm font-bold truncate max-w-[150px]">{pedido.user?.filial || pedido.user?.name}</span>
                    </div>
                </div>
            );
        }
        return (
            <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Origem (Vem De):</span>
                <div className="flex items-center gap-1">
                    {pedido.origem_user_id ? (
                        <>
                            <span className="text-lg text-blue-500">⬅</span>
                            <span className="text-sm font-bold text-blue-700 truncate max-w-[150px]">{pedido.origem?.filial}</span>
                        </>
                    ) : (
                        <>
                            <span className="text-lg text-gray-500">🏭</span>
                            <span className="text-sm font-bold text-gray-700">CD / Fábrica</span>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-xl text-gray-800">Gerenciamento de Pedidos</h2>}>
            <Head title="Pedidos" />

            <div className="py-8 bg-gray-50 min-h-screen pb-32">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6 px-4">
                    
                    {/* --- 1. BARRA DE AÇÕES --- */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
                        {perfil === 'loja' ? (
                            <Link href={route('solicitar')} className="w-full md:w-auto bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-lg font-bold shadow hover:from-red-700 hover:to-red-800 transform hover:-translate-y-0.5 transition flex items-center justify-center gap-2">
                                <span>➕</span> Nova Solicitação
                            </Link>
                        ) : (
                            <div className="flex items-center gap-3 text-gray-600">
                                <span className="text-2xl bg-gray-100 p-2 rounded-lg">📊</span>
                                <div>
                                    <h3 className="font-bold text-lg leading-none text-gray-800">Visão Geral</h3>
                                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total: {safePedidos.total}</span>
                                </div>
                            </div>
                        )}
                        
                        <form onSubmit={handleSearch} className="flex w-full md:w-auto gap-2 relative group">
                            <div className="relative w-full md:w-80">
                                <input 
                                    type="text" 
                                    className="pl-10 pr-10 w-full border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 transition-all group-hover:border-gray-400"
                                    placeholder="Buscar ID, Chassi ou Loja..."
                                    value={data.search}
                                    onChange={e => setData('search', e.target.value)}
                                />
                                <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                                {data.search && (
                                    <button type="button" onClick={clearSearch} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-500 font-bold">✕</button>
                                )}
                            </div>
                            <button type="submit" className="bg-gray-800 text-white px-5 rounded-lg hover:bg-gray-700 font-bold transition" disabled={processing}>
                                Ir
                            </button>
                        </form>
                    </div>

                    {/* --- 2. DESTAQUE V2: TRANSFERÊNCIAS A ENVIAR (Hub & Spoke / Milk Run) --- */}
                    {transferenciasAEnviar.length > 0 && (
                        <div className="bg-orange-50 border-l-8 border-orange-500 rounded-xl shadow-md p-6 animate-fade-in-down relative overflow-hidden">
                            <div className="absolute right-0 top-0 opacity-10 text-9xl -mr-4 -mt-4 text-orange-900 pointer-events-none">🚛</div>
                            
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 relative z-10">
                                <div>
                                    <h3 className="text-xl font-black text-orange-900 flex items-center gap-2">
                                        🔁 EXPEDIÇÃO DE TRANSFERÊNCIA
                                    </h3>
                                    <p className="text-sm text-orange-800 mt-1 font-medium max-w-2xl">
                                        Separe estas motos! O caminhão passará na sua loja para coletá-las.
                                    </p>
                                </div>
                                <span className="mt-2 md:mt-0 bg-orange-600 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow animate-pulse">
                                    {transferenciasAEnviar.length} Pendentes
                                </span>
                            </div>

                            <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-orange-200 overflow-hidden relative z-10">
                                {transferenciasAEnviar.map(p => (
                                    <div key={p.id} className="p-4 border-b border-orange-100 flex flex-col md:flex-row justify-between items-center hover:bg-white transition gap-4">
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className="bg-orange-100 text-orange-800 font-black p-3 rounded text-lg">#{p.id}</div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-500 uppercase">Destino:</span>
                                                    <span className="font-bold text-gray-800 text-lg">{p.user?.filial}</span>
                                                </div>
                                                <div className="text-xs text-orange-700 font-medium">
                                                    Status: {p.status === 'aguardando_coleta' ? 'Aguardando Caminhão' : 'Preparação'}
                                                </div>
                                            </div>
                                        </div>
                                        <Link href={route('pedidos.show', p.id)} className="w-full md:w-auto text-center bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-6 rounded shadow-sm text-sm transition">
                                            VER / SEPARAR
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* --- 3. LISTAGEM GERAL (HISTÓRICO / ENTRADAS) --- */}
                    
                    {/* Mobile View */}
                    <div className="md:hidden space-y-4">
                        {listaPrincipal.map((pedido) => (
                            <Link key={pedido.id} href={route('pedidos.show', pedido.id)} className="block group">
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-red-300 transition relative overflow-hidden">
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${safeGetStatusColor(pedido.status)}`}></div>
                                    <div className="flex justify-between items-start mb-3 pl-3">
                                        <div>
                                            <span className="text-lg font-black text-gray-800">#{pedido.id}</span>
                                            <div className="mt-1"><TipoBadge pedido={pedido} authId={auth.user.id} /></div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] text-gray-400 uppercase font-bold block">Motos</span>
                                            <span className="text-lg font-black text-gray-800 bg-gray-100 px-2 rounded">{pedido.motos_count || 0}</span>
                                        </div>
                                    </div>
                                    <div className="pl-3 mt-2 border-t border-gray-50 pt-3">
                                        {renderOrigemDestino(pedido)}
                                        <div className="mt-3 flex justify-between items-end">
                                            <StatusBadge status={pedido.status} />
                                            <span className="text-[10px] text-gray-400 font-medium">{new Date(pedido.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Desktop View */}
                    <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Pedido / Tipo</th>
                                    <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Logística</th>
                                    <th className="px-6 py-4 text-center text-xs font-extrabold text-gray-500 uppercase tracking-wider">Qtde</th>
                                    <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider w-1/4">Status & Progresso</th>
                                    <th className="px-6 py-4 text-right text-xs font-extrabold text-gray-500 uppercase tracking-wider">Detalhes</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {listaPrincipal.length > 0 ? listaPrincipal.map((pedido) => (
                                    <tr key={pedido.id} className="hover:bg-gray-50 transition duration-150">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-black text-gray-800">#{pedido.id}</div>
                                            <div className="mt-1"><TipoBadge pedido={pedido} authId={auth.user.id} /></div>
                                            <div className="text-[10px] text-gray-400 mt-1">{new Date(pedido.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {renderOrigemDestino(pedido)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                                {pedido.motos_count || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={pedido.status} />
                                            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mt-2">
                                                <div className={`h-full ${safeGetStatusColor(pedido.status)} transition-all duration-700`} style={{ width: `${(safeGetStepNumber(pedido.status) / 5) * 100}%` }}></div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link href={route('pedidos.show', pedido.id)} className="text-gray-500 hover:text-red-600 font-bold text-sm bg-transparent hover:bg-red-50 px-3 py-1.5 rounded transition">
                                                Abrir ↗
                                            </Link>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-20 text-center text-gray-400 bg-gray-50/50">
                                            <div className="flex flex-col items-center">
                                                <span className="text-4xl mb-4 grayscale opacity-30">📦</span>
                                                <p className="font-medium text-lg">Nenhum pedido encontrado.</p>
                                                {data.search && <button onClick={clearSearch} className="text-red-500 text-sm mt-4 font-bold hover:underline">Limpar busca</button>}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* PAGINAÇÃO */}
                    {safePedidos.links && safePedidos.links.length > 3 && (
                        <div className="flex flex-wrap justify-center gap-2 mt-8">
                            {safePedidos.links.map((link, k) => (
                                <Link key={k} href={link.url || '#'} className={`px-4 py-2 text-sm font-bold rounded-lg border transition ${link.active ? 'bg-gray-800 text-white border-gray-800 shadow-md transform scale-105' : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'} ${!link.url ? 'opacity-50 pointer-events-none' : ''}`} dangerouslySetInnerHTML={{ __html: link.label }} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// --- HELPERS E COMPONENTES VISUAIS (ÚNICOS E ATUALIZADOS) ---

function TipoBadge({ pedido, authId }) {
    if (pedido.origem_user_id) {
        const souOrigem = pedido.origem_user_id === authId;
        return (
            <span className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 w-fit font-bold uppercase tracking-wide ${souOrigem ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                {souOrigem ? '📤 Saída (Transf)' : '🔁 Entrada (Transf)'}
            </span>
        );
    }
    return (
        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 w-fit font-bold uppercase tracking-wide">
            🏭 Reposição (CD)
        </span>
    );
}

function safeString(value) { return String(value || '').toLowerCase(); }

function safeGetStepNumber(status) {
    const map = { 
        'em_analise': 0.5, 
        'solicitado': 1,      
        'separado': 2,        
        'aguardando_coleta': 3, 
        'expedido': 3,       
        'em_transito': 4,     
        'em_transito_cd': 4,
        'no_cd': 4.5,
        'concluido': 5       
    };
    return map[String(status).toLowerCase()] || 1;
}

function safeGetStatusColor(status) {
    const map = {
        'em_analise': 'bg-purple-500', 
        'solicitado': 'bg-yellow-500', 
        'separado': 'bg-blue-500',
        'aguardando_coleta': 'bg-orange-400',
        'expedido': 'bg-cyan-500', // Ciano para diferenciar
        'em_transito': 'bg-orange-500', 
        'em_transito_cd': 'bg-indigo-500',
        'no_cd': 'bg-purple-600', 
        'concluido': 'bg-green-500', 
        'cancelado': 'bg-red-500'
    };
    return map[safeString(status)] || 'bg-gray-400';
}

function StatusBadge({ status }) {
    const s = safeString(status);
    
    const config = {
        'em_analise':      { label: 'Em Análise',    bg: 'bg-purple-100 text-purple-800 border-purple-200' },
        'solicitado':      { label: 'Solicitado',    bg: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
        'separado':        { label: 'Separado',      bg: 'bg-blue-100 text-blue-800 border-blue-200' },
        'expedido':        { label: 'Expedido',      bg: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
        'aguardando_coleta':{ label: 'Aguard. Coleta', bg: 'bg-orange-100 text-orange-800 border-orange-300' },
        'em_transito':     { label: 'Em Trânsito',   bg: 'bg-orange-500 text-white border-orange-600' },
        'em_transito_cd':  { label: 'Indo p/ CD',    bg: 'bg-indigo-500 text-white border-indigo-600' },
        'no_cd':           { label: 'No Hub/CD',     bg: 'bg-purple-600 text-white border-purple-700' },
        'concluido':       { label: 'Concluído',     bg: 'bg-green-100 text-green-800 border-green-200' },
        'cancelado':       { label: 'Cancelado',     bg: 'bg-red-100 text-red-800 border-red-200' },
    }[s] || { label: s.toUpperCase(), bg: 'bg-gray-100 text-gray-600' };

    return (
        <span className={`px-2.5 py-1 rounded-md text-[10px] md:text-xs font-bold uppercase border tracking-wide whitespace-nowrap ${config.bg}`}>
            {config.label}
        </span>
    );
}