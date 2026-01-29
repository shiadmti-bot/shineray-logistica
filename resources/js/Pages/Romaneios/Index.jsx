import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';

export default function RomaneioIndex({ auth, romaneios, filters }) {
    // 1. BLINDAGEM DE DADOS: Garante que 'romaneios' nunca seja nulo/undefined
    const safeRomaneios = romaneios || { data: [], links: [], total: 0 };

    const { data, setData, get, processing } = useForm({
        search: filters?.search || '', // Proteção contra filters null
    });

    const handleSearch = (e) => {
        e.preventDefault();
        get(route('romaneios.index'), {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-xl text-gray-800">Histórico de Cargas</h2>}>
            <Head title="Cargas e Romaneios" />

            <div className="py-8 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6 px-4">
                    
                    {/* --- CABEÇALHO E AÇÕES --- */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center transition-all hover:shadow-md">
                        {auth.user.perfil === 'cd' && (
                            <Link href={route('romaneios.create')} className="w-full md:w-auto bg-gradient-to-r from-gray-800 to-gray-900 text-white px-6 py-3 rounded-lg font-bold shadow hover:from-black hover:to-gray-800 transform hover:-translate-y-0.5 transition flex items-center justify-center gap-2">
                                <span>🚛</span> Nova Expedição
                            </Link>
                        )}

                        <form onSubmit={handleSearch} className="flex w-full md:w-auto gap-2 relative">
                            <div className="relative w-full md:w-80">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input 
                                    type="text" 
                                    className="pl-10 w-full border-gray-300 rounded-lg focus:ring-gray-500 focus:border-gray-500 transition-colors"
                                    placeholder="Buscar placa, motorista..."
                                    value={data.search}
                                    onChange={e => setData('search', e.target.value)}
                                />
                            </div>
                            <button type="submit" className="bg-gray-800 text-white px-5 rounded-lg hover:bg-gray-700 font-bold transition shadow-sm" disabled={processing}>
                                Buscar
                            </button>
                        </form>
                    </div>

                    {/* --- VERSÃO MOBILE (CARDS COM PROGRESSO) --- */}
                    <div className="md:hidden space-y-4">
                        {safeRomaneios.data.length > 0 ? safeRomaneios.data.map((romaneio) => (
                            <Link key={romaneio.id} href={route('romaneios.show', romaneio.id)} className="block group">
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:border-gray-300 hover:shadow-md transition relative overflow-hidden">
                                    {/* Faixa lateral colorida segura */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${safeGetStatusColor(romaneio.status)}`}></div>

                                    <div className="flex justify-between items-start mb-3 pl-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl font-black text-gray-800">#{String(romaneio.id).padStart(6, '0')}</span>
                                            </div>
                                            <div className="text-sm font-bold text-gray-700 mt-1">{romaneio.motorista || 'Motorista N/D'}</div>
                                            <div className="text-xs text-gray-500 font-mono uppercase bg-gray-50 px-2 py-0.5 rounded inline-block mt-1 border border-gray-200">
                                                {romaneio.placa || 'SEM PLACA'}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xs text-gray-400 uppercase font-bold mb-1">Motos</span>
                                            <span className="text-xl font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                                                {romaneio.motos_count || 0}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Barra de Progresso Visual */}
                                    <div className="mt-4 pl-2">
                                        <div className="flex justify-between items-end mb-1">
                                            <BadgeStatus status={romaneio.status} />
                                            <span className="text-[10px] text-gray-400 font-bold">
                                                {romaneio.created_at ? new Date(romaneio.created_at).toLocaleDateString() : '-'}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full ${safeGetStatusColor(romaneio.status)} transition-all duration-1000`} 
                                                style={{ width: `${(safeGetStepNumber(romaneio.status) / 4) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )) : (
                            <div className="text-center py-10 text-gray-500">Nenhuma expedição encontrada.</div>
                        )}
                    </div>

                    {/* --- VERSÃO DESKTOP (TABELA COM PROGRESSO) --- */}
                    <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">ID / Data</th>
                                    <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Dados do Transporte</th>
                                    <th className="px-6 py-4 text-center text-xs font-extrabold text-gray-500 uppercase tracking-wider">Volume</th>
                                    <th className="px-6 py-4 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider w-1/4">Status da Carga</th>
                                    <th className="px-6 py-4 text-right text-xs font-extrabold text-gray-500 uppercase tracking-wider">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {safeRomaneios.data.length > 0 ? (
                                    safeRomaneios.data.map((romaneio) => (
                                        <tr key={romaneio.id || Math.random()} className="hover:bg-gray-50 transition duration-150 group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-black text-gray-800">#{String(romaneio.id).padStart(6, '0')}</div>
                                                <div className="text-xs text-gray-400 mt-0.5">
                                                    {romaneio.created_at ? new Date(romaneio.created_at).toLocaleDateString() : '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-gray-800">{romaneio.motorista || 'Sem Motorista'}</div>
                                                <div className="text-xs text-gray-500 font-mono mt-1">
                                                    {romaneio.placa || 'SEM PLACA'} {romaneio.transportadora ? `• ${romaneio.transportadora}` : ''}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-700 border border-gray-200 group-hover:bg-white group-hover:border-gray-300 transition">
                                                    {romaneio.motos_count || 0}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex justify-between items-center">
                                                        <BadgeStatus status={romaneio.status} />
                                                    </div>
                                                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full ${safeGetStatusColor(romaneio.status)}`} 
                                                            style={{ width: `${(safeGetStepNumber(romaneio.status) / 4) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <Link href={route('romaneios.show', romaneio.id)} className="text-indigo-600 hover:text-indigo-900 font-bold border border-indigo-100 hover:border-indigo-300 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition">
                                                    Inspecionar →
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-gray-400 bg-gray-50/50">
                                            <div className="flex flex-col items-center">
                                                <span className="text-4xl mb-2">🚛</span>
                                                <p>Nenhuma carga encontrada.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* PAGINAÇÃO */}
                    {safeRomaneios.links && safeRomaneios.links.length > 3 && (
                        <div className="flex flex-wrap justify-center gap-2 mt-6">
                            {safeRomaneios.links.map((link, k) => (
                                <Link
                                    key={k}
                                    href={link.url || '#'}
                                    className={`px-4 py-2 text-sm font-bold rounded-lg border transition ${
                                        link.active 
                                            ? 'bg-gray-800 text-white border-gray-800' 
                                            : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
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

// --- FUNÇÕES AUXILIARES BLINDADAS (ZERO CRASH) ---

// 1. Converte qualquer coisa para string segura (evita o erro toString of null)
function safeString(value) {
    if (value === null || value === undefined) return '';
    return String(value).toLowerCase();
}

function safeGetStepNumber(status) {
    const s = safeString(status);
    switch(s) {
        case 'aberto': return 1;
        case 'expedido': return 2;
        case 'em_transito': return 3;
        case 'concluido': return 4;
        default: return 1;
    }
}

function safeGetStatusColor(status) {
    const s = safeString(status);
    switch(s) {
        case 'aberto': return 'bg-yellow-500';
        case 'expedido': return 'bg-blue-500';
        case 'em_transito': return 'bg-orange-500';
        case 'concluido': return 'bg-green-500';
        default: return 'bg-gray-400';
    }
}

function BadgeStatus({ status }) {
    const s = safeString(status);
    
    const config = {
        'aberto':      { label: 'Em Aberto',    bg: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
        'expedido':    { label: 'Carregando',   bg: 'bg-blue-100 text-blue-800 border-blue-200' },
        'em_transito': { label: 'Em Trânsito',  bg: 'bg-orange-100 text-orange-800 border-orange-200' },
        'concluido':   { label: 'Concluído',    bg: 'bg-green-100 text-green-800 border-green-200' },
    };

    const current = config[s] || { label: status || 'Desconhecido', bg: 'bg-gray-100 text-gray-600 border-gray-200' };

    return (
        <span className={`px-2.5 py-1 rounded-md text-[10px] md:text-xs font-bold uppercase border tracking-wide ${current.bg}`}>
            {current.label}
        </span>
    );
}