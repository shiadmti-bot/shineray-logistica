import AppLayout from '@/Layouts/AppLayout';
import { PageHeader, Card, StatCard, Button, StatusBadge, Tabs, EmptyState } from '@/Components/UI';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import {
    UsersIcon,
    BuildingStorefrontIcon,
    BuildingOffice2Icon,
    ShieldCheckIcon,
    SignalIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    TrashIcon,
    XMarkIcon,
    PlusIcon,
    BoltIcon,
    TruckIcon,
    WrenchScrewdriverIcon,
    ClockIcon,
    CubeIcon,
    ArchiveBoxIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';

export default function UsersIndex({ auth, users, stats, filters }) {
    const [searchTerm, setSearchTerm] = useState(filters?.search || '');
    const currentPerfil = filters?.perfil || 'all';

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(
            route('users.index'),
            { search: searchTerm, perfil: currentPerfil !== 'all' ? currentPerfil : undefined },
            { preserveState: true, replace: true }
        );
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        router.get(
            route('users.index'),
            { perfil: currentPerfil !== 'all' ? currentPerfil : undefined },
            { preserveState: true, replace: true }
        );
    };

    const handleTabChange = (tabKey) => {
        router.get(
            route('users.index'),
            {
                search: searchTerm || undefined,
                perfil: tabKey !== 'all' ? tabKey : undefined,
            },
            { preserveState: true, replace: true }
        );
    };

    const handleDelete = (user) => {
        if (user.id === auth.user.id) {
            Swal.fire({
                title: 'Ação não permitida',
                text: 'Você não pode excluir a sua própria conta logada.',
                icon: 'warning',
                confirmButtonColor: '#0284c7',
            });
            return;
        }

        Swal.fire({
            title: 'Remover Usuário?',
            text: `Tem certeza que deseja remover o acesso de "${user.name}" (${user.email})?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Sim, remover',
            cancelButtonText: 'Cancelar',
        }).then((result) => {
            if (result.isConfirmed) {
                router.delete(route('users.destroy', user.id), {
                    onSuccess: () => {
                        Swal.fire({
                            icon: 'success',
                            title: 'Removido',
                            text: 'O acesso do usuário foi revogado.',
                            timer: 2000,
                            showConfirmButton: false,
                        });
                    },
                });
            }
        });
    };

    const handleRestore = (user) => {
        Swal.fire({
            title: 'Restaurar Acesso?',
            text: `Deseja restabelecer o acesso de "${user.name}" (${user.email})?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#16a34a',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Sim, restaurar acesso',
            cancelButtonText: 'Cancelar',
        }).then((result) => {
            if (result.isConfirmed) {
                router.patch(route('users.restore', user.id), {}, {
                    onSuccess: () => {
                        Swal.fire({
                            icon: 'success',
                            title: 'Acesso Restaurado',
                            text: 'O usuário está ativo novamente no sistema.',
                            timer: 2000,
                            showConfirmButton: false,
                        });
                    },
                });
            }
        });
    };

    const toggleRota = (user) => {
        const proximoModo = user.is_interior ? 'CAPITAL (Direto)' : 'INTERIOR (Via CD)';
        const descricao = user.is_interior
            ? `Mudar ${user.filial} para CAPITAL? Habilita envio direto entre lojas sem triagem no CD.`
            : `Mudar ${user.filial} para INTERIOR? Exige que todas as cargas sejam triadas pelo CD.`;

        Swal.fire({
            title: 'Alterar Logística da Filial?',
            text: descricao,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: user.is_interior ? '#16a34a' : '#ea580c',
            cancelButtonColor: '#6b7280',
            confirmButtonText: `Sim, virar ${proximoModo}`,
            cancelButtonText: 'Cancelar',
        }).then((result) => {
            if (result.isConfirmed) {
                router.patch(
                    route('users.toggle-interior', user.id),
                    {},
                    {
                        preserveScroll: true,
                        preserveState: false,
                        onSuccess: () => {
                            const Toast = Swal.mixin({
                                toast: true,
                                position: 'top-end',
                                showConfirmButton: false,
                                timer: 3000,
                            });
                            Toast.fire({
                                icon: 'success',
                                title: 'Fluxo Logístico Atualizado',
                                text: `Regra de ${user.filial} alterada para ${proximoModo}.`,
                            });
                        },
                    }
                );
            }
        });
    };

    const tabsConfig = [
        { key: 'all', label: 'Todos os Usuários', count: stats?.total ?? 0, icon: UsersIcon },
        { key: 'loja', label: 'Lojas / Revendas', count: stats?.lojas ?? 0, icon: BuildingStorefrontIcon },
        { key: 'cd', label: 'Operação CD', count: stats?.cd ?? 0, icon: BuildingOffice2Icon },
        { key: 'gestao', label: 'Gestão & Admin', count: stats?.gestores ?? 0, icon: ShieldCheckIcon },
        { key: 'online', label: 'Online Agora', count: stats?.online ?? 0, icon: SignalIcon },
        ...(stats?.arquivados > 0
            ? [{ key: 'arquivados', label: 'Arquivados', count: stats.arquivados, icon: ArchiveBoxIcon }]
            : []),
    ];

    return (
        <AppLayout user={auth.user}>
            <Head title="Gestão de Usuários" />

            <PageHeader
                title="Gestão de Usuários & Acessos"
                description="Cadastros de equipe, filiais autorizadas, permissões e diretrizes logísticas da rede."
                breadcrumbs={[
                    { label: 'Início', href: route('dashboard') },
                    { label: 'Usuários' },
                ]}
                actions={
                    <Button href={route('users.create')} icon={PlusIcon}>
                        Novo Usuário
                    </Button>
                }
            />

            {/* ---------- STATS CARDS (TOP KPIS) ---------- */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-6">
                <StatCard
                    label="Total de Contas"
                    value={stats?.total ?? 0}
                    icon={UsersIcon}
                    tone="neutral"
                    hint="Usuários cadastrados"
                />
                <StatCard
                    label="Lojas / Filiais"
                    value={stats?.lojas ?? 0}
                    icon={BuildingStorefrontIcon}
                    tone="brand"
                    hint="Acessos de loja"
                />
                <StatCard
                    label="Operação CD"
                    value={stats?.cd ?? 0}
                    icon={BuildingOffice2Icon}
                    tone="info"
                    hint="Galpão e expedição"
                />
                <StatCard
                    label="Gestão & Admins"
                    value={stats?.gestores ?? 0}
                    icon={ShieldCheckIcon}
                    tone="warning"
                    hint="Diretoria e auditores"
                />
                <StatCard
                    label="Online Agora"
                    value={stats?.online ?? 0}
                    icon={SignalIcon}
                    tone="success"
                    hint="Ativos nos últimos 5 min"
                />
            </div>

            {/* ---------- CONTROLES: ABAS E BUSCA ---------- */}
            <Card padding="none" className="mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-line px-4 pt-2 pb-2 gap-4">
                    <Tabs
                        tabs={tabsConfig}
                        active={currentPerfil}
                        onChange={handleTabChange}
                        className="border-b-0"
                    />

                    {/* Formulário de Busca */}
                    <form onSubmit={handleSearch} className="relative w-full md:w-80 shrink-0 pb-2 md:pb-0">
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                        <input
                            type="text"
                            placeholder="Buscar nome, e-mail ou loja..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-line-strong bg-surface-canvas pl-9 pr-9 py-2 text-sm text-content-primary placeholder-content-muted focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-primary"
                                title="Limpar busca"
                            >
                                <XMarkIcon className="h-4 w-4" />
                            </button>
                        )}
                    </form>
                </div>

                {/* ---------- VISUALIZAÇÃO DESKTOP: TABELA ELEGANTE ---------- */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-line text-left text-sm">
                        <thead className="bg-surface-sunken/60 text-xs font-bold uppercase tracking-wider text-content-secondary">
                            <tr>
                                <th scope="col" className="py-3.5 pl-6 pr-4">Usuário</th>
                                <th scope="col" className="px-4 py-3.5">Perfil</th>
                                <th scope="col" className="px-4 py-3.5">Filial / Unidade</th>
                                <th scope="col" className="px-4 py-3.5 text-center">Logística (Lojas)</th>
                                <th scope="col" className="px-4 py-3.5">Permissões</th>
                                <th scope="col" className="py-3.5 pl-4 pr-6 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line bg-surface-card">
                            {users.data.map((user) => (
                                <tr key={user.id} className="transition hover:bg-surface-sunken/40">
                                    {/* Usuário + Avatar */}
                                    <td className="py-4 pl-6 pr-4">
                                        <div className="flex items-center gap-3.5">
                                            <div className="relative shrink-0">
                                                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white uppercase shadow-sm ${getAvatarColor(user.perfil)}`}>
                                                    {user.name.charAt(0)}
                                                </div>
                                                {user.is_online && (
                                                    <span
                                                        className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-status-success-solid animate-pulse"
                                                        title="Usuário Online"
                                                    />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 font-bold text-content-primary truncate">
                                                    <span>{user.name}</span>
                                                    {user.id === auth.user.id && (
                                                        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-700 uppercase">
                                                            Você
                                                        </span>
                                                    )}
                                                    {user.is_trashed && (
                                                        <span className="rounded bg-status-danger-bg border border-status-danger-solid/30 px-1.5 py-0.5 text-[10px] font-extrabold text-status-danger-fg uppercase">
                                                            Arquivado
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-content-secondary truncate">{user.email}</div>
                                                <div className="flex items-center gap-1 mt-0.5 text-[11px] text-content-muted">
                                                    <ClockIcon className="h-3 w-3 inline" />
                                                    <span>{user.last_seen_human ? `Visto ${user.last_seen_human}` : 'Nunca acessou'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Perfil */}
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <BadgePerfil perfil={user.perfil} />
                                    </td>

                                    {/* Filial */}
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-content-secondary">
                                        <div className="flex items-center gap-2 font-medium">
                                            {user.perfil === 'loja' ? (
                                                <BuildingStorefrontIcon className="h-4 w-4 text-brand-600 shrink-0" />
                                            ) : user.perfil === 'cd' ? (
                                                <BuildingOffice2Icon className="h-4 w-4 text-status-info-fg shrink-0" />
                                            ) : (
                                                <BuildingOffice2Icon className="h-4 w-4 text-content-muted shrink-0" />
                                            )}
                                            <span>{user.filial || 'Matriz'}</span>
                                        </div>
                                    </td>

                                    {/* Logística (Lojas) */}
                                    <td className="px-4 py-4 text-center whitespace-nowrap">
                                        {user.perfil === 'loja' ? (
                                            <div className="inline-flex flex-col items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleRota(user)}
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 transition hover:scale-105 ${
                                                        user.is_interior
                                                            ? 'bg-status-warning-bg text-status-warning-fg ring-status-warning-solid/30 hover:bg-status-warning-bg/80'
                                                            : 'bg-status-success-bg text-status-success-fg ring-status-success-solid/30 hover:bg-status-success-bg/80'
                                                    }`}
                                                    title="Clique para alternar regra logística"
                                                >
                                                    {user.is_interior ? (
                                                        <>
                                                            <TruckIcon className="h-3.5 w-3.5" />
                                                            <span>Interior (Via CD)</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <BoltIcon className="h-3.5 w-3.5" />
                                                            <span>Capital (Direto)</span>
                                                        </>
                                                    )}
                                                </button>
                                                {user.default_route && (
                                                    <span className="text-[10px] font-mono text-content-muted font-semibold">
                                                        Rota: {user.default_route.code}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-content-muted">-</span>
                                        )}
                                    </td>

                                    {/* Permissões Especiais */}
                                    <td className="px-4 py-4 whitespace-nowrap text-xs">
                                        <div className="flex flex-col gap-1">
                                            {user.valida_motos || user.perfil === 'admin' ? (
                                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-bold text-amber-800 ring-1 ring-amber-200 w-fit">
                                                    <CubeIcon className="h-3 w-3" />
                                                    Valida Motos
                                                </span>
                                            ) : null}

                                            {user.valida_pecas || user.perfil === 'admin' ? (
                                                <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 font-bold text-brand-700 ring-1 ring-brand-200 w-fit">
                                                    <WrenchScrewdriverIcon className="h-3 w-3" />
                                                    Valida Peças (Gate 1)
                                                </span>
                                            ) : null}

                                            {!user.valida_motos && !user.valida_pecas && user.perfil !== 'admin' && (
                                                <span className="text-content-muted">Padrão</span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Ações */}
                                    <td className="py-4 pl-4 pr-6 text-right whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-2">
                                            {user.is_trashed ? (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    icon={ArrowPathIcon}
                                                    onClick={() => handleRestore(user)}
                                                    className="border-status-success-solid text-status-success-fg hover:bg-status-success-bg/30"
                                                >
                                                    Restaurar Acesso
                                                </Button>
                                            ) : (
                                                <>
                                                    <Button
                                                        href={route('users.edit', user.id)}
                                                        variant="secondary"
                                                        size="sm"
                                                        icon={PencilSquareIcon}
                                                    >
                                                        Editar
                                                    </Button>

                                                    {user.id !== auth.user.id && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(user)}
                                                            className="inline-flex items-center justify-center rounded-lg p-1.5 text-content-muted transition hover:bg-status-danger-bg hover:text-status-danger-fg"
                                                            title="Arquivar usuário"
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ---------- VISUALIZAÇÃO MOBILE: CARDS RESPONSIVOS ---------- */}
                <div className="divide-y divide-line md:hidden">
                    {users.data.map((user) => (
                        <div key={user.id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="relative shrink-0">
                                        <div className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-bold text-white uppercase shadow-sm ${getAvatarColor(user.perfil)}`}>
                                            {user.name.charAt(0)}
                                        </div>
                                        {user.is_online && (
                                            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-status-success-solid animate-pulse" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-bold text-content-primary text-base flex items-center gap-2">
                                            <span>{user.name}</span>
                                            {user.id === auth.user.id && (
                                                <span className="rounded bg-brand-50 px-1 py-0.2 text-[10px] font-extrabold text-brand-700 uppercase">
                                                    Você
                                                </span>
                                            )}
                                            {user.is_trashed && (
                                                <span className="rounded bg-status-danger-bg border border-status-danger-solid/30 px-1.5 py-0.5 text-[10px] font-extrabold text-status-danger-fg uppercase">
                                                    Arquivado
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-content-secondary">{user.email}</div>
                                    </div>
                                </div>
                                <BadgePerfil perfil={user.perfil} />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs border-t border-line/60">
                                <div className="flex items-center gap-1.5 text-content-secondary">
                                    <BuildingStorefrontIcon className="h-4 w-4 text-content-muted" />
                                    <span>{user.filial || 'Matriz'}</span>
                                </div>
                                <div className="text-[11px] text-content-muted">
                                    {user.last_seen_human ? `🕒 ${user.last_seen_human}` : 'Nunca acessou'}
                                </div>
                            </div>

                            {user.perfil === 'loja' && (
                                <div className="flex items-center justify-between bg-surface-sunken p-2.5 rounded-lg text-xs">
                                    <span className="font-semibold text-content-secondary">Modelo Logístico:</span>
                                    <button
                                        type="button"
                                        onClick={() => toggleRota(user)}
                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bold ${
                                            user.is_interior
                                                ? 'bg-status-warning-bg text-status-warning-fg'
                                                : 'bg-status-success-bg text-status-success-fg'
                                        }`}
                                    >
                                        {user.is_interior ? (
                                            <>
                                                <TruckIcon className="h-3 w-3" />
                                                Interior (CD)
                                            </>
                                        ) : (
                                            <>
                                                <BoltIcon className="h-3 w-3" />
                                                Capital (Direto)
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {(user.valida_motos || user.valida_pecas || user.perfil === 'admin') && (
                                <div className="flex flex-wrap gap-1.5 text-xs pt-1">
                                    {(user.valida_motos || user.perfil === 'admin') && (
                                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 font-bold text-amber-800 ring-1 ring-amber-200">
                                            <CubeIcon className="h-3 w-3" />
                                            Valida Motos
                                        </span>
                                    )}
                                    {(user.valida_pecas || user.perfil === 'admin') && (
                                        <span className="inline-flex items-center gap-1 rounded bg-brand-50 px-2 py-0.5 font-bold text-brand-700 ring-1 ring-brand-200">
                                            <WrenchScrewdriverIcon className="h-3 w-3" />
                                            Valida Peças (Gate 1)
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                                {user.is_trashed ? (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon={ArrowPathIcon}
                                        onClick={() => handleRestore(user)}
                                        className="flex-1 border-status-success-solid text-status-success-fg hover:bg-status-success-bg/30"
                                    >
                                        Restaurar Acesso
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            href={route('users.edit', user.id)}
                                            variant="secondary"
                                            size="sm"
                                            icon={PencilSquareIcon}
                                            className="flex-1"
                                        >
                                            Editar
                                        </Button>
                                        {user.id !== auth.user.id && (
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(user)}
                                                className="inline-flex items-center justify-center rounded-lg border border-line-strong p-2 text-status-danger-fg hover:bg-status-danger-bg transition"
                                                title="Arquivar"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ---------- ESTADO VAZIO ---------- */}
                {users.data.length === 0 && (
                    <EmptyState
                        title="Nenhum usuário localizado"
                        description={
                            searchTerm
                                ? `Nenhum registro corresponde à busca "${searchTerm}".`
                                : 'Não existem usuários nesta categoria.'
                        }
                        action={
                            searchTerm ? (
                                <Button variant="secondary" onClick={handleClearSearch}>
                                    Limpar Filtros
                                </Button>
                            ) : (
                                <Button href={route('users.create')} icon={PlusIcon}>
                                    Criar Usuário
                                </Button>
                            )
                        }
                    />
                )}

                {/* ---------- PAGINAÇÃO ---------- */}
                {users.links.length > 3 && (
                    <div className="flex flex-wrap items-center justify-between border-t border-line bg-surface-sunken/40 px-6 py-3 text-xs text-content-secondary">
                        <div>
                            Mostrando <span className="font-bold text-content-primary">{users.from || 0}</span> a{' '}
                            <span className="font-bold text-content-primary">{users.to || 0}</span> de{' '}
                            <span className="font-bold text-content-primary">{users.total}</span> usuários
                        </div>
                        <div className="flex gap-1 mt-2 sm:mt-0">
                            {users.links.map((link, idx) =>
                                link.url ? (
                                    <Link
                                        key={idx}
                                        href={link.url}
                                        className={`rounded-md px-3 py-1 font-semibold transition ${
                                            link.active
                                                ? 'bg-brand-600 text-white shadow-sm'
                                                : 'bg-surface-card text-content-secondary ring-1 ring-inset ring-line-strong hover:bg-surface-sunken'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ) : (
                                    <span
                                        key={idx}
                                        className="rounded-md px-3 py-1 text-content-muted opacity-50"
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                )
                            )}
                        </div>
                    </div>
                )}
            </Card>
        </AppLayout>
    );
}

function BadgePerfil({ perfil }) {
    const config = {
        admin: { label: 'Administrador', class: 'bg-black text-white ring-1 ring-black' },
        gestor: { label: 'Diretoria / Gestor', class: 'bg-status-warning-bg text-status-warning-fg ring-1 ring-status-warning-solid/30' },
        cd: { label: 'Operador CD', class: 'bg-status-info-bg text-status-info-fg ring-1 ring-status-info-solid/30' },
        loja: { label: 'Loja / Revenda', class: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' },
    }[perfil] || { label: perfil, class: 'bg-surface-sunken text-content-secondary ring-1 ring-line' };

    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide ${config.class}`}>
            {config.label}
        </span>
    );
}

function getAvatarColor(perfil) {
    switch (perfil) {
        case 'admin':
            return 'bg-zinc-800';
        case 'gestor':
            return 'bg-amber-600';
        case 'cd':
            return 'bg-sky-600';
        case 'loja':
        default:
            return 'bg-brand-600';
    }
}