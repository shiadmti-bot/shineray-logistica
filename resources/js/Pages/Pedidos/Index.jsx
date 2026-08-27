import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, useForm, router } from '@inertiajs/react';
import { useEffect } from 'react';
import Swal from 'sweetalert2';
import {
    BuildingOffice2Icon,
    BuildingStorefrontIcon,
    MapPinIcon,
    PlusIcon,
    MagnifyingGlassIcon,
    ExclamationTriangleIcon,
    ArrowUpOnSquareIcon,
    ArrowDownOnSquareIcon,
    ArrowsRightLeftIcon,
    WrenchScrewdriverIcon,
    ArrowRightIcon,
    ArrowLongDownIcon,
    InboxIcon,
} from '@heroicons/react/24/outline';

import { Card, PageHeader, Button, StatusBadge, EmptyState } from '@/Components/UI';

/**
 * Gerenciamento de Pedidos — repaginado para o design system v3.
 *
 * A lógica é a mesma: notificações via Echo, filtros, destaque de
 * transferências que exigem ação e o indicador de embarque parcial. O que
 * mudou é a camada visual — as ~11 paletas de status escritas à mão aqui
 * (roxo, ciano, teal, esmeralda…) deram lugar ao StatusBadge central, que é
 * a mesma marcação usada em Peças e Cargas.
 *
 * Mantém as duas apresentações: tabela no desktop, cartão no celular. O CD e
 * o motorista usam o celular, e uma tabela rolando de lado não serve para eles.
 */
export default function PedidosIndex({ auth, pedidos, perfil, filters, lojas }) {
    const safePedidos = pedidos || { data: [], links: [], total: 0 };

    // Transferências em que ESTA loja é a origem: exigem separação física.
    const transferenciasAEnviar = safePedidos.data.filter(
        (p) =>
            p.origem_user_id === auth.user.id &&
            ['solicitado', 'aprovado', 'separado', 'aguardando_coleta'].includes(p.status)
    );

    const listaPrincipal = safePedidos.data;

    const { data, setData, get, processing } = useForm({
        search: filters?.search || '',
        data_inicio: filters?.data_inicio || '',
        data_fim: filters?.data_fim || '',
        status: filters?.status || '',
        loja_id: filters?.loja_id || '',
    });

    const temFiltro = data.search || data.data_inicio || data.data_fim || data.status || data.loja_id;

    // --- Notificações em tempo real ---
    useEffect(() => {
        if (!auth.user?.id || !window.Echo) return;
        const channel = window.Echo.private(`App.Models.User.${auth.user.id}`);

        channel.notification((notification) => {
            try {
                const audio = new Audio('/plim.mp3');
                audio.play().catch(() => {});
            } catch (e) {}

            Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 4000,
                timerProgressBar: true,
            }).fire({
                icon: 'info',
                title: 'Atualização Logística',
                text: notification.mensagem || 'Status atualizado.',
            });

            router.reload({ only: ['pedidos'] });
        });

        return () => channel.stopListening('Notification');
    }, [auth.user?.id]);

    const handleSearch = (e) => {
        e.preventDefault();
        get(route('pedidos.index'), { preserveState: true, preserveScroll: true });
    };

    const clearSearch = () => {
        setData({ search: '', data_inicio: '', data_fim: '', status: '', loja_id: '' });
        router.get(route('pedidos.index'), {}, { preserveState: true });
    };

    const classeCampo =
        'w-full rounded-lg border-line bg-surface-card text-xs py-2 text-content-primary focus:border-brand-500 focus:ring-brand-500';

    return (
        <AppLayout user={auth.user}>
            <Head title="Pedidos" />

            <PageHeader
                title="Gerenciamento de Pedidos"
                description={`${safePedidos.total} pedido(s) no total.`}
                breadcrumbs={[{ label: 'Logística' }, { label: 'Pedidos' }]}
                actions={
                    perfil === 'loja' && (
                        <Button href={route('solicitar')} icon={PlusIcon}>
                            Nova Solicitação
                        </Button>
                    )
                }
            />

            {/* ---------- FILTROS ---------- */}
            <Card padding="none" className="mb-6">
                <form onSubmit={handleSearch} className="grid grid-cols-1 gap-2 p-4 md:grid-cols-12">
                    <div className="relative md:col-span-4">
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                        <input
                            type="text"
                            className={`${classeCampo} pl-9`}
                            placeholder="Buscar ID, chassi ou loja…"
                            value={data.search}
                            onChange={(e) => setData('search', e.target.value)}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <input
                            type="date"
                            className={classeCampo}
                            value={data.data_inicio}
                            onChange={(e) => setData('data_inicio', e.target.value)}
                            title="Data início"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <input
                            type="date"
                            className={classeCampo}
                            value={data.data_fim}
                            onChange={(e) => setData('data_fim', e.target.value)}
                            title="Data fim"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <select
                            className={classeCampo}
                            value={data.status}
                            onChange={(e) => setData('status', e.target.value)}
                        >
                            <option value="">Status: todos</option>
                            <option value="em_analise">Em Análise</option>
                            <option value="solicitado">Solicitado</option>
                            <option value="separado">Separado</option>
                            <option value="aguardando_coleta">Aguard. Coleta</option>
                            <option value="em_transito">Em Trânsito</option>
                            <option value="concluido">Concluído</option>
                            <option value="cancelado">Cancelado</option>
                        </select>
                    </div>

                    {lojas && lojas.length > 0 && (
                        <div className="md:col-span-2">
                            <select
                                className={classeCampo}
                                value={data.loja_id}
                                onChange={(e) => setData('loja_id', e.target.value)}
                            >
                                <option value="">Loja: todas</option>
                                {lojas.map((l) => (
                                    <option key={l.id} value={l.id}>
                                        {l.filial}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 md:col-span-12">
                        {temFiltro && (
                            <Button variant="ghost" size="sm" onClick={clearSearch} type="button">
                                Limpar filtros
                            </Button>
                        )}
                        <Button type="submit" size="sm" loading={processing}>
                            Filtrar
                        </Button>
                    </div>
                </form>
            </Card>

            {/* ---------- AÇÃO PENDENTE: TRANSFERÊNCIAS A ENVIAR ---------- */}
            {transferenciasAEnviar.length > 0 && (
                <Card
                    padding="none"
                    className="mb-6 border-l-4 border-l-status-warning-solid"
                    title="Transferências pendentes"
                    subtitle="Estas motos saem da sua loja e precisam ser separadas."
                    actions={
                        <span className="rounded-full bg-status-warning-solid px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                            {transferenciasAEnviar.length} ação(ões)
                        </span>
                    }
                >
                    <div className="divide-y divide-line">
                        {transferenciasAEnviar.map((p) => (
                            <div
                                key={p.id}
                                className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="rounded-lg bg-status-warning-bg px-2.5 py-1.5 font-black text-status-warning-fg">
                                        #{p.id}
                                    </span>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted">
                                            Enviar para
                                        </p>
                                        <p className="font-bold text-content-primary">{p.user?.filial}</p>
                                    </div>
                                </div>

                                <Button
                                    href={route('pedidos.show', p.id)}
                                    size="sm"
                                    icon={ArrowRightIcon}
                                    iconRight
                                    className="w-full justify-center sm:w-auto"
                                >
                                    Resolver agora
                                </Button>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* ---------- LISTA (DESKTOP) ---------- */}
            <Card padding="none" className="hidden md:block">
                {listaPrincipal.length > 0 ? (
                    <div className="overflow-x-auto scrollbar-slim">
                        <table className="min-w-full divide-y divide-line">
                            <thead className="bg-surface-sunken">
                                <tr>
                                    {['ID / Tipo', 'Fluxo logístico', 'Volume', 'Status', ''].map((h, i) => (
                                        <th
                                            key={i}
                                            className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-content-secondary
                                                ${i === 2 ? 'text-center' : i === 4 ? 'text-right' : 'text-left'}`}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-line bg-surface-card">
                                {listaPrincipal.map((pedido) => (
                                    <tr key={pedido.id} className="group transition hover:bg-surface-sunken/60">
                                        <td className="whitespace-nowrap px-4 py-3 align-top">
                                            <div className="font-black text-content-primary transition group-hover:text-brand-700">
                                                #{pedido.id}
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                <ProdutoBadge pedido={pedido} />
                                                <TipoBadge pedido={pedido} authId={auth.user.id} />
                                            </div>
                                            <div className="mt-1 text-[10px] text-content-muted">
                                                {new Date(pedido.created_at).toLocaleDateString()}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 align-top">
                                            <FluxoLogistico pedido={pedido} authId={auth.user.id} />
                                        </td>

                                        <td className="px-4 py-3 text-center align-middle">
                                            <VolumeIndicator pedido={pedido} />
                                        </td>

                                        <td className="px-4 py-3 align-middle">
                                            <StatusBadge status={pedido.status} size="sm" />
                                            <EmbarqueParcial pedido={pedido} />
                                            <BarraProgresso status={pedido.status} />
                                        </td>

                                        <td className="px-4 py-3 text-right align-middle">
                                            <Button href={route('pedidos.show', pedido.id)} variant="secondary" size="sm">
                                                Abrir
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        icon={InboxIcon}
                        title="Nenhum pedido encontrado"
                        description={
                            temFiltro
                                ? 'Nenhum resultado para os filtros aplicados.'
                                : 'Ainda não há pedidos registrados.'
                        }
                        action={
                            temFiltro && (
                                <Button variant="secondary" onClick={clearSearch}>
                                    Limpar filtros
                                </Button>
                            )
                        }
                    />
                )}
            </Card>

            {/* ---------- LISTA (MOBILE) ---------- */}
            <div className="space-y-3 md:hidden">
                {listaPrincipal.length > 0 ? (
                    listaPrincipal.map((pedido) => (
                        <Link
                            key={pedido.id}
                            href={route('pedidos.show', pedido.id)}
                            className="block rounded-card bg-surface-card p-4 shadow-card ring-1 ring-line transition active:scale-[0.99]"
                        >
                            <div className="mb-3 flex items-start justify-between">
                                <div>
                                    <span className="text-lg font-black leading-none text-content-primary">
                                        #{pedido.id}
                                    </span>
                                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-content-muted">
                                        {new Date(pedido.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="flex flex-wrap justify-end gap-1">
                                    <ProdutoBadge pedido={pedido} />
                                    <TipoBadge pedido={pedido} authId={auth.user.id} />
                                </div>
                            </div>

                            <div className="mb-3 rounded-lg bg-surface-sunken p-3">
                                <FluxoLogistico pedido={pedido} authId={auth.user.id} />
                            </div>

                            <div className="flex flex-col gap-2 border-t border-line pt-3">
                                <div className="flex items-center justify-between">
                                    <StatusBadge status={pedido.status} size="sm" />
                                    <VolumeIndicator pedido={pedido} />
                                </div>
                                <EmbarqueParcial pedido={pedido} />
                            </div>
                        </Link>
                    ))
                ) : (
                    <Card>
                        <EmptyState icon={InboxIcon} title="Nenhum pedido encontrado" />
                    </Card>
                )}
            </div>

            {/* ---------- PAGINAÇÃO ---------- */}
            {safePedidos.links && safePedidos.links.length > 3 && (
                <div className="mt-6 flex flex-wrap justify-center gap-1">
                    {safePedidos.links.map((link, k) => (
                        <Link
                            key={k}
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

/* ================= SUBCOMPONENTES ================= */

/**
 * Origem → destino do pedido, destacando o lado que é o usuário logado.
 * Saber "isto sai de mim" ou "isto vem para mim" é o que define a ação.
 */
function FluxoLogistico({ pedido, authId }) {
    const souOrigem = pedido.origem_user_id === authId;
    const souDestino = pedido.user_id === authId;
    const ehReposicao = !pedido.origem_user_id; // veio do CD

    const marca = (destaque) =>
        `inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${
            destaque
                ? 'bg-status-warning-bg text-status-warning-fg ring-status-warning-solid/20'
                : 'bg-surface-sunken text-content-secondary ring-line'
        }`;

    return (
        <div className="flex w-full flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase text-content-muted">Origem</span>
                {ehReposicao ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-status-info-bg px-2 py-0.5 text-xs font-bold text-status-info-fg ring-1 ring-inset ring-status-info-solid/20">
                        <BuildingOffice2Icon className="h-3 w-3" /> CD Matriz
                    </span>
                ) : (
                    <span className={marca(souOrigem)}>
                        <BuildingStorefrontIcon className="h-3 w-3" />
                        {pedido.origem?.filial} {souOrigem && '(você)'}
                    </span>
                )}
            </div>

            <ArrowLongDownIcon className="h-3 w-3 self-center text-content-muted opacity-40" />

            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase text-content-muted">Destino</span>
                <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${
                        souDestino
                            ? 'bg-status-success-bg text-status-success-fg ring-status-success-solid/20'
                            : 'bg-surface-sunken text-content-secondary ring-line'
                    }`}
                >
                    <MapPinIcon className="h-3 w-3" />
                    {pedido.destino_final || pedido.user?.filial || pedido.user?.name}{' '}
                    {souDestino && '(você)'}
                </span>
            </div>
        </div>
    );
}

/** Reposição (vem do CD) x transferência entre lojas, e de que lado o usuário está. */
/**
 * Que produto o pedido carrega.
 *
 * A logística é uma só, mas moto e peça têm processos distintos até o envio —
 * chassi contra saldo, atribuição contra basqueta. Sem esta marca, um pedido de
 * peça se parece com um de moto na lista e o número ao lado ("12") é lido como
 * doze motos, quando são doze unidades de peça.
 *
 * Só aparece para peça: moto é o caso dominante e marcar os dois viraria ruído.
 */
function ProdutoBadge({ pedido }) {
    if (pedido.tipo_carga !== 'peca') return null;

    return (
        <span className="inline-flex w-fit items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand-700 ring-1 ring-inset ring-brand-500/25">
            <WrenchScrewdriverIcon className="h-3 w-3" /> Peças
        </span>
    );
}

function TipoBadge({ pedido, authId }) {
    const ehTransferencia =
        pedido.origem_user_id && pedido.origem && pedido.origem.perfil === 'loja';

    const base =
        'inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ring-1 ring-inset';

    if (ehTransferencia) {
        if (pedido.origem_user_id === authId) {
            return (
                <span className={`${base} bg-status-warning-bg text-status-warning-fg ring-status-warning-solid/20`}>
                    <ArrowUpOnSquareIcon className="h-3 w-3" /> Saída
                </span>
            );
        }

        if (pedido.user_id === authId) {
            return (
                <span className={`${base} bg-status-success-bg text-status-success-fg ring-status-success-solid/20`}>
                    <ArrowDownOnSquareIcon className="h-3 w-3" /> Entrada
                </span>
            );
        }

        return (
            <span className={`${base} bg-status-neutral-bg text-status-neutral-fg ring-status-neutral-solid/20`}>
                <ArrowsRightLeftIcon className="h-3 w-3" /> Transf.
            </span>
        );
    }

    return (
        <span className={`${base} bg-status-info-bg text-status-info-fg ring-status-info-solid/20`}>
            <BuildingOffice2Icon className="h-3 w-3" /> Reposição
        </span>
    );
}

const paraTexto = (v) => String(v || '').toLowerCase();

/**
 * Embarque parcial: parte das motos do pedido já saiu, parte segue no CD.
 * Sem esse aviso, o pedido aparece como "em trânsito" e a loja espera o total.
 */
function ehEmbarqueParcial(pedido) {
    const total = pedido.motos_count || 0;
    const pendentes = pedido.motos_separadas_count ?? 0;
    const embarcadas = total - pendentes;

    return (
        ['em_transito', 'expedido', 'coletado', 'em_transito_cd', 'separado', 'solicitado'].includes(paraTexto(pedido.status)) &&
        pendentes > 0 &&
        embarcadas > 0
    );
}

function VolumeIndicator({ pedido }) {
    const total = pedido.motos_count || 0;
    const pendentes = pedido.motos_separadas_count ?? 0;
    const embarcadas = total - pendentes;

    if (ehEmbarqueParcial(pedido)) {
        const circunferencia = 94.2; // 2πr, r = 15

        return (
            <div className="inline-flex flex-col items-center gap-0.5">
                <div className="relative inline-flex h-9 w-9 items-center justify-center">
                    <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-line" />
                        <circle
                            cx="18"
                            cy="18"
                            r="15"
                            fill="none"
                            strokeWidth="3"
                            strokeLinecap="round"
                            className="stroke-status-warning-solid transition-all duration-700"
                            strokeDasharray={`${(embarcadas / total) * circunferencia} ${circunferencia}`}
                        />
                    </svg>
                    <span className="absolute text-[10px] font-black text-status-warning-fg">
                        {embarcadas}/{total}
                    </span>
                </div>
                <span className="text-[8px] font-bold uppercase leading-none text-status-warning-fg">
                    Parcial
                </span>
            </div>
        );
    }

    return (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-sunken text-sm font-bold text-content-secondary ring-1 ring-inset ring-line">
            {total}
        </span>
    );
}

function EmbarqueParcial({ pedido }) {
    if (!ehEmbarqueParcial(pedido)) return null;

    const pendentes = pedido.motos_separadas_count ?? 0;

    return (
        <div className="mt-1.5 flex w-fit items-center gap-1.5 rounded-md bg-status-warning-bg px-2 py-1 ring-1 ring-inset ring-status-warning-solid/20">
            <ExclamationTriangleIcon className="h-3 w-3 shrink-0 text-status-warning-fg" />
            <span className="text-[9px] font-bold uppercase tracking-wide text-status-warning-fg">
                Embarque parcial · {pendentes} no CD
            </span>
        </div>
    );
}

/**
 * Progresso do pedido ao longo do fluxo, de solicitado a concluído.
 * Dá noção de "quanto falta" sem precisar abrir o detalhe.
 */
function BarraProgresso({ status }) {
    const etapas = {
        em_analise: 0.5,
        solicitado: 1,
        separado: 2,
        aguardando_rota: 2.3,
        rota_confirmada: 2.6,
        aguardando_coleta: 2.8,
        coletado: 3.5,
        expedido: 3.5,
        em_transito: 4,
        concluido: 5,
    };

    const s = paraTexto(status);
    const etapa = etapas[s] ?? 1;

    const cor =
        s === 'cancelado'
            ? 'bg-status-danger-solid'
            : s === 'concluido'
              ? 'bg-status-success-solid'
              : 'bg-status-info-solid';

    return (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
                className={`h-full transition-all duration-700 ${cor}`}
                style={{ width: `${(etapa / 5) * 100}%` }}
            />
        </div>
    );
}
