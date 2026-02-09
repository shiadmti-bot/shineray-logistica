import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, router } from '@inertiajs/react';
import { useEffect } from 'react';
import Swal from 'sweetalert2';

export default function PedidosIndex({ auth, pedidos, perfil, filters }) {
    
    // 1. BLINDAGEM DE DADOS
    const safePedidos = pedidos || { data: [], links: [], total: 0 };

    // 2. LÓGICA V2: Separar o que exige ação imediata (Expedição)
    const transferenciasAEnviar = safePedidos.data.filter(p => 
        p.origem_user_id === auth.user.id && 
        ['solicitado', 'aprovado', 'separado', 'aguardando_coleta'].includes(p.status)
    );

    const listaPrincipal = safePedidos.data; 

    const { data, setData, get, processing } = useForm({
        search: filters?.search || '',
    });

    // --- NOTIFICAÇÕES ---
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

    // --- NOVO RENDERIZADOR DE FLUXO (SOLICITANTE X ORIGEM) ---
    const RenderLogisticaFlow = ({ pedido }) => {
        const souOrigem = pedido.origem_user_id === auth.user.id;
        const souDestino = pedido.user_id === auth.user.id;
        const ehReposicao = !pedido.origem_user_id; // Vem do CD

        return (
            <div className="flex flex-col gap-1">
                {/* LINHA DE CIMA: DE ONDE VEM? */}
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 font-bold uppercase w-10 text-right">DE:</span>
                    {ehReposicao ? (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 font-bold flex items-center gap-1">
                            🏭 CD MATRIZ
                        </span>
                    ) : (
                        <span className={`px-2 py-0.5 rounded border font-bold flex items-center gap-1 ${souOrigem ? 'bg-yellow-50 text-yellow-800 border-yellow-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                            🏪 {pedido.origem?.filial} {souOrigem && '(Você)'}
                        </span>
                    )}
                </div>

                {/* ÍCONE DE SETA */}
                <div className="pl-12 text-gray-300 leading-none -my-1 text-xs">
                    ⬇
                </div>

                {/* LINHA DE BAIXO: PARA ONDE VAI? */}
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 font-bold uppercase w-10 text-right">PARA:</span>
                    <span className={`px-2 py-0.5 rounded border font-bold flex items-center gap-1 ${souDestino ? 'bg-green-50 text-green-800 border-green-200' : 'bg-gray-50 text-gray-800 border-gray-200'}`}>
                        📍 {pedido.user?.filial || pedido.user?.name} {souDestino && '(Você)'}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-xl text-gray-800">Gerenciamento de Pedidos</h2>}>
            <Head title="Pedidos" />

            <div className="py-8 bg-gray-50 min-h-screen pb-32">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6 px-4">
                    
                    {/* --- 1. BARRA DE AÇÕES E FILTROS --- */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
                        {perfil === 'loja' ? (
                            <Link href={route('solicitar')} className="w-full md:w-auto bg-gray-900 text-white px-6 py-3 rounded-lg font-bold shadow hover:bg-black transform hover:-translate-y-0.5 transition flex items-center justify-center gap-2">
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
                                    className="pl-10 pr-10 w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                    placeholder="Buscar ID, Chassi ou Loja..."
                                    value={data.search}
                                    onChange={e => setData('search', e.target.value)}
                                />
                                <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                                {data.search && (
                                    <button type="button" onClick={clearSearch} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-500 font-bold">✕</button>
                                )}
                            </div>
                            <button type="submit" className="bg-blue-600 text-white px-5 rounded-lg hover:bg-blue-700 font-bold transition text-sm" disabled={processing}>
                                Buscar
                            </button>
                        </form>
                    </div>

                    {/* --- 2. DESTAQUE V2: TRANSFERÊNCIAS A ENVIAR --- */}
                    {transferenciasAEnviar.length > 0 && (
                        <div className="bg-orange-50 border-l-4 border-orange-500 rounded-xl shadow-md p-6 animate-fade-in-down relative overflow-hidden">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 relative z-10">
                                <div>
                                    <h3 className="text-lg font-black text-orange-900 flex items-center gap-2 uppercase">
                                        📢 Atenção: Transferências Pendentes
                                    </h3>
                                    <p className="text-sm text-orange-800 mt-1 font-medium">
                                        Você precisa preparar estas motos para envio.
                                    </p>
                                </div>
                                <span className="mt-2 md:mt-0 bg-orange-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow animate-pulse">
                                    {transferenciasAEnviar.length} Ações Requeridas
                                </span>
                            </div>

                            <div className="bg-white/90 rounded-lg border border-orange-200 overflow-hidden relative z-10">
                                {transferenciasAEnviar.map(p => (
                                    <div key={p.id} className="p-4 border-b border-orange-100 flex flex-col md:flex-row justify-between items-center hover:bg-orange-50/50 transition gap-4">
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className="bg-orange-100 text-orange-800 font-black p-2 rounded text-md">#{p.id}</div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-500 uppercase">Enviar Para:</span>
                                                <span className="font-bold text-gray-800 text-lg">{p.user?.filial}</span>
                                            </div>
                                        </div>
                                        <Link href={route('pedidos.show', p.id)} className="w-full md:w-auto text-center bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-6 rounded shadow-sm text-xs uppercase transition">
                                            Resolver Agora ➔
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* --- 3. TABELA GERAL --- */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        
                        {/* VIEW DESKTOP */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">ID / Tipo</th>
                                        <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Fluxo Logístico (Origem ➔ Destino)</th>
                                        <th className="px-6 py-4 text-center text-xs font-extrabold text-gray-500 uppercase tracking-wider">Volume</th>
                                        <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider w-1/4">Status & Progresso</th>
                                        <th className="px-6 py-4 text-right text-xs font-extrabold text-gray-500 uppercase tracking-wider">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100 text-sm">
                                    {listaPrincipal.length > 0 ? listaPrincipal.map((pedido) => (
                                        <tr key={pedido.id} className="hover:bg-gray-50 transition duration-150 group">
                                            
                                            {/* ID e Tipo */}
                                            <td className="px-6 py-4 whitespace-nowrap align-top">
                                                <div className="text-sm font-black text-gray-800 group-hover:text-blue-600 transition">#{pedido.id}</div>
                                                <div className="mt-1"><TipoBadge pedido={pedido} authId={auth.user.id} /></div>
                                                <div className="text-[10px] text-gray-400 mt-1 font-mono">{new Date(pedido.created_at).toLocaleDateString()}</div>
                                            </td>

                                            {/* Fluxo Logístico (NOVO) */}
                                            <td className="px-6 py-4 align-top">
                                                <RenderLogisticaFlow pedido={pedido} />
                                            </td>

                                            {/* Quantidade */}
                                            <td className="px-6 py-4 text-center align-middle">
                                                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                                    {pedido.motos_count || 0}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-6 py-4 align-middle">
                                                <StatusBadge status={pedido.status} />
                                                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mt-2">
                                                    <div className={`h-full ${safeGetStatusColor(pedido.status)} transition-all duration-700`} style={{ width: `${(safeGetStepNumber(pedido.status) / 5) * 100}%` }}></div>
                                                </div>
                                            </td>

                                            {/* Ações */}
                                            <td className="px-6 py-4 text-right align-middle">
                                                <Link href={route('pedidos.show', pedido.id)} className="text-gray-500 hover:text-blue-600 font-bold text-xs bg-gray-50 hover:bg-blue-50 px-3 py-2 rounded transition border border-gray-200 hover:border-blue-200">
                                                    ABRIR DETALHES
                                                </Link>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-20 text-center text-gray-400 bg-gray-50/50">
                                                <p className="font-medium">Nenhum pedido encontrado.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* VIEW MOBILE (Cards) */}
                        <div className="md:hidden">
                            {listaPrincipal.map((pedido) => (
                                <Link key={pedido.id} href={route('pedidos.show', pedido.id)} className="block border-b border-gray-100 p-4 hover:bg-gray-50 transition">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="font-bold text-gray-900">#{pedido.id}</span>
                                            <span className="text-gray-400 text-xs ml-2">{new Date(pedido.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <TipoBadge pedido={pedido} authId={auth.user.id} />
                                    </div>
                                    
                                    <div className="mb-3 pl-2 border-l-2 border-gray-200">
                                        <RenderLogisticaFlow pedido={pedido} />
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <StatusBadge status={pedido.status} />
                                        <div className="text-xs font-bold text-gray-500">
                                            {pedido.motos_count || 0} Motos
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>

                    </div>

                    {/* PAGINAÇÃO */}
                    {safePedidos.links && safePedidos.links.length > 3 && (
                        <div className="flex flex-wrap justify-center gap-2 mt-8">
                            {safePedidos.links.map((link, k) => (
                                <Link key={k} href={link.url || '#'} className={`px-4 py-2 text-sm font-bold rounded-lg border transition ${link.active ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'} ${!link.url ? 'opacity-50 pointer-events-none' : ''}`} dangerouslySetInnerHTML={{ __html: link.label }} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// --- HELPERS VISUAIS ATUALIZADOS ---

function TipoBadge({ pedido, authId }) {
    if (pedido.origem_user_id) {
        const souOrigem = pedido.origem_user_id === authId;
        const souDestino = pedido.user_id === authId;
        
        if(souOrigem) return <span className="text-[9px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded border border-orange-200 font-bold uppercase">📤 Saída</span>;
        if(souDestino) return <span className="text-[9px] bg-green-100 text-green-800 px-1.5 py-0.5 rounded border border-green-200 font-bold uppercase">📥 Entrada</span>;
        
        return <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded border border-purple-200 font-bold uppercase">🔁 Transf.</span>;
    }
    return <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 font-bold uppercase">🏭 Reposição</span>;
}

function safeString(value) { return String(value || '').toLowerCase(); }

function safeGetStepNumber(status) {
    const map = { 
        'em_analise': 0.5, 'solicitado': 1, 'separado': 2, 'aguardando_coleta': 3, 
        'expedido': 3, 'em_transito': 4, 'em_transito_cd': 4, 'no_cd': 4.5, 'concluido': 5 
    };
    return map[String(status).toLowerCase()] || 1;
}

function safeGetStatusColor(status) {
    const map = {
        'em_analise': 'bg-purple-500', 'solicitado': 'bg-yellow-500', 'separado': 'bg-blue-500',
        'aguardando_coleta': 'bg-orange-400', 'expedido': 'bg-cyan-500', 'em_transito': 'bg-orange-500', 
        'em_transito_cd': 'bg-indigo-500', 'no_cd': 'bg-purple-600', 'concluido': 'bg-green-500', 'cancelado': 'bg-red-500'
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
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border tracking-wide whitespace-nowrap ${config.bg}`}>
            {config.label}
        </span>
    );
}