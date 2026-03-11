import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

export default function GestorHistory({ auth, logs, filters }) {
    
    // 1. BLINDAGEM DE FILTROS (Evita o erro no input)
    // Se filters vier null/undefined, usamos um objeto vazio
    const safeFilters = filters || {};

    const [filterForm, setFilterForm] = useState({
        // Forçamos string vazia '' se o valor for null/undefined
        search: safeFilters.search || '', 
        data_inicio: safeFilters.data_inicio || '',
        data_fim: safeFilters.data_fim || '',
    });

    const handleFiltrar = (e) => {
        e.preventDefault();
        router.get(route(route().current()), filterForm, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const limparFiltros = () => {
        setFilterForm({ search: '', data_inicio: '', data_fim: '' });
        router.get(route(route().current()));
    };

    const renderDescricao = (texto) => {
        if (!texto) return null;
        return texto.split('\n').map((linha, index) => {
            if (linha.includes('✅')) return <p key={index} className="text-green-700 font-bold mb-1 bg-green-50 p-1 rounded">{linha}</p>;
            if (linha.includes('🚫') || linha.includes('REJEITADOS')) return <p key={index} className="text-red-600 font-medium pl-2 border-l-4 border-red-400 mt-1 bg-red-50 p-1 rounded">{linha}</p>;
            if (linha.includes('Obs:') || linha.includes('Justificativa')) return <p key={index} className="text-gray-600 italic bg-yellow-50 p-3 rounded border border-yellow-200 my-2 text-sm">{linha}</p>;
            return <p key={index} className="text-gray-600 text-sm py-0.5">{linha}</p>;
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-purple-800">Auditoria Comercial</h2>}>
            <Head title="Histórico de Aprovações" />

            <div className="py-8 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* CABEÇALHO */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div>
                            <h3 className="text-2xl font-black text-gray-800">Registro de Decisões</h3>
                            <p className="text-sm text-gray-500">Histórico completo de auditorias.</p>
                        </div>
                        <Link href={route('gestor.index')} className="bg-white text-gray-700 border border-gray-300 px-5 py-2.5 rounded-lg font-bold shadow-sm hover:bg-gray-50 transition flex items-center gap-2">
                            <span>⬅️</span> Voltar ao Painel
                        </Link>
                    </div>

                    {/* FILTROS */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-8">
                        <form onSubmit={handleFiltrar} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Buscar</label>
                                <input 
                                    type="text" 
                                    placeholder="Nome, Filial ou Pedido..." 
                                    className="w-full rounded-lg border-gray-300 focus:ring-purple-500 focus:border-purple-500 text-sm"
                                    value={filterForm.search} // Blindado pelo useState inicial
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
                                <button type="submit" className="flex-1 bg-purple-600 text-white font-bold py-2.5 rounded-lg hover:bg-purple-700 transition">Filtrar</button>
                                <button type="button" onClick={limparFiltros} className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition">Limpar</button>
                            </div>
                        </form>
                    </div>

                    {/* LISTA DE LOGS */}
                    <div className="space-y-6">
                        {logs.data.map((log) => (
                            <div key={log.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all">
                                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="text-2xl">{log.descricao.includes('REJEITADOS') ? '✂️' : '🛡️'}</div>
                                        <div>
                                            <h4 className="font-bold text-gray-900">
                                                Pedido #{log.pedido_id} 
                                                <StatusBadge status={log.pedido?.status} />
                                            </h4>
                                            <p className="text-sm text-gray-500">
                                                📅 {new Date(log.created_at).toLocaleDateString('pt-BR')} • {log.pedido?.user?.filial || 'Usuario Removido'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div className="text-sm leading-relaxed space-y-1">{renderDescricao(log.descricao)}</div>
                                    
                                    {/* Link Condicional: Só exibe se log.pedido_id existir */}
                                    {log.pedido_id && log.pedido && (
                                        <div className="mt-4 flex justify-end">
                                            <Link href={route('pedidos.show', log.pedido_id)} className="text-sm font-bold text-purple-600 hover:underline">
                                                Ver Pedido ↗
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        
                        {logs.data.length === 0 && (
                            <div className="text-center py-10 text-gray-500">Nenhum registro encontrado.</div>
                        )}
                    </div>

                    {/* 2. BLINDAGEM DA PAGINAÇÃO (CORREÇÃO CRÍTICA) */}
                    {logs.links && logs.links.length > 3 && (
                        <div className="mt-10 flex justify-center flex-wrap gap-2">
                            {logs.links.map((link, k) => {
                                // Se a URL for null (botão desativado), renderizamos SPAN, não LINK
                                if (!link.url) {
                                    return (
                                        <span
                                            key={k}
                                            className="px-4 py-2 text-sm font-bold rounded-lg border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    );
                                }
                                // Se tiver URL, renderizamos o Link normal
                                return (
                                    <Link
                                        key={k}
                                        href={link.url}
                                        className={`px-4 py-2 text-sm font-bold rounded-lg border transition-all ${
                                            link.active 
                                                ? 'bg-purple-600 text-white border-purple-600' 
                                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                );
                            })}
                        </div>
                    )}

                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function StatusBadge({ status }) {
    if (!status) return <span className="ml-2 bg-gray-50 text-gray-500 text-[10px] px-2 py-0.5 rounded font-bold border border-gray-200">N/D</span>;

    const s = String(status).toLowerCase();
    const config = {
        'em_analise':      { label: 'Em Análise',    bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
        'solicitado':      { label: 'Solicitado',    bg: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
        'separado':        { label: 'Separado',      bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
        'aguardando_rota': { label: 'Aguard. Rota',  bg: 'bg-pink-50 text-pink-700 border-pink-200', dot: 'bg-pink-500' },
        'aguardando_coleta':{ label: 'Aguard. Coleta', bg: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
        'expedido':        { label: 'Expedido',      bg: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
        'em_transito':     { label: 'Em Trânsito',   bg: 'bg-orange-500 text-white border-orange-600 shadow-sm', dot: 'bg-white' },
        'em_transito_cd':  { label: 'Indo p/ CD',    bg: 'bg-indigo-500 text-white border-indigo-600 shadow-sm', dot: 'bg-white' },
        'no_cd':           { label: 'No Hub/CD',     bg: 'bg-purple-600 text-white border-purple-700 shadow-sm', dot: 'bg-purple-300' },
        'concluido':       { label: 'Concluído',     bg: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
        'cancelado':       { label: 'Cancelado',     bg: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
    }[s] || { label: s.toUpperCase(), bg: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400' };

    return (
        <span className={`ml-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase border tracking-wider whitespace-nowrap align-middle ${config.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
            {config.label}
        </span>
    );
}