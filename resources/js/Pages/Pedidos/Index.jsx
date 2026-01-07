import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

export default function PedidosIndex({ auth, pedidos, perfil, filters }) {
    const [term, setTerm] = useState(filters.search || '');

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(route('pedidos.index'), { search: term }, { preserveState: true, replace: true });
    };

    return (
        <AuthenticatedLayout 
            user={auth.user} 
            header={<h2 className="font-bold text-2xl text-gray-800">{perfil === 'cd' ? 'Gestão de Pedidos' : 'Acompanhamento de Pedidos'}</h2>}
        >
            <Head title="Pedidos" />
            <div className="py-12 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    
                    {/* BARRA DE BUSCA */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <form onSubmit={handleSearch} className="w-full md:w-1/2 relative">
                            <input 
                                type="text" 
                                placeholder="🔍 Buscar ID, Loja, Romaneio..." 
                                value={term}
                                onChange={(e) => setTerm(e.target.value)}
                                className="w-full border-gray-300 rounded-full pl-5 pr-12 shadow-sm focus:border-red-500 focus:ring-red-500"
                            />
                            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600">➜</button>
                        </form>
                        {perfil === 'loja' && (
                            <Link href={route('solicitar')} className="w-full md:w-auto bg-red-600 text-white px-6 py-2 rounded-full font-bold hover:bg-red-700 shadow text-center">
                                + Nova Solicitação
                            </Link>
                        )}
                    </div>

                    {/* BARRA DE FERRAMENTAS */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <form onSubmit={handleSearch} className="w-full md:w-1/2 relative">
                            <input 
                                type="text" 
                                placeholder="🔍 Buscar pedido, chassi ou loja..." 
                                value={term}
                                onChange={(e) => setTerm(e.target.value)}
                                className="w-full border-gray-300 rounded-full pl-5 pr-12 shadow-sm focus:border-red-500 focus:ring-red-500"
                            />
                            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600">
                                ➜
                            </button>
                        </form>

                        <div className="flex gap-2 w-full md:w-auto">
                            {/* BOTÃO EXCEL (NOVO) */}
                            {(auth.user.perfil === 'admin' || auth.user.perfil === 'cd') && (
                                <a 
                                    href={`${route('pedidos.exportar')}?search=${term}`} 
                                    target="_blank"
                                    className="bg-green-600 text-white px-4 py-2 rounded-full font-bold hover:bg-green-700 shadow flex items-center justify-center gap-2 flex-1 md:flex-none"
                                >
                                    📊 Excel
                                </a>
                            )}

                            {auth.user.perfil === 'loja' && (
                                <Link href={route('solicitar')} className="bg-red-600 text-white px-6 py-2 rounded-full font-bold hover:bg-red-700 shadow flex-1 md:flex-none text-center">
                                    + Nova Solicitação
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* TABELA */}
                    <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg border-t-4 border-red-600">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">#ID</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">{perfil === 'cd' ? 'Loja' : 'Romaneio'}</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Data</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Motos</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {pedidos.map((pedido) => (
                                        <tr key={pedido.id} className="hover:bg-red-50 transition">
                                            <td className="px-6 py-4 font-bold text-gray-900">#{pedido.id}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700">
                                                {perfil === 'cd' ? (
                                                    <div className="flex flex-col"><span className="font-bold">{pedido.user.name}</span><span className="text-xs text-gray-400">{pedido.user.filial}</span></div>
                                                ) : (
                                                    pedido.romaneio ? <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold font-mono">R-{String(pedido.romaneio.id).padStart(6, '0')}</span> : <span className="text-gray-400 text-xs">---</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{new Date(pedido.created_at).toLocaleDateString('pt-BR')}</td>
                                            <td className="px-6 py-4 text-center font-bold text-lg text-gray-700">{pedido.motos_count}</td>
                                            <td className="px-6 py-4 text-center"><BadgeStatus status={pedido.status} /></td>
                                            <td className="px-6 py-4 text-right">
                                                <Link href={route('pedidos.show', pedido.id)} className={`px-4 py-2 rounded-full text-xs font-bold shadow-sm inline-block uppercase tracking-wide ${perfil === 'cd' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white border-2 border-gray-200 text-gray-600 hover:text-red-600'}`}>
                                                    {perfil === 'cd' ? 'Gerenciar' : 'Detalhes'}
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                    {pedidos.length === 0 && <tr><td colSpan="6" className="text-center py-12 text-gray-500">Nenhum pedido encontrado.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// ATUALIZADO COM OS STATUS NOVOS
function BadgeStatus({ status }) {
    const config = {
        solicitado:  { label: 'Solicitado',  class: 'bg-yellow-100 text-yellow-800' },
        separado:    { label: 'Separado',    class: 'bg-blue-100 text-blue-800' },
        expedido:    { label: 'Expedido',    class: 'bg-indigo-100 text-indigo-800' },
        em_transito: { label: 'Em Trânsito', class: 'bg-orange-100 text-orange-800' },
        concluido:   { label: 'Concluído',   class: 'bg-green-100 text-green-800' },
        cancelado:   { label: 'Cancelado',   class: 'bg-red-100 text-red-800' },
    }[status] || { label: status, class: 'bg-gray-100' };

    return <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${config.class}`}>{config.label}</span>;
}