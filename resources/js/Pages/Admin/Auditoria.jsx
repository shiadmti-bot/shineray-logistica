import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function Auditoria({ auth, logs }) {
    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-gray-800">Auditoria de Alterações</h2>}>
            <Head title="Logs do Sistema" />

            <div className="py-12 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg border-t-4 border-black">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left font-bold text-gray-500">Data</th>
                                    <th className="px-6 py-3 text-left font-bold text-gray-500">Usuário (Quem)</th>
                                    <th className="px-6 py-3 text-left font-bold text-gray-500">Ação</th>
                                    <th className="px-6 py-3 text-left font-bold text-gray-500 w-1/2">Detalhes (Antes -{'>'} Depois)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {logs.data.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(log.created_at).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4 font-bold">
                                            {log.causer ? log.causer.name : 'Sistema'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                log.event === 'created' ? 'bg-green-100 text-green-800' :
                                                log.event === 'updated' ? 'bg-blue-100 text-blue-800' :
                                                'bg-red-100 text-red-800'
                                            }`}>
                                                {log.description}
                                            </span>
                                            <div className="text-xs text-gray-400 mt-1">ID Objeto: {log.subject_id}</div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs">
                                            {log.properties && log.properties.attributes && (
                                                <div className="space-y-1">
                                                    {Object.keys(log.properties.attributes).map((key) => (
                                                        <div key={key}>
                                                            <span className="font-bold text-gray-700 uppercase">{key}:</span>{' '}
                                                            {log.properties.old && (
                                                                <span className="text-red-500 line-through mr-2">
                                                                    {log.properties.old[key]}
                                                                </span>
                                                            )}
                                                            <span className="text-green-600 font-bold">
                                                                {log.properties.attributes[key]}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {/* Paginação simples */}
                        <div className="p-4 flex justify-center gap-2">
                            {logs.prev_page_url && <a href={logs.prev_page_url} className="px-3 py-1 bg-gray-200 rounded">Anterior</a>}
                            {logs.next_page_url && <a href={logs.next_page_url} className="px-3 py-1 bg-gray-200 rounded">Próxima</a>}
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}