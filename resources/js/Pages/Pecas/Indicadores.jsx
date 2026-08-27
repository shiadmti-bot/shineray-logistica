import { Head, router } from '@inertiajs/react';
import {
    ClockIcon,
    ArchiveBoxIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import AppLayout from '@/Layouts/AppLayout';
import { Card, PageHeader, StatCard, EmptyState } from '@/Components/UI';

/**
 * Indicadores do fluxo de peças — a Fase 5 do alinhamento com o manual.
 *
 * SEM GRÁFICO, DE PROPÓSITO.
 * Cada número aqui é uma manchete que responde uma pergunta ("quanto tempo a
 * filial espera por um código?"), e a comparação que importa é entre duas
 * contagens, não uma série ao longo do tempo. Manchete quer tile; 18 filiais
 * lado a lado querem tabela. Um gráfico aqui seria decoração.
 *
 * NULL É "SEM DADOS", NUNCA ZERO.
 * Um indicador sem base no período mostra travessão. Zero dias de permanência
 * seria uma mentira otimista quando na verdade nada foi medido.
 */
export default function Indicadores({ periodo, atendimento, basquetas, qualidade, porFilial = [] }) {
    const trocarPeriodo = (dias) =>
        router.get(route('pecas.indicadores'), { dias }, { preserveState: true, replace: true });

    return (
        <AppLayout>
            <Head title="Indicadores de Peças" />

            <PageHeader
                title="Indicadores de Peças"
                subtitle="Onde o fluxo trava e quanto a dupla confirmação está pegando"
                breadcrumbs={[{ label: 'Peças' }, { label: 'Indicadores' }]}
                actions={
                    <div className="flex gap-1 rounded-lg bg-surface-sunken p-1">
                        {periodo.opcoes.map((d) => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => trocarPeriodo(d)}
                                className={`rounded px-3 py-1.5 text-xs font-bold transition ${
                                    periodo.dias === d
                                        ? 'bg-surface-card text-content-primary shadow-sm'
                                        : 'text-content-muted hover:text-content-secondary'
                                }`}
                            >
                                {d} dias
                            </button>
                        ))}
                    </div>
                }
            />

            {/* --- A MANCHETE: o que o Gate 2 pegou --- */}
            <Card
                className="mb-6"
                title="A regra do manual, medida"
                subtitle="Cada ajuste pedido na conferência é uma viagem que não foi desperdiçada"
            >
                <div className="grid gap-6 sm:grid-cols-2">
                    <Manchete
                        valor={qualidade.ajustes_gate2}
                        rotulo="erros pegos na doca"
                        detalhe={
                            qualidade.taxa_ajuste_pct === null
                                ? 'Nenhuma caixa conferida no período'
                                : `${qualidade.taxa_ajuste_pct}% das ${qualidade.conferidas} caixas conferidas`
                        }
                        tom="success"
                    />
                    <Manchete
                        valor={qualidade.divergencias}
                        rotulo="erros que chegaram na filial"
                        detalhe="Divergências acusadas só no recebimento"
                        tom={qualidade.divergencias > qualidade.ajustes_gate2 ? 'danger' : 'neutral'}
                    />
                </div>

                <p className="mt-5 border-t border-line pt-4 text-xs text-content-secondary">
                    A leitura é a razão entre os dois ao longo do tempo. Se a dupla confirmação
                    funciona, o número da esquerda sobe e o da direita cai &mdash; o erro muda de
                    lugar, da filial para a doca.
                </p>
            </Card>

            {/* --- ATENDIMENTO --- */}
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-content-muted">
                Atendimento &mdash; Passos 2 e 3
            </h2>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Até achar o código"
                    value={horas(atendimento.horas_ate_codigo)}
                    icon={ClockIcon}
                    tone="info"
                />
                <StatCard
                    label="Até a liberação"
                    value={horas(atendimento.horas_ate_liberacao)}
                    icon={ShieldCheckIcon}
                    tone="info"
                />
                <StatCard
                    label="Na fila sem código"
                    value={atendimento.fila_sem_codigo}
                    icon={ExclamationTriangleIcon}
                    tone={atendimento.fila_sem_codigo > 0 ? 'warning' : 'success'}
                />
                <StatCard
                    label="Esperando assinatura"
                    value={atendimento.fila_sem_liberacao}
                    icon={ExclamationTriangleIcon}
                    tone={atendimento.fila_sem_liberacao > 0 ? 'warning' : 'success'}
                />
            </div>

            {atendimento.pct_sem_codigo !== null && (
                <p className="mb-8 text-xs text-content-secondary">
                    <strong>{atendimento.pct_sem_codigo}%</strong> das {atendimento.cotas_periodo} cotas
                    do período chegaram sem código &mdash; o caso que o manual descreve e que antes
                    vivia fora do sistema.
                </p>
            )}

            {/* --- BASQUETAS --- */}
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-content-muted">
                Basqueta e janela &mdash; Passos 4 e 5
            </h2>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Permanência média"
                    value={dias(basquetas.dias_medio)}
                    icon={ArchiveBoxIcon}
                    tone="info"
                />
                <StatCard
                    label="Maior permanência"
                    value={dias(basquetas.dias_maximo)}
                    icon={ArchiveBoxIcon}
                    tone={basquetas.dias_maximo > 14 ? 'warning' : 'neutral'}
                />
                <StatCard
                    label="Saíram na viagem marcada"
                    value={
                        basquetas.aderencia_pct === null
                            ? '—'
                            : `${basquetas.aderencia_pct}%`
                    }
                    icon={ShieldCheckIcon}
                    tone={
                        basquetas.aderencia_pct === null
                            ? 'neutral'
                            : basquetas.aderencia_pct >= 80
                              ? 'success'
                              : 'warning'
                    }
                />
                <StatCard
                    label="Abertas sem viagem"
                    value={`${basquetas.sem_viagem} de ${basquetas.abertas}`}
                    icon={ExclamationTriangleIcon}
                    tone={basquetas.sem_viagem > 0 ? 'warning' : 'success'}
                />
            </div>

            {/* --- POR FILIAL --- */}
            <Card
                title="Por filial"
                subtitle={`Caixas abertas nos últimos ${periodo.dias} dias`}
                padding="none"
            >
                {porFilial.length === 0 ? (
                    <div className="p-6">
                        <EmptyState
                            icon={ArchiveBoxIcon}
                            title="Sem basquetas no período"
                            description="Os números aparecem assim que o CD separar a primeira peça."
                        />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] text-sm">
                            <thead>
                                <tr className="border-b border-line bg-surface-sunken text-content-muted">
                                    <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest">
                                        Filial
                                    </th>
                                    <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest">
                                        Caixas
                                    </th>
                                    <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest">
                                        Dias na caixa
                                    </th>
                                    <th className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-widest">
                                        Ajustes
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {porFilial.map((f) => (
                                    <tr key={f.filial}>
                                        <td className="px-5 py-2.5 font-semibold text-content-primary">
                                            {f.filial}
                                        </td>
                                        <td className="px-5 py-2.5 text-right tabular-nums text-content-secondary">
                                            {f.caixas}
                                        </td>
                                        <td className="px-5 py-2.5 text-right tabular-nums text-content-secondary">
                                            {f.dias_medio === null ? '—' : f.dias_medio}
                                        </td>
                                        <td className="px-5 py-2.5 text-right tabular-nums">
                                            {f.ajustes > 0 ? (
                                                <span className="font-bold text-status-warning-fg">
                                                    {f.ajustes}
                                                </span>
                                            ) : (
                                                <span className="text-content-muted">0</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <p className="mt-4 text-xs text-content-muted">
                {qualidade.notas_canceladas} nota(s) cancelada(s) e {qualidade.recusas_gate1} item(ns)
                recusado(s) na liberação no período.
            </p>
        </AppLayout>
    );
}

/* ------------------------------------------------------------------ */

/** Número-manchete: o dado é a mensagem, sem moldura de cartão. */
function Manchete({ valor, rotulo, detalhe, tom }) {
    const cores = {
        success: 'text-status-success-fg',
        danger: 'text-status-danger-fg',
        neutral: 'text-content-primary',
    };

    return (
        <div>
            <p className={`text-5xl font-black tabular-nums leading-none ${cores[tom] ?? cores.neutral}`}>
                {valor}
            </p>
            <p className="mt-2 text-sm font-bold text-content-primary">{rotulo}</p>
            <p className="mt-0.5 text-xs text-content-muted">{detalhe}</p>
        </div>
    );
}

function horas(valor) {
    if (valor === null || valor === undefined) return '—';
    if (valor < 24) return `${valor}h`;

    return `${(valor / 24).toFixed(1)}d`;
}

function dias(valor) {
    return valor === null || valor === undefined ? '—' : `${valor}d`;
}
