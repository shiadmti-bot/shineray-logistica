import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    TruckIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    PlusIcon,
    WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

import { Card, PageHeader, Button, StatusBadge, EmptyState } from '@/Components/UI';

/**
 * Histórico de cargas — repaginado para o design system v3.
 *
 * A carga passou a ser mista (motos + peças no mesmo romaneio), então a coluna
 * de volume mostra os dois. Antes exibia só `motos_count`, e uma carga que
 * levasse apenas peças aparecia como "0" — parecendo vazia.
 */
export default function RomaneioIndex({ auth, romaneios, filters }) {
    const safeRomaneios = romaneios || { data: [], links: [], total: 0 };

    const { data, setData, get, processing } = useForm({
        search: filters?.search || '',
        data_inicio: filters?.data_inicio || '',
        data_fim: filters?.data_fim || '',
        status: filters?.status || '',
    });

    const temFiltro = data.search || data.data_inicio || data.data_fim || data.status;

    const handleSearch = (e) => {
        e.preventDefault();
        get(route('romaneios.index'), { preserveState: true, preserveScroll: true });
    };

    const clearSearch = () => {
        setData({ search: '', data_inicio: '', data_fim: '', status: '' });
        get(route('romaneios.index'), {}, { preserveState: true });
    };

    const classeCampo =
        'w-full rounded-lg border-line bg-surface-card py-2 text-sm text-content-primary focus:border-brand-500 focus:ring-brand-500';

    return (
        <AppLayout user={auth.user}>
            <Head title="Cargas e Romaneios" />

            <PageHeader
                title="Cargas e Romaneios"
                description={`${safeRomaneios.total} carga(s) no histórico.`}
                breadcrumbs={[{ label: 'Logística' }, { label: 'Cargas' }]}
                actions={
                    ['cd', 'admin'].includes(auth.user.perfil) && (
                        <Button href={route('romaneios.create')} icon={PlusIcon}>
                            Nova Expedição
                        </Button>
                    )
                }
            />

            {/* ---------- FILTROS ---------- */}
            <Card padding="none" className="mb-6">
                <form onSubmit={handleSearch} className="grid grid-cols-1 items-end gap-3 p-4 md:grid-cols-12">
                    <div className="md:col-span-4">
                        <label className="mb-1 block text-xs font-bold uppercase text-content-secondary">
                            Busca rápida
                        </label>
                        <div className="relative">
                            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                            <input
                                type="text"
                                className={`${classeCampo} pl-9`}
                                placeholder="Placa, motorista ou rota…"
                                value={data.search}
                                onChange={(e) => setData('search', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-bold uppercase text-content-secondary">De</label>
                        <input
                            type="date"
                            className={classeCampo}
                            value={data.data_inicio}
                            onChange={(e) => setData('data_inicio', e.target.value)}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-bold uppercase text-content-secondary">Até</label>
                        <input
                            type="date"
                            className={classeCampo}
                            value={data.data_fim}
                            onChange={(e) => setData('data_fim', e.target.value)}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-bold uppercase text-content-secondary">
                            Status
                        </label>
                        <select
                            className={classeCampo}
                            value={data.status}
                            onChange={(e) => setData('status', e.target.value)}
                        >
                            <option value="">Todos</option>
                            <option value="aberto">Em Aberto</option>
                            <option value="expedido">Carregando</option>
                            <option value="em_transito">Em Trânsito</option>
                            <option value="concluido">Concluído</option>
                        </select>
                    </div>

                    <div className="flex gap-2 md:col-span-2">
                        <Button type="submit" loading={processing} className="flex-1 justify-center">
                            Filtrar
                        </Button>
                        {temFiltro && (
                            <Button variant="secondary" type="button" onClick={clearSearch} title="Limpar filtros">
                                <XMarkIcon className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </form>
            </Card>

            {/* ---------- MOBILE ---------- */}
            <div className="space-y-3 md:hidden">
                {safeRomaneios.data.length > 0 ? (
                    safeRomaneios.data.map((romaneio) => (
                        <Link
                            key={romaneio.id}
                            href={route('romaneios.show', romaneio.id)}
                            className="relative block overflow-hidden rounded-card bg-surface-card p-4 pl-5 shadow-card ring-1 ring-line transition active:scale-[0.99]"
                        >
                            <span
                                className={`absolute inset-y-0 left-0 w-1.5 ${corDoStatus(romaneio.status)}`}
                            />

                            <div className="mb-3 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <span className="text-lg font-black text-content-primary">
                                        #{String(romaneio.id).padStart(6, '0')}
                                    </span>
                                    <div className="mt-1 text-sm font-bold text-content-secondary">
                                        {romaneio.motorista || 'Motorista não informado'}
                                    </div>
                                    <span className="mt-1 inline-block rounded bg-surface-sunken px-2 py-0.5 font-mono text-xs uppercase text-content-secondary ring-1 ring-inset ring-line">
                                        {romaneio.placa || 'sem placa'}
                                    </span>
                                </div>

                                <Volume romaneio={romaneio} />
                            </div>

                            <div className="mb-1 flex items-end justify-between">
                                <StatusBadge status={romaneio.status} size="sm" />
                                <span className="text-[10px] font-bold text-content-muted">
                                    {romaneio.created_at
                                        ? new Date(romaneio.created_at).toLocaleDateString()
                                        : '-'}
                                </span>
                            </div>

                            <BarraProgresso status={romaneio.status} />
                        </Link>
                    ))
                ) : (
                    <Card>
                        <EmptyState icon={TruckIcon} title="Nenhuma carga encontrada" />
                    </Card>
                )}
            </div>

            {/* ---------- DESKTOP ---------- */}
            <Card padding="none" className="hidden md:block">
                {safeRomaneios.data.length > 0 ? (
                    <div className="overflow-x-auto scrollbar-slim">
                        <table className="min-w-full divide-y divide-line">
                            <thead className="bg-surface-sunken">
                                <tr>
                                    {['ID / Data', 'Transporte', 'Volume', 'Status da carga', ''].map((h, i) => (
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
                                {safeRomaneios.data.map((romaneio) => (
                                    <tr key={romaneio.id} className="group transition hover:bg-surface-sunken/60">
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <div className="font-black text-content-primary transition group-hover:text-brand-700">
                                                #{String(romaneio.id).padStart(6, '0')}
                                            </div>
                                            <div className="mt-0.5 text-xs text-content-muted">
                                                {romaneio.created_at
                                                    ? new Date(romaneio.created_at).toLocaleDateString()
                                                    : '-'}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3">
                                            <div className="text-sm font-bold text-content-primary">
                                                {romaneio.motorista || 'Sem motorista'}
                                            </div>
                                            <div className="mt-0.5 font-mono text-xs text-content-secondary">
                                                {romaneio.placa || 'SEM PLACA'}
                                                {romaneio.transportadora ? ` · ${romaneio.transportadora}` : ''}
                                                {romaneio.rota ? ` · ${romaneio.rota}` : ''}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                            <Volume romaneio={romaneio} />
                                        </td>

                                        <td className="w-1/4 px-4 py-3">
                                            <StatusBadge status={romaneio.status} size="sm" />
                                            <BarraProgresso status={romaneio.status} />
                                        </td>

                                        <td className="whitespace-nowrap px-4 py-3 text-right">
                                            <Button
                                                href={route('romaneios.show', romaneio.id)}
                                                variant="secondary"
                                                size="sm"
                                            >
                                                Inspecionar
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState
                        icon={TruckIcon}
                        title="Nenhuma carga encontrada"
                        description={
                            temFiltro
                                ? 'Nenhum resultado para os filtros aplicados.'
                                : 'As cargas montadas na expedição aparecem aqui.'
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

            {/* ---------- PAGINAÇÃO ---------- */}
            {safeRomaneios.links && safeRomaneios.links.length > 3 && (
                <div className="mt-6 flex flex-wrap justify-center gap-1">
                    {safeRomaneios.links.map((link, k) => (
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
 * Volume da carga: motos e peças.
 *
 * Carga mista é o caso normal desde a v3 — mostrar só motos faria uma carga de
 * peças parecer vazia. As peças aparecem em UNIDADES (não em linhas), que é o
 * número que importa para quem carrega o caminhão.
 */
function Volume({ romaneio }) {
    const motos = romaneio.motos_count || 0;
    const pecas = romaneio.pecas_unidades || 0;

    if (!motos && !pecas) {
        return <span className="text-xs text-content-muted">vazia</span>;
    }

    return (
        <div className="inline-flex items-center gap-1.5">
            {motos > 0 && (
                <span
                    title={`${motos} moto(s)`}
                    className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-sm font-bold text-content-secondary ring-1 ring-inset ring-line"
                >
                    <TruckIcon className="h-3.5 w-3.5" />
                    {motos}
                </span>
            )}

            {pecas > 0 && (
                <span
                    title={`${pecas} unidade(s) de peça`}
                    className="inline-flex items-center gap-1 rounded-full bg-status-info-bg px-2.5 py-1 text-sm font-bold text-status-info-fg ring-1 ring-inset ring-status-info-solid/20"
                >
                    <WrenchScrewdriverIcon className="h-3.5 w-3.5" />
                    {pecas}
                </span>
            )}
        </div>
    );
}

const paraTexto = (v) => String(v ?? '').toLowerCase();

/** Etapa da carga no fluxo, de aberta a concluída com cores semânticas vibrantes. */
function BarraProgresso({ status }) {
    const etapas = {
        aberto: 1,
        carregado: 1.5,
        aguardando_saida: 1.8,
        expedido: 2.2,
        em_transito: 3.2,
        concluido: 4,
        cancelado: 4,
        retornado: 4,
    };
    const s = paraTexto(status);

    return (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
                className={`h-full transition-all duration-700 ${corDoStatus(status)}`}
                style={{ width: `${((etapas[s] ?? 1) / 4) * 100}%` }}
            />
        </div>
    );
}

function corDoStatus(status) {
    const s = paraTexto(status);
    const mapaCores = {
        aberto: 'bg-amber-500',
        carregado: 'bg-indigo-500',
        aguardando_saida: 'bg-pink-500',
        expedido: 'bg-cyan-500',
        em_transito: 'bg-blue-600',
        concluido: 'bg-emerald-600',
        cancelado: 'bg-rose-500',
        retornado: 'bg-rose-500',
    };

    return mapaCores[s] || 'bg-brand-600';
}
