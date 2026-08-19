import AppLayout from '@/Layouts/AppLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import NoticeBoard from '@/Components/NoticeBoard';
import { Card, StatCard, Button } from '@/Components/UI';
import axios from 'axios';
import {
    ClockIcon,
    TruckIcon,
    ClipboardDocumentCheckIcon,
    ArchiveBoxIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    BuildingStorefrontIcon,
    ArrowRightIcon,
    ShoppingCartIcon,
    CubeIcon,
    WrenchScrewdriverIcon,
    WrenchIcon,
    PauseCircleIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';

/**
 * Painel de Controle.
 *
 * Repaginado para o design system v3: a lógica (auto-refresh, modal de
 * separação, KPIs do ERP) é a mesma de antes — mudou a camada visual, que
 * passou de cores cruas (bg-status-info-bg, text-content-primary) para os tokens, e dos
 * cards locais para os componentes compartilhados.
 *
 * Três painéis distintos no mesmo arquivo, por perfil: admin vê auditoria,
 * CD vê a mesa de operações, loja vê reposição.
 */
export default function Dashboard({ auth, stats, perfil, notices }) {
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

    const [animatePulse, setAnimatePulse] = useState(false);
    const [showSeparationModal, setShowSeparationModal] = useState(false);

    const [estoqueCD, setEstoqueCD] = useState(null);
    const [loadingEstoque, setLoadingEstoque] = useState(false);

    // --- Pop-up de separação pendente (loja) ---
    useEffect(() => {
        if (perfil === 'loja' && stats.transferencias_saida > 0) {
            setTimeout(() => setShowSeparationModal(true), 500);
        }
    }, [perfil, stats.transferencias_saida]);

    // --- Auto-refresh (CD/Admin) ---
    useEffect(() => {
        if (perfil === 'cd' || perfil === 'admin') {
            const timer = setInterval(() => {
                router.reload({
                    only: ['stats', 'notices'],
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => {
                        setAnimatePulse(true);
                        setTimeout(() => setAnimatePulse(false), 1000);
                    },
                });
            }, 15000);
            return () => clearInterval(timer);
        }
    }, [perfil]);

    // --- Estoque físico do CD (ERP Microwork) ---
    useEffect(() => {
        if (perfil === 'admin' || perfil === 'gestor' || perfil === 'cd') {
            setLoadingEstoque(true);
            axios
                .get(route('api.estoque.microwork'))
                .then((res) => {
                    const dados = Array.isArray(res.data.data)
                        ? res.data.data
                        : Array.isArray(res.data)
                          ? res.data
                          : [];
                    setEstoqueCD(dados);
                })
                .catch((err) => console.error('Erro API Microwork (Dashboard)', err))
                .finally(() => setLoadingEstoque(false));
        }
    }, [perfil]);

    // --- KPIs por pátio ---
    const kpisEstoque = { montadas: 0, desmontadas: 0, separada: 0, conserto: 0, parada: 0 };

    if (estoqueCD) {
        estoqueCD.forEach((moto) => {
            const patio = (moto.patio || '').toUpperCase();
            if (patio.includes('MOTOS MONTADAS')) kpisEstoque.montadas++;
            else if (patio.includes('DESMONTADA CD')) kpisEstoque.desmontadas++;
            else if (patio.includes('CD EXPEDI')) kpisEstoque.separada++;
            else if (patio.includes('AVARIA')) kpisEstoque.conserto++;
            else if (patio.includes('INATIVADA')) kpisEstoque.parada++;
        });
    }

    const rotulosPerfil = {
        cd: { label: 'CD / Expedição', icon: ArchiveBoxIcon },
        admin: { label: 'Auditoria / Admin', icon: ClipboardDocumentCheckIcon },
        gestor: { label: 'Gestão', icon: ClipboardDocumentCheckIcon },
        loja: { label: 'Loja / Revenda', icon: BuildingStorefrontIcon },
    };

    const perfilAtual = rotulosPerfil[perfil] ?? rotulosPerfil.loja;
    const IconePerfil = perfilAtual.icon;

    const valorErp = (v) => (estoqueCD ? v : null);

    return (
        <AppLayout user={auth.user}>
            <Head title="Painel de Controle" />

            {/* ============ MODAL: SEPARAÇÃO PENDENTE (LOJA) ============ */}
            {showSeparationModal && (
                <div className="fixed inset-0 z-overlay flex items-center justify-center bg-content-primary/70 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg animate-fade-in-up overflow-hidden rounded-card border-t-8 border-status-warning-solid bg-surface-card p-6 text-center shadow-overlay md:p-8">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-status-warning-bg">
                            <ArchiveBoxIcon className="h-10 w-10 text-status-warning-fg" />
                        </div>

                        <h3 className="mb-2 text-2xl font-black uppercase tracking-tight text-content-primary">
                            Atenção necessária
                        </h3>

                        <p className="mb-6 text-content-secondary">
                            Você possui{' '}
                            <strong className="text-status-warning-fg">
                                {stats.transferencias_saida} pedidos
                            </strong>{' '}
                            de transferência aguardando separação.
                        </p>

                        <div className="mb-6 rounded-lg border border-status-warning-solid/20 bg-status-warning-bg/50 p-4 text-left">
                            <p className="flex items-center gap-2 text-sm font-bold text-status-warning-fg">
                                <TruckIcon className="h-5 w-5" /> O caminhão vai passar
                            </p>
                            <p className="mt-1 text-xs text-content-secondary">
                                Estas motos precisam ser separadas no pátio para que o motorista consiga
                                fazer a coleta.
                            </p>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button
                                href={route('pedidos.index')}
                                size="lg"
                                icon={ArrowRightIcon}
                                iconRight
                                className="w-full justify-center"
                            >
                                Ir para separação agora
                            </Button>
                            <button
                                type="button"
                                onClick={() => setShowSeparationModal(false)}
                                className="py-2 text-sm font-medium text-content-muted transition hover:text-content-secondary"
                            >
                                Ver o painel primeiro
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ BOAS-VINDAS ============ */}
            <Card className="mb-6 border-l-4 border-l-brand-600">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-content-primary md:text-3xl">
                            {saudacao}, <span className="text-brand-700">{auth.user.name.split(' ')[0]}</span>!
                        </h1>
                        <p className="mt-1 text-sm text-content-secondary">
                            Sistema de Logística Integrada{' '}
                            <span className="font-bold text-brand-600">Shineray By Sabel</span>.
                        </p>
                    </div>

                    <div className="flex flex-col items-start gap-2 md:items-end">
                        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-600/20">
                            <IconePerfil className="h-4 w-4" />
                            {perfilAtual.label}
                        </span>

                        <div className="flex items-center gap-3">
                            <p className="flex items-center gap-1 text-xs text-content-muted">
                                <ClockIcon className="h-3.5 w-3.5" />
                                {new Date().toLocaleDateString('pt-BR', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                })}
                            </p>

                            {/* Indicador de atualização automática */}
                            {(perfil === 'cd' || perfil === 'admin') && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-[11px] font-bold text-content-secondary">
                                    <span
                                        className={`h-2 w-2 rounded-full transition-all duration-500 ${
                                            animatePulse
                                                ? 'scale-125 bg-status-success-solid'
                                                : 'bg-status-success-fg'
                                        }`}
                                    />
                                    Tempo real
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            <NoticeBoard notices={notices} auth={auth} />

            {/* ============ ADMIN ============ */}
            {perfil === 'admin' && (
                <>
                    <SecaoTitulo icon={ClipboardDocumentCheckIcon}>Movimentação de pedidos</SecaoTitulo>
                    <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <StatCard label="Total histórico" value={stats.total_pedidos} icon={ArchiveBoxIcon} tone="neutral" hint="Pedidos processados" />
                        <StatCard label="Em operação" value={stats.em_andamento} icon={ArrowPathIcon} tone="info" hint="Fluxo ativo agora" />
                        <StatCard label="Cargas na rua" value={stats.cargas_transito} icon={TruckIcon} tone="warning" hint="Romaneios em trânsito" href={route('romaneios.index')} />
                        <StatCard label="Cancelados" value={stats.cancelados} icon={ExclamationTriangleIcon} tone="danger" hint="Devoluções e erros" href={route('pedidos.index')} />
                    </div>

                    <SecaoTitulo icon={CubeIcon} loading={loadingEstoque}>
                        Estoque físico do CD (ERP em tempo real)
                    </SecaoTitulo>
                    <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
                        <StatCard label="Montadas" value={valorErp(kpisEstoque.montadas)} loading={!estoqueCD} icon={CheckCircleIcon} tone="success" hint="Prontas para faturar" />
                        <StatCard label="Desmontadas" value={valorErp(kpisEstoque.desmontadas)} loading={!estoqueCD} icon={WrenchIcon} tone="warning" hint="Em montagem" />
                        <StatCard label="Separadas" value={valorErp(kpisEstoque.separada)} loading={!estoqueCD} icon={ArchiveBoxIcon} tone="info" hint="Aguardando carga/NF" />
                        <StatCard label="Em conserto" value={valorErp(kpisEstoque.conserto)} loading={!estoqueCD} icon={WrenchScrewdriverIcon} tone="danger" hint="Avaria e retrabalho" />
                        <StatCard label="Paradas" value={valorErp(kpisEstoque.parada)} loading={!estoqueCD} icon={PauseCircleIcon} tone="neutral" hint="Inativadas" />
                    </div>

                    <SecaoTitulo icon={BuildingStorefrontIcon}>Atalhos</SecaoTitulo>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <CartaoAcao href={route('pedidos.index')} titulo="Auditoria de pedidos" desc="Inspecionar solicitações e tempos." icon={ClipboardDocumentCheckIcon} />
                        <CartaoAcao href={route('romaneios.index')} titulo="Monitorar cargas" desc="Rastrear motoristas e entregas." icon={TruckIcon} />
                        <CartaoAcao href={route('pecas.index')} titulo="Catálogo de peças" desc="Estoque por filial e modelo." icon={WrenchScrewdriverIcon} />
                        <CartaoAcao href={route('pecas.estoque.index')} titulo="Inventário do CD" desc="Entradas, transferências e saldo." icon={CubeIcon} />
                    </div>
                </>
            )}

            {/* ============ CD ============ */}
            {perfil === 'cd' && (
                <>
                    {stats.pendentes > 0 && (
                        <Alerta
                            titulo="Separação de pedidos pendente"
                            descricao={`${stats.pendentes} solicitações de chassi aguardando separação pelo CD.`}
                            href={route('pedidos.index')}
                            acao="Ir para separação"
                        />
                    )}

                    <SecaoTitulo icon={ArchiveBoxIcon}>Status da operação</SecaoTitulo>
                    <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <StatCard label="Total expedido" value={stats.cargas_total} icon={ArchiveBoxIcon} tone="neutral" hint="Motos enviadas" />
                        <StatCard label="Na fila p/ carga" value={stats.no_patio} icon={PauseCircleIcon} tone="info" hint="Separadas no pool" href={route('romaneios.create')} />
                        <StatCard label="Trânsito ativo" value={stats.cargas_transito} icon={TruckIcon} tone="warning" hint="Romaneios na rua" href={route('romaneios.index')} />
                        <StatCard label="Entregues hoje" value={stats.hoje} icon={ClipboardDocumentCheckIcon} tone="success" hint="Concluídos no dia" />
                    </div>

                    <SecaoTitulo icon={BuildingStorefrontIcon}>Mesa de operações</SecaoTitulo>
                    <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <CartaoAcao
                            href={route('pedidos.index')}
                            titulo="1. Separar pedidos"
                            desc={`${stats.pendentes} pendentes. Auditar e confirmar chassis no pátio.`}
                            icon={ClipboardDocumentCheckIcon}
                            destaque={stats.pendentes > 0}
                        />
                        <CartaoAcao
                            href={route('romaneios.create')}
                            titulo="2. Montar expedição"
                            desc={`${stats.no_patio} itens no pool. Criar romaneio de carga para a rota.`}
                            icon={TruckIcon}
                        />
                        <CartaoAcao
                            href={route('romaneios.index')}
                            titulo="3. Romaneios e rotas"
                            desc={`${stats.cargas_total} cargas montadas. Monitorar trânsito e coletas.`}
                            icon={ArchiveBoxIcon}
                        />
                        <CartaoAcao
                            href={route('pecas.estoque.index')}
                            titulo="4. Inventário de peças"
                            desc="Entradas de NF, contagem e transferências do saldo gerenciado."
                            icon={CubeIcon}
                        />
                        <CartaoAcao
                            href={route('pecas.index')}
                            titulo="5. Catálogo e localização"
                            desc="Disponibilidade e saldo por empresa no ERP."
                            icon={WrenchScrewdriverIcon}
                        />
                        <CartaoAcao
                            href={route('pecas.pendencias.index')}
                            titulo="6. Pendências de peças"
                            desc="Divergências de recebimento e alertas de reposição."
                            icon={ExclamationTriangleIcon}
                        />
                    </div>

                    <Card
                        title="Estoque físico no Microwork"
                        subtitle="Resumo por pátio, direto do ERP."
                        actions={
                            loadingEstoque ? (
                                <span className="flex items-center gap-1.5 text-xs font-bold text-content-muted">
                                    <ArrowPathIcon className="h-4 w-4 animate-spin" /> Atualizando…
                                </span>
                            ) : (
                                <Button href={route('motos.index')} variant="ghost" size="sm" icon={ArrowRightIcon} iconRight>
                                    Ver tabela
                                </Button>
                            )
                        }
                    >
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <BlocoPatio valor={valorErp(kpisEstoque.montadas)} label="Montadas / prontas" icon={CheckCircleIcon} tone="success" />
                            <BlocoPatio valor={valorErp(kpisEstoque.desmontadas)} label="Desmontadas" icon={WrenchIcon} tone="warning" />
                            <BlocoPatio valor={valorErp(kpisEstoque.separada)} label="Separadas / pool" icon={ArchiveBoxIcon} tone="info" />
                            <BlocoPatio valor={valorErp(kpisEstoque.conserto)} label="Conserto / avaria" icon={WrenchScrewdriverIcon} tone="danger" />
                        </div>
                    </Card>
                </>
            )}

            {/* ============ LOJA ============ */}
            {perfil === 'loja' && (
                <>
                    {stats.transferencias_saida > 0 && (
                        <Alerta
                            titulo="Separação necessária na sua loja"
                            descricao={`${stats.transferencias_saida} pedidos aguardando separação.`}
                            href={route('pedidos.index')}
                            acao="Resolver agora"
                        />
                    )}

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {/* Chamada principal */}
                        <Link
                            href={route('solicitar')}
                            className="group relative overflow-hidden rounded-card bg-gradient-to-br from-brand-700 to-brand-600 p-6 text-white shadow-card transition hover:shadow-card-hover md:p-8 lg:col-span-2"
                        >
                            <div className="relative z-10 flex h-full flex-col justify-between">
                                <div>
                                    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-white/70">
                                        Estoque baixo?
                                    </p>
                                    <h3 className="mb-2 text-2xl font-black md:text-3xl">
                                        Fazer pedido / reposição
                                    </h3>
                                    <p className="max-w-md text-sm leading-relaxed text-white/80">
                                        Solicite motos ao CD ou transferências entre lojas. Toda solicitação passa
                                        pela aprovação do gestor.
                                    </p>
                                </div>

                                <span className="mt-6 inline-flex w-max items-center gap-2 rounded-full bg-surface-card px-5 py-2.5 font-bold text-brand-700 shadow-sm transition group-hover:bg-brand-50">
                                    <ShoppingCartIcon className="h-5 w-5" /> Nova solicitação
                                </span>
                            </div>

                            <ShoppingCartIcon className="pointer-events-none absolute -bottom-8 -right-8 h-48 w-48 opacity-10 transition duration-500 group-hover:scale-110" />
                        </Link>

                        <div className="grid grid-cols-1 gap-4">
                            <StatCard
                                label="A chegar"
                                value={stats.receber}
                                icon={TruckIcon}
                                tone="info"
                                hint="Motos em trânsito"
                                href={route('pedidos.index')}
                            />
                            <StatCard
                                label="Meus pedidos"
                                value={stats.meus_pedidos}
                                icon={ClipboardDocumentCheckIcon}
                                tone="neutral"
                                hint="Histórico completo"
                                href={route('pedidos.index')}
                            />
                        </div>
                    </div>

                    <div className="mt-8">
                        <SecaoTitulo icon={WrenchScrewdriverIcon}>Módulo de peças</SecaoTitulo>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <CartaoAcao
                                href={route('pecas.solicitar')}
                                titulo="Solicitar peças"
                                desc="Pedidos de reposição com busca por modelo de moto."
                                icon={ShoppingCartIcon}
                                destaque
                            />
                            <CartaoAcao
                                href={route('pecas.index')}
                                titulo="Onde encontrar peças"
                                desc="Saldo por empresa e compatibilidade por modelo."
                                icon={CubeIcon}
                            />
                        </div>
                    </div>
                </>
            )}
        </AppLayout>
    );
}

/* ---------------------------------------------------------------- */
/* Subcomponentes                                                    */
/* ---------------------------------------------------------------- */

function SecaoTitulo({ icon: Icon, children, loading = false }) {
    return (
        <div className="mb-3 mt-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-content-secondary">
                {Icon && <Icon className="h-4 w-4" />}
                {children}
            </h2>

            {loading && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-content-muted">
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> Atualizando…
                </span>
            )}
        </div>
    );
}

/**
 * Aviso de ação pendente. Substitui os três blocos de alerta que existiam
 * antes com marcações diferentes (amarelo no CD, laranja na loja).
 */
function Alerta({ titulo, descricao, href, acao }) {
    return (
        <Link
            href={href}
            className="mb-6 flex flex-col items-start justify-between gap-4 rounded-card border-l-4 border-status-warning-solid bg-status-warning-bg/50 p-5 shadow-card transition hover:shadow-card-hover md:flex-row md:items-center"
        >
            <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-6 w-6 shrink-0 text-status-warning-fg" />
                <div>
                    <h3 className="font-bold text-content-primary">{titulo}</h3>
                    <p className="mt-0.5 text-sm text-content-secondary">{descricao}</p>
                </div>
            </div>

            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-status-warning-solid px-4 py-2 text-sm font-bold text-white shadow-sm">
                {acao} <ArrowRightIcon className="h-4 w-4" />
            </span>
        </Link>
    );
}

function CartaoAcao({ href, titulo, desc, icon: Icon, destaque = false }) {
    return (
        <Link
            href={href}
            className={`group flex h-full flex-col rounded-card bg-surface-card p-5 shadow-card ring-1 transition hover:shadow-card-hover
                ${destaque ? 'ring-brand-600/30' : 'ring-line hover:ring-line-strong'}`}
        >
            <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="font-bold text-content-primary transition group-hover:text-brand-700">
                    {titulo}
                </h3>
                <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition group-hover:scale-105
                        ${destaque ? 'bg-brand-600 text-white' : 'bg-surface-sunken text-content-secondary'}`}
                >
                    <Icon className="h-5 w-5" />
                </span>
            </div>

            <p className="text-sm leading-relaxed text-content-secondary">{desc}</p>

            <span className="mt-auto pt-4 text-sm font-bold text-content-muted transition group-hover:text-brand-600">
                Acessar <ArrowRightIcon className="inline h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
        </Link>
    );
}

function BlocoPatio({ valor, label, icon: Icon, tone }) {
    const tones = {
        success: 'bg-status-success-bg text-status-success-fg',
        warning: 'bg-status-warning-bg text-status-warning-fg',
        info: 'bg-status-info-bg text-status-info-fg',
        danger: 'bg-status-danger-bg text-status-danger-fg',
        neutral: 'bg-status-neutral-bg text-status-neutral-fg',
    };

    return (
        <div className={`flex flex-col items-center rounded-card p-4 text-center ${tones[tone]}`}>
            <Icon className="mb-1.5 h-5 w-5 opacity-80" />
            {valor === null ? (
                <span className="my-1 h-8 w-10 animate-pulse rounded bg-current opacity-20" />
            ) : (
                <span className="text-3xl font-black tabular-nums">{valor}</span>
            )}
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-80">
                {label}
            </span>
        </div>
    );
}
