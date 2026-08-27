import { useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArchiveBoxIcon,
    ExclamationTriangleIcon,
    CalendarDaysIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/outline';

import AppLayout from '@/Layouts/AppLayout';
import { Card, PageHeader, EmptyState, StatCard, Button } from '@/Components/UI';

/**
 * Basquetas do CD — o caixote de cada filial.
 *
 * Uma linha por filial habilitada, ordenada pela peça que está esperando há
 * mais tempo. Basqueta sem viagem marcada e parada há dias sobe para o topo
 * com alerta: peça ali dentro é saldo reservado, some do disponível do CD sem
 * ter saído do galpão.
 */
export default function Basquetas({ basquetas = [], vazias = [], diasAlerta = 7 }) {
    const [aberta, setAberta] = useState(null);

    const emAlerta = basquetas.filter((b) => b.em_alerta);
    const totalUnidades = basquetas.reduce((s, b) => s + b.total_un, 0);
    const comViagem = basquetas.filter((b) => b.viagem).length;

    return (
        <AppLayout>
            <Head title="Basquetas" />

            <PageHeader
                title="Basquetas"
                subtitle="O que está separado e esperando a carga de cada filial"
                breadcrumbs={[{ label: 'Peças' }, { label: 'Basquetas' }]}
            />

            <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <StatCard
                    label="Filiais com peça separada"
                    value={basquetas.length}
                    icon={ArchiveBoxIcon}
                />
                <StatCard
                    label="Unidades aguardando"
                    value={totalUnidades}
                    icon={ArchiveBoxIcon}
                />
                <StatCard
                    label="Com viagem marcada"
                    value={`${comViagem} de ${basquetas.length}`}
                    icon={CalendarDaysIcon}
                    tone={comViagem < basquetas.length ? 'warning' : 'success'}
                />
            </div>

            {emAlerta.length > 0 && (
                <div className="mb-6 flex items-start gap-3 rounded-lg border border-status-warning-solid/40 bg-status-warning-bg p-4">
                    <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-status-warning-fg" />
                    <div>
                        <p className="text-sm font-bold text-status-warning-fg">
                            {emAlerta.length} basqueta(s) parada(s) há {diasAlerta}+ dias sem viagem marcada
                        </p>
                        <p className="mt-0.5 text-xs text-status-warning-fg">
                            {emAlerta.map((b) => b.local).join(', ')}. Essas peças estão com o saldo
                            reservado no CD — marque a rota no Calendário para liberá-las.
                        </p>
                    </div>
                </div>
            )}

            {basquetas.length === 0 ? (
                <EmptyState
                    icon={ArchiveBoxIcon}
                    title="Nenhuma basqueta com peça"
                    description="Assim que o CD separar a primeira peça de um pedido, a basqueta da filial aparece aqui."
                />
            ) : (
                <div className="space-y-3">
                    {basquetas.map((b) => (
                        <LinhaBasqueta
                            key={b.id}
                            basqueta={b}
                            expandida={aberta === b.id}
                            onAlternar={() => setAberta(aberta === b.id ? null : b.id)}
                        />
                    ))}
                </div>
            )}

            {vazias.length > 0 && (
                <Card className="mt-6" title="Filiais sem peça separada" padding="sm">
                    <div className="flex flex-wrap gap-2">
                        {vazias.map((v) => (
                            <span
                                key={v.local_id}
                                className="rounded bg-surface-sunken px-2.5 py-1 text-xs text-content-muted"
                            >
                                {v.local}
                            </span>
                        ))}
                    </div>
                </Card>
            )}
        </AppLayout>
    );
}

/* ------------------------------------------------------------------ */

function LinhaBasqueta({ basqueta, expandida, onAlternar }) {
    const Chevron = expandida ? ChevronDownIcon : ChevronRightIcon;

    return (
        <Card padding="none">
            <button
                type="button"
                onClick={onAlternar}
                className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-surface-sunken"
            >
                <Chevron className="h-4 w-4 shrink-0 text-content-muted" />

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-sm font-bold text-content-primary">
                            {basqueta.local}
                        </span>
                        <span className="font-mono text-[11px] text-content-muted">
                            basqueta #{basqueta.id}
                        </span>
                        {basqueta.em_alerta && (
                            <span className="rounded bg-status-warning-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-status-warning-fg">
                                Parada há {basqueta.dias_espera} dias
                            </span>
                        )}
                    </div>

                    <p className="mt-0.5 text-xs text-content-secondary">
                        {basqueta.total_un} unidade(s) em {basqueta.itens.length} item(ns)
                        {basqueta.dias_espera > 0 && ` · mais antiga há ${basqueta.dias_espera} dia(s)`}
                    </p>
                </div>

                <div className="shrink-0 text-right">
                    {basqueta.viagem ? (
                        <>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted">
                                Sai em
                            </p>
                            <p className="text-sm font-bold tabular-nums text-status-success-fg">
                                {formatarData(basqueta.viagem.data)}
                            </p>
                        </>
                    ) : (
                        <p className="text-xs font-semibold text-status-warning-fg">
                            Sem viagem marcada
                        </p>
                    )}
                </div>
            </button>

            {expandida && (
                <div className="border-t border-line">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-surface-sunken text-content-muted">
                                <th className="px-4 py-2 text-left font-bold uppercase tracking-wide">Código</th>
                                <th className="px-4 py-2 text-left font-bold uppercase tracking-wide">Descrição</th>
                                <th className="px-4 py-2 text-left font-bold uppercase tracking-wide">Pedido</th>
                                <th className="px-4 py-2 text-right font-bold uppercase tracking-wide">Qtd</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {basqueta.itens.map((i) => (
                                <tr key={i.id}>
                                    <td className="px-4 py-2 font-mono text-content-primary">{i.codigo}</td>
                                    <td className="px-4 py-2 text-content-secondary">{i.descricao}</td>
                                    <td className="px-4 py-2 text-content-muted">
                                        #{i.pedido_id}
                                        {i.solicitante && ` · ${i.solicitante}`}
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold tabular-nums text-content-primary">
                                        {i.quantidade} {i.unidade}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <Faturamento basqueta={basqueta} />
                </div>
            )}
        </Card>
    );
}

/* ------------------------------------------------------------------ */

/**
 * Passo 6 — recolher, faturar e emitir o romaneio.
 *
 * A NF é emitida no Microwork; aqui se registra o vínculo. Depois disto a
 * caixa não aceita peça nova: incluir um item passa a exigir o ciclo de
 * ajuste, com cancelamento e reemissão da nota.
 */
function Faturamento({ basqueta }) {
    const [aberto, setAberto] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        numero: '',
        serie: '',
        chave: '',
        valor_total: '',
        volumes: 1,
    });

    const enviar = (e) => {
        e.preventDefault();
        post(route('pecas.basquetas.faturar', basqueta.id), {
            preserveScroll: true,
            onSuccess: () => { reset(); setAberto(false); },
        });
    };

    /*
     * Caixa já faturada não é refaturada: ela está com a filial, esperando a
     * conferência do Gate 2. O que resta ao CD aqui é acompanhar e abrir o
     * romaneio.
     */
    if (!basqueta.aberta) {
        return (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-sunken px-4 py-3">
                <p className="text-xs text-content-secondary">
                    {basqueta.nota && <>NF <strong>{basqueta.nota}</strong> · </>}
                    {basqueta.conferida
                        ? 'Conferida pela filial. Pronta para entrar numa carga.'
                        : 'Aguardando a conferência da filial antes do despacho.'}
                </p>
                <Link
                    href={route('pecas.basquetas.romaneio', basqueta.id)}
                    className="text-xs font-bold text-brand-700 hover:underline"
                >
                    Ver romaneio
                </Link>
            </div>
        );
    }

    if (!aberto) {
        return (
            <div className="border-t border-line bg-surface-sunken px-4 py-3">
                {basqueta.ajuste_motivo && (
                    <p className="mb-2 rounded bg-status-warning-bg px-3 py-2 text-xs text-status-warning-fg">
                        <strong>Ajuste pedido pela filial: </strong>
                        {basqueta.ajuste_motivo} — inclua o item e fature novamente.
                    </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-content-secondary">
                        {basqueta.viagem
                            ? 'Viagem confirmada. Recolha a caixa, emita a NF no Microwork e registre aqui.'
                            : 'Sem viagem marcada — o CD precisa confirmar a rota no Calendário antes de faturar.'}
                    </p>
                    <Button icon={DocumentTextIcon} onClick={() => setAberto(true)}>
                        Faturar e gerar romaneio
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={enviar} className="space-y-3 border-t border-line bg-surface-sunken px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Campo label="Número da NF" erro={errors.numero}>
                    <input
                        value={data.numero}
                        onChange={(e) => setData('numero', e.target.value)}
                        placeholder="123456"
                        className="w-full rounded border-line-strong bg-surface py-2 text-xs tabular-nums focus:ring-brand-500"
                    />
                </Campo>

                <Campo label="Série" erro={errors.serie}>
                    <input
                        value={data.serie}
                        onChange={(e) => setData('serie', e.target.value)}
                        placeholder="1"
                        className="w-full rounded border-line-strong bg-surface py-2 text-xs tabular-nums focus:ring-brand-500"
                    />
                </Campo>

                <Campo label="Volumes (caixas)" erro={errors.volumes}>
                    <input
                        type="number"
                        min="1"
                        value={data.volumes}
                        onChange={(e) => setData('volumes', e.target.value)}
                        className="w-full rounded border-line-strong bg-surface py-2 text-xs tabular-nums focus:ring-brand-500"
                    />
                </Campo>

                <Campo label="Valor total (opcional)" erro={errors.valor_total}>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={data.valor_total}
                        onChange={(e) => setData('valor_total', e.target.value)}
                        placeholder="calculado pelos itens"
                        className="w-full rounded border-line-strong bg-surface py-2 text-xs tabular-nums focus:ring-brand-500"
                    />
                </Campo>
            </div>

            <Campo label="Chave da NF-e (44 dígitos, opcional)" erro={errors.chave}>
                <input
                    value={data.chave}
                    onChange={(e) => setData('chave', e.target.value)}
                    maxLength={44}
                    className="w-full rounded border-line-strong bg-surface py-2 font-mono text-xs focus:ring-brand-500"
                />
            </Campo>

            {errors.geral && (
                <p className="text-xs font-bold text-status-danger-fg">{errors.geral}</p>
            )}

            <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={processing} disabled={!data.numero}>
                    Confirmar faturamento
                </Button>
                <Button type="button" variant="secondary" onClick={() => setAberto(false)}>
                    Cancelar
                </Button>
                <Link
                    href={route('pecas.basquetas.romaneio', basqueta.id)}
                    className="inline-flex items-center px-3 text-xs font-bold text-brand-700 hover:underline"
                >
                    Ver romaneio
                </Link>
            </div>
        </form>
    );
}

function Campo({ label, erro, children }) {
    return (
        <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-content-muted">
                {label}
            </span>
            {children}
            {erro && <span className="mt-1 block text-[10px] text-status-danger-fg">{erro}</span>}
        </label>
    );
}

function formatarData(valor) {
    if (!valor) return '—';

    // A data vem como 'YYYY-MM-DD' do banco. Montar o Date a partir das partes
    // evita o fuso zerar um dia — new Date('2026-08-26') é interpretado em UTC.
    const [ano, mes, dia] = String(valor).slice(0, 10).split('-');

    return `${dia}/${mes}/${ano}`;
}
