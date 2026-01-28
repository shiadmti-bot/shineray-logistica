import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link } from '@inertiajs/react';

export default function MotosIndex({ auth, motos, filters }) {
    const { data, setData, get, processing } = useForm({
        search: filters.search || '',
    });

    const handleSearch = (e) => {
        e.preventDefault();
        get(route('motos.index'), {
            preserveState: true, // Mantém o estado da página
            preserveScroll: true, // Não rola para o topo
            replace: true, // Substitui o histórico para não poluir o botão voltar
        });
    };

    // Função para limpar a busca
    const clearSearch = () => {
        setData('search', '');
        get(route('motos.index'));
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-xl text-gray-800">Base Geral de Chassis</h2>}>
            <Head title="Base de Chassis" />

            <div className="py-8 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6 px-4">
                    
                    {/* BUSCA */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2 text-gray-600">
                            <span className="text-2xl">🏍️</span>
                            <h3 className="font-bold text-lg">Inventário de Frota</h3>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-500 font-bold border">
                                {motos.total} itens
                            </span>
                        </div>

                        <form onSubmit={handleSearch} className="flex w-full md:w-auto gap-2 relative">
                            <div className="relative w-full md:w-96">
                                <input 
                                    type="text" 
                                    className="pl-4 pr-10 w-full border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 transition-colors"
                                    placeholder="Buscar Chassi, Modelo ou Cor..."
                                    value={data.search}
                                    onChange={e => setData('search', e.target.value)}
                                />
                                {data.search && (
                                    <button 
                                        type="button" 
                                        onClick={clearSearch}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 font-bold"
                                        title="Limpar busca"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                            <button 
                                type="submit" 
                                disabled={processing}
                                className="bg-gray-800 text-white px-6 rounded-lg hover:bg-gray-700 font-bold transition-colors disabled:opacity-50"
                            >
                                {processing ? '...' : 'Buscar'}
                            </button>
                        </form>
                    </div>

                    {/* TABELA */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {motos.data.length > 0 ? (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase">Chassi / Modelo</th>
                                        <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase">Cor / Ano</th>
                                        <th className="px-6 py-4 text-center text-xs font-extrabold text-gray-500 uppercase">Status Atual</th>
                                        <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase">Localização</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {motos.data.map((moto) => (
                                        <tr key={moto.id} className="hover:bg-red-50/20 transition duration-150">
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-black text-gray-800 font-mono tracking-wide">
                                                    {moto.chassi || <span className="text-red-400 italic">Sem Chassi</span>}
                                                </div>
                                                <div className="text-xs text-gray-500 font-bold mt-1 uppercase">
                                                    {moto.modelo || '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-700 font-medium">{moto.cor || '-'}</div>
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
                                                    <div className="text-xs text-blue-600 mt-1 font-bold bg-blue-50 inline-block px-2 py-0.5 rounded border border-blue-100">
                                                        🚛 Carga #{String(moto.romaneio_id).padStart(6,'0')}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-12 text-center text-gray-500">
                                <div className="text-4xl mb-3">🔍</div>
                                <p className="font-bold text-lg">Nenhuma moto encontrada.</p>
                                <p className="text-sm">Tente ajustar os filtros da busca.</p>
                            </div>
                        )}
                    </div>

                    {/* PAGINAÇÃO */}
                    {motos.links && motos.links.length > 3 && (
                        <div className="flex flex-wrap justify-center gap-2 mt-6 pb-8">
                            {motos.links.map((link, k) => (
                                <Link
                                    key={k}
                                    href={link.url}
                                    preserveScroll // Importante para não pular a tela ao mudar de página
                                    preserveState
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

// CONFIGURAÇÃO DOS BADGES (CORES E NOMES)
function StatusBadge({ status }) {
    const config = {
        'estoque_fabrica': { label: 'Em Estoque',      bg: 'bg-green-100 text-green-800 border-green-200' },
        'reservado':       { label: 'Reservado',       bg: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
        'separado':        { label: 'Separado (Pátio)',bg: 'bg-blue-100 text-blue-800 border-blue-200' },
        'em_transito':     { label: 'Em Trânsito',     bg: 'bg-orange-100 text-orange-800 border-orange-200' },
        'entregue':        { label: 'Entregue',        bg: 'bg-gray-900 text-white border-gray-700' },
        'avariado':        { label: 'Avariado',        bg: 'bg-red-100 text-red-800 border-red-200' }, // Adicionado caso precise
    };

    // Remove underline e previne erro se status for null
    const normalized = status ? status.toLowerCase() : 'desconhecido';
    
    const current = config[normalized] || { 
        label: (status || 'Desconhecido').replace('_', ' ').toUpperCase(), 
        bg: 'bg-gray-100 text-gray-600 border-gray-200' 
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border tracking-wide shadow-sm ${current.bg}`}>
            {current.label}
        </span>
    );
}