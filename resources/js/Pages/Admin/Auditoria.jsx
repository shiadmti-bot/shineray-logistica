import AppLayout from '@/Layouts/AppLayout';
import { PageHeader } from '@/Components/UI';
import { Head } from '@inertiajs/react';

export default function Auditoria({ auth, logs }) {
    return (
        <AppLayout user={auth.user}>
            <Head title="Logs do Sistema" />
            <PageHeader
                title="Auditoria de Alterações"
                breadcrumbs={[
                    { label: 'Início', href: route('dashboard') },
                    { label: 'Auditoria' },
                ]}
            />

            <div className="bg-surface-card overflow-hidden shadow-sm sm:rounded-lg border-t-4 border-black">
                        <table className="min-w-full text-sm">
                            <thead className="bg-surface-sunken border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left font-bold text-content-muted">Data</th>
                                    <th className="px-6 py-3 text-left font-bold text-content-muted">Usuário (Quem)</th>
                                    <th className="px-6 py-3 text-left font-bold text-content-muted">Ação</th>
                                    <th className="px-6 py-3 text-left font-bold text-content-muted w-1/2">Detalhes (Antes -{'>'} Depois)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {logs.data.map((log) => (
                                    <tr key={log.id} className="hover:bg-surface-sunken">
                                        <td className="px-6 py-4 text-content-muted">
                                            {new Date(log.created_at).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4 font-bold">
                                            {log.causer ? log.causer.name : 'Sistema'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                                log.event === 'created' ? 'bg-status-success-bg text-status-success-fg' :
                                                log.event === 'updated' ? 'bg-status-info-bg text-status-info-fg' :
                                                'bg-status-danger-bg text-status-danger-fg'
                                            }`}>
                                                {log.description}
                                            </span>
                                            <div className="text-xs text-content-muted mt-1">ID Objeto: {log.subject_id}</div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs">
                                            {log.properties && log.properties.attributes && (
                                                <div className="space-y-1">
                                                    {Object.keys(log.properties.attributes).map((key) => (
                                                        <div key={key}>
                                                            <span className="font-bold text-content-secondary uppercase">{key}:</span>{' '}
                                                            {log.properties.old && (
                                                                <span className="text-status-danger-fg line-through mr-2">
                                                                    {log.properties.old[key]}
                                                                </span>
                                                            )}
                                                            <span className="text-status-success-fg font-bold">
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
                            {logs.prev_page_url && <a href={logs.prev_page_url} className="px-3 py-1 bg-surface-sunken rounded">Anterior</a>}
                            {logs.next_page_url && <a href={logs.next_page_url} className="px-3 py-1 bg-surface-sunken rounded">Próxima</a>}
                        </div>
                        </div>
        </AppLayout>
    );
}