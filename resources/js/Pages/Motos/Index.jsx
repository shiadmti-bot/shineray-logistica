import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, Link } from '@inertiajs/react';
import { useState } from 'react';
import StockTable from '@/Components/Microwork/StockTable';

export default function MotosIndex({ auth, motos, lojas, filters }) {
    
    // Estado local para os filtros
    const [params, setParams] = useState({
        search: filters.search || '',
        status: filters.status || '',
        loja_id: filters.loja_id || ''
    });

    const [activeTab, setActiveTab] = useState('loja'); // 'loja' | 'fabrica'

    // Função que aplica os filtros
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
        <AuthenticatedLayout user={auth.user} 
            header={
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="font-bold text-xl text-gray-800 leading-tight">Base Geral de Motos</h2>
                    
                    <div className="flex bg-gray-200 p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('loja')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center gap-2 ${activeTab === 'loja' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            🏪 Estoque Loja
                        </button>
                        <button 
                            onClick={() => setActiveTab('fabrica')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition flex items-center gap-2 ${activeTab === 'fabrica' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            🏭 Estoque Fábrica
                        </button>
                    </div>

                    <Link 
                        href={route('motos.timeline')} 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition flex items-center gap-2"
                    >
                        <span>🔍</span> Timeline
                    </Link>
                </div>
            }
        >
            <Head title="Motos" />

            <div className="py-8 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
                    
                    {activeTab === 'fabrica' ? (
                        <div className="animate-fadeIn">
                            <StockTable />
                        </div>
                    ) : (
                        <div className="animate-fadeIn space-y-6">
                            {/* --- BARRA DE FILTROS --- */}
                            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    {/* ... filtros existentes ... */}
                            
                            {/* Busca Texto */}
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Buscar</label>
                                <input 
                                    type="text"
                                    className="w-full border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Chassi ou Modelo..."
                                    value={params.search}
                                    onChange={e => setParams({...params, search: e.target.value})}
                                    onKeyDown={handleKeyDown}
                                />
                            </div>

                            {/* Filtro de Loja */}
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Loja Solicitante/Atual</label>
                                <select 
                                    className="w-full border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={params.loja_id}
                                    onChange={e => {
                                        const newVal = e.target.value;
                                        setParams(prev => ({...prev, loja_id: newVal}));
                                        router.get(route('motos.index'), { ...params, loja_id: newVal }, { preserveState: true, replace: true });
                                    }}
                                >
                                    <option value="">Todas as Lojas</option>
                                    {lojas.map(loja => (
                                        <option key={loja.id} value={loja.id}>{loja.filial} - {loja.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro de Status (ATUALIZADO) */}
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status Atual</label>
                                <select 
                                    className="w-full border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={params.status}
                                    onChange={e => setParams({...params, status: e.target.value})}
                                >
                                    <option value="">Todos</option>
                                    <option value="estoque_fabrica">Estoque Fábrica</option>
                                    <option value="estoque_loja">Disponível Loja</option>
                                    <option value="vendida">Vendida</option>
                                    <option value="reservado">Reservado</option>
                                    <option value="separado">Separado (Expedição)</option>
                                    <option value="em_transito">Em Trânsito</option>
                                    <option value="avariado">Avariado</option>
                                </select>
                            </div>

                            {/* Botões */}
                            <div className="flex gap-2 h-10">
                                <button onClick={applyFilters} className="bg-gray-800 text-white px-4 rounded-md text-sm font-bold hover:bg-gray-700 transition flex-1 h-full">
                                    Filtrar
                                </button>
                                {(params.search || params.status || params.loja_id) && (
                                    <button onClick={clearFilters} className="bg-white border border-gray-300 text-gray-500 px-3 rounded-md text-sm hover:bg-gray-50 h-full">
                                        ✕
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
                                        <th className="px-6 py-3 text-left">Loja Atual/Dono</th>
                                        <th className="px-6 py-3 text-left">Localização / Status</th>
                                        <th className="px-6 py-3 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100 text-sm">
                                    {motos.data.length > 0 ? (
                                        motos.data.map((moto) => {
                                            // Pega o pedido mais recente se existir
                                            const pedidoAtual = moto.pedidos && moto.pedidos.length > 0 ? moto.pedidos[0] : null;
                                            
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

                                                    {/* Coluna 3: Loja Dona (Baseada no loja_atual_id ou Pedido) */}
                                                    <td className="px-6 py-4">
                                                        {moto.loja ? (
                                                            <div>
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                                                    🏪 {moto.loja.filial}
                                                                </span>
                                                                <div className="text-[10px] text-gray-500 mt-1 ml-1">{moto.loja.name}</div>
                                                            </div>
                                                        ) : (pedidoAtual ? (
                                                            <div>
                                                                <div className="font-bold text-blue-800">{pedidoAtual.user.filial || 'Matriz'}</div>
                                                                <div className="text-xs text-gray-500">{pedidoAtual.user.name}</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 italic text-xs">CD / Fábrica</span>
                                                        ))}
                                                    </td>

                                                    {/* Coluna 4: Status */}
                                                    <td className="px-6 py-4">
                                                        <StatusBadge status={moto.status} />
                                                        <div className="text-xs text-gray-500 mt-1 max-w-[200px] truncate" title={moto.localizacao_atual}>
                                                            📍 {moto.localizacao_atual || 'Não informado'}
                                                        </div>
                                                    </td>

                                                    {/* Coluna 5: Ações */}
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {pedidoAtual && (
                                                                <Link 
                                                                    href={route('pedidos.show', pedidoAtual.id)} 
                                                                    className="text-indigo-600 hover:text-indigo-900 font-bold text-xs border border-indigo-200 px-3 py-1 rounded hover:bg-indigo-50"
                                                                >
                                                                    Ver Pedido
                                                                </Link>
                                                            )}
                                                            <Link 
                                                                href={route('motos.timeline', { chassi: moto.chassi })}
                                                                className="text-gray-500 hover:text-gray-900"
                                                                title="Ver Histórico Completo"
                                                            >
                                                                🕒
                                                            </Link>
                                                        </div>
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
                )}
                    
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function StatusBadge({ status }) {
    const config = {
        'estoque_fabrica': { bg: 'bg-gray-100 text-gray-800 border border-gray-200', label: 'Estoque Fábrica' },
        'estoque_loja':    { bg: 'bg-green-50 text-green-700 border border-green-200', label: 'Disponível Loja' }, 
        'disponivel':      { bg: 'bg-green-50 text-green-600 border border-green-200', label: 'Disponível (Antigo)' },
        'vendida':         { bg: 'bg-blue-900 text-white', label: 'Vendida' },
        'reservado':       { bg: 'bg-yellow-100 text-yellow-800 border border-yellow-200', label: 'Reservado' },
        'separado':        { bg: 'bg-blue-100 text-blue-800 border border-blue-200', label: 'Separado CD' },
        'em_transito':     { bg: 'bg-orange-500 text-white border border-orange-600', label: 'Em Trânsito' },
        'entregue':        { bg: 'bg-gray-800 text-white', label: 'Entregue' },
        'concluido':       { bg: 'bg-gray-800 text-white', label: 'Concluído' },
        'avariado':        { bg: 'bg-red-100 text-red-800 border border-red-200', label: 'Avariado' },
        'aguardando_coleta': { bg: 'bg-purple-100 text-purple-800 border border-purple-200', label: 'Aguard. Coleta' },
    }[status] || { bg: 'bg-gray-100 text-gray-600', label: status };

    return (
        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase whitespace-nowrap shadow-sm ${config.bg}`}>
            {config.label}
        </span>
    );
}