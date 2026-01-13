import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

export default function GestorHistory({ auth, logs }) {
    
    // Função para colorir o texto do log dinamicamente
    const renderDescricao = (texto) => {
        // Divide o texto onde houver quebras de linha
        return texto.split('\n').map((linha, index) => {
            if (linha.includes('✅')) {
                return <p key={index} className="text-green-700 font-bold mb-1">{linha}</p>;
            }
            if (linha.includes('🚫') || linha.includes('REJEITADOS')) {
                return <p key={index} className="text-red-600 font-medium pl-4 border-l-2 border-red-200 mt-1">{linha}</p>;
            }
            if (linha.includes('Obs:')) {
                return <p key={index} className="text-gray-600 italic bg-yellow-50 p-2 rounded border border-yellow-100 my-2 text-sm">{linha}</p>;
            }
            return <p key={index} className="text-gray-600 text-sm">{linha}</p>;
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-purple-800">Auditoria Comercial</h2>}>
            <Head title="Histórico de Aprovações" />

            <div className="py-8 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* CABEÇALHO */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                        <div>
                            <h3 className="text-xl font-black text-gray-800">Registro de Decisões</h3>
                            <p className="text-sm text-gray-500">Rastreabilidade completa de autorizações e cortes.</p>
                        </div>
                        <Link href={route('gestor.index')} className="bg-white text-purple-700 border border-purple-200 px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-purple-50 transition flex items-center gap-2">
                            <span>⬅️</span> Voltar ao Painel
                        </Link>
                    </div>

                    {/* LISTA DE CARDS (AUDITORIA) */}
                    <div className="space-y-4">
                        {logs.data.map((log) => (
                            <div key={log.id} className="bg-white rounded-xl shadow-sm border-l-4 border-purple-500 overflow-hidden hover:shadow-md transition-shadow">
                                <div className="p-6">
                                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                                        
                                        {/* Coluna 1: Dados do Pedido */}
                                        <div className="flex items-center gap-4">
                                            <div className="bg-purple-50 p-3 rounded-full text-2xl">
                                                🛡️
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-black text-gray-800">Pedido #{log.pedido_id}</span>
                                                    {!log.pedido && <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Deletado</span>}
                                                </div>
                                                <div className="text-sm text-gray-500 font-medium mt-0.5">
                                                    {log.pedido?.user?.filial || log.pedido?.user?.name || 'Solicitante Desconhecido'}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">
                                                    📅 {new Date(log.created_at).toLocaleDateString('pt-BR')} às {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Coluna 2: Status do Pedido (Snapshot atual) */}
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-gray-400 uppercase">Status Atual</span>
                                            <div className="mt-1">
                                                <StatusBadge status={log.pedido?.status || 'cancelado'} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ÁREA DE DETALHES (LOG FORMATADO) */}
                                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                                        <div className="text-sm leading-relaxed">
                                            {renderDescricao(log.descricao)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {logs.data.length === 0 && (
                            <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-200">
                                <p className="text-gray-400 font-medium">Nenhum registro de auditoria encontrado ainda.</p>
                            </div>
                        )}
                    </div>

                    {/* PAGINAÇÃO */}
                    {logs.links && logs.links.length > 3 && (
                        <div className="mt-8 flex justify-center gap-2">
                            {logs.links.map((link, k) => (
                                <Link
                                    key={k}
                                    href={link.url}
                                    className={`px-4 py-2 text-sm font-bold rounded border transition ${
                                        link.active 
                                            ? 'bg-purple-600 text-white border-purple-600' 
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
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

// Badge Auxiliar
function StatusBadge({ status }) {
    const config = {
        'em_analise': { label: 'Em Análise', bg: 'bg-purple-100 text-purple-800' },
        'solicitado': { label: 'Aguardando CD', bg: 'bg-yellow-100 text-yellow-800' },
        'separado':   { label: 'No Pátio', bg: 'bg-blue-100 text-blue-800' },
        'em_transito':{ label: 'Em Trânsito', bg: 'bg-orange-100 text-orange-800' },
        'concluido':  { label: 'Concluído', bg: 'bg-green-100 text-green-800' },
        'cancelado':  { label: 'Cancelado/Excluído', bg: 'bg-red-100 text-red-800' },
    }[status] || { label: status, bg: 'bg-gray-100 text-gray-600' };

    return <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.bg}`}>{config.label}</span>;
}