import { useState, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import {
    MagnifyingGlassIcon,
    CheckCircleIcon,
    XCircleIcon,
    PaperAirplaneIcon,
    ExclamationTriangleIcon,
    LockClosedIcon,
} from '@heroicons/react/24/outline';

import AppLayout from '@/Layouts/AppLayout';
import { Card, PageHeader, Button, EmptyState, StatusBadge } from '@/Components/UI';

/**
 * Fila do Call Center — Passos 2 e 3 do manual.
 *
 * Duas colunas de trabalho, na ordem em que o manual as descreve:
 *   IDENTIFICAR  o CD acha o código no e-Part e informa o preço.
 *   LIBERAR      um dos validadores assina que a peça é a certa.
 *
 * A liberação é item a item de propósito. Um pedido de 10 peças em que 8 estão
 * certas não deveria esperar as outras 2 — as certas seguem, as duvidosas
 * voltam para o Call Center com o motivo.
 *
 * O e-Part não expõe dados, então a consulta continua sendo humana. O que a
 * tela faz é sugerir a partir do catálogo Microwork e guardar a escolha: qual
 * SKU, por quem, por qual preço.
 */
export default function PecasAtendimento({ pedidos = [], podeLiberar = false }) {
    const [aberto, setAberto] = useState(pedidos[0]?.id ?? null);

    const pedido = useMemo(
        () => pedidos.find((p) => p.id === aberto) ?? null,
        [pedidos, aberto]
    );

    return (
        <AppLayout>
            <Head title="Atendimento de Peças" />

            <PageHeader
                title="Atendimento de Peças"
                subtitle="Identifique o código e libere o pedido para separação"
                breadcrumbs={[{ label: 'Peças' }, { label: 'Atendimento' }]}
            />

            {pedidos.length === 0 ? (
                <EmptyState
                    icon={CheckCircleIcon}
                    title="Nada na fila"
                    description="Toda solicitação de peça já foi identificada e liberada."
                />
            ) : (
                <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
                    <FilaLateral
                        pedidos={pedidos}
                        aberto={aberto}
                        onAbrir={setAberto}
                    />

                    {pedido ? (
                        <DetalhePedido
                            key={pedido.id}
                            pedido={pedido}
                            podeLiberar={podeLiberar}
                        />
                    ) : (
                        <EmptyState
                            icon={MagnifyingGlassIcon}
                            title="Escolha um pedido"
                            description="Selecione uma solicitação na lista ao lado."
                        />
                    )}
                </div>
            )}
        </AppLayout>
    );
}

/* ------------------------------------------------------------------ */

function FilaLateral({ pedidos, aberto, onAbrir }) {
    return (
        <Card title="Fila" subtitle={`${pedidos.length} pedido(s)`} padding="none">
            <ul className="divide-y divide-line">
                {pedidos.map((p) => {
                    const semCodigo = p.itens.filter((i) => !i.identificada).length;
                    const aguardando = p.itens.filter((i) => i.identificada && !i.liberada).length;

                    return (
                        <li key={p.id}>
                            <button
                                type="button"
                                onClick={() => onAbrir(p.id)}
                                className={`w-full px-4 py-3 text-left transition ${
                                    aberto === p.id
                                        ? 'bg-brand-50 border-l-2 border-brand-600'
                                        : 'border-l-2 border-transparent hover:bg-surface-sunken'
                                }`}
                            >
                                <div className="flex items-baseline justify-between gap-2">
                                    <span className="font-mono text-xs font-bold text-content-primary">
                                        #{p.id}
                                    </span>
                                    <StatusBadge status={p.status} size="sm" />
                                </div>
                                <p className="mt-1 truncate text-sm font-semibold text-content-primary">
                                    {p.loja}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-x-3 text-[11px]">
                                    {semCodigo > 0 && (
                                        <span className="font-bold text-status-warning-fg">
                                            {semCodigo} sem código
                                        </span>
                                    )}
                                    {aguardando > 0 && (
                                        <span className="font-bold text-status-info-fg">
                                            {aguardando} aguardando liberação
                                        </span>
                                    )}
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
}

/* ------------------------------------------------------------------ */

function DetalhePedido({ pedido, podeLiberar }) {
    // Rascunho local: peca_id e preço por item, antes de salvar.
    const [rascunho, setRascunho] = useState(() =>
        Object.fromEntries(pedido.itens.map((i) => [i.id, {
            peca_id: i.peca?.id ?? null,
            peca: i.peca ?? null,
            preco_unitario: i.preco_unitario ?? '',
            quantidade: i.quantidade,
        }]))
    );

    const [processando, setProcessando] = useState(false);

    const definir = (itemId, campo, valor) =>
        setRascunho((r) => ({ ...r, [itemId]: { ...r[itemId], [campo]: valor } }));

    const payloadItens = () =>
        pedido.itens.map((i) => ({
            item_id: i.id,
            peca_id: rascunho[i.id]?.peca_id ?? null,
            preco_unitario: rascunho[i.id]?.preco_unitario === '' ? null : rascunho[i.id]?.preco_unitario,
            quantidade: rascunho[i.id]?.quantidade ?? i.quantidade,
        }));

    const salvar = (enviar) => {
        setProcessando(true);
        router.post(
            route('pecas.atender', pedido.id),
            { itens: payloadItens(), enviar },
            { preserveScroll: true, onFinish: () => setProcessando(false) }
        );
    };

    const liberarTodos = () => {
        const elegiveis = pedido.itens.filter((i) => i.identificada && !i.liberada).map((i) => i.id);

        if (elegiveis.length === 0) return;

        setProcessando(true);
        router.post(
            route('pecas.liberar', pedido.id),
            { itens: elegiveis },
            { preserveScroll: true, onFinish: () => setProcessando(false) }
        );
    };

    const todosIdentificados = pedido.itens.every((i) => rascunho[i.id]?.peca_id);
    const aguardandoLiberacao = pedido.itens.filter((i) => i.identificada && !i.liberada);

    return (
        <div className="space-y-4">
            <Card
                title={`Pedido #${pedido.id} — ${pedido.loja}`}
                subtitle={`Solicitado por ${pedido.solicitante}`}
                padding="sm"
            >
                {pedido.observacao && (
                    <p className="rounded bg-surface-sunken p-3 text-xs text-content-secondary">
                        <span className="font-bold uppercase tracking-wide">Observação da loja: </span>
                        {pedido.observacao}
                    </p>
                )}
            </Card>

            <div className="space-y-3">
                {pedido.itens.map((item) => (
                    <LinhaItem
                        key={item.id}
                        item={item}
                        rascunho={rascunho[item.id]}
                        onDefinir={definir}
                        pedidoId={pedido.id}
                        podeLiberar={podeLiberar}
                        processando={processando}
                    />
                ))}
            </div>

            <Card padding="sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-content-secondary">
                        {todosIdentificados
                            ? 'Todos os itens têm código. Pode enviar para liberação.'
                            : 'Identifique o código de todos os itens para enviar à liberação.'}
                    </p>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="secondary"
                            loading={processando}
                            onClick={() => salvar(false)}
                        >
                            Salvar rascunho
                        </Button>

                        <Button
                            icon={PaperAirplaneIcon}
                            loading={processando}
                            disabled={!todosIdentificados}
                            onClick={() => salvar(true)}
                        >
                            Enviar para liberação
                        </Button>
                    </div>
                </div>
            </Card>

            {aguardandoLiberacao.length > 0 && (
                <Card
                    title="Liberação do Pós-Venda"
                    subtitle={`${aguardandoLiberacao.length} item(ns) aguardando assinatura`}
                    padding="sm"
                >
                    {podeLiberar ? (
                        <>
                            <p className="mb-3 text-xs text-content-secondary">
                                Nenhuma peça é separada antes desta liberação. Confira código,
                                descrição e preço antes de assinar.
                            </p>
                            <Button icon={CheckCircleIcon} loading={processando} onClick={liberarTodos}>
                                Liberar {aguardandoLiberacao.length} item(ns)
                            </Button>
                        </>
                    ) : (
                        <div className="flex items-start gap-2 text-xs text-content-secondary">
                            <LockClosedIcon className="mt-0.5 h-4 w-4 shrink-0 text-content-muted" />
                            <span>
                                Você não tem atribuição para liberar peças. Um dos validadores
                                precisa assinar antes da separação.
                            </span>
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */

function LinhaItem({ item, rascunho, onDefinir, pedidoId, podeLiberar, processando }) {
    const [termo, setTermo] = useState('');
    const [resultados, setResultados] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [recusando, setRecusando] = useState(false);
    const [motivo, setMotivo] = useState('');

    const buscar = async (valor) => {
        setTermo(valor);

        if (valor.trim().length < 2) {
            setResultados([]);
            return;
        }

        setBuscando(true);

        try {
            const resposta = await fetch(
                `${route('pecas.atendimento.buscar')}?termo=${encodeURIComponent(valor)}`,
                { headers: { Accept: 'application/json' } }
            );
            const dados = await resposta.json();
            setResultados(dados.pecas ?? []);
        } catch {
            setResultados([]);
        } finally {
            setBuscando(false);
        }
    };

    const escolher = (peca) => {
        onDefinir(item.id, 'peca_id', peca.id);
        onDefinir(item.id, 'peca', peca);

        // O preço do catálogo entra como sugestão; o operador sobrescreve se
        // o valor combinado com a filial for outro.
        if (!rascunho?.preco_unitario && peca.preco) {
            onDefinir(item.id, 'preco_unitario', peca.preco);
        }

        setTermo('');
        setResultados([]);
    };

    const recusar = () => {
        if (motivo.trim().length < 3) return;

        router.post(
            route('pecas.recusar', pedidoId),
            { item_id: item.id, motivo },
            { preserveScroll: true, onSuccess: () => { setRecusando(false); setMotivo(''); } }
        );
    };

    const escolhida = rascunho?.peca ?? null;

    return (
        <Card padding="sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-content-primary">
                        {item.quantidade}× {item.descricao_solicitada || escolhida?.descricao || 'Item sem descrição'}
                    </p>
                    {item.motivo && (
                        <p className="mt-0.5 text-[11px] text-content-muted">Motivo: {item.motivo}</p>
                    )}
                </div>

                {item.liberada ? (
                    <span className="inline-flex items-center gap-1 rounded bg-status-success-bg px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-status-success-fg">
                        <CheckCircleIcon className="h-3.5 w-3.5" /> Liberado
                    </span>
                ) : item.identificada ? (
                    <span className="rounded bg-status-info-bg px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-status-info-fg">
                        Aguardando liberação
                    </span>
                ) : (
                    <span className="rounded bg-status-warning-bg px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-status-warning-fg">
                        Sem código
                    </span>
                )}
            </div>

            {item.recusa_motivo && (
                <div className="mt-3 flex items-start gap-2 rounded border border-status-danger-solid/30 bg-status-danger-bg p-2">
                    <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-status-danger-fg" />
                    <p className="text-[11px] text-status-danger-fg">
                        <span className="font-bold">Recusado na liberação: </span>
                        {item.recusa_motivo}
                    </p>
                </div>
            )}

            {/* Item já assinado não é reaberto por edição — trocar o SKU sob uma
                assinatura existente invalidaria a liberação silenciosamente. */}
            {item.liberada ? (
                <p className="mt-3 font-mono text-xs text-content-secondary">
                    {escolhida?.codigo} — {escolhida?.descricao}
                    {item.preco_unitario && ` · R$ ${item.preco_unitario}`}
                </p>
            ) : (
                <div className="mt-3 space-y-3">
                    {escolhida && (
                        <div className="flex flex-wrap items-center gap-3 rounded bg-surface-sunken p-2">
                            <div className="min-w-0 flex-1">
                                <p className="font-mono text-xs font-bold text-content-primary">
                                    {escolhida.codigo}
                                </p>
                                <p className="truncate text-[11px] text-content-secondary">
                                    {escolhida.descricao}
                                </p>
                            </div>

                            <label className="flex items-center gap-1 text-[11px] text-content-secondary">
                                R$
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={rascunho?.preco_unitario ?? ''}
                                    onChange={(e) => onDefinir(item.id, 'preco_unitario', e.target.value)}
                                    className="w-24 rounded border-line-strong bg-surface py-1 text-xs tabular-nums"
                                />
                            </label>

                            <label className="flex items-center gap-1 text-[11px] text-content-secondary">
                                Qtd
                                <input
                                    type="number"
                                    min="1"
                                    max={item.quantidade}
                                    value={rascunho?.quantidade ?? item.quantidade}
                                    onChange={(e) => onDefinir(item.id, 'quantidade', e.target.value)}
                                    className="w-16 rounded border-line-strong bg-surface py-1 text-xs tabular-nums"
                                />
                            </label>
                        </div>
                    )}

                    <div className="relative">
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-content-muted" />
                        <input
                            value={termo}
                            onChange={(e) => buscar(e.target.value)}
                            placeholder={escolhida ? 'Trocar peça…' : 'Buscar código ou descrição no catálogo…'}
                            className="w-full rounded border-line-strong bg-surface py-2 pl-8 text-xs placeholder-content-muted focus:ring-brand-500"
                        />

                        {(resultados.length > 0 || buscando) && (
                            <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded border border-line bg-surface shadow-lg">
                                {buscando && (
                                    <li className="px-3 py-2 text-xs text-content-muted">Buscando…</li>
                                )}
                                {resultados.map((p) => (
                                    <li key={p.id}>
                                        <button
                                            type="button"
                                            onClick={() => escolher(p)}
                                            className="w-full px-3 py-2 text-left hover:bg-surface-sunken"
                                        >
                                            <p className="font-mono text-xs font-bold text-content-primary">
                                                {p.codigo}
                                            </p>
                                            <p className="text-[11px] text-content-secondary">{p.descricao}</p>
                                            {p.onde_tem?.length > 0 && (
                                                <p className="mt-0.5 text-[10px] text-content-muted">
                                                    {p.onde_tem.map((o) => `${o.local}: ${o.saldo}`).join(' · ')}
                                                </p>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {podeLiberar && item.identificada && (
                        recusando ? (
                            <div className="space-y-2">
                                <input
                                    value={motivo}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    placeholder="O que está errado? Ex.: essa serve na JEF, não na JET"
                                    className="w-full rounded border-line-strong bg-surface py-2 text-xs placeholder-content-muted focus:ring-brand-500"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        variant="danger"
                                        loading={processando}
                                        disabled={motivo.trim().length < 3}
                                        onClick={recusar}
                                    >
                                        Confirmar recusa
                                    </Button>
                                    <Button variant="secondary" onClick={() => setRecusando(false)}>
                                        Cancelar
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setRecusando(true)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-status-danger-fg hover:underline"
                            >
                                <XCircleIcon className="h-4 w-4" /> Recusar este item
                            </button>
                        )
                    )}
                </div>
            )}
        </Card>
    );
}
