import { PageHeader } from '@/Components/UI';
import { Head, Link } from '@inertiajs/react';

/**
 * Valor de um campo alterado, pronto para a tabela.
 *
 * `itens` do pedido é uma lista de objetos: entregue direto ao React, ele
 * derrubava a tela inteira ("Objects are not valid as a React child") no
 * primeiro log de pedido.
 */
function formatar(valor) {
    if (valor === null || valor === undefined || valor === '') return '—';
    if (typeof valor === 'object') return JSON.stringify(valor);
    return String(valor);
}

/** Trilha de alterações (activity_log). Rota: auditoria.index, só admin. */
export default function Auditoria({ logs }) {
    return (
        <>
            <Head title="Logs do Sistema" />
            <PageHeader
                title="Auditoria de Alterações"
                breadcrumbs={[
                    { label: 'Início', href: route('dashboard') },
                    { label: 'Auditoria' },
                ]}
            />

            {/* overflow-x-auto no lugar de overflow-hidden: a tabela tem 5 colunas
                largas e, recortada, o log ficava inalcançável no celular em vez
                de apenas rolar de lado. */}
            <div className="bg-surface-card shadow-sm sm:rounded-lg border-t-4 border-black">
                <div className="overflow-x-auto">
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
                                            <div className="text-xs text-content-muted mt-1">
                                                {log.subject ?? 'Registro'} #{log.subject_id}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs">
                                            {log.properties && log.properties.attributes && (
                                                <div className="space-y-1">
                                                    {Object.keys(log.properties.attributes).map((key) => (
                                                        <div key={key}>
                                                            <span className="font-bold text-content-secondary uppercase">{key}:</span>{' '}
                                                            {log.properties.old && (
                                                                <span className="text-status-danger-fg line-through mr-2 break-all">
                                                                    {formatar(log.properties.old[key])}
                                                                </span>
                                                            )}
                                                            <span className="text-status-success-fg font-bold break-all">
                                                                {formatar(log.properties.attributes[key])}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {logs.data.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-10 text-center text-content-muted">
                                            Nenhuma alteração registrada.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                </div>
                        {/* Paginação simples — fora da área de rolagem, para os
                            botões ficarem sempre visíveis sem rolar de lado. */}
                        <div className="p-4 flex justify-center gap-2">
                            {logs.prev_page_url && <Link href={logs.prev_page_url} preserveScroll className="px-3 py-1 bg-surface-sunken rounded">Anterior</Link>}
                            {logs.next_page_url && <Link href={logs.next_page_url} preserveScroll className="px-3 py-1 bg-surface-sunken rounded">Próxima</Link>}
                        </div>
                        </div>
        </>
    );
}