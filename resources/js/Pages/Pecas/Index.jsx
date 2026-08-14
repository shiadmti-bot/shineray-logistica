import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import {
    WrenchScrewdriverIcon,
    CubeIcon,
    LockClosedIcon,
    ExclamationTriangleIcon,
    MagnifyingGlassIcon,
    GlobeAltIcon,
    QuestionMarkCircleIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';

import AppLayout from '@/Layouts/AppLayout';
import { Card, DataTable, PageHeader, StatCard, Button, StatusBadge } from '@/Components/UI';

/**
 * Estoque de Peças — primeira tela do módulo (v3).
 *
 * Diferença central em relação ao estoque de motos: aqui não há chassi. A
 * unidade de leitura é SKU + saldo por local, e o número que importa para
 * quem opera é DISPONÍVEL (saldo - reservado), não o saldo bruto.
 */
export default function PecasIndex({
    estoques,
    locais = [],
    localAtual,
    podeEscolherLocal = false,
    filtros = {},
    modelos = [],
    resumo = {},
}) {
    const [busca, setBusca] = useState(filtros.busca ?? '');

    const aplicarFiltro = (novos = {}) => {
        router.get(
            route('pecas.index'),
            {
                busca,
                local: localAtual,
                modelo: filtros.modelo || undefined,
                apenas_criticos: filtros.apenas_criticos ? 1 : undefined,
                ...novos,
            },
            { preserveState: true, replace: true }
        );
    };

    const colunas = [
        {
            key: 'codigo',
            header: 'Código',
            className: 'font-mono text-xs font-semibold',
        },
        {
            key: 'descricao',
            header: 'Descrição',
            render: (row) => (
                <div className="min-w-0">
                    <p className="truncate font-semibold text-content-primary">{row.descricao}</p>
                    <p className="truncate text-xs text-content-muted">{row.categoria || '—'}</p>
                </div>
            ),
        },
        {
            key: 'modelos',
            header: 'Serve em',
            render: (row) => {
                if (row.tipo_item === 'universal') {
                    return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-status-info-bg px-2 py-0.5 text-[11px] font-semibold text-status-info-fg">
                            <GlobeAltIcon className="h-3 w-3" />
                            Qualquer moto
                        </span>
                    );
                }

                if (!row.modelos?.length) {
                    return (
                        <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-content-muted"
                            title="Aplicação não preenchida no Microwork. Precisa de conferência."
                        >
                            <QuestionMarkCircleIcon className="h-3.5 w-3.5" />
                            A confirmar
                        </span>
                    );
                }

                return (
                    <div className="flex flex-wrap gap-1">
                        {row.modelos.map((m, i) => (
                            <span
                                key={i}
                                title={
                                    m.confiavel
                                        ? 'Aplicação do cadastro oficial'
                                        : 'Deduzido do nome da peça — confirme antes de usar'
                                }
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset
                                    ${
                                        m.confiavel
                                            ? 'bg-status-success-bg text-status-success-fg ring-status-success-solid/20'
                                            : 'bg-status-warning-bg text-status-warning-fg ring-status-warning-solid/30'
                                    }`}
                            >
                                {!m.confiavel && <ExclamationTriangleIcon className="h-3 w-3" />}
                                {m.label}
                            </span>
                        ))}
                    </div>
                );
            },
        },
        {
            key: 'preco',
            header: 'Preço',
            align: 'right',
            render: (row) =>
                row.preco != null ? (
                    <span className="tabular-nums text-content-secondary">
                        {Number(row.preco).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                        })}
                    </span>
                ) : (
                    <span className="text-content-muted">—</span>
                ),
        },
        {
            key: 'onde_tem',
            header: 'Onde tem (Microwork)',
            render: (row) => {
                if (!row.onde_tem?.length) {
                    return <span className="text-xs text-content-muted">Sem saldo</span>;
                }

                return (
                    <div className="flex flex-col gap-0.5">
                        {row.onde_tem.map((o, i) => (
                            <span
                                key={i}
                                title={
                                    o.agrupado
                                        ? `Saldo somado de: ${o.detalhe}. Confirme em qual ponto está antes de separar.`
                                        : undefined
                                }
                                className="inline-flex items-center gap-1 whitespace-nowrap text-xs"
                            >
                                <span className="font-bold tabular-nums text-content-primary">{o.saldo}</span>
                                <span className="text-content-secondary">{o.local}</span>
                                {o.agrupado && (
                                    <ExclamationTriangleIcon
                                        className="h-3 w-3 shrink-0 text-status-warning-fg"
                                        aria-label="Saldo agrupado"
                                    />
                                )}
                            </span>
                        ))}
                    </div>
                );
            },
        },
        {
            key: 'reservado',
            header: 'Reservado',
            align: 'right',
            render: (row) => (
                <span className={`tabular-nums ${row.reservado > 0 ? 'text-status-warning-fg font-semibold' : 'text-content-muted'}`}>
                    {row.reservado}
                </span>
            ),
        },
        {
            key: 'disponivel',
            header: 'Disponível aqui',
            align: 'right',
            headerClassName: 'text-brand-700',
            render: (row) => (
                <span className="font-bold tabular-nums text-content-primary">
                    {row.disponivel} <span className="text-xs font-normal text-content-muted">{row.unidade}</span>
                </span>
            ),
        },
        {
            key: 'situacao',
            header: 'Situação',
            render: (row) =>
                row.abaixo_do_minimo ? (
                    <StatusBadge status="reservado" size="sm" />
                ) : row.disponivel > 0 ? (
                    <StatusBadge status="disponivel" size="sm" />
                ) : (
                    <StatusBadge status="cancelado" size="sm" />
                ),
        },
    ];

    return (
        <AppLayout header="Estoque de Peças">
            <Head title="Estoque de Peças" />

            <PageHeader
                title="Estoque de Peças"
                description="Saldo por SKU e local. O número que vale para atender pedido é o disponível."
                breadcrumbs={[{ label: 'Peças' }, { label: 'Estoque' }]}
            />

            {/* Resumo */}
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Catálogo" value={resumo.catalogo} icon={WrenchScrewdriverIcon} tone="brand"
                          hint="Peças cadastradas (todas as lojas)" />
                <StatCard label="Com saldo aqui" value={resumo.skus} icon={CubeIcon} tone="info"
                          hint={`${resumo.unidades ?? 0} unidades`} />
                <StatCard label="Reservado" value={resumo.reservado} icon={LockClosedIcon} tone="warning"
                          hint="Prometido a pedidos abertos" />
                <StatCard label="Abaixo do mínimo" value={resumo.criticos} icon={ExclamationTriangleIcon}
                          tone={resumo.criticos > 0 ? 'danger' : 'success'} hint="Precisa repor" />
            </div>

            {/*
                Duas colunas de número na mesma tabela pedem explicação: sem ela,
                alguém promete uma peça baseando-se no saldo do Microwork, que é
                agregado de mais de um ponto e não passa por reserva.
            */}
            <div className="mb-4 flex items-start gap-3 rounded-card border border-status-info-solid/20 bg-status-info-bg/40 px-4 py-3">
                <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-status-info-fg" />
                <div className="text-xs leading-relaxed text-content-secondary">
                    <p>
                        <strong className="text-content-primary">Disponível aqui</strong> é o saldo
                        controlado pelo sistema neste local — é o número que vale para atender pedido,
                        e o único que reserva.
                    </p>
                    <p className="mt-1">
                        <strong className="text-content-primary">Onde tem</strong> é o espelho do
                        Microwork, para localizar a peça. Itens marcados com{' '}
                        <ExclamationTriangleIcon className="inline h-3 w-3 text-status-warning-fg" />{' '}
                        somam mais de um ponto físico — confirme antes de separar.
                    </p>
                </div>
            </div>

            <Card padding="none">
                {/* Filtros */}
                <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                        <input
                            type="search"
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && aplicarFiltro()}
                            placeholder="Buscar por código, descrição ou código de barras…"
                            className="w-full rounded-lg border-line bg-surface-card py-2 pl-9 pr-3 text-sm text-content-primary placeholder:text-content-muted focus:border-brand-500 focus:ring-brand-500"
                        />
                    </div>

                    {/* Filtro por moto: o caminho mais rápido para montar um pedido */}
                    <select
                        value={filtros.modelo ?? ''}
                        onChange={(e) => aplicarFiltro({ modelo: e.target.value || undefined })}
                        className="rounded-lg border-line bg-surface-card py-2 text-sm text-content-primary focus:border-brand-500 focus:ring-brand-500"
                    >
                        <option value="">Todas as motos</option>
                        {modelos.map((m) => (
                            <option key={m.valor} value={m.valor}>
                                {m.label} ({m.total})
                            </option>
                        ))}
                    </select>

                    {podeEscolherLocal && (
                        <select
                            value={localAtual ?? ''}
                            onChange={(e) => aplicarFiltro({ local: e.target.value })}
                            className="rounded-lg border-line bg-surface-card py-2 text-sm text-content-primary focus:border-brand-500 focus:ring-brand-500"
                        >
                            {locais.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.nome}
                                </option>
                            ))}
                        </select>
                    )}

                    <Button
                        variant={filtros.apenas_criticos ? 'danger' : 'secondary'}
                        icon={ExclamationTriangleIcon}
                        onClick={() => aplicarFiltro({ apenas_criticos: filtros.apenas_criticos ? undefined : 1 })}
                    >
                        Só críticos
                    </Button>
                </div>

                <DataTable
                    columns={colunas}
                    rows={estoques?.data ?? []}
                    emptyIcon={WrenchScrewdriverIcon}
                    emptyTitle="Nenhuma peça encontrada"
                    emptyDescription={
                        filtros.busca
                            ? 'Nenhum resultado para esta busca. Tente outro código ou descrição.'
                            : 'O catálogo está vazio. Rode "php artisan pecas:sync-estoque" para importar do Microwork.'
                    }
                />

                {/* Paginação */}
                {estoques?.links?.length > 3 && (
                    <div className="flex flex-wrap items-center justify-center gap-1 border-t border-line p-4">
                        {estoques.links.map((link, i) => (
                            <button
                                key={i}
                                type="button"
                                disabled={!link.url}
                                onClick={() => link.url && router.get(link.url, {}, { preserveState: true })}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                                className={`min-w-[2rem] rounded-md px-2.5 py-1.5 text-sm font-semibold transition
                                    ${
                                        link.active
                                            ? 'bg-brand-600 text-white'
                                            : link.url
                                              ? 'text-content-secondary hover:bg-surface-sunken'
                                              : 'cursor-not-allowed text-content-muted opacity-50'
                                    }`}
                            />
                        ))}
                    </div>
                )}
            </Card>
        </AppLayout>
    );
}
