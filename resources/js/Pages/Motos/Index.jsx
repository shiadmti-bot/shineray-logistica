import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, Link } from '@inertiajs/react';
import { useState, useEffect } from 'react';

export default function MotosIndex({ auth, motos, lojas, filters }) {
    // Estado local para os filtros
    const [params, setParams] = useState({
        search: filters.search || '',
        status: filters.status || '',
        loja_id: filters.loja_id || ''
    });

    // Função que aplica os filtros automaticamente ao mudar (Debounce opcional aqui, faremos direto no botão ou enter)
    const applyFilters = () => {
        router.get(route('motos.index'), params, {
            preserveState: true,
            replace: true,
        });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') applyFilters();
    };

    // Limpar filtros
    const clearFilters = () => {
        setParams({ search: '', status: '', loja_id: '' });
        router.get(route('motos.index'));
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-xl text-gray-800">Base Geral de Motos</h2>}>
            <Head title="Motos" />

            <div className="py-8 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
                    
                    {/* --- BARRA DE FILTROS AVANÇADA --- */}
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            
                            {/* Busca Texto */}
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Buscar</label>
                                <input 
                                    type="text"
                                    className="w-full border-gray-300 rounded-md text-sm focus:ring-red-500 focus:border-red-500"
                                    placeholder="Chassi ou Modelo..."
                                    value={params.search}
                                    onChange={e => setParams({...params, search: e.target.value})}
                                    onKeyDown={handleKeyDown}
                                />
                            </div>

                            {/* Filtro de Loja */}
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loja Solicitante</label>
                                <select 
                                    className="w-full border-gray-300 rounded-md text-sm focus:ring-red-500 focus:border-red-500"
                                    value={params.loja_id}
                                    onChange={e => {
                                        const newVal = e.target.value;
                                        setParams(prev => ({...prev, loja_id: newVal}));
                                        // Auto-submit ao selecionar loja (UX melhor)
                                        router.get(route('motos.index'), { ...params, loja_id: newVal }, { preserveState: true, replace: true });
                                    }}
                                >
                                    <option value="">Todas as Lojas</option>
                                    {lojas.map(loja => (
                                        <option key={loja.id} value={loja.id}>{loja.filial} - {loja.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro de Status */}
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status Atual</label>
                                <select 
                                    className="w-full border-gray-300 rounded-md text-sm focus:ring-red-500 focus:border-red-500"
                                    value={params.status}
                                    onChange={e => setParams({...params, status: e.target.value})}
                                >
                                    <option value="">Todos</option>
                                    <option value="estoque_fabrica">Estoque Fábrica</option>
                                    <option value="reservado">Reservado</option>
                                    <option value="separado">Separado</option>
                                    <option value="em_transito">Em Trânsito</option>
                                    <option value="entregue">Entregue</option>
                                </select>
                            </div>

                            {/* Botões */}
                            <div className="flex gap-2">
                                <button onClick={applyFilters} className="bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-gray-700 transition flex-1">
                                    Filtrar
                                </button>
                                {(params.search || params.status || params.loja_id) && (
                                    <button onClick={clearFilters} className="bg-white border border-gray-300 text-gray-500 px-3 py-2 rounded-md text-sm hover:bg-gray-50">
                                        Limpar
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* --- TABELA DE DADOS --- */}
                    <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg border border-gray-200">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3 text-left">Chassi / ID</th>
                                        <th className="px-6 py-3 text-left">Modelo & Detalhes</th>
                                        <th className="px-6 py-3 text-left">Loja Solicitante</th>
                                        <th className="px-6 py-3 text-left">Localização / Status</th>
                                        <th className="px-6 py-3 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100 text-sm">
                                    {motos.data.length > 0 ? (
                                        motos.data.map((moto) => {
                                            // Pega o pedido mais recente (vinculado no controller)
                                            const pedidoAtual = moto.pedidos && moto.pedidos.length > 0 ? moto.pedidos[0] : null;
                                            const loja = pedidoAtual ? pedidoAtual.user : null;

                                            return (
                                                <tr key={moto.id} className="hover:bg-gray-50 transition">
                                                    
                                                    {/* Coluna 1: Chassi */}
                                                    <td className="px-6 py-4">
                                                        <div className="font-mono font-bold text-gray-800 tracking-wide">{moto.chassi}</div>
                                                        <div className="text-xs text-gray-400">ID: #{moto.id}</div>
                                                    </td>

                                                    {/* Coluna 2: Dados Moto */}
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-gray-700">{moto.modelo}</div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded capitalize border border-gray-200">{moto.cor}</span>
                                                            {moto.ano_fabricacao && <span className="text-xs text-gray-500">Ano: {moto.ano_fabricacao}</span>}
                                                        </div>
                                                    </td>

                                                    {/* Coluna 3: Loja (Inteligente) */}
                                                    <td className="px-6 py-4">
                                                        {loja ? (
                                                            <div>
                                                                <div className="font-bold text-blue-800">{loja.filial || 'Matriz'}</div>
                                                                <div className="text-xs text-gray-500">{loja.name}</div>
                                                                <div className="text-[10px] text-gray-400 mt-0.5">Pedido #{pedidoAtual.id}</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 italic text-xs">Sem pedido ativo</span>
                                                        )}
                                                    </td>

                                                    {/* Coluna 4: Status */}
                                                    <td className="px-6 py-4">
                                                        <StatusBadge status={moto.status} />
                                                        <div className="text-xs text-gray-500 mt-1 max-w-[150px] truncate" title={moto.localizacao_atual}>
                                                            📍 {moto.localizacao_atual || 'Não informado'}
                                                        </div>
                                                    </td>

                                                    {/* Coluna 5: Ações */}
                                                    <td className="px-6 py-4 text-right">
                                                        {pedidoAtual && (
                                                            <Link 
                                                                href={route('pedidos.show', pedidoAtual.id)} 
                                                                className="text-indigo-600 hover:text-indigo-900 font-bold text-xs border border-indigo-200 px-3 py-1 rounded hover:bg-indigo-50"
                                                            >
                                                                Ver Pedido
                                                            </Link>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                                <div className="text-3xl mb-2">🔍</div>
                                                <p>Nenhuma moto encontrada com estes filtros.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginação */}
                        {motos.links.length > 3 && (
                            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-center flex-wrap gap-1">
                                {motos.links.map((link, i) => (
                                    link.url ? (
                                        <Link
                                            key={i}
                                            href={link.url}
                                            className={`px-3 py-1 rounded text-xs font-bold border ${link.active ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ) : (
                                        <span key={i} className="px-3 py-1 text-xs text-gray-400 border bg-gray-100 rounded" dangerouslySetInnerHTML={{ __html: link.label }} />
                                    )
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// Helper Visual
function StatusBadge({ status }) {
    const config = {
        'estoque_fabrica': { bg: 'bg-green-100 text-green-800', label: 'Estoque' },
        'reservado':       { bg: 'bg-yellow-100 text-yellow-800', label: 'Reservado' },
        'separado':        { bg: 'bg-blue-100 text-blue-800', label: 'Separado' },
        'em_transito':     { bg: 'bg-orange-100 text-orange-800', label: 'Em Trânsito' },
        'entregue':        { bg: 'bg-gray-800 text-white', label: 'Entregue' },
        'avariado':        { bg: 'bg-red-100 text-red-800', label: 'Avariado' },
    }[status] || { bg: 'bg-gray-100 text-gray-600', label: status };

    return (
        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${config.bg}`}>
            {config.label}
        </span>
    );
}