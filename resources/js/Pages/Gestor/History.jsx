import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

export default function GestorHistory({ auth, logs }) {
    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-purple-800">Histórico de Auditoria</h2>}>
            <Head title="Auditoria Gestão" />

            <div className="py-8 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-gray-600 font-bold">Registro de Aprovações e Cortes</h3>
                        <Link href={route('gestor.index')} className="text-purple-600 hover:underline font-bold">
                            &larr; Voltar para Painel
                        </Link>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-purple-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-purple-800 uppercase tracking-wider">Data / Hora</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-purple-800 uppercase tracking-wider">Pedido / Loja</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-purple-800 uppercase tracking-wider">Ação e Detalhes</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {logs.data.map((log) => (
                                    <tr key={log.id} className="hover:bg-purple-50/20 transition">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {new Date(log.created_at).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-gray-800">
                                                #{log.pedido_id}
                                            </span>
                                            {log.pedido?.user && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {log.pedido.user.filial || log.pedido.user.name}
                                                </div>
                                            )}
                                            {!log.pedido && <span className="text-xs text-red-400 ml-2">(Cancelado/Excluído)</span>}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700">
                                            {log.descricao}
                                        </td>
                                    </tr>
                                ))}
                                {logs.data.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="px-6 py-12 text-center text-gray-400">
                                            Nenhum registro de auditoria encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginação Simples */}
                    {logs.links && logs.links.length > 3 && (
                        <div className="mt-4 flex justify-center gap-1">
                            {logs.links.map((link, k) => (
                                <Link
                                    key={k}
                                    href={link.url}
                                    className={`px-3 py-1 border rounded text-sm ${link.active ? 'bg-purple-600 text-white' : 'bg-white text-gray-600'}`}
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