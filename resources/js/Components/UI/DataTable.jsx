import EmptyState from './EmptyState';

/**
 * Tabela de dados padrão.
 *
 * As listagens atuais (Motos, Pedidos, Romaneios, Users) repetem a mesma
 * estrutura de <table> com estilos ligeiramente diferentes. Este componente
 * unifica cabeçalho, zebra, estado vazio e o comportamento responsivo.
 *
 * RESPONSIVO: em telas estreitas a tabela rola horizontalmente dentro do
 * próprio contêiner, em vez de deixar a página inteira rolar de lado — que é
 * o que acontece hoje e atrapalha no celular do CD e do motorista.
 *
 * @param {Array<{
 *   key: string,
 *   header: string,
 *   render?: (row, index) => React.ReactNode,
 *   align?: 'left'|'center'|'right',
 *   className?: string,
 *   headerClassName?: string,
 * }>} columns
 */
export default function DataTable({
    columns = [],
    rows = [],
    rowKey = (row, i) => row.id ?? i,
    onRowClick,
    emptyTitle = 'Nenhum registro encontrado',
    emptyDescription,
    emptyIcon,
    emptyAction,
    dense = false,
    className = '',
}) {
    const alinhamento = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
    };

    if (!rows.length) {
        return (
            <EmptyState
                title={emptyTitle}
                description={emptyDescription}
                icon={emptyIcon}
                action={emptyAction}
            />
        );
    }

    const paddingCelula = dense ? 'px-3 py-2' : 'px-4 py-3';

    return (
        <div className={`overflow-x-auto scrollbar-slim ${className}`}>
            <table className="min-w-full divide-y divide-line">
                <thead>
                    <tr className="bg-surface-sunken">
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                scope="col"
                                className={`${paddingCelula} text-[11px] font-bold uppercase tracking-wider
                                    text-content-secondary whitespace-nowrap
                                    ${alinhamento[col.align ?? 'left']} ${col.headerClassName ?? ''}`}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody className="divide-y divide-line bg-surface-card">
                    {rows.map((row, index) => (
                        <tr
                            key={rowKey(row, index)}
                            onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                            className={`transition ${
                                onRowClick
                                    ? 'cursor-pointer hover:bg-surface-sunken/70'
                                    : 'hover:bg-surface-sunken/40'
                            }`}
                        >
                            {columns.map((col) => (
                                <td
                                    key={col.key}
                                    className={`${paddingCelula} text-sm text-content-primary
                                        ${alinhamento[col.align ?? 'left']} ${col.className ?? ''}`}
                                >
                                    {col.render ? col.render(row, index) : row[col.key] ?? '—'}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
