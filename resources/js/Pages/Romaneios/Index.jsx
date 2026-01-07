import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

export default function RomaneiosIndex({ auth, romaneios, filters }) {
    const [term, setTerm] = useState(filters.search || '');

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(route('romaneios.index'), { search: term }, { preserveState: true, replace: true });
    };

    // Paginação simples
    const links = romaneios.links;

    return (
        <AuthenticatedLayout 
            user={auth.user} 
            header={<h2 className="font-bold text-2xl text-gray-800">Histórico de Cargas e Expedição</h2>}
        >
            <Head title="Cargas" />

            <div className="py-12 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    
                    {/* BARRA DE FERRAMENTAS */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <form onSubmit={handleSearch} className="w-full md:w-1/2 relative">
                            <input 
                                type="text" 
                                placeholder="🔍 Buscar por Nº Carga, Motorista ou Placa..." 
                                value={term}
                                onChange={(e) => setTerm(e.target.value)}
                                className="w-full border-gray-300 rounded-full pl-5 pr-12 shadow-sm focus:border-red-500 focus:ring-red-500"
                            />
                            <button type="submit" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-600">
                                ➜
                            </button>
                        </form>

                        <Link href={route('romaneios.create')} className="w-full md:w-auto bg-gray-800 text-white px-6 py-2 rounded-full font-bold hover:bg-gray-700 shadow-md transition text-center flex items-center justify-center gap-2">
                            <span>🚛</span> Nova Carga
                        </Link>
                    </div>

                    {/* TABELA DE CARGAS */}
                    <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg border-t-4 border-gray-800">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Nº Carga</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Transporte</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Data Saída</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Volumes</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {romaneios.data.map((romaneio) => (
                                        <tr key={romaneio.id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-mono font-bold text-lg text-gray-800">#{String(romaneio.id).padStart(6, '0')}</span>
                                            </td>
                                            
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-gray-700">{romaneio.motorista}</span>
                                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded w-fit mt-1 border border-gray-200 uppercase font-mono">
                                                        {romaneio.placa}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(romaneio.created_at).toLocaleDateString('pt-BR')}
                                                <span className="text-xs block text-gray-400">{new Date(romaneio.created_at).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                                    {romaneio.motos_count} Motos
                                                </span>
                                            </td>
                                            
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <BadgeCarga status={romaneio.status_geral} />
                                            </td>
                                            
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <Link 
                                                    href={route('romaneios.show', romaneio.id)} 
                                                    className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-blue-600 hover:border-blue-400 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition flex items-center justify-end gap-2 ml-auto w-fit"
                                                >
                                                    👁‍🗨 Inspecionar
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                    
                                    {romaneios.data.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="text-center py-16 text-gray-500">
                                                Nenhuma carga encontrada no histórico.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginação */}
                        {romaneios.links.length > 3 && (
                            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-center">
                                {romaneios.links.map((link, key) => (
                                    link.url ? (
                                        <Link 
                                            key={key} 
                                            href={link.url} 
                                            className={`px-3 py-1 mx-1 rounded border text-sm ${link.active ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ) : (
                                        <span key={key} className="px-3 py-1 mx-1 text-sm text-gray-400" dangerouslySetInnerHTML={{ __html: link.label }} />
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

// Componente Visual de Status da Carga
function BadgeCarga({ status }) {
    const config = {
        expedido:    { label: '🏢 PÁTIO / CARREGANDO', class: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
        em_transito: { label: '🚛 EM TRÂNSITO',       class: 'bg-orange-100 text-orange-800 border-orange-200' },
        concluido:   { label: '✅ FINALIZADA',        class: 'bg-green-100 text-green-800 border-green-200' },
    }[status] || { label: 'DESCONHECIDO', class: 'bg-gray-100' };

    return (
        <span className={`px-3 py-1 inline-flex text-[10px] md:text-xs leading-5 font-bold rounded-full border ${config.class}`}>
            {config.label}
        </span>
    );
}