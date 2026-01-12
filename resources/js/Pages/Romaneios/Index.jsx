import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';

export default function RomaneioIndex({ auth, romaneios, filters }) {
    const { data, setData, get, processing } = useForm({
        search: filters.search || '',
    });

    const handleSearch = (e) => {
        e.preventDefault();
        get(route('romaneios.index'));
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-xl text-gray-800">Histórico de Cargas</h2>}>
            <Head title="Cargas e Romaneios" />

            <div className="py-12 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
                    
                    {/* BARRA DE AÇÕES */}
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                        <Link href={route('romaneios.create')} className="bg-gray-800 text-white px-6 py-3 rounded-lg font-bold shadow hover:bg-gray-700 text-center">
                            + Nova Carga / Expedição
                        </Link>

                        <form onSubmit={handleSearch} className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Buscar placa, motorista..." 
                                className="border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                value={data.search}
                                onChange={e => setData('search', e.target.value)}
                            />
                            <button type="submit" className="bg-white border border-gray-300 px-4 rounded-lg font-bold text-gray-600 hover:bg-gray-50" disabled={processing}>
                                🔍
                            </button>
                        </form>
                    </div>

                    {/* LISTAGEM */}
                    <div className="bg-white shadow-sm sm:rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transporte</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Motos</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {romaneios.data.map((romaneio) => (
                                    <tr key={romaneio.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-700">
                                            #{String(romaneio.id).padStart(6, '0')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-gray-900">{romaneio.motorista}</div>
                                            <div className="text-sm text-gray-500">
                                                {romaneio.placa} {romaneio.transportadora ? `• ${romaneio.transportadora}` : ''}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                {new Date(romaneio.created_at).toLocaleDateString('pt-BR')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-bold">
                                                {romaneio.motos_count}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <BadgeStatus status={romaneio.status} />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <Link href={route('romaneios.show', romaneio.id)} className="text-indigo-600 hover:text-indigo-900 font-bold border border-indigo-200 px-3 py-1 rounded hover:bg-indigo-50">
                                                Inspecionar
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                                
                                {romaneios.data.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                            Nenhum romaneio encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* PAGINAÇÃO */}
                    {romaneios.links && romaneios.links.length > 3 && (
                        <div className="flex justify-center mt-4">
                            {romaneios.links.map((link, k) => (
                                <Link
                                    key={k}
                                    href={link.url}
                                    className={`px-4 py-2 border rounded mx-1 text-sm ${link.active ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`}
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

// COMPONENTE DE STATUS CORRIGIDO
function BadgeStatus({ status }) {
    const config = {
        'aberto':      { label: 'Em Aberto',    bg: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
        'expedido':    { label: 'Carregando',   bg: 'bg-blue-100 text-blue-800 border-blue-200' },
        'em_transito': { label: 'Em Trânsito',  bg: 'bg-orange-100 text-orange-800 border-orange-200' },
        'finalizado':  { label: 'Finalizado',   bg: 'bg-green-100 text-green-800 border-green-200' },
    };

    // Fallback para status desconhecido
    const current = config[status] || { label: status || 'Desconhecido', bg: 'bg-gray-100 text-gray-600 border-gray-200' };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${current.bg}`}>
            {current.label}
        </span>
    );
}