import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link } from '@inertiajs/react'; // ADICIONADO: Link

export default function MotosIndex({ auth, motos, filters }) {
    const { data, setData, get, processing } = useForm({
        search: filters.search || '',
    });

    const handleSearch = (e) => {
        e.preventDefault();
        get(route('motos.index'));
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-xl text-gray-800">Base Geral de Chassis</h2>}>
            <Head title="Base de Chassis" />

            <div className="py-8 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6 px-4">
                    
                    {/* BARRA DE PESQUISA */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-gray-600 hidden md:flex">
                            <span className="text-2xl">🏍️</span>
                            <h3 className="font-bold text-lg">Inventário de Frota</h3>
                        </div>

                        <form onSubmit={handleSearch} className="flex w-full md:w-auto gap-2 relative">
                            <div className="relative w-full md:w-96">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input 
                                    type="text" 
                                    className="pl-10 w-full border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 transition-colors"
                                    placeholder="Buscar Chassi, Modelo ou Cor..."
                                    value={data.search}
                                    onChange={e => setData('search', e.target.value)}
                                />
                            </div>
                            <button type="submit" className="bg-gray-800 text-white px-6 rounded-lg hover:bg-gray-700 font-bold transition shadow-md" disabled={processing}>
                                Buscar
                            </button>
                        </form>
                    </div>

                    {/* TABELA RESPONSIVA */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Chassi / Modelo</th>
                                    <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Cor / Ano</th>
                                    <th className="px-6 py-4 text-center text-xs font-extrabold text-gray-500 uppercase tracking-wider">Status Atual</th>
                                    <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Localização</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {motos.data.map((moto) => (
                                    <tr key={moto.id} className="hover:bg-red-50/20 transition duration-150 group">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-black text-gray-800 font-mono tracking-wide">{moto.chassi}</div>
                                            <div className="text-xs text-gray-500 font-bold mt-1 uppercase">{moto.modelo}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-700 font-medium">{moto.cor}</div>
                                            <div className="text-xs text-gray-400">{moto.ano_fabricacao || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <StatusBadge status={moto.status} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-600 font-medium flex items-center gap-1">
                                                <span>📍</span> {moto.localizacao_atual || 'Não informado'}
                                            </div>
                                            {moto.romaneio_id && (
                                                <div className="text-xs text-blue-600 mt-1 font-bold">
                                                    Carga #{String(moto.romaneio_id).padStart(6,'0')}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                
                                {motos.data.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-gray-400 bg-gray-50">
                                            <div className="flex flex-col items-center">
                                                <span className="text-4xl mb-2">🔍</span>
                                                <p>Nenhum chassi encontrado.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* PAGINAÇÃO (CORRIGIDA COM LINK DO INERTIA) */}
                    {motos.links && motos.links.length > 3 && (
                        <div className="flex flex-wrap justify-center gap-2 mt-6">
                            {motos.links.map((link, k) => (
                                <Link
                                    key={k}
                                    href={link.url}
                                    className={`px-4 py-2 text-sm font-bold rounded-lg border transition ${
                                        link.active 
                                            ? 'bg-gray-800 text-white border-gray-800 shadow-md' 
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

// COMPONENTE DE STATUS (Tradução Visual)
function StatusBadge({ status }) {
    const config = {
        'estoque_fabrica': { label: 'Em Estoque (Livre)', bg: 'bg-green-100 text-green-800 border-green-200' },
        'reservado':       { label: 'Reservado (Pedido)', bg: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
        'separado':        { label: 'Separado (Pátio)',   bg: 'bg-blue-100 text-blue-800 border-blue-200' },
        'em_transito':     { label: 'Em Trânsito',        bg: 'bg-orange-100 text-orange-800 border-orange-200' },
        'entregue':        { label: 'Entregue / Vendida', bg: 'bg-gray-800 text-white border-gray-600' },
    };

    // Se o status não estiver na lista, mostra o texto original formatado
    const current = config[status] || { 
        label: status?.replace('_', ' ').toUpperCase() || 'DESCONHECIDO', 
        bg: 'bg-gray-100 text-gray-600 border-gray-200' 
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border tracking-wide shadow-sm ${current.bg}`}>
            {current.label}
        </span>
    );
}