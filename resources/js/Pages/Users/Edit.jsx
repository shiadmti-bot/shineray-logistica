import AppLayout from '@/Layouts/AppLayout';
import { PageHeader, Card, Button } from '@/Components/UI';
import { Head, useForm, Link } from '@inertiajs/react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import {
    BuildingStorefrontIcon,
    BuildingOffice2Icon,
    ShieldCheckIcon,
    BriefcaseIcon,
    UserIcon,
    EnvelopeIcon,
    KeyIcon,
    EyeIcon,
    EyeSlashIcon,
    BoltIcon,
    TruckIcon,
    WrenchScrewdriverIcon,
    CheckCircleIcon,
    ArrowLeftIcon,
    CheckIcon,
    LockClosedIcon,
    CubeIcon,
} from '@heroicons/react/24/outline';

export default function UserEdit({ auth, usuario, filiais, rotas }) {
    const [mostrarSenha, setMostrarSenha] = useState(false);

    const { data, setData, put, processing, errors } = useForm({
        name: usuario.name || '',
        email: usuario.email || '',
        perfil: usuario.perfil || 'loja',
        filial: usuario.filial || '',
        is_interior: Boolean(usuario.is_interior),
        default_route_id: usuario.default_route_id || '',
        valida_pecas: Boolean(usuario.valida_pecas),
        valida_motos: usuario.valida_motos !== undefined ? Boolean(usuario.valida_motos) : (usuario.perfil === 'gestor'),
        password: '',
        password_confirmation: '',
    });

    const perfisConfig = [
        {
            key: 'loja',
            titulo: 'Loja / Revenda',
            descricao: 'Acesso da filial para solicitar motos, peças, receber cargas e abrir devoluções.',
            icon: BuildingStorefrontIcon,
            badgeClass: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
            borderActive: 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/20',
        },
        {
            key: 'cd',
            titulo: 'Operação CD',
            descricao: 'Acesso do Centro de Distribuição para separação, basquetas de peças e despacho.',
            icon: BuildingOffice2Icon,
            badgeClass: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
            borderActive: 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/20',
        },
        {
            key: 'gestor',
            titulo: 'Diretoria / Gestão',
            descricao: 'Visão executiva para aprovar pedidos, validar devoluções e acompanhar métricas.',
            icon: BriefcaseIcon,
            badgeClass: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
            borderActive: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20',
        },
        {
            key: 'admin',
            titulo: 'Administrador Geral',
            descricao: 'Controle irrestrito do sistema, gestão de acessos, auditoria e cadastros globais.',
            icon: ShieldCheckIcon,
            badgeClass: 'bg-zinc-900 text-white',
            borderActive: 'border-zinc-900 ring-2 ring-zinc-900/20 bg-zinc-50',
        },
    ];

    const perfilAtual = perfisConfig.find((p) => p.key === data.perfil) || perfisConfig[0];
    const rotaSelecionada = rotas?.find((r) => String(r.id) === String(data.default_route_id));

    const submit = (e) => {
        e.preventDefault();
        put(route('users.update', usuario.id), {
            onSuccess: () => {
                Swal.fire({
                    title: 'Dados Atualizados!',
                    text: `As permissões e informações de ${data.name} foram salvas com sucesso.`,
                    icon: 'success',
                    timer: 2500,
                    showConfirmButton: false,
                });
            },
            onError: () => {
                Swal.fire({
                    title: 'Erro na Atualização',
                    text: 'Por favor, revise os campos destacados em vermelho.',
                    icon: 'error',
                });
            },
        });
    };

    return (
        <AppLayout user={auth.user}>
            <Head title={`Editar ${usuario.name}`} />

            <PageHeader
                title={`Editar Usuário: ${usuario.name}`}
                description={`Ajuste credenciais, filiais e regras logísticas da conta #${usuario.id}.`}
                breadcrumbs={[
                    { label: 'Início', href: route('dashboard') },
                    { label: 'Usuários', href: route('users.index') },
                    { label: 'Editar Usuário' },
                ]}
                actions={
                    <Button href={route('users.index')} variant="secondary" icon={ArrowLeftIcon}>
                        Voltar para Lista
                    </Button>
                }
            />

            <form onSubmit={submit}>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
                    {/* ========================================================
                        COLUNA PRINCIPAL: FORMULÁRIO DE EDIÇÃO
                    ======================================================== */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* 1. SELEÇÃO DE PERFIL */}
                        <Card
                            title="1. Nível de Acesso & Perfil"
                            subtitle="Altere o perfil de acesso e os privilégios da conta."
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {perfisConfig.map((p) => {
                                    const Icon = p.icon;
                                    const isSelected = data.perfil === p.key;

                                    return (
                                        <div
                                            key={p.key}
                                            onClick={() => {
                                                setData('perfil', p.key);
                                                if (p.key !== 'loja') {
                                                    setData((prev) => ({
                                                        ...prev,
                                                        perfil: p.key,
                                                        filial: p.key === 'cd' ? 'CD Ananindeua' : 'Matriz',
                                                    }));
                                                }
                                            }}
                                            className={`relative cursor-pointer rounded-xl border p-4 transition-all ${
                                                isSelected
                                                    ? p.borderActive
                                                    : 'border-line hover:border-line-strong hover:bg-surface-sunken/40'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`p-2.5 rounded-lg shrink-0 ${
                                                        isSelected
                                                            ? 'bg-surface-card shadow-sm'
                                                            : 'bg-surface-sunken text-content-secondary'
                                                    }`}
                                                >
                                                    <Icon className="h-5 w-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-bold text-sm text-content-primary">
                                                            {p.titulo}
                                                        </span>
                                                        {isSelected && (
                                                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white text-xs">
                                                                <CheckIcon className="h-3 w-3 stroke-[3]" />
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-1 text-xs text-content-secondary leading-relaxed">
                                                        {p.descricao}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {errors.perfil && (
                                <p className="mt-2 text-xs text-status-danger-fg">{errors.perfil}</p>
                            )}
                        </Card>

                        {/* 2. DADOS PESSOAIS & LOGIN */}
                        <Card
                            title="2. Identificação & Credenciais"
                            subtitle="Dados cadastrais do usuário e login de acesso."
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1.5">
                                        Nome Completo ou Nome da Unidade <span className="text-status-danger-fg">*</span>
                                    </label>
                                    <div className="relative">
                                        <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                                        <input
                                            type="text"
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                            className="w-full rounded-lg border border-line-strong bg-surface-canvas pl-10 pr-4 py-2 text-sm text-content-primary placeholder-content-muted focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                            required
                                        />
                                    </div>
                                    {errors.name && (
                                        <p className="mt-1 text-xs text-status-danger-fg">{errors.name}</p>
                                    )}
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1.5">
                                        E-mail de Acesso (Login) <span className="text-status-danger-fg">*</span>
                                    </label>
                                    <div className="relative">
                                        <EnvelopeIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                                        <input
                                            type="email"
                                            value={data.email}
                                            onChange={(e) => setData('email', e.target.value)}
                                            className="w-full rounded-lg border border-line-strong bg-surface-canvas pl-10 pr-4 py-2 text-sm text-content-primary placeholder-content-muted focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                            required
                                        />
                                    </div>
                                    {errors.email && (
                                        <p className="mt-1 text-xs text-status-danger-fg">{errors.email}</p>
                                    )}
                                </div>
                            </div>
                        </Card>

                        {/* 3. FILIAL & DIRETRIZES LOGÍSTICAS */}
                        {data.perfil === 'loja' && (
                            <Card
                                title="3. Vínculo Territorial da Filial"
                                subtitle="Selecione a loja da rede para vincular os pedidos e o saldo."
                            >
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1.5">
                                            Loja / Filial Oficial <span className="text-status-danger-fg">*</span>
                                        </label>
                                        <select
                                            value={data.filial}
                                            onChange={(e) => setData('filial', e.target.value)}
                                            className="w-full rounded-lg border border-line-strong bg-surface-canvas px-3.5 py-2 text-sm text-content-primary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                            required
                                        >
                                            <option value="">-- Selecione a filial correspondente --</option>
                                            {filiais?.map((f) => (
                                                <option key={f.id} value={`${f.cidade}/${f.uf}`}>
                                                    [{f.uf}] {f.cidade} - {f.nome}
                                                </option>
                                            ))}
                                            <option value="Matriz">Matriz / Escritório Central</option>
                                        </select>
                                        {errors.filial && (
                                            <p className="mt-1 text-xs text-status-danger-fg">{errors.filial}</p>
                                        )}
                                    </div>

                                    {/* Modelo Logístico: Capital vs Interior */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1.5">
                                            Modelo Logístico de Roteamento
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div
                                                onClick={() => setData('is_interior', false)}
                                                className={`cursor-pointer rounded-xl border p-3.5 flex items-center gap-3 transition ${
                                                    !data.is_interior
                                                        ? 'border-status-success-solid bg-status-success-bg/30 ring-2 ring-status-success-solid/20 shadow-sm'
                                                        : 'border-line hover:border-line-strong bg-surface-card'
                                                }`}
                                            >
                                                <div
                                                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${
                                                        !data.is_interior
                                                            ? 'bg-status-success-bg text-status-success-fg'
                                                            : 'bg-surface-sunken text-content-muted'
                                                    }`}
                                                >
                                                    <BoltIcon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-content-primary">
                                                        Capital (Direto)
                                                    </div>
                                                    <div className="text-xs text-content-secondary">
                                                        Transferência Loja ➔ Loja
                                                    </div>
                                                </div>
                                            </div>

                                            <div
                                                onClick={() => setData('is_interior', true)}
                                                className={`cursor-pointer rounded-xl border p-3.5 flex items-center gap-3 transition ${
                                                    data.is_interior
                                                        ? 'border-status-warning-solid bg-status-warning-bg/30 ring-2 ring-status-warning-solid/20 shadow-sm'
                                                        : 'border-line hover:border-line-strong bg-surface-card'
                                                }`}
                                            >
                                                <div
                                                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${
                                                        data.is_interior
                                                            ? 'bg-status-warning-bg text-status-warning-fg'
                                                            : 'bg-surface-sunken text-content-muted'
                                                    }`}
                                                >
                                                    <TruckIcon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-content-primary">
                                                        Interior (Via CD)
                                                    </div>
                                                    <div className="text-xs text-content-secondary">
                                                        Triagem obrigatória no CD
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* 4. ROTA LOGÍSTICA OFICIAL */}
                        {(data.perfil === 'loja' || data.perfil === 'cd') && (
                            <Card
                                title="4. Rota Logística Oficial"
                                subtitle="Vincula este usuário ao calendário e escalas de transporte do CD."
                            >
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1.5">
                                        Rota Preferencial
                                    </label>
                                    <select
                                        value={data.default_route_id}
                                        onChange={(e) => setData('default_route_id', e.target.value)}
                                        className="w-full rounded-lg border border-line-strong bg-surface-canvas px-3.5 py-2 text-sm text-content-primary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                    >
                                        <option value="">-- Nenhuma rota padrão atribuída --</option>
                                        {rotas?.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                [{r.code}] {r.name ? `- ${r.name}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1.5 text-xs text-content-muted">
                                        Quando definida, o calendário de expedição do CD priorizará as viagens nesta rota para esta unidade.
                                    </p>
                                    {errors.default_route_id && (
                                        <p className="mt-1 text-xs text-status-danger-fg">
                                            {errors.default_route_id}
                                        </p>
                                    )}
                                </div>
                            </Card>
                        )}

                        {/* 5. ATRIBUIÇÕES DE VALIDAÇÃO (SEPARAÇÃO MOTOS VS PEÇAS) */}
                        {data.perfil !== 'loja' && (
                            <Card
                                title="5. Atribuições de Validação (Módulos Independentes)"
                                subtitle="Quem valida peças NÃO necessariamente valida motos, e vice-versa. Configure cada alçada."
                            >
                                <div className="space-y-3.5">
                                    {/* Validador de Motos */}
                                    <div className={`rounded-xl border p-4 transition ${data.valida_motos || data.perfil === 'gestor' ? 'border-amber-400 bg-amber-50/20' : 'border-line bg-surface-sunken/40'}`}>
                                        <label className="flex items-start gap-3.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={data.valida_motos || data.perfil === 'gestor'}
                                                disabled={data.perfil === 'gestor'}
                                                onChange={(e) => setData('valida_motos', e.target.checked)}
                                                className="mt-1 h-4 w-4 rounded border-line-strong text-amber-600 focus:ring-amber-500 disabled:opacity-60"
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-content-primary">
                                                        Validador de Motos (Gestão Comercial)
                                                    </span>
                                                    <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 uppercase">
                                                        Motos
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-content-secondary leading-relaxed">
                                                    Autoriza a aprovar ou rejeitar pedidos de reposição e transferência de motos e aprovar estornos/devoluções no painel de Motos. Não dá acesso à liberação de peças.
                                                </p>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Validador de Peças */}
                                    <div className={`rounded-xl border p-4 transition ${data.valida_pecas ? 'border-brand-400 bg-brand-50/20' : 'border-line bg-surface-sunken/40'}`}>
                                        <label className="flex items-start gap-3.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={data.valida_pecas}
                                                onChange={(e) => setData('valida_pecas', e.target.checked)}
                                                className="mt-1 h-4 w-4 rounded border-line-strong text-brand-600 focus:ring-brand-500"
                                            />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-content-primary">
                                                        Validador de Peças (Pós-Venda - Gate 1)
                                                    </span>
                                                    <span className="rounded bg-brand-50 px-2 py-0.5 text-[10px] font-extrabold text-brand-700 uppercase">
                                                        Peças
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-xs text-content-secondary leading-relaxed">
                                                    Autoriza a assinar a liberação técnica de peças sem código ou com divergência de preço na Fila de Atendimento do Pós-Venda. Não dá acesso a aprovações de motos.
                                                </p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </Card>
                        )}

                        {/* 6. ALTERAÇÃO DE SENHA (OPCIONAL) */}
                        <Card
                            title="6. Alteração de Senha (Opcional)"
                            subtitle="Deixe em branco caso deseje manter a senha atual do usuário."
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1.5">
                                        Nova Senha
                                    </label>
                                    <div className="relative">
                                        <KeyIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                                        <input
                                            type={mostrarSenha ? 'text' : 'password'}
                                            value={data.password}
                                            onChange={(e) => setData('password', e.target.value)}
                                            placeholder="Deixe em branco para manter"
                                            className="w-full rounded-lg border border-line-strong bg-surface-canvas pl-10 pr-10 py-2 text-sm text-content-primary placeholder-content-muted focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setMostrarSenha(!mostrarSenha)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-primary"
                                        >
                                            {mostrarSenha ? (
                                                <EyeSlashIcon className="h-4 w-4" />
                                            ) : (
                                                <EyeIcon className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                    {errors.password && (
                                        <p className="mt-1 text-xs text-status-danger-fg">{errors.password}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-content-secondary mb-1.5">
                                        Confirmar Nova Senha
                                    </label>
                                    <div className="relative">
                                        <KeyIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                                        <input
                                            type={mostrarSenha ? 'text' : 'password'}
                                            value={data.password_confirmation}
                                            onChange={(e) => setData('password_confirmation', e.target.value)}
                                            placeholder="Repita a nova senha"
                                            className="w-full rounded-lg border border-line-strong bg-surface-canvas pl-10 pr-4 py-2 text-sm text-content-primary placeholder-content-muted focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* BOTÕES DO FORMULÁRIO */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                            <Button href={route('users.index')} variant="secondary">
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                loading={processing}
                                icon={CheckCircleIcon}
                            >
                                Salvar Alterações
                            </Button>
                        </div>
                    </div>

                    {/* ========================================================
                        COLUNA LATERAL: PRÉ-VISUALIZAÇÃO / CRACHÁ DIGITAL
                    ======================================================== */}
                    <div className="lg:col-span-4 sticky top-6 space-y-4">
                        <div className="rounded-2xl border border-line bg-surface-card p-5 shadow-sm space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-line">
                                <span className="text-xs font-bold uppercase tracking-wider text-content-muted">
                                    Crachá do Usuário
                                </span>
                                <span className="text-[10px] font-mono text-content-muted">ID: #{usuario.id}</span>
                            </div>

                            {/* Avatar & Identificação */}
                            <div className="flex flex-col items-center text-center pt-2">
                                <div
                                    className={`flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-black text-white uppercase shadow-md transition-colors ${
                                        data.perfil === 'admin'
                                            ? 'bg-zinc-900'
                                            : data.perfil === 'gestor'
                                            ? 'bg-amber-600'
                                            : data.perfil === 'cd'
                                            ? 'bg-sky-600'
                                            : 'bg-brand-600'
                                    }`}
                                >
                                    {data.name ? data.name.charAt(0) : 'U'}
                                </div>

                                <h3 className="mt-3 font-black text-content-primary text-base truncate max-w-full">
                                    {data.name || 'Nome do Usuário'}
                                </h3>
                                <p className="text-xs text-content-secondary truncate max-w-full">
                                    {data.email || 'email@shineray.com.br'}
                                </p>

                                <div className="mt-3">
                                    <span
                                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${perfilAtual.badgeClass}`}
                                    >
                                        {perfilAtual.titulo}
                                    </span>
                                </div>
                            </div>

                            {/* Detalhes Operacionais */}
                            <div className="rounded-xl bg-surface-sunken/60 p-3.5 text-xs space-y-2.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-content-muted">Unidade:</span>
                                    <span className="font-semibold text-content-primary truncate max-w-[170px]">
                                        {data.perfil === 'loja'
                                            ? data.filial || 'Pendente'
                                            : data.perfil === 'cd'
                                            ? 'CD Ananindeua'
                                            : 'Matriz Geral'}
                                    </span>
                                </div>

                                {data.perfil === 'loja' && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-content-muted">Logística:</span>
                                        <span
                                            className={`font-bold ${
                                                data.is_interior
                                                    ? 'text-status-warning-fg'
                                                    : 'text-status-success-fg'
                                            }`}
                                        >
                                            {data.is_interior ? '🏭 Interior (CD)' : '⚡ Capital (Direto)'}
                                        </span>
                                    </div>
                                )}

                                {(data.perfil === 'loja' || data.perfil === 'cd') && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-content-muted">Rota:</span>
                                        <span className="font-mono font-semibold text-content-primary">
                                            {rotaSelecionada ? rotaSelecionada.code : 'Não vinculada'}
                                        </span>
                                    </div>
                                )}

                                {data.perfil !== 'loja' && (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <span className="text-content-muted">Valida Motos:</span>
                                            <span
                                                className={`font-bold ${
                                                    data.valida_motos || data.perfil === 'gestor' || data.perfil === 'admin'
                                                        ? 'text-amber-700'
                                                        : 'text-content-muted'
                                                }`}
                                            >
                                                {data.valida_motos || data.perfil === 'gestor' || data.perfil === 'admin' ? 'Sim (Aprova Motos)' : 'Não'}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <span className="text-content-muted">Valida Peças:</span>
                                            <span
                                                className={`font-bold ${
                                                    data.valida_pecas || data.perfil === 'admin'
                                                        ? 'text-brand-700'
                                                        : 'text-content-muted'
                                                }`}
                                            >
                                                {data.valida_pecas || data.perfil === 'admin' ? 'Sim (Gate 1 Ativo)' : 'Não'}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Informações de Escopo */}
                            <div className="text-[11px] text-content-muted leading-relaxed bg-brand-50/40 p-3 rounded-lg border border-brand-100">
                                💡 <strong>Resumo do Acesso:</strong> {perfilAtual.descricao}
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </AppLayout>
    );
}