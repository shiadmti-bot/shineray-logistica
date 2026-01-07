import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, Link } from '@inertiajs/react';
import { useState } from 'react';

export default function MotosIndex({ auth, motos, filters }) {
    const [term, setTerm] = useState(filters.search || '');

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(route('motos.index'), { search: term }, { preserveState: true, replace: true });
    };

    return (
        <AuthenticatedLayout 
            user={auth.user} 
            header={<h2 className="font-bold text-2xl text-gray-800 leading-tight">Histórico Geral de Chassis</h2>}
        >
            <Head title="Histórico de Motos" />
            <div className="py-12 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
                    
                    {/* Barra de Busca */}
                    <div className="flex justify-between items-center mb-4">
                        <form onSubmit={handleSearch} className="w-full md:w-1/2 relative">
                            <input 
                                type="text" 
                                placeholder="🔍 Buscar Chassi, Modelo ou Cor..." 
                                value={term}
                                onChange={(e) => setTerm(e.target.value)}
                                className="w-full border-gray-300 rounded-full pl-5 pr-12 shadow-sm focus:border-red-500 focus:ring-red-500"
                            />
                            <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600">➜</button>
                        </form>
                    </div>

                    {/* Tabela de Listagem */}
                    <div className="bg-white overflow-hidden shadow-md sm:rounded-lg border-t-4 border-gray-800">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Chassi</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Modelo</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Cor/Ano</th>
                                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Localização</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {motos.data.map((moto) => (
                                        <tr key={moto.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-700 font-bold">{moto.chassi}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">{moto.modelo}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {moto.cor || '-'} 
                                                {moto.ano_fabricacao && <span className="text-gray-400 text-xs ml-1">({moto.ano_fabricacao})</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <BadgeStatus status={moto.status} />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                                {moto.localizacao_atual}
                                            </td>
                                        </tr>
                                    ))}
                                    {motos.data.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-10 text-center text-gray-500">
                                                Nenhum registro encontrado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginação */}
                        {motos.links.length > 3 && (
                            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-center">
                                {motos.links.map((link, key) => (
                                    link.url ? (
                                        <Link 
                                            key={key} 
                                            href={link.url} 
                                            className={`px-3 py-1 mx-1 rounded border text-sm ${link.active ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
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

function BadgeStatus({ status }) {
    const colors = {
        solicitado: 'bg-yellow-100 text-yellow-800',
        reservado: 'bg-yellow-100 text-yellow-800',
        separado: 'bg-blue-100 text-blue-800',
        expedido: 'bg-indigo-100 text-indigo-800',
        em_transito: 'bg-orange-100 text-orange-800',
        concluido: 'bg-green-100 text-green-800',
        entregue: 'bg-green-100 text-green-800',
        cancelado: 'bg-red-100 text-red-800',
    };
    return (
        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${colors[status] || 'bg-gray-100'}`}>
            {status}
        </span>
    );
}