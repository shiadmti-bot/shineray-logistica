import AppLayout from '@/Layouts/AppLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import {
    BuildingStorefrontIcon,
    MapPinIcon,
    PlusIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    TrashIcon,
    CheckCircleIcon,
    XCircleIcon,
    UsersIcon,
    WrenchScrewdriverIcon,
    ArrowPathIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

import { Card, PageHeader, Button, StatCard, EmptyState } from '@/Components/UI';

export default function FiliaisIndex({ auth, filiais, stats, filters, todasUfs = [] }) {
    const [searchTerm, setSearchTerm] = useState(filters?.search || '');
    const [modalAberto, setModalAberto] = useState(false);
    const [filialEdicao, setFilialEdicao] = useState(null);

    // Formulário do Modal (Criação / Edição)
    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        nome: '',
        cidade: '',
        uf: 'PA',
        codigo_empresa: '',
        ativo: true,
        participa_pecas: true,
    });

    const safeFiliais = filiais || { data: [], links: [], total: 0 };
    const lista = safeFiliais.data || [];

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(
            route('filiais.index'),
            {
                ...filters,
                search: searchTerm,
            },
            { preserveState: true, replace: true }
        );
    };

    const handleFilterStatus = (novoStatus) => {
        router.get(
            route('filiais.index'),
            {
                ...filters,
                status: novoStatus,
                search: searchTerm,
            },
            { preserveState: true, replace: true }
        );
    };

    const handleFilterUf = (novaUf) => {
        router.get(
            route('filiais.index'),
            {
                ...filters,
                uf: novaUf,
                search: searchTerm,
            },
            { preserveState: true, replace: true }
        );
    };

    const handleLimparFiltros = () => {
        setSearchTerm('');
        router.get(route('filiais.index'), {}, { replace: true });
    };

    const abrirModalCriacao = () => {
        setFilialEdicao(null);
        clearErrors();
        reset();
        setData({
            nome: '',
            cidade: '',
            uf: 'PA',
            codigo_empresa: '',
            ativo: true,
            participa_pecas: true,
        });
        setModalAberto(true);
    };

    const abrirModalEdicao = (filial) => {
        setFilialEdicao(filial);
        clearErrors();
        setData({
            nome: filial.nome,
            cidade: filial.cidade,
            uf: filial.uf,
            codigo_empresa: filial.codigo_empresa || '',
            ativo: Boolean(filial.ativo),
            participa_pecas: Boolean(filial.participa_pecas),
        });
        setModalAberto(true);
    };

    const fecharModal = () => {
        setModalAberto(false);
        setFilialEdicao(null);
        clearErrors();
        reset();
    };

    const salvarFilial = (e) => {
        e.preventDefault();
        if (filialEdicao) {
            put(route('filiais.update', filialEdicao.id), {
                onSuccess: () => fecharModal(),
            });
        } else {
            post(route('filiais.store'), {
                onSuccess: () => fecharModal(),
            });
        }
    };

    const toggleAtivo = (filial) => {
        if (filial.ativo) {
            Swal.fire({
                title: 'Desativar Filial?',
                html: `
                    <p class="text-sm text-content-secondary mb-3">Ao desativar a filial <b>${filial.nome}</b>:</p>
                    <ul class="text-left text-xs list-disc pl-5 space-y-1.5 text-content-secondary bg-surface-sunken p-3 rounded-lg border border-line">
                        <li><b>${filial.usuarios_count || 0} conta(s) de usuário vinculada(s)</b> serão <b>automaticamente arquivadas</b>;</li>
                        <li>A filial <b>sumirá das opções de envio</b> de novos pedidos e transferências;</li>
                        <li>Ficará <b>bloqueada para novos cadastros</b> de usuários até ser reativada;</li>
                        <li>Todo o histórico passado de pedidos, motos e peças permanece <b>100% íntegro e rastreável</b>.</li>
                    </ul>
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ea580c',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Sim, desativar filial',
                cancelButtonText: 'Cancelar',
            }).then((result) => {
                if (result.isConfirmed) {
                    router.patch(
                        route('filiais.toggle', filial.id),
                        {},
                        {
                            preserveScroll: true,
                        }
                    );
                }
            });
        } else {
            Swal.fire({
                title: 'Reativar Filial?',
                html: `
                    <p class="text-sm text-content-secondary mb-3">Deseja reativar a filial <b>${filial.nome}</b>?</p>
                    <ul class="text-left text-xs list-disc pl-5 space-y-1.5 text-content-secondary bg-surface-sunken p-3 rounded-lg border border-line">
                        <li>Os <b>usuários arquivados serão automaticamente restaurados</b>;</li>
                        <li>A filial <b>voltará a receber novos envios</b> e pedidos;</li>
                        <li>Voltará a estar disponível nas opções de cadastro.</li>
                    </ul>
                `,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#16a34a',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Sim, reativar filial',
                cancelButtonText: 'Cancelar',
            }).then((result) => {
                if (result.isConfirmed) {
                    router.patch(
                        route('filiais.toggle', filial.id),
                        {},
                        {
                            preserveScroll: true,
                        }
                    );
                }
            });
        }
    };

    const confirmarExclusao = (filial) => {
        Swal.fire({
            title: 'Excluir / Desativar Filial?',
            html: `
                <p class="text-sm text-content-secondary mb-2">Deseja remover <b>${filial.nome}</b>?</p>
                <p class="text-xs text-content-muted">Se houver histórico de pedidos, motos ou peças, ela será <b>desativada com segurança</b> e os usuários vinculados serão <b>automaticamente arquivados</b> para preservar a rastreabilidade.</p>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Sim, prosseguir',
            cancelButtonText: 'Cancelar',
        }).then((result) => {
            if (result.isConfirmed) {
                router.delete(route('filiais.destroy', filial.id), {
                    preserveScroll: true,
                });
            }
        });
    };

    const temFiltros = Boolean(filters?.search || (filters?.status && filters.status !== 'todas') || filters?.uf);

    // Texto de resumo de estados
    const ufsResumo = Object.entries(stats?.ufs || {})
        .map(([uf, qtd]) => `${uf}: ${qtd}`)
        .join(' · ');

    return (
        <AppLayout user={auth.user}>
            <Head title="Gerenciamento de Filiais" />

            <PageHeader
                title="Gerenciamento de Filiais"
                description="Organização e cadastro da rede de lojas, independente de contas de usuários, integradas à logística."
                breadcrumbs={[
                    { label: 'Início', href: route('dashboard') },
                    { label: 'Gestão', href: route('users.index') },
                    { label: 'Filiais' },
                ]}
                actions={
                    <Button onClick={abrirModalCriacao} icon={PlusIcon}>
                        Nova Filial
                    </Button>
                }
            />

            {/* ---------- STATS CARDS (KPIS) ---------- */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
                <StatCard
                    label="Total de Filiais"
                    value={stats?.total ?? 0}
                    icon={BuildingStorefrontIcon}
                    tone="brand"
                    hint="Lojas cadastradas"
                />
                <StatCard
                    label="Filiais Ativas"
                    value={stats?.ativas ?? 0}
                    icon={CheckCircleIcon}
                    tone="success"
                    hint="Disponíveis para pedidos"
                />
                <StatCard
                    label="Filiais Inativas"
                    value={stats?.inativas ?? 0}
                    icon={XCircleIcon}
                    tone={stats?.inativas > 0 ? 'warning' : 'neutral'}
                    hint="Desativadas temporariamente"
                />
                <StatCard
                    label="Estados Atendidos"
                    value={Object.keys(stats?.ufs || {}).length}
                    icon={MapPinIcon}
                    tone="info"
                    hint={ufsResumo || 'Sem registros'}
                />
            </div>

            {/* ---------- BARRA DE BUSCA E FILTROS ---------- */}
            <Card padding="none" className="mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 gap-3 border-b border-line bg-surface-card">
                    {/* Busca por texto */}
                    <form onSubmit={handleSearch} className="relative flex-1">
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                        <input
                            type="text"
                            placeholder="Buscar por nome da filial, cidade ou UF..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-line-strong bg-surface-canvas pl-9 pr-9 py-2 text-sm text-content-primary placeholder-content-muted focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm('');
                                    router.get(route('filiais.index'), { ...filters, search: '' }, { replace: true });
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-primary"
                            >
                                <XMarkIcon className="h-4 w-4" />
                            </button>
                        )}
                    </form>

                    {/* Filtros Dropdown */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        <select
                            value={filters?.status || 'todas'}
                            onChange={(e) => handleFilterStatus(e.target.value)}
                            className="rounded-lg border border-line-strong bg-surface-canvas px-3 py-2 text-xs font-semibold text-content-primary focus:border-brand-500 focus:outline-none"
                        >
                            <option value="todas">Todos os Status</option>
                            <option value="ativas">Apenas Ativas</option>
                            <option value="inativas">Apenas Inativas</option>
                        </select>

                        {todasUfs.length > 0 && (
                            <select
                                value={filters?.uf || ''}
                                onChange={(e) => handleFilterUf(e.target.value)}
                                className="rounded-lg border border-line-strong bg-surface-canvas px-3 py-2 text-xs font-semibold text-content-primary focus:border-brand-500 focus:outline-none"
                            >
                                <option value="">Todas as UFs</option>
                                {todasUfs.map((u) => (
                                    <option key={u} value={u}>
                                        Estado: {u}
                                    </option>
                                ))}
                            </select>
                        )}

                        {temFiltros && (
                            <Button variant="secondary" size="sm" onClick={handleLimparFiltros}>
                                Limpar
                            </Button>
                        )}
                    </div>
                </div>

                {/* ---------- TABELA (DESKTOP) ---------- */}
                <div className="hidden md:block overflow-x-auto scrollbar-slim">
                    <table className="min-w-full divide-y divide-line">
                        <thead className="bg-surface-sunken">
                            <tr>
                                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-content-secondary">
                                    Filial / Nome
                                </th>
                                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-content-secondary">
                                    Cidade / UF
                                </th>
                                <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-content-secondary">
                                    Peças (Basqueta)
                                </th>
                                <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-content-secondary">
                                    Usuários
                                </th>
                                <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-content-secondary">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-content-secondary">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line bg-surface-card">
                            {lista.length > 0 ? (
                                lista.map((filial) => (
                                    <tr key={filial.id} className="group transition hover:bg-surface-sunken/60">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-200">
                                                    <BuildingStorefrontIcon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-content-primary">
                                                        {filial.nome}
                                                    </div>
                                                    {filial.codigo_empresa && (
                                                        <div className="text-[10px] text-content-muted font-mono">
                                                            Cód. Microwork: #{filial.codigo_empresa}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5">
                                                <span className="inline-flex items-center rounded-md bg-surface-sunken px-2 py-0.5 text-xs font-black text-content-primary ring-1 ring-line">
                                                    {filial.uf}
                                                </span>
                                                <span className="text-sm font-medium text-content-secondary">
                                                    {filial.cidade}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            {filial.participa_pecas ? (
                                                <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-800 ring-1 ring-brand-200">
                                                    <WrenchScrewdriverIcon className="h-3.5 w-3.5" />
                                                    Habilitada
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-md bg-surface-sunken px-2 py-0.5 text-xs font-medium text-content-muted ring-1 ring-line">
                                                    Apenas Motos
                                                </span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${
                                                !filial.ativo && (filial.usuarios_arquivados > 0 || filial.usuarios_count > 0)
                                                    ? 'bg-status-warning-bg text-status-warning-fg ring-status-warning-solid/30'
                                                    : 'bg-surface-sunken text-content-secondary ring-line'
                                            }`}>
                                                <UsersIcon className="h-3 w-3" />
                                                {filial.usuarios_count} conta(s)
                                                {!filial.ativo && (filial.usuarios_arquivados > 0 || filial.usuarios_count > 0) && (
                                                    <span className="text-[10px] font-semibold opacity-90">(arquivadas)</span>
                                                )}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() => toggleAtivo(filial)}
                                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset transition cursor-pointer ${
                                                    filial.ativo
                                                        ? 'bg-status-success-bg text-status-success-fg ring-status-success-solid/30 hover:bg-status-success-bg/80'
                                                        : 'bg-status-neutral-bg text-status-neutral-fg ring-status-neutral-solid/30 hover:bg-status-neutral-bg/80'
                                                }`}
                                                title="Clique para alternar o status da filial"
                                            >
                                                <span
                                                    className={`h-1.5 w-1.5 rounded-full ${
                                                        filial.ativo ? 'bg-status-success-solid' : 'bg-status-neutral-solid'
                                                    }`}
                                                />
                                                {filial.ativo ? 'Ativa' : 'Inativa'}
                                            </button>
                                        </td>

                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    icon={PencilSquareIcon}
                                                    onClick={() => abrirModalEdicao(filial)}
                                                >
                                                    Editar
                                                </Button>
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    icon={TrashIcon}
                                                    onClick={() => confirmarExclusao(filial)}
                                                >
                                                    Remover
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="py-8">
                                        <EmptyState
                                            icon={BuildingStorefrontIcon}
                                            title="Nenhuma filial encontrada"
                                            description={
                                                temFiltros
                                                    ? 'Nenhum resultado para os filtros informados.'
                                                    : 'Cadastre a primeira filial da rede.'
                                            }
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ---------- CARDS (MOBILE) ---------- */}
                <div className="md:hidden divide-y divide-line">
                    {lista.length > 0 ? (
                        lista.map((filial) => (
                            <div key={filial.id} className="p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="font-black text-content-primary text-base">
                                            {filial.nome}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-black text-content-primary ring-1 ring-line">
                                                {filial.uf}
                                            </span>
                                            <span className="text-xs text-content-secondary font-medium">
                                                {filial.cidade}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggleAtivo(filial)}
                                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${
                                            filial.ativo
                                                ? 'bg-status-success-bg text-status-success-fg ring-status-success-solid/30'
                                                : 'bg-status-neutral-bg text-status-neutral-fg ring-status-neutral-solid/30'
                                        }`}
                                    >
                                        <span
                                            className={`h-1.5 w-1.5 rounded-full ${
                                                filial.ativo ? 'bg-status-success-solid' : 'bg-status-neutral-solid'
                                            }`}
                                        />
                                        {filial.ativo ? 'Ativa' : 'Inativa'}
                                    </button>
                                </div>

                                <div className="flex flex-wrap gap-2 text-xs">
                                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ring-1 ${
                                        !filial.ativo && (filial.usuarios_arquivados > 0 || filial.usuarios_count > 0)
                                            ? 'bg-status-warning-bg text-status-warning-fg ring-status-warning-solid/30 font-bold'
                                            : 'bg-surface-sunken text-content-secondary ring-line'
                                    }`}>
                                        <UsersIcon className="h-3 w-3" />
                                        {filial.usuarios_count} conta(s)
                                        {!filial.ativo && (filial.usuarios_arquivados > 0 || filial.usuarios_count > 0) && (
                                            <span className="text-[10px] opacity-90">(arquivadas)</span>
                                        )}
                                    </span>
                                    {filial.participa_pecas && (
                                        <span className="inline-flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 text-brand-800 font-bold ring-1 ring-brand-200">
                                            <WrenchScrewdriverIcon className="h-3 w-3" />
                                            Peças Habilitadas
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon={PencilSquareIcon}
                                        onClick={() => abrirModalEdicao(filial)}
                                        className="flex-1"
                                    >
                                        Editar
                                    </Button>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        icon={TrashIcon}
                                        onClick={() => confirmarExclusao(filial)}
                                    >
                                        Remover
                                    </Button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-8">
                            <EmptyState
                                icon={BuildingStorefrontIcon}
                                title="Nenhuma filial encontrada"
                                description="Não há filiais correspondentes aos critérios de busca."
                            />
                        </div>
                    )}
                </div>

                {/* ---------- PAGINAÇÃO ---------- */}
                {safeFiliais.links && safeFiliais.links.length > 3 && (
                    <div className="p-4 border-t border-line flex flex-wrap justify-center gap-1 bg-surface-sunken">
                        {safeFiliais.links.map((link, k) => (
                            <button
                                key={k}
                                disabled={!link.url || link.active}
                                onClick={() => link.url && router.get(link.url, {}, { preserveState: true })}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                                className={`min-w-[2rem] rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                                    link.active
                                        ? 'bg-brand-600 text-white'
                                        : link.url
                                          ? 'text-content-secondary hover:bg-surface-card bg-surface-canvas border border-line'
                                          : 'pointer-events-none text-content-muted opacity-50'
                                }`}
                            />
                        ))}
                    </div>
                )}
            </Card>

            {/* ================= MODAL DE CRIAÇÃO / EDIÇÃO ================= */}
            {modalAberto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="w-full max-w-lg rounded-2xl bg-surface-card shadow-2xl border border-line overflow-hidden">
                        {/* Header do Modal */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface-sunken">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                                    <BuildingStorefrontIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-content-primary">
                                        {filialEdicao ? 'Editar Filial' : 'Cadastrar Nova Filial'}
                                    </h3>
                                    <p className="text-xs text-content-muted">
                                        {filialEdicao
                                            ? `Atualize as diretrizes da filial #${filialEdicao.id}`
                                            : 'Adicione um novo ponto de distribuição ou venda da rede'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={fecharModal}
                                className="rounded-lg p-1.5 text-content-muted hover:bg-surface-canvas hover:text-content-primary transition"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Formulário */}
                        <form onSubmit={salvarFilial} className="p-6 space-y-4">
                            {/* Nome da Filial */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1">
                                    Nome da Filial <span className="text-status-danger-fg">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Shineray Castanhal, Loja Marabá..."
                                    value={data.nome}
                                    onChange={(e) => setData('nome', e.target.value)}
                                    className="w-full rounded-lg border border-line-strong bg-surface-canvas px-3.5 py-2 text-sm text-content-primary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                                {errors.nome && (
                                    <p className="mt-1 text-xs text-status-danger-fg">{errors.nome}</p>
                                )}
                            </div>

                            {/* Cidade e UF */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1">
                                        Cidade <span className="text-status-danger-fg">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Castanhal, Belém..."
                                        value={data.cidade}
                                        onChange={(e) => setData('cidade', e.target.value)}
                                        className="w-full rounded-lg border border-line-strong bg-surface-canvas px-3.5 py-2 text-sm text-content-primary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                    />
                                    {errors.cidade && (
                                        <p className="mt-1 text-xs text-status-danger-fg">{errors.cidade}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1">
                                        UF <span className="text-status-danger-fg">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={2}
                                        placeholder="PA"
                                        value={data.uf}
                                        onChange={(e) => setData('uf', e.target.value.toUpperCase())}
                                        className="w-full uppercase font-bold rounded-lg border border-line-strong bg-surface-canvas px-3.5 py-2 text-sm text-content-primary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                    />
                                    {errors.uf && (
                                        <p className="mt-1 text-xs text-status-danger-fg">{errors.uf}</p>
                                    )}
                                </div>
                            </div>

                            {/* Código ERP / Microwork */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1">
                                    Código Empresa / Microwork (Opcional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 1, 2, 10..."
                                    value={data.codigo_empresa}
                                    onChange={(e) => setData('codigo_empresa', e.target.value)}
                                    className="w-full rounded-lg border border-line-strong bg-surface-canvas px-3.5 py-2 text-sm text-content-primary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                                {errors.codigo_empresa && (
                                    <p className="mt-1 text-xs text-status-danger-fg">{errors.codigo_empresa}</p>
                                )}
                            </div>

                            {/* Opções e Flags */}
                            <div className="rounded-xl bg-surface-sunken p-3.5 space-y-3 border border-line">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={data.ativo}
                                        onChange={(e) => setData('ativo', e.target.checked)}
                                        className="h-4 w-4 rounded border-line-strong text-brand-600 focus:ring-brand-500"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-content-primary">
                                            Filial Ativa
                                        </div>
                                        <div className="text-[11px] text-content-muted">
                                            Disponível para seleção em cadastros de usuários e novos pedidos
                                        </div>
                                    </div>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={data.participa_pecas}
                                        onChange={(e) => setData('participa_pecas', e.target.checked)}
                                        className="h-4 w-4 rounded border-line-strong text-brand-600 focus:ring-brand-500"
                                    />
                                    <div>
                                        <div className="text-xs font-bold text-content-primary">
                                            Habilitar Fluxo de Peças & Basquetas
                                        </div>
                                        <div className="text-[11px] text-content-muted">
                                            Cria caixote reservado no CD e habilita solicitações no catálogo de peças
                                        </div>
                                    </div>
                                </label>
                            </div>

                            {/* Ações do Rodapé */}
                            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-line">
                                <Button variant="secondary" onClick={fecharModal} disabled={processing}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={processing} icon={filialEdicao ? CheckCircleIcon : PlusIcon}>
                                    {filialEdicao ? 'Salvar Alterações' : 'Cadastrar Filial'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
