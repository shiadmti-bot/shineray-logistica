import AppLayout from '@/Layouts/AppLayout';
import { Head, router, Link } from '@inertiajs/react';
import { useState } from 'react';
import StockTable from '@/Components/Microwork/StockTable';
import {
    BuildingStorefrontIcon,
    BuildingOffice2Icon,
    MagnifyingGlassIcon,
    XMarkIcon,
    FunnelIcon,
    MapPinIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';

import { Card, PageHeader, Button, StatusBadge, EmptyState, Tabs, DataTable } from '@/Components/UI';

/**
 * Estoque de motos — repaginado para o design system v3.
 *
 * Duas fontes distintas, separadas em abas porque respondem perguntas
 * diferentes:
 *   Histórico do sistema -> o que o BySabel registrou (movimentação, dono atual)
 *   CD em tempo real     -> o que o ERP Microwork diz que está no pátio agora
 *
 * A loja só enxerga a aba do CD: o histórico interno de outras lojas não lhe
 * diz respeito.
 */
export default function MotosIndex({ auth, motos, lojas, filters }) {
    const [params, setParams] = useState({
        search: filters.search || '',
        status: filters.status || '',
        loja_id: filters.loja_id || '',
    });

    const isLoja = auth.user.perfil === 'loja';
    const [abaAtiva, setAbaAtiva] = useState(isLoja ? 'fabrica' : 'sistema');

    const temFiltro = params.search || params.status || params.loja_id;

    const applyFilters = () => {
        router.get(route('motos.index'), params, { preserveState: true, replace: true });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') applyFilters();
    };

    const clearFilters = () => {
        setParams({ search: '', status: '', loja_id: '' });
        router.get(route('motos.index'));
    };

    const abas = [
        ...(!isLoja
            ? [{ key: 'sistema', label: 'Histórico do Sistema', icon: BuildingStorefrontIcon }]
            : []),
        { key: 'fabrica', label: 'CD em Tempo Real', icon: BuildingOffice2Icon },
    ];

    const classeCampo =
        'w-full rounded-lg border-line bg-surface-card text-sm text-content-primary focus:border-brand-500 focus:ring-brand-500';

    /* ---------- Dono atual da moto ---------- */
    const DonoAtual = ({ moto }) => {
        const pedidoAtual = moto.pedidos?.length ? moto.pedidos[0] : null;

        const noCd =
            (!moto.loja_atual_id &&
                !moto.loja &&
                (!pedidoAtual || ['em_analise', 'cancelado'].includes(pedidoAtual.status))) ||
            moto.status === 'estoque_fabrica';

        if (noCd) {
            return (
                <span className="inline-flex w-max items-center gap-1 rounded-md bg-surface-sunken px-2 py-1 text-xs font-bold text-content-secondary ring-1 ring-inset ring-line">
                    <BuildingOffice2Icon className="h-3 w-3" /> CD / Fábrica
                </span>
            );
        }

        const loja = moto.loja ?? pedidoAtual?.user;

        if (!loja) {
            return <span className="text-xs italic text-content-muted">CD / Fábrica</span>;
        }

        return (
            <div>
                <span className="inline-flex items-center gap-1 rounded-md bg-status-info-bg px-2 py-0.5 text-xs font-bold text-status-info-fg ring-1 ring-inset ring-status-info-solid/20">
                    <BuildingStorefrontIcon className="h-3 w-3" /> {loja.filial || 'Matriz'}
                </span>
                <div className="mt-1 ml-1 text-[10px] text-content-muted">{loja.name}</div>
            </div>
        );
    };

    /* ---------- Colunas da tabela ---------- */
    const colunas = [
        {
            key: 'chassi',
            header: 'Chassi / ID',
            render: (moto) => (
                <div>
                    <div className="font-mono font-bold tracking-wide text-content-primary">
                        {moto.chassi}
                    </div>
                    <div className="text-xs text-content-muted">ID: #{moto.id}</div>
                </div>
            ),
        },
        {
            key: 'modelo',
            header: 'Modelo',
            render: (moto) => (
                <div>
                    <div className="font-bold text-content-primary">{moto.modelo}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-surface-sunken px-2 py-0.5 text-xs capitalize text-content-secondary ring-1 ring-inset ring-line">
                            {moto.cor}
                        </span>
                        {moto.ano_fabricacao && (
                            <span className="text-xs text-content-muted">Ano: {moto.ano_fabricacao}</span>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'dono',
            header: 'Loja atual',
            render: (moto) => <DonoAtual moto={moto} />,
        },
        {
            key: 'status',
            header: 'Localização / Status',
            render: (moto) => (
                <div>
                    <StatusBadge status={moto.status} size="sm" />
                    <div
                        className="mt-1 flex max-w-[200px] items-center gap-1 truncate text-xs text-content-secondary"
                        title={moto.localizacao_atual}
                    >
                        <MapPinIcon className="h-3 w-3 shrink-0" />
                        {moto.localizacao_atual || 'Não informado'}
                    </div>
                </div>
            ),
        },
        {
            key: 'acoes',
            header: '',
            align: 'right',
            render: (moto) => {
                const pedidoAtual = moto.pedidos?.length ? moto.pedidos[0] : null;

                return (
                    <div className="flex justify-end gap-2">
                        {pedidoAtual && (
                            <Button href={route('pedidos.show', pedidoAtual.id)} variant="secondary" size="sm">
                                Ver pedido
                            </Button>
                        )}
                        <Link
                            href={route('motos.timeline', { chassi: moto.chassi })}
                            title="Histórico completo do chassi"
                            className="rounded-lg p-1.5 text-content-muted transition hover:bg-surface-sunken hover:text-content-primary"
                        >
                            <ClockIcon className="h-5 w-5" />
                        </Link>
                    </div>
                );
            },
        },
    ];

    return (
        <AppLayout user={auth.user}>
            <Head title="Motos" />

            <PageHeader
                title="Estoque de Motos"
                description="Histórico de movimentação do sistema e pátio do CD em tempo real."
                breadcrumbs={[{ label: 'Motos' }, { label: 'Estoque' }]}
                actions={
                    !isLoja && (
                        <Button href={route('motos.timeline')} variant="secondary" icon={MagnifyingGlassIcon}>
                            Timeline
                        </Button>
                    )
                }
            />

            <Tabs tabs={abas} active={abaAtiva} onChange={setAbaAtiva} className="mb-6" />

            {abaAtiva === 'fabrica' ? (
                <div className="animate-fade-in-up">
                    <StockTable user={auth.user} />
                </div>
            ) : (
                <div className="animate-fade-in-up space-y-6">
                    {/* ---------- FILTROS ---------- */}
                    <Card>
                        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-4">
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase text-content-secondary">
                                    Buscar
                                </label>
                                <input
                                    type="text"
                                    className={classeCampo}
                                    placeholder="Chassi ou modelo…"
                                    value={params.search}
                                    onChange={(e) => setParams({ ...params, search: e.target.value })}
                                    onKeyDown={handleKeyDown}
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase text-content-secondary">
                                    Loja
                                </label>
                                <select
                                    className={classeCampo}
                                    value={params.loja_id}
                                    onChange={(e) => {
                                        const novo = e.target.value;
                                        setParams((prev) => ({ ...prev, loja_id: novo }));
                                        router.get(
                                            route('motos.index'),
                                            { ...params, loja_id: novo },
                                            { preserveState: true, replace: true }
                                        );
                                    }}
                                >
                                    <option value="">Todas as lojas</option>
                                    {lojas.map((loja) => (
                                        <option key={loja.id} value={loja.id}>
                                            {loja.filial} — {loja.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase text-content-secondary">
                                    Status
                                </label>
                                <select
                                    className={classeCampo}
                                    value={params.status}
                                    onChange={(e) => setParams({ ...params, status: e.target.value })}
                                >
                                    <option value="">Todos</option>
                                    <option value="estoque_fabrica">Estoque Fábrica</option>
                                    <option value="estoque_loja">Estoque Loja</option>
                                    <option value="vendida">Vendida</option>
                                    <option value="reservado">Reservado</option>
                                    <option value="separado">Separado</option>
                                    <option value="em_transito">Em Trânsito</option>
                                    <option value="avariado">Avariado</option>
                                </select>
                            </div>

                            <div className="flex gap-2">
                                <Button icon={FunnelIcon} onClick={applyFilters} className="flex-1 justify-center">
                                    Filtrar
                                </Button>
                                {temFiltro && (
                                    <Button variant="secondary" onClick={clearFilters} title="Limpar filtros">
                                        <XMarkIcon className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* ---------- DESKTOP ---------- */}
                    <Card padding="none" className="hidden md:block">
                        <DataTable
                            columns={colunas}
                            rows={motos.data}
                            emptyIcon={MagnifyingGlassIcon}
                            emptyTitle="Nenhuma moto encontrada"
                            emptyDescription={
                                temFiltro
                                    ? 'Nenhum resultado para os filtros aplicados.'
                                    : 'Ainda não há motos registradas no histórico do sistema.'
                            }
                            emptyAction={
                                temFiltro && (
                                    <Button variant="secondary" onClick={clearFilters}>
                                        Limpar filtros
                                    </Button>
                                )
                            }
                        />
                    </Card>

                    {/* ---------- MOBILE ---------- */}
                    <div className="space-y-3 md:hidden">
                        {motos.data.length > 0 ? (
                            motos.data.map((moto) => {
                                const pedidoAtual = moto.pedidos?.length ? moto.pedidos[0] : null;

                                return (
                                    <div
                                        key={moto.id}
                                        className="rounded-card bg-surface-card p-4 shadow-card ring-1 ring-line"
                                    >
                                        <div className="mb-3 flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="truncate font-mono text-lg font-black leading-none tracking-wider text-content-primary">
                                                    {moto.chassi}
                                                </div>
                                                <div className="mt-1 text-xs font-bold uppercase text-content-muted">
                                                    ID: #{moto.id}
                                                </div>
                                            </div>

                                            <Link
                                                href={route('motos.timeline', { chassi: moto.chassi })}
                                                className="shrink-0 rounded-lg bg-surface-sunken p-2 text-content-secondary transition hover:text-content-primary"
                                            >
                                                <ClockIcon className="h-5 w-5" />
                                            </Link>
                                        </div>

                                        <div className="mb-3 rounded-lg bg-surface-sunken p-3">
                                            <div className="mb-1 text-sm font-bold text-content-primary">
                                                {moto.modelo}
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                <span className="rounded bg-surface-card px-2 py-0.5 text-[10px] font-bold uppercase text-content-secondary ring-1 ring-inset ring-line">
                                                    {moto.cor}
                                                </span>
                                                {moto.ano_fabricacao && (
                                                    <span className="rounded bg-surface-card px-2 py-0.5 text-[10px] font-bold uppercase text-content-muted ring-1 ring-inset ring-line">
                                                        Ano: {moto.ano_fabricacao}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-end justify-between gap-2">
                                            <div className="flex min-w-0 flex-col gap-2">
                                                <StatusBadge status={moto.status} size="sm" />
                                                <div
                                                    className="flex items-center gap-1 truncate text-[10px] font-bold text-content-secondary"
                                                    title={moto.localizacao_atual}
                                                >
                                                    <MapPinIcon className="h-3 w-3 shrink-0 text-content-muted" />
                                                    {moto.localizacao_atual || 'Não informado'}
                                                </div>
                                            </div>

                                            {pedidoAtual && (
                                                <Button
                                                    href={route('pedidos.show', pedidoAtual.id)}
                                                    variant="secondary"
                                                    size="sm"
                                                >
                                                    Ver pedido
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <Card>
                                <EmptyState
                                    icon={MagnifyingGlassIcon}
                                    title="Nenhuma moto encontrada"
                                    description={temFiltro ? 'Tente outros filtros.' : undefined}
                                />
                            </Card>
                        )}
                    </div>

                    {/* ---------- PAGINAÇÃO ---------- */}
                    {motos.links.length > 3 && (
                        <div className="flex flex-wrap justify-center gap-1">
                            {motos.links.map((link, i) => (
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
                </div>
            )}
        </AppLayout>
    );
}
