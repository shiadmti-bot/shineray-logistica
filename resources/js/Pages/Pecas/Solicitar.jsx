import { useState, useMemo } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import {
    MagnifyingGlassIcon,
    ShoppingCartIcon,
    PlusIcon,
    MinusIcon,
    TrashIcon,
    ExclamationTriangleIcon,
    GlobeAltIcon,
    CheckCircleIcon,
    QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

import AppLayout from '@/Layouts/AppLayout';
import { Card, PageHeader, Button, EmptyState } from '@/Components/UI';

/**
 * Solicitação de peças da loja ao CD.
 *
 * O ponto de partida é a MOTO, não a peça: quem atende o cliente sabe o modelo
 * e precisa descobrir o que serve nele. Por isso o filtro por modelo vem antes
 * da busca textual.
 *
 * A tela também é onde o catálogo se completa. Quando uma peça aparece sem
 * aplicação conhecida, quem está com ela na mão pode confirmar em qual moto
 * serve — o vínculo vira `manual` com confiança alta e passa a valer para todas
 * as lojas. É assim que as ~1.400 peças sem aplicação se resolvem, sem ninguém
 * precisar sentar para preencher planilha.
 */
export default function SolicitarPecas({ pecas, modelos = [], filtros = {}, loja = {} }) {
    const [busca, setBusca] = useState(filtros.busca ?? '');
    const [carrinho, setCarrinho] = useState([]);
    const [observacao, setObservacao] = useState('');

    const { post, processing, errors } = useForm();

    const filtrar = (novos = {}) => {
        router.get(
            route('pecas.solicitar'),
            { modelo: filtros.modelo || undefined, busca: busca || undefined, ...novos },
            { preserveState: true, replace: true }
        );
    };

    const adicionar = (peca) => {
        setCarrinho((atual) => {
            const existente = atual.find((i) => i.peca_id === peca.id);

            if (existente) {
                return atual.map((i) =>
                    i.peca_id === peca.id ? { ...i, quantidade: i.quantidade + 1 } : i
                );
            }

            return [...atual, {
                peca_id: peca.id,
                codigo: peca.codigo,
                descricao: peca.descricao,
                unidade: peca.unidade,
                quantidade: 1,
            }];
        });
    };

    const alterarQtd = (pecaId, delta) => {
        setCarrinho((atual) =>
            atual
                .map((i) => (i.peca_id === pecaId ? { ...i, quantidade: i.quantidade + delta } : i))
                .filter((i) => i.quantidade > 0)
        );
    };

    const remover = (pecaId) => setCarrinho((a) => a.filter((i) => i.peca_id !== pecaId));

    const totalUnidades = useMemo(
        () => carrinho.reduce((s, i) => s + i.quantidade, 0),
        [carrinho]
    );

    const enviar = () => {
        router.post(route('pecas.solicitar.store'), {
            itens: carrinho.map(({ peca_id, quantidade }) => ({ peca_id, quantidade })),
            observacao,
        });
    };

    // Confirma que a peça serve no modelo filtrado — só faz sentido quando há
    // um modelo selecionado, senão não há o que confirmar.
    const confirmarAplicacao = (peca, serve) => {
        router.post(
            route('pecas.aplicacao.confirmar', peca.id),
            { familia: filtros.modelo, serve },
            { preserveScroll: true }
        );
    };

    const modeloLabel = modelos.find((m) => m.valor === filtros.modelo)?.label;

    return (
        <AppLayout>
            <Head title="Solicitar Peças" />

            <PageHeader
                title="Solicitar Peças"
                description={`Pedido de ${loja.nome ?? 'sua loja'} para o Centro de Distribuição.`}
                breadcrumbs={[{ label: 'Peças' }, { label: 'Solicitar' }]}
            />

            <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
                {/* --- CATÁLOGO --- */}
                <div className="min-w-0">
                    <Card padding="none" className="mb-4">
                        <div className="flex flex-col gap-3 p-4 sm:flex-row">
                            <select
                                value={filtros.modelo ?? ''}
                                onChange={(e) => filtrar({ modelo: e.target.value || undefined })}
                                className="rounded-lg border-line bg-surface-card py-2 text-sm font-semibold text-content-primary focus:border-brand-500 focus:ring-brand-500 sm:w-52"
                            >
                                <option value="">Escolha a moto…</option>
                                {modelos.map((m) => (
                                    <option key={m.valor} value={m.valor}>
                                        {m.label} ({m.total})
                                    </option>
                                ))}
                            </select>

                            <div className="relative flex-1">
                                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                                <input
                                    type="search"
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && filtrar()}
                                    placeholder="Ou busque por código / descrição…"
                                    className="w-full rounded-lg border-line bg-surface-card py-2 pl-9 pr-3 text-sm text-content-primary placeholder:text-content-muted focus:border-brand-500 focus:ring-brand-500"
                                />
                            </div>

                            <Button variant="secondary" onClick={() => filtrar()}>
                                Buscar
                            </Button>
                        </div>
                    </Card>

                    {!pecas ? (
                        <Card>
                            <EmptyState
                                icon={MagnifyingGlassIcon}
                                title="Escolha a moto ou busque uma peça"
                                description="São mais de 2.300 peças no catálogo. Selecionar o modelo mostra só o que serve nele."
                            />
                        </Card>
                    ) : pecas.data.length === 0 ? (
                        <Card>
                            <EmptyState
                                title="Nenhuma peça encontrada"
                                description="Tente outro termo, ou limpe o filtro de moto — a aplicação de algumas peças ainda não está cadastrada."
                            />
                        </Card>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {pecas.data.map((peca) => {
                                const noCarrinho = carrinho.find((i) => i.peca_id === peca.id);
                                const semAplicacao =
                                    peca.tipo_item === 'indefinido' && !peca.modelos.length;

                                return (
                                    <div
                                        key={peca.id}
                                        className="flex flex-col rounded-card bg-surface-card p-4 shadow-card ring-1 ring-line transition hover:shadow-card-hover"
                                    >
                                        <div className="flex-1">
                                            <p className="font-mono text-[11px] font-semibold text-content-muted">
                                                {peca.codigo}
                                            </p>
                                            <p className="mt-0.5 font-bold leading-snug text-content-primary">
                                                {peca.descricao}
                                            </p>

                                            {/* Onde a peça existe — orienta o CD na separação */}
                                            {peca.onde_tem?.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-content-secondary">
                                                    {peca.onde_tem.slice(0, 3).map((o, i) => (
                                                        <span key={i} className="inline-flex items-center gap-1">
                                                            <strong className="tabular-nums text-content-primary">
                                                                {o.saldo}
                                                            </strong>
                                                            {o.local}
                                                            {o.agrupado && (
                                                                <ExclamationTriangleIcon
                                                                    className="h-3 w-3 text-status-warning-fg"
                                                                    aria-label="Saldo agrupado"
                                                                />
                                                            )}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Aplicação */}
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {peca.tipo_item === 'universal' ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-status-info-bg px-2 py-0.5 text-[11px] font-semibold text-status-info-fg">
                                                        <GlobeAltIcon className="h-3 w-3" />
                                                        Qualquer moto
                                                    </span>
                                                ) : (
                                                    peca.modelos.map((m, i) => (
                                                        <span
                                                            key={i}
                                                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                                                m.confiavel
                                                                    ? 'bg-status-success-bg text-status-success-fg'
                                                                    : 'bg-status-warning-bg text-status-warning-fg'
                                                            }`}
                                                        >
                                                            {m.label}
                                                            {!m.confiavel && ' ?'}
                                                        </span>
                                                    ))
                                                )}
                                            </div>

                                            {/*
                                                Captura de conhecimento: quem está com a peça na mão
                                                sabe se ela serve. Só aparece quando há modelo filtrado.
                                            */}
                                            {semAplicacao && filtros.modelo && (
                                                <div className="mt-3 rounded-lg bg-surface-sunken p-2">
                                                    <p className="flex items-center gap-1 text-[11px] text-content-secondary">
                                                        <QuestionMarkCircleIcon className="h-3.5 w-3.5" />
                                                        Serve na {modeloLabel}?
                                                    </p>
                                                    <div className="mt-1.5 flex gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => confirmarAplicacao(peca, true)}
                                                            className="inline-flex items-center gap-1 rounded-md bg-status-success-bg px-2 py-1 text-[11px] font-bold text-status-success-fg hover:brightness-95"
                                                        >
                                                            <CheckCircleIcon className="h-3 w-3" /> Sim
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => confirmarAplicacao(peca, false)}
                                                            className="rounded-md bg-surface-card px-2 py-1 text-[11px] font-bold text-content-secondary ring-1 ring-line hover:bg-surface-sunken"
                                                        >
                                                            Não
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                                            <span className="text-sm font-bold text-content-primary">
                                                {peca.preco != null
                                                    ? Number(peca.preco).toLocaleString('pt-BR', {
                                                          style: 'currency',
                                                          currency: 'BRL',
                                                      })
                                                    : '—'}
                                            </span>

                                            <Button
                                                size="sm"
                                                variant={noCarrinho ? 'success' : 'primary'}
                                                icon={PlusIcon}
                                                onClick={() => adicionar(peca)}
                                            >
                                                {noCarrinho ? `No pedido (${noCarrinho.quantidade})` : 'Adicionar'}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Paginação */}
                    {pecas?.links?.length > 3 && (
                        <div className="mt-4 flex flex-wrap items-center justify-center gap-1">
                            {pecas.links.map((link, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    disabled={!link.url}
                                    onClick={() => link.url && router.get(link.url, {}, { preserveState: true })}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                    className={`min-w-[2rem] rounded-md px-2.5 py-1.5 text-sm font-semibold transition ${
                                        link.active
                                            ? 'bg-brand-600 text-white'
                                            : link.url
                                              ? 'text-content-secondary hover:bg-surface-sunken'
                                              : 'cursor-not-allowed text-content-muted opacity-50'
                                    }`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* --- CARRINHO --- */}
                <aside className="lg:sticky lg:top-20 lg:self-start">
                    <Card
                        title="Seu pedido"
                        subtitle={totalUnidades > 0 ? `${totalUnidades} unidade(s)` : 'Nenhum item ainda'}
                        padding="none"
                    >
                        {carrinho.length === 0 ? (
                            <div className="px-5 py-8 text-center">
                                <ShoppingCartIcon className="mx-auto h-8 w-8 text-content-muted" />
                                <p className="mt-2 text-xs text-content-secondary">
                                    Adicione peças pelo catálogo ao lado.
                                </p>
                            </div>
                        ) : (
                            <>
                                <ul className="max-h-80 divide-y divide-line overflow-y-auto scrollbar-slim">
                                    {carrinho.map((item) => (
                                        <li key={item.peca_id} className="flex items-start gap-2 p-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs font-semibold text-content-primary">
                                                    {item.descricao}
                                                </p>
                                                <p className="font-mono text-[10px] text-content-muted">
                                                    {item.codigo}
                                                </p>
                                            </div>

                                            <div className="flex shrink-0 items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => alterarQtd(item.peca_id, -1)}
                                                    className="rounded p-1 text-content-secondary hover:bg-surface-sunken"
                                                    aria-label="Diminuir"
                                                >
                                                    <MinusIcon className="h-3 w-3" />
                                                </button>
                                                <span className="w-6 text-center text-xs font-bold tabular-nums">
                                                    {item.quantidade}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => alterarQtd(item.peca_id, 1)}
                                                    className="rounded p-1 text-content-secondary hover:bg-surface-sunken"
                                                    aria-label="Aumentar"
                                                >
                                                    <PlusIcon className="h-3 w-3" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => remover(item.peca_id)}
                                                    className="ml-1 rounded p-1 text-status-danger-fg hover:bg-status-danger-bg"
                                                    aria-label="Remover"
                                                >
                                                    <TrashIcon className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>

                                <div className="border-t border-line p-3">
                                    <textarea
                                        value={observacao}
                                        onChange={(e) => setObservacao(e.target.value)}
                                        rows={2}
                                        placeholder="Observação para o CD (opcional)"
                                        className="w-full rounded-lg border-line bg-surface-card text-xs text-content-primary placeholder:text-content-muted focus:border-brand-500 focus:ring-brand-500"
                                    />

                                    {errors.itens && (
                                        <p className="mt-2 text-xs font-semibold text-status-danger-fg">
                                            {errors.itens}
                                        </p>
                                    )}

                                    <Button
                                        className="mt-3 w-full"
                                        icon={ShoppingCartIcon}
                                        loading={processing}
                                        onClick={enviar}
                                    >
                                        Enviar solicitação
                                    </Button>
                                </div>
                            </>
                        )}
                    </Card>
                </aside>
            </div>
        </AppLayout>
    );
}
