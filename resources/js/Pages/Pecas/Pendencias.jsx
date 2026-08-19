import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import {
    ExclamationTriangleIcon,
    ArrowPathIcon,
    ShoppingCartIcon,
    CheckCircleIcon,
    ArrowTrendingDownIcon,
} from '@heroicons/react/24/outline';

import AppLayout from '@/Layouts/AppLayout';
import { Card, PageHeader, DataTable, Button, Tabs, StatCard, EmptyState } from '@/Components/UI';

/**
 * Central de pendências: o que deu errado e o que está para faltar.
 *
 * Duas filas com públicos diferentes:
 *   Divergências -> o CD decide o destino do que não bateu na conferência.
 *   Reposição    -> a loja vê o que precisa pedir antes de zerar.
 */
export default function Pendencias({
    divergencias = [],
    reposicao = [],
    local,
    locais = [],
    podeResolver = false,
}) {
    const [aba, setAba] = useState(divergencias.length > 0 ? 'divergencias' : 'reposicao');
    const [resolvendo, setResolvendo] = useState(null);
    const [resolucao, setResolucao] = useState('');
    const [observacao, setObservacao] = useState('');
    const [selecionadas, setSelecionadas] = useState({});

    const zerados = reposicao.filter((r) => r.zerado).length;

    const resolver = () => {
        if (!resolvendo || !resolucao) return;

        router.post(
            route('pecas.pendencias.resolver', resolvendo.id),
            { resolucao, observacao },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setResolvendo(null);
                    setResolucao('');
                    setObservacao('');
                },
            }
        );
    };

    // Leva os itens marcados para a tela de solicitação já como pedido.
    const gerarPedido = () => {
        const itens = reposicao
            .filter((r) => selecionadas[r.peca_id])
            .map((r) => ({ peca_id: r.peca_id, quantidade: selecionadas[r.peca_id] }));

        if (!itens.length) return;

        router.post(route('pecas.solicitar.store'), {
            itens,
            observacao: 'Reposição automática — itens abaixo do ponto de reposição.',
        });
    };

    const colunasDivergencia = [
        {
            key: 'peca',
            header: 'Peça',
            render: (r) => (
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-content-primary">{r.descricao}</p>
                    <p className="font-mono text-[10px] text-content-muted">{r.codigo}</p>
                </div>
            ),
        },
        { key: 'loja', header: 'Destino', className: 'text-sm text-content-secondary' },
        {
            key: 'quantidades',
            header: 'Enviado / Recebido',
            align: 'center',
            render: (r) => (
                <span className="whitespace-nowrap text-sm tabular-nums">
                    <strong>{r.enviado}</strong>
                    <span className="mx-1 text-content-muted">/</span>
                    <strong className="text-status-warning-fg">{r.recebido}</strong>
                </span>
            ),
        },
        {
            key: 'diferenca',
            header: 'Diferença',
            align: 'right',
            render: (r) => (
                <span className="font-bold tabular-nums text-status-danger-fg">{r.diferenca}</span>
            ),
        },
        {
            key: 'origem',
            header: 'Pedido / Carga',
            render: (r) => (
                <span className="whitespace-nowrap text-xs text-content-secondary">
                    #{r.pedido_id}
                    {r.carga && <span className="text-content-muted"> · carga {r.carga}</span>}
                </span>
            ),
        },
        { key: 'quando', header: 'Conferido em', className: 'whitespace-nowrap text-xs text-content-muted' },
        ...(podeResolver
            ? [{
                  key: 'acao',
                  header: '',
                  align: 'right',
                  render: (r) => (
                      <Button size="sm" variant="secondary" onClick={() => setResolvendo(r)}>
                          Resolver
                      </Button>
                  ),
              }]
            : []),
    ];

    const colunasReposicao = [
        {
            key: 'sel',
            header: '',
            render: (r) => (
                <input
                    type="checkbox"
                    checked={!!selecionadas[r.peca_id]}
                    onChange={(e) =>
                        setSelecionadas((s) => {
                            const novo = { ...s };
                            if (e.target.checked) novo[r.peca_id] = r.sugestao;
                            else delete novo[r.peca_id];
                            return novo;
                        })
                    }
                    className="rounded border-line text-brand-600 focus:ring-brand-500"
                />
            ),
        },
        {
            key: 'peca',
            header: 'Peça',
            render: (r) => (
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-content-primary">{r.descricao}</p>
                    <p className="font-mono text-[10px] text-content-muted">{r.codigo}</p>
                </div>
            ),
        },
        {
            key: 'disponivel',
            header: 'Disponível',
            align: 'right',
            render: (r) => (
                <span
                    className={`font-bold tabular-nums ${
                        r.zerado ? 'text-status-danger-fg' : 'text-status-warning-fg'
                    }`}
                >
                    {r.disponivel}
                </span>
            ),
        },
        { key: 'minimo', header: 'Mínimo', align: 'right', className: 'tabular-nums text-content-secondary' },
        {
            key: 'sugestao',
            header: 'Pedir',
            align: 'right',
            render: (r) => (
                <input
                    type="number"
                    min="1"
                    value={selecionadas[r.peca_id] ?? r.sugestao}
                    onChange={(e) =>
                        setSelecionadas((s) => ({ ...s, [r.peca_id]: parseInt(e.target.value, 10) || 1 }))
                    }
                    className="w-20 rounded-lg border-line bg-surface-card py-1 text-center text-sm font-bold tabular-nums focus:border-brand-500 focus:ring-brand-500"
                />
            ),
        },
    ];

    const totalSelecionado = Object.keys(selecionadas).length;

    return (
        <AppLayout>
            <Head title="Pendências" />

            <PageHeader
                title="Pendências"
                description="Divergências que aguardam decisão e itens que precisam de reposição."
                breadcrumbs={[{ label: 'Peças' }, { label: 'Pendências' }]}
                actions={
                    locais.length > 1 && (
                        <select
                            value={local?.id ?? ''}
                            onChange={(e) => router.get(route('pecas.pendencias.index'), { local: e.target.value })}
                            className="rounded-lg border-line bg-surface-card py-2 text-sm font-semibold focus:border-brand-500 focus:ring-brand-500"
                        >
                            {locais.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.nome}
                                </option>
                            ))}
                        </select>
                    )
                }
            />

            <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-lg">
                <StatCard
                    label="Divergências abertas"
                    value={divergencias.length}
                    icon={ExclamationTriangleIcon}
                    tone={divergencias.length > 0 ? 'danger' : 'success'}
                    hint="Aguardam decisão do CD"
                />
                <StatCard
                    label="Abaixo do mínimo"
                    value={reposicao.length}
                    icon={ArrowTrendingDownIcon}
                    tone={zerados > 0 ? 'danger' : reposicao.length > 0 ? 'warning' : 'success'}
                    hint={zerados > 0 ? `${zerados} zerado(s)` : 'Precisa repor'}
                />
            </div>

            <Card padding="none">
                <Tabs
                    active={aba}
                    onChange={setAba}
                    tabs={[
                        { key: 'divergencias', label: 'Divergências', count: divergencias.length, icon: ExclamationTriangleIcon },
                        { key: 'reposicao', label: 'Reposição', count: reposicao.length, icon: ArrowPathIcon },
                    ]}
                />

                {aba === 'divergencias' ? (
                    <DataTable
                        columns={colunasDivergencia}
                        rows={divergencias}
                        emptyIcon={CheckCircleIcon}
                        emptyTitle="Nenhuma divergência aberta"
                        emptyDescription="Tudo que foi enviado bateu com o que foi recebido."
                    />
                ) : (
                    <>
                        <DataTable
                            columns={colunasReposicao}
                            rows={reposicao}
                            emptyIcon={CheckCircleIcon}
                            emptyTitle="Nada para repor"
                            emptyDescription="Nenhuma peça está abaixo do ponto de reposição. Defina o mínimo das peças que você quer acompanhar para receber alertas."
                        />

                        {reposicao.length > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
                                <p className="text-xs text-content-secondary">
                                    {totalSelecionado > 0
                                        ? `${totalSelecionado} item(ns) selecionado(s).`
                                        : 'Marque os itens que deseja solicitar ao CD.'}
                                </p>

                                <Button
                                    icon={ShoppingCartIcon}
                                    disabled={totalSelecionado === 0}
                                    onClick={gerarPedido}
                                >
                                    Gerar pedido de reposição
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </Card>

            {/* --- MODAL DE RESOLUÇÃO --- */}
            {resolvendo && (
                <div className="fixed inset-0 z-overlay flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setResolvendo(null)}
                        aria-hidden="true"
                    />

                    <div className="relative w-full max-w-md animate-fade-in-up rounded-card bg-surface-card p-5 shadow-overlay">
                        <h3 className="text-base font-bold text-content-primary">Resolver divergência</h3>
                        <p className="mt-1 text-sm text-content-secondary">
                            {resolvendo.descricao}
                        </p>
                        <p className="mt-2 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-content-secondary">
                            Enviado <strong className="text-content-primary">{resolvendo.enviado}</strong>, recebido{' '}
                            <strong className="text-content-primary">{resolvendo.recebido}</strong> — diferença de{' '}
                            <strong className="text-status-danger-fg">{Math.abs(resolvendo.diferenca)}</strong> un.
                        </p>

                        <div className="mt-4 space-y-2">
                            {[
                                { v: 'erro_contagem', t: 'Erro de contagem', d: 'A peça estava na loja. Corrige o saldo de lá.' },
                                { v: 'reenvio', t: 'Vou reenviar', d: 'O CD ainda deve essa quantidade.' },
                                { v: 'perda', t: 'Perda / extravio', d: 'Sumiu no caminho. Ninguém ficou com ela.' },
                                { v: 'aceito', t: 'Aceitar diferença', d: 'Encerra sem mover estoque.' },
                            ].map((op) => (
                                <label
                                    key={op.v}
                                    className={`flex cursor-pointer gap-3 rounded-lg p-3 ring-1 transition ${
                                        resolucao === op.v
                                            ? 'bg-brand-50 ring-brand-500'
                                            : 'ring-line hover:bg-surface-sunken'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="resolucao"
                                        value={op.v}
                                        checked={resolucao === op.v}
                                        onChange={(e) => setResolucao(e.target.value)}
                                        className="mt-0.5 text-brand-600 focus:ring-brand-500"
                                    />
                                    <div>
                                        <p className="text-sm font-bold text-content-primary">{op.t}</p>
                                        <p className="text-xs text-content-secondary">{op.d}</p>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <input
                            type="text"
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            placeholder="Observação (opcional)"
                            className="mt-3 w-full rounded-lg border-line bg-surface-card py-2 text-sm focus:border-brand-500 focus:ring-brand-500"
                        />

                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setResolvendo(null)}>
                                Cancelar
                            </Button>
                            <Button disabled={!resolucao} onClick={resolver}>
                                Confirmar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
