import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

export default function GestorHistory({ auth, logs, filters }) {
    
    // --- BLINDAGEM CONTRA O ERRO 'toString' ---
    // Garante que mesmo se vier null/undefined, virará uma string vazia
    const safeFilters = {
        search: filters?.search || '',
        data_inicio: filters?.data_inicio || '',
        data_fim: filters?.data_fim || ''
    };

    // Estado inicial usando os valores seguros
    const [filterForm, setFilterForm] = useState({
        search: safeFilters.search,
        data_inicio: safeFilters.data_inicio,
        data_fim: safeFilters.data_fim,
    });

    // Função para aplicar os filtros (recarrega a página com parametros)
    const handleFiltrar = (e) => {
        e.preventDefault();
        router.get(route(route().current()), filterForm, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    // Função para limpar filtros
    const limparFiltros = () => {
        setFilterForm({ search: '', data_inicio: '', data_fim: '' });
        router.get(route(route().current()));
    };

    // Função para colorir o texto do log dinamicamente (Mantida e melhorada)
    const renderDescricao = (texto) => {
        if (!texto) return null;
        return texto.split('\n').map((linha, index) => {
            if (linha.includes('✅')) {
                return <p key={index} className="text-green-700 font-bold mb-1 flex items-center gap-2 bg-green-50 p-1 rounded">{linha}</p>;
            }
            if (linha.includes('🚫') || linha.includes('REJEITADOS') || linha.includes('Cortado')) {
                return <p key={index} className="text-red-600 font-medium pl-2 border-l-4 border-red-400 mt-1 bg-red-50 p-1 rounded">{linha}</p>;
            }
            if (linha.includes('Obs:') || linha.includes('Justificativa')) {
                return <p key={index} className="text-gray-600 italic bg-yellow-50 p-3 rounded border border-yellow-200 my-2 text-sm">{linha}</p>;
            }
            return <p key={index} className="text-gray-600 text-sm py-0.5">{linha}</p>;
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-purple-800">Auditoria Comercial</h2>}>
            <Head title="Histórico de Aprovações" />

            <div className="py-8 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* CABEÇALHO E AÇÕES */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div>
                            <h3 className="text-2xl font-black text-gray-800 tracking-tight">Registro de Decisões</h3>
                            <p className="text-sm text-gray-500">Histórico completo de auditorias, cortes e aprovações.</p>
                        </div>
                        <Link href={route('gestor.index')} className="bg-white text-gray-700 border border-gray-300 px-5 py-2.5 rounded-lg font-bold shadow-sm hover:bg-gray-50 transition flex items-center gap-2">
                            <span>⬅️</span> Voltar ao Painel
                        </Link>
                    </div>

                    {/* BARRA DE FILTROS */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-8">
                        <form onSubmit={handleFiltrar} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Filial ou Usuário</label>
                                <input 
                                    type="text" 
                                    placeholder="Ex: Ananindeua..." 
                                    className="w-full rounded-lg border-gray-300 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                    value={filterForm.search}
                                    onChange={e => setFilterForm({...filterForm, search: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Início</label>
                                <input 
                                    type="date" 
                                    className="w-full rounded-lg border-gray-300 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                    value={filterForm.data_inicio}
                                    onChange={e => setFilterForm({...filterForm, data_inicio: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data Fim</label>
                                <input 
                                    type="date" 
                                    className="w-full rounded-lg border-gray-300 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                    value={filterForm.data_fim}
                                    onChange={e => setFilterForm({...filterForm, data_fim: e.target.value})}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" className="flex-1 bg-purple-600 text-white font-bold py-2.5 rounded-lg hover:bg-purple-700 transition shadow-sm">
                                    Filtrar
                                </button>
                                <button type="button" onClick={limparFiltros} className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition">
                                    Limpar
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* LISTA DE CARDS (AUDITORIA) */}
                    <div className="space-y-6">
                        {logs.data.map((log) => (
                            <div key={log.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 group">
                                
                                {/* Header do Card */}
                                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-sm ${log.descricao.includes('REJEITADOS') ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600'}`}>
                                            {log.descricao.includes('REJEITADOS') ? '✂️' : '🛡️'}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                                Pedido #{log.pedido_id}
                                                <StatusBadge status={log.pedido?.status} />
                                            </h4>
                                            <p className="text-sm text-gray-500 flex items-center gap-1">
                                                <span>🏪 {log.pedido?.user?.filial || log.pedido?.user?.name || 'N/D'}</span>
                                                <span className="text-gray-300">•</span>
                                                <span>📅 {new Date(log.created_at).toLocaleDateString('pt-BR')} às {new Date(log.created_at).toLocaleTimeString('pt-BR')}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                         <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Auditor</p>
                                         <p className="font-medium text-purple-800">{auth.user.name}</p> {/* Assumindo que o user logado vê seus logs, ou adicionar log.user.name se disponível */}
                                    </div>
                                </div>

                                {/* Corpo do Card */}
                                <div className="p-6">
                                    <div className="bg-white border border-gray-100 rounded-lg p-4 shadow-inner">
                                        <div className="text-sm leading-relaxed space-y-1">
                                            {renderDescricao(log.descricao)}
                                        </div>
                                    </div>
                                    
                                    {/* Footer do Card com Ações Rápidas (Opcional) */}
                                    {log.pedido && (
                                        <div className="mt-4 flex justify-end">
                                            <Link href={route('pedidos.show', log.pedido_id)} className="text-sm font-bold text-purple-600 hover:text-purple-800 hover:underline flex items-center gap-1">
                                                Ver Pedido Completo <span>↗</span>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {logs.data.length === 0 && (
                            <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-300">
                                <p className="text-4xl mb-4">📂</p>
                                <h3 className="text-lg font-bold text-gray-800">Nenhum registro encontrado</h3>
                                <p className="text-gray-500">Tente ajustar os filtros de data ou busca.</p>
                            </div>
                        )}
                    </div>

                    {/* PAGINAÇÃO */}
                    {logs.links && logs.links.length > 3 && (
                        <div className="mt-10 flex justify-center flex-wrap gap-2">
                            {logs.links.map((link, k) => (
                                <Link
                                    key={k}
                                    href={link.url}
                                    className={`px-4 py-2 text-sm font-bold rounded-lg border transition-all ${
                                        link.active 
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-md transform scale-105' 
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

// Badge Auxiliar (Pequeno ajuste visual)
function StatusBadge({ status }) {
    if (!status) return <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded uppercase font-bold">Excluído</span>;

    const config = {
        'em_analise': { label: 'Em Análise', bg: 'bg-purple-100 text-purple-700 border border-purple-200' },
        'solicitado': { label: 'Aguardando CD', bg: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
        'separado':   { label: 'Separado', bg: 'bg-blue-100 text-blue-700 border border-blue-200' },
        'em_transito':{ label: 'Em Trânsito', bg: 'bg-orange-100 text-orange-700 border border-orange-200' },
        'concluido':  { label: 'Concluído', bg: 'bg-green-100 text-green-700 border border-green-200' },
        'cancelado':  { label: 'Cancelado', bg: 'bg-red-100 text-red-700 border border-red-200' },
    }[status] || { label: status, bg: 'bg-gray-100 text-gray-600 border border-gray-200' };

    return <span className={`ml-2 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${config.bg}`}>{config.label}</span>;
}