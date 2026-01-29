import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';

export default function MotosIndex({ auth, motos, filters }) {
    // Inicializa o termo de busca com o que veio do controller (ou vazio)
    const [term, setTerm] = useState(filters?.search || '');

    // Função de busca manual e segura
    const doSearch = (e) => {
        e.preventDefault();
        router.get(route('motos.index'), 
            { search: term }, // Envia apenas o termo
            {
                preserveState: true, // Não reseta a página inteira
                replace: true        // Substitui a URL atual
            }
        );
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-xl text-gray-800">Motos (Modo Seguro)</h2>}>
            <Head title="Motos" />

            <div className="py-12 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    
                    {/* ÁREA DE BUSCA */}
                    <div className="bg-white p-4 rounded shadow mb-6">
                        <form onSubmit={doSearch} className="flex gap-2">
                            <input 
                                type="text"
                                className="border border-gray-300 p-2 rounded w-full text-black placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                placeholder="Digite chassi, modelo ou cor..."
                                value={term}
                                onChange={e => setTerm(e.target.value)}
                            />
                            <button type="submit" className="bg-blue-800 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold transition-colors">
                                Buscar
                            </button>
                            {/* Botão limpar se tiver busca */}
                            {filters?.search && (
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setTerm('');
                                        router.get(route('motos.index'));
                                    }}
                                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded font-bold hover:bg-gray-300"
                                >
                                    Limpar
                                </button>
                            )}
                        </form>
                    </div>

                    {/* TABELA BLINDADA (Sem componentes complexos) */}
                    <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg border border-gray-200">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider font-bold">
                                    <tr>
                                        <th className="p-4 border-b">ID</th>
                                        <th className="p-4 border-b">Chassi</th>
                                        <th className="p-4 border-b">Modelo / Cor</th>
                                        <th className="p-4 border-b">Status</th>
                                        <th className="p-4 border-b">Localização</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {/* Verifica se existem dados antes de tentar mapear */}
                                    {motos?.data?.length > 0 ? (
                                        motos.data.map((moto) => (
                                            <tr key={moto?.id || Math.random()} className="hover:bg-blue-50 transition-colors">
                                                <td className="p-4 text-gray-500">#{moto.id}</td>
                                                <td className="p-4 font-mono font-bold text-gray-800">
                                                    {moto.chassi || <span className="text-red-400">SEM CHASSI</span>}
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-700">{moto.modelo || '-'}</div>
                                                    <div className="text-xs text-gray-500">{moto.cor || '-'}</div>
                                                </td>
                                                <td className="p-4">
                                                    <StatusBadge status={moto.status} />
                                                </td>
                                                <td className="p-4 text-gray-600 text-xs">
                                                    {moto.localizacao_atual || '-'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" className="p-8 text-center text-gray-500">
                                                <div className="text-2xl mb-2">🔍</div>
                                                Nenhuma moto encontrada.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* PAGINAÇÃO */}
                        {motos?.links?.length > 3 && (
                            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-center gap-1 flex-wrap">
                                {motos.links.map((link, i) => (
                                    link.url ? (
                                        <button
                                            key={i}
                                            onClick={() => router.get(link.url)}
                                            className={`px-3 py-1 rounded text-sm font-bold border ${
                                                link.active 
                                                    ? 'bg-blue-800 text-white border-blue-800' 
                                                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                                            }`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ) : (
                                        <span 
                                            key={i} 
                                            className="px-3 py-1 rounded text-sm text-gray-400 border border-gray-200 bg-gray-50" 
                                            dangerouslySetInnerHTML={{ __html: link.label }} 
                                        />
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

// Subcomponente para organizar os Badges
function StatusBadge({ status }) {
    const s = status || 'nd';
    let colorClass = 'bg-gray-200 text-gray-800'; // Padrão

    if (s === 'entregue') colorClass = 'bg-gray-800 text-white';
    else if (s === 'em_transito') colorClass = 'bg-orange-100 text-orange-800';
    else if (s === 'estoque_fabrica' || s === 'disponivel') colorClass = 'bg-green-100 text-green-800';
    else if (s === 'reservado') colorClass = 'bg-yellow-100 text-yellow-800';
    else if (s === 'separado') colorClass = 'bg-blue-100 text-blue-800';

    return (
        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${colorClass}`}>
            {s.replace('_', ' ')}
        </span>
    );
}