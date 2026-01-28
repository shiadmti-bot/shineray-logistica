import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link } from '@inertiajs/react';

export default function MotosIndex({ auth, motos, filters }) {
    // Proteção inicial: Se 'motos' vier nulo do backend, usa um objeto vazio para não travar a tela
    const safeMotos = motos || { data: [], links: [], total: 0 };

    const { data, setData, get, processing } = useForm({
        search: filters?.search || '', // Proteção contra filters null
    });

    const handleSearch = (e) => {
        e.preventDefault();
        get(route('motos.index'), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    // Função para limpar a busca
    const clearSearch = () => {
        setData('search', '');
        // Dispara a limpeza imediatamente
        get(route('motos.index'), {
             preserveState: true,
             preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-xl text-gray-800">Base Geral de Chassis</h2>}>
            <Head title="Base de Chassis" />

            <div className="py-8 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6 px-4">
                    
                    {/* BARRA DE BUSCA E TÍTULO */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2 text-gray-600">
                            <span className="text-2xl">🏍️</span>
                            <div>
                                <h3 className="font-bold text-lg leading-tight">Inventário de Frota</h3>
                                <span className="text-xs text-gray-400 font-mono">
                                    Total: {safeMotos.total || 0} registros
                                </span>
                            </div>
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
                                {/* Botão X para limpar busca */}
                                {data.search && (
                                    <button 
                                        type="button" 
                                        onClick={clearSearch}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 font-bold px-2"
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

                    {/* TABELA BLINDADA */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {safeMotos.data && safeMotos.data.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Chassi / Modelo</th>
                                            <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Cor / Ano</th>
                                            <th className="px-6 py-4 text-center text-xs font-extrabold text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Localização</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {safeMotos.data.map((moto) => (
                                            <tr key={moto?.id || Math.random()} className="hover:bg-red-50/30 transition duration-150">
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-black text-gray-800 font-mono tracking-wide">
                                                        {moto.chassi || <span className="text-red-300 italic">Sem Chassi</span>}
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
                                                        <div className="mt-1">
                                                            <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-flex items-center gap-1">
                                                                🚛 Carga #{String(moto.romaneio_id).padStart(6,'0')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            // ESTADO VAZIO (EMPTY STATE)
                            <div className="p-12 text-center text-gray-400">
                                <div className="text-5xl mb-4 opacity-30">🏍️</div>
                                <p className="font-bold text-lg text-gray-600">Nenhuma moto encontrada.</p>
                                <p className="text-sm mt-1">Verifique o termo buscado ou limpe os filtros.</p>
                                {data.search && (
                                    <button onClick={clearSearch} className="mt-4 text-red-600 font-bold text-sm hover:underline">
                                        Limpar busca
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* PAGINAÇÃO */}
                    {safeMotos.links && safeMotos.links.length > 3 && (
                        <div className="flex flex-wrap justify-center gap-2 mt-6 pb-12">
                            {safeMotos.links.map((link, k) => (
                                <Link
                                    key={k}
                                    href={link.url}
                                    preserveScroll
                                    preserveState
                                    className={`px-4 py-2 text-sm font-bold rounded-lg border transition-all ${
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

// COMPONENTE VISUAL DE STATUS (BLINDADO)
function StatusBadge({ status }) {
    const config = {
        'estoque_fabrica': { label: 'Em Estoque',      bg: 'bg-green-100 text-green-800 border-green-200' },
        'reservado':       { label: 'Reservado',       bg: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
        'separado':        { label: 'Separado',        bg: 'bg-blue-100 text-blue-800 border-blue-200' },
        'em_transito':     { label: 'Em Trânsito',     bg: 'bg-orange-100 text-orange-800 border-orange-200' },
        'entregue':        { label: 'Entregue',        bg: 'bg-gray-900 text-white border-gray-700' },
        'avariado':        { label: 'Avariado',        bg: 'bg-red-100 text-red-800 border-red-200' },
    };

    // Converte para string minúscula de forma segura, evitando erro no .toLowerCase() se for null
    const normalized = String(status || 'desconhecido').toLowerCase();
    
    // Tenta achar na config, se não achar usa um padrão genérico
    const current = config[normalized] || { 
        label: (status || 'Desconhecido').toString().replace('_', ' ').toUpperCase(), 
        bg: 'bg-gray-100 text-gray-500 border-gray-200' 
    };

    return (
        <span className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase border tracking-wide shadow-sm whitespace-nowrap ${current.bg}`}>
            {current.label}
        </span>
    );
}