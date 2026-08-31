import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowUturnLeftIcon,
    PlusCircleIcon,
    ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

import AppLayout from '@/Layouts/AppLayout';
import { Card, PageHeader, DataTable, StatusBadge, Button, Tabs } from '@/Components/UI';

/**
 * A fila da logística reversa.
 *
 * Um perfil, uma pergunta: a loja quer saber onde parou o que ela devolveu; o
 * gestor, o que está esperando decisão; o CD, o que está chegando. A mesma
 * lista responde às três — o filtro de status é a única diferença, e por isso
 * ele mora na URL, sobrevive a um refresh e pode ser mandado por link.
 */
export default function Index({ devolucoes, filtros = {}, podeCriar = false }) {
    const abas = [
        { key: '', label: 'Todas' },
        { key: 'rascunho', label: 'Rascunho' },
        { key: 'aguardando_aprovacao', label: 'Aguardando diretoria' },
        { key: 'aprovada', label: 'Em transporte' },
        { key: 'recebida', label: 'Recebidas' },
    ];

    const filtrar = (status) =>
        router.get(route('devolucoes.index'), status ? { status } : {}, {
            preserveState: true,
            replace: true,
        });

    const colunas = [
        {
            key: 'id',
            header: 'Devolução',
            render: (row) => (
                <div>
                    <Link
                        href={route('devolucoes.show', row.id)}
                        className="font-mono font-black text-content-primary hover:text-brand-700"
                    >
                        #{String(row.id).padStart(5, '0')}
                    </Link>
                    <p className="text-[11px] text-content-muted">{formatarData(row.criada_em)}</p>
                </div>
            ),
        },
        {
            key: 'loja',
            header: 'Origem → Destino',
            render: (row) => (
                <div className="text-xs">
                    <p className="font-bold text-content-primary">{row.loja}</p>
                    <p className="text-content-muted">para {row.destino}</p>
                </div>
            ),
        },
        {
            key: 'motivo',
            header: 'Motivo',
            render: (row) => <span className="text-xs text-content-secondary">{row.motivo}</span>,
        },
        {
            key: 'motos',
            header: 'Motos',
            align: 'center',
            render: (row) => (
                <div>
                    <p className="text-sm font-black tabular-nums text-content-primary">
                        {row.qtd_motos}
                    </p>
                    <p
                        className="max-w-[10rem] truncate text-[10px] text-content-muted"
                        title={row.chassis.join(', ')}
                    >
                        {row.chassis.join(', ')}
                    </p>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Situação',
            render: (row) => (
                <div className="space-y-1">
                    <StatusBadge status={row.status} size="sm" />
                    {/* Enquanto a moto viaja, o status que interessa é o do
                        frete: é ele que diz se já subiu no caminhão. */}
                    {row.pedido_status && row.status === 'aprovada' && (
                        <p className="text-[10px] text-content-muted">
                            frete #{row.pedido_id}: {row.pedido_status.replace(/_/g, ' ')}
                        </p>
                    )}
                    {row.retidas > 0 && (
                        <p className="text-[10px] font-bold text-status-danger-fg">
                            {row.retidas} retida(s) por avaria
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: 'acoes',
            header: '',
            align: 'right',
            render: (row) => (
                <Button
                    size="sm"
                    variant="ghost"
                    icon={ArrowTopRightOnSquareIcon}
                    href={route('devolucoes.show', row.id)}
                >
                    Abrir
                </Button>
            ),
        },
    ];

    return (
        <AppLayout>
            <Head title="Devoluções" />

            <PageHeader
                title="Devoluções ao CD"
                description="Logística reversa de motos, com checklist de conferência na saída da loja e na chegada ao CD."
                breadcrumbs={[{ label: 'Motos' }, { label: 'Devoluções' }]}
                actions={
                    podeCriar && (
                        <Button icon={PlusCircleIcon} href={route('devolucoes.create')}>
                            Nova devolução
                        </Button>
                    )
                }
            />

            <Card padding="none">
                <Tabs tabs={abas} active={filtros.status ?? ''} onChange={filtrar} />

                <DataTable
                    columns={colunas}
                    rows={devolucoes.data}
                    emptyIcon={ArrowUturnLeftIcon}
                    emptyTitle="Nenhuma devolução por aqui"
                    emptyDescription="Devoluções abertas pelas lojas aparecem nesta lista assim que criadas."
                    emptyAction={
                        podeCriar && (
                            <Button icon={PlusCircleIcon} href={route('devolucoes.create')}>
                                Abrir a primeira
                            </Button>
                        )
                    }
                />
            </Card>

            {devolucoes.links.length > 3 && (
                <div className="mt-4 flex flex-wrap justify-center gap-1">
                    {devolucoes.links.map((link, i) => (
                        <Link
                            key={i}
                            href={link.url || '#'}
                            dangerouslySetInnerHTML={{ __html: link.label }}
                            className={`min-w-[2rem] rounded-md px-2.5 py-1.5 text-sm font-semibold transition
                                ${
                                    link.active
                                        ? 'bg-brand-600 text-white'
                                        : link.url
                                          ? 'text-content-secondary hover:bg-surface-sunken'
                                          : 'pointer-events-none text-content-muted opacity-50'
                                }`}
                        />
                    ))}
                </div>
            )}
        </AppLayout>
    );
}

function formatarData(valor) {
    if (!valor) return '—';

    return new Date(valor).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
    });
}
