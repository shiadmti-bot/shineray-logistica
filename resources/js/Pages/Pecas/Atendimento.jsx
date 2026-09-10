import { useState, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import {
    MagnifyingGlassIcon,
    CheckCircleIcon,
    XCircleIcon,
    PaperAirplaneIcon,
    ExclamationTriangleIcon,
    LockClosedIcon,
    ClipboardDocumentCheckIcon,
    ArrowUturnLeftIcon,
    ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';

import AppLayout from '@/Layouts/AppLayout';
import { Card, PageHeader, Button, EmptyState, StatusBadge } from '@/Components/UI';

function formatMoeda(valor) {
    if (valor === null || valor === undefined || valor === '') return 'R$ 0,00';
    const num = Number(valor);
    if (isNaN(num)) return 'R$ 0,00';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatData(dataIso) {
    if (!dataIso) return '';
    const d = new Date(dataIso);
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Mesa de Peças — Separação estrita em dois atos e papéis independentes:
 *
 * 1. APROVAÇÕES DO PÓS-VENDA (Gate 1):
 *    Exclusivo para quem valida peças. Tela limpa, executiva, com itens,
 *    preços, totais e botões diretos de Aprovar Pedido ou Recusar Item.
 *
 * 2. TRIAGEM & IDENTIFICAÇÃO (CD):
 *    Para a equipe do CD pesquisar o SKU no e-Part para itens solicitados
 *    sem código de catálogo. Ao concluir, envia para a fila de aprovação.
 */
export default function PecasAtendimento({
    aprovacoes = [],
    triagem = [],
    pedidos = [],
    totalAprovacoes = 0,
    totalTriagem = 0,
    abaAtiva = 'aprovacoes',
    podeLiberar = false,
    podeAtender = false,
}) {
    // Compatibilidade com coleções fornecidas pelo backend
    const listaAprovacoes = useMemo(() => {
        if (aprovacoes && aprovacoes.length > 0) return aprovacoes;
        return pedidos.filter((p) => p.status === 'aguardando_confirmacao');
    }, [aprovacoes, pedidos]);

    const listaTriagem = useMemo(() => {
        if (triagem && triagem.length > 0) return triagem;
        return pedidos.filter((p) => p.status !== 'aguardando_confirmacao');
    }, [triagem, pedidos]);

    const [aba, setAba] = useState(() => {
        if (abaAtiva && ['aprovacoes', 'triagem'].includes(abaAtiva)) {
            return abaAtiva;
        }
        return podeLiberar ? 'aprovacoes' : 'triagem';
    });

    const pedidosAtuais = aba === 'aprovacoes' ? listaAprovacoes : listaTriagem;
    const [aberto, setAberto] = useState(pedidosAtuais[0]?.id ?? null);

    const trocarAba = (novaAba) => {
        setAba(novaAba);
        const novaLista = novaAba === 'aprovacoes' ? listaAprovacoes : listaTriagem;
        setAberto(novaLista[0]?.id ?? null);
    };

    const pedido = useMemo(
        () => pedidosAtuais.find((p) => p.id === aberto) ?? null,
        [pedidosAtuais, aberto]
    );

    const qtdAprovacoes = totalAprovacoes || listaAprovacoes.length;
    const qtdTriagem = totalTriagem || listaTriagem.length;

    return (
        <AppLayout>
            <Head title={aba === 'aprovacoes' ? 'Aprovações de Peças' : 'Triagem de Peças'} />

            <PageHeader
                title={aba === 'aprovacoes' ? 'Aprovações de Peças' : 'Triagem de Peças'}
                subtitle={
                    aba === 'aprovacoes'
                        ? 'Mesa de liberação técnica do Pós-Venda (Gate 1). Revise e autorize as peças para separação no CD.'
                        : 'Identificação de códigos e preços no e-Part para solicitações sem catálogo.'
                }
                breadcrumbs={[
                    { label: 'Peças' },
                    { label: aba === 'aprovacoes' ? 'Aprovações' : 'Triagem' },
                ]}
            />

            {/* Abas de Navegação Superior (Segregação de Papéis) */}
            <div className="flex border-b border-line mb-6 gap-2">
                <button
                    type="button"
                    onClick={() => trocarAba('aprovacoes')}
                    className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition ${
                        aba === 'aprovacoes'
                            ? 'border-brand-600 text-brand-600'
                            : 'border-transparent text-content-secondary hover:text-content-primary'
                    }`}
                >
                    <ClipboardDocumentCheckIcon className="h-5 w-5" />
                    <span>Aprovações do Pós-Venda (Gate 1)</span>
                    {qtdAprovacoes > 0 && (
                        <span className="rounded-full bg-brand-100 text-brand-800 px-2 py-0.5 text-xs font-bold font-mono">
                            {qtdAprovacoes}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => trocarAba('triagem')}
                    className={`flex items-center gap-2 pb-3 px-4 text-sm font-semibold border-b-2 transition ${
                        aba === 'triagem'
                            ? 'border-brand-600 text-brand-600'
                            : 'border-transparent text-content-secondary hover:text-content-primary'
                    }`}
                >
                    <MagnifyingGlassIcon className="h-5 w-5" />
                    <span>Triagem & Identificação (CD)</span>
                    {qtdTriagem > 0 && (
                        <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-bold font-mono">
                            {qtdTriagem}
                        </span>
                    )}
                </button>
            </div>

            {pedidosAtuais.length === 0 ? (
                <EmptyState
                    icon={CheckCircleIcon}
                    title={aba === 'aprovacoes' ? 'Nenhuma aprovação pendente' : 'Nenhum pedido em triagem'}
                    description={
                        aba === 'aprovacoes'
                            ? 'Todos os pedidos identificados já foram assinados e liberados pelo Pós-Venda.'
                            : 'Todas as solicitações de balcão já foram identificadas com código SKU.'
                    }
                />
            ) : (
                <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <FilaLateral
                        pedidos={pedidosAtuais}
                        aberto={aberto}
                        onAbrir={setAberto}
                        aba={aba}
                    />

                    {pedido ? (
                        aba === 'aprovacoes' ? (
                            <MesaAprovacao
                                key={`aprovacao-${pedido.id}`}
                                pedido={pedido}
                                podeLiberar={podeLiberar}
                            />
                        ) : (
                            <MesaTriagem
                                key={`triagem-${pedido.id}`}
                                pedido={pedido}
                                podeAtender={podeAtender}
                                podeLiberar={podeLiberar}
                            />
                        )
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
/* FILA LATERAL                                                        */
/* ------------------------------------------------------------------ */

function FilaLateral({ pedidos, aberto, onAbrir, aba }) {
    return (
        <Card
            title={aba === 'aprovacoes' ? 'Aguardando Assinatura' : 'Fila de Identificação'}
            subtitle={`${pedidos.length} pedido(s)`}
            padding="none"
        >
            <ul className="divide-y divide-line">
                {pedidos.map((p) => {
                    const semCodigo = p.itens_sem_codigo_count ?? p.itens.filter((i) => !i.identificada).length;
                    const aguardando = p.itens_aguardando_count ?? p.itens.filter((i) => i.identificada && !i.liberada).length;
                    const valorTotal = p.valor_total ?? p.itens.reduce((acc, i) => acc + (Number(i.preco_unitario || 0) * i.quantidade), 0);

                    return (
                        <li key={p.id}>
                            <button
                                type="button"
                                onClick={() => onAbrir(p.id)}
                                className={`w-full px-4 py-3 text-left transition ${
                                    aberto === p.id
                                        ? 'bg-brand-50 border-l-4 border-brand-600'
                                        : 'border-l-4 border-transparent hover:bg-surface-sunken'
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
                                <p className="text-xs text-content-secondary truncate">
                                    {p.solicitante}
                                </p>

                                <div className="mt-2 flex items-center justify-between text-[11px]">
                                    {aba === 'aprovacoes' ? (
                                        <>
                                            <span className="font-bold text-status-info-fg">
                                                {aguardando} item(ns)
                                            </span>
                                            <span className="font-mono font-semibold text-content-primary">
                                                {formatMoeda(valorTotal)}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            {semCodigo > 0 ? (
                                                <span className="font-bold text-status-warning-fg">
                                                    {semCodigo} sem código
                                                </span>
                                            ) : (
                                                <span className="font-bold text-status-info-fg">
                                                    Pronto p/ envio
                                                </span>
                                            )}
                                            <span className="text-content-muted">
                                                {p.itens.length} itens
                                            </span>
                                        </>
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
/* MESA DE APROVAÇÃO DO PÓS-VENDA (GATE 1)                            */
/* ------------------------------------------------------------------ */

function MesaAprovacao({ pedido, podeLiberar }) {
    const [processando, setProcessando] = useState(false);
    const [itemRecusando, setItemRecusando] = useState(null);
    const [motivoRecusa, setMotivoRecusa] = useState('');

    const itensElegiveis = pedido.itens.filter((i) => i.identificada && !i.liberada);

    const aprovarPedido = () => {
        if (!podeLiberar) return;
        setProcessando(true);
        router.post(
            route('pecas.liberar', pedido.id),
            { itens: itensElegiveis.map((i) => i.id) },
            { preserveScroll: true, onFinish: () => setProcessando(false) }
        );
    };

    const rejeitarPedidoCompleto = async () => {
        const { value: motivo, isConfirmed } = await Swal.fire({
            title: 'Rejeitar Pedido Completo?',
            text: `Deseja rejeitar e cancelar o Pedido #${pedido.id}? Esta ação não poderá ser desfeita.`,
            input: 'textarea',
            inputPlaceholder: 'Informe o motivo da rejeição do pedido...',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'Sim, Rejeitar Pedido',
            cancelButtonText: 'Voltar',
            preConfirm: (texto) => {
                if (!texto || texto.trim().length < 3) {
                    Swal.showValidationMessage('Por favor, informe um motivo válido (mínimo 3 caracteres).');
                    return false;
                }
                return texto;
            },
        });

        if (isConfirmed && motivo) {
            setProcessando(true);
            router.post(
                route('pedidos.rejeitar', pedido.id),
                { motivo },
                {
                    onFinish: () => setProcessando(false),
                }
            );
        }
    };

    const confirmarRecusa = () => {
        if (!itemRecusando || motivoRecusa.trim().length < 3) return;
        setProcessando(true);
        router.post(
            route('pecas.recusar', pedido.id),
            { item_id: itemRecusando.id, motivo: motivoRecusa },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setItemRecusando(null);
                    setMotivoRecusa('');
                },
                onFinish: () => setProcessando(false),
            }
        );
    };

    const valorTotal = pedido.valor_total ?? pedido.itens.reduce((acc, i) => acc + (Number(i.preco_unitario || 0) * i.quantidade), 0);
    const totalUnidades = pedido.total_unidades ?? pedido.itens.reduce((acc, i) => acc + i.quantidade, 0);

    return (
        <div className="space-y-4">
            {/* Header do Pedido */}
            <Card padding="sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-bold text-content-primary">
                                Pedido #{pedido.id}
                            </span>
                            <StatusBadge status={pedido.status} />
                        </div>
                        <p className="text-sm font-semibold text-content-primary mt-0.5">
                            Destino: <span className="text-brand-600 font-bold">{pedido.loja}</span>
                        </p>
                        <p className="text-xs text-content-muted">
                            Solicitado por {pedido.solicitante} em {formatData(pedido.created_at)}
                        </p>
                    </div>

                    <div className="text-right">
                        <span className="text-xs text-content-muted block">Valor Total Estimado</span>
                        <span className="font-mono text-lg font-bold text-content-primary">
                            {formatMoeda(valorTotal)}
                        </span>
                        <span className="text-xs text-content-secondary block">
                            {totalUnidades} unidade(s) em {pedido.itens.length} item(ns)
                        </span>
                    </div>
                </div>

                {pedido.observacao && (
                    <div className="mt-3 rounded-lg border border-line bg-surface-sunken p-3 text-xs text-content-secondary">
                        <span className="font-bold text-content-primary uppercase tracking-wide">Observação da Loja: </span>
                        {pedido.observacao}
                    </div>
                )}
            </Card>

            {/* Tabela de Peças Solicitadas */}
            <Card
                title="Peças para Validação Técnica"
                subtitle="Verifique se os códigos e preços atendem à necessidade da filial antes de assinar a liberação"
                padding="none"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="border-b border-line bg-surface-sunken text-content-secondary font-semibold uppercase tracking-wider text-[11px]">
                            <tr>
                                <th className="px-4 py-3">Código / SKU</th>
                                <th className="px-4 py-3">Descrição da Peça</th>
                                <th className="px-4 py-3 text-center">Qtd</th>
                                <th className="px-4 py-3 text-right">Preço Unit.</th>
                                <th className="px-4 py-3 text-right">Subtotal</th>
                                <th className="px-4 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {pedido.itens.map((item) => {
                                const precoUnit = Number(item.preco_unitario || item.peca?.preco || 0);
                                const sub = Number(item.subtotal || (precoUnit * item.quantidade));

                                return (
                                    <tr key={item.id} className="hover:bg-surface-sunken/50 transition">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {item.peca?.codigo ? (
                                                <span className="inline-block font-mono font-bold text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded border border-brand-200">
                                                    {item.peca.codigo}
                                                </span>
                                            ) : (
                                                <span className="inline-block font-mono text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                                                    Sem código
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-content-primary">
                                                {item.peca?.descricao || item.descricao_solicitada || 'Item sem descrição'}
                                            </p>
                                            {item.motivo && (
                                                <p className="text-[11px] text-content-muted mt-0.5">
                                                    Motivo: {item.motivo}
                                                </p>
                                            )}
                                            {item.recusa_motivo && (
                                                <p className="text-[11px] text-status-danger-fg font-medium mt-1">
                                                    ⚠️ Devolvido: {item.recusa_motivo}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-content-primary">
                                            {item.quantidade} {item.peca?.unidade || 'UN'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono tabular-nums text-content-secondary">
                                            {formatMoeda(precoUnit)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-content-primary">
                                            {formatMoeda(sub)}
                                        </td>
                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            {item.liberada ? (
                                                <span className="inline-flex items-center gap-1 rounded bg-status-success-bg px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-status-success-fg">
                                                    <CheckCircleIcon className="h-3.5 w-3.5" /> Liberado
                                                </span>
                                            ) : (
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="rounded bg-status-info-bg px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-status-info-fg">
                                                        Aguardando
                                                    </span>
                                                    {podeLiberar && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setItemRecusando(item);
                                                                setMotivoRecusa('');
                                                            }}
                                                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-status-warning-fg hover:bg-status-warning-bg transition"
                                                            title="Devolver este item à Triagem do CD para corrigir ou trocar o código"
                                                        >
                                                            <ArrowUturnLeftIcon className="h-3.5 w-3.5" /> Devolver ao CD
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Modal / Dialog de Devolução do Item à Triagem do CD */}
            {itemRecusando && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-xl bg-surface-card p-6 shadow-2xl border border-line">
                        <div className="flex items-start gap-3">
                            <div className="rounded-full bg-status-warning-bg p-2 text-status-warning-fg">
                                <ArrowUturnLeftIcon className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-bold text-content-primary">
                                    Devolver Peça à Triagem do CD
                                </h3>
                                <p className="text-xs text-content-secondary mt-1">
                                    O item <strong>{itemRecusando.peca?.descricao || itemRecusando.descricao_solicitada}</strong> ({itemRecusando.peca?.codigo || 'Sem código'}) será retornado à Triagem do CD para localização da peça correta.
                                </p>
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-xs font-semibold text-content-secondary mb-1">
                                Motivo da Incompatibilidade / Devolução *
                            </label>
                            <textarea
                                rows={3}
                                value={motivoRecusa}
                                onChange={(e) => setMotivoRecusa(e.target.value)}
                                placeholder="Ex.: O código informado é da Phoenix 50, mas a moto da oficina é uma Jet 125..."
                                className="w-full rounded-lg border-line-strong bg-surface-sunken p-2.5 text-xs text-content-primary placeholder-content-muted focus:ring-brand-500 focus:border-brand-500"
                            />
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => setItemRecusando(null)}
                                disabled={processando}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="warning"
                                icon={ArrowUturnLeftIcon}
                                loading={processando}
                                disabled={motivoRecusa.trim().length < 3}
                                onClick={confirmarRecusa}
                            >
                                Confirmar Devolução
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Card de Assinatura & Decisão do Pós-Venda */}
            <Card padding="md" className="border-2 border-brand-500/20 bg-gradient-to-r from-surface to-brand-50/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h4 className="text-sm font-bold text-content-primary flex items-center gap-2">
                            <ClipboardDocumentCheckIcon className="h-5 w-5 text-brand-600" />
                            Liberação do Pós-Venda (Gate 1)
                        </h4>
                        <p className="text-xs text-content-secondary max-w-xl">
                            {itensElegiveis.length > 0
                                ? `Há ${itensElegiveis.length} item(ns) pronto(s) para liberação. Ao assinar, as peças serão disponibilizadas para separação física na basqueta pelo CD.`
                                : 'Todos os itens deste pedido já foram assinados e liberados.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {podeLiberar ? (
                            <>
                                <Button
                                    variant="secondary"
                                    size="lg"
                                    icon={XCircleIcon}
                                    loading={processando}
                                    onClick={rejeitarPedidoCompleto}
                                    className="!text-status-danger-fg hover:!bg-status-danger-bg border-status-danger-border"
                                >
                                    Rejeitar Pedido
                                </Button>
                                <Button
                                    size="lg"
                                    icon={CheckCircleIcon}
                                    loading={processando}
                                    disabled={itensElegiveis.length === 0}
                                    onClick={aprovarPedido}
                                >
                                    {itensElegiveis.length > 0
                                        ? `Aprovar Pedido (${itensElegiveis.length} itens)`
                                        : 'Pedido Liberado'}
                                </Button>
                            </>
                        ) : (
                            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                                <LockClosedIcon className="h-4 w-4 shrink-0 text-amber-600" />
                                <span>Apenas usuários com permissão de <strong>Validador de Peças</strong> podem assinar ou rejeitar.</span>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* MESA DE TRIAGEM & IDENTIFICAÇÃO (CD)                               */
/* ------------------------------------------------------------------ */

function MesaTriagem({ pedido, podeAtender, podeLiberar }) {
    const [rascunho, setRascunho] = useState(() =>
        Object.fromEntries(
            pedido.itens.map((i) => [
                i.id,
                {
                    peca_id: i.peca?.id ?? null,
                    peca: i.peca ?? null,
                    preco_unitario: i.preco_unitario !== null && i.preco_unitario !== undefined ? i.preco_unitario : (i.peca?.preco ?? ''),
                    quantidade: i.quantidade,
                },
            ])
        )
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

    const rejeitarPedidoCompleto = async () => {
        const { value: motivo, isConfirmed } = await Swal.fire({
            title: 'Rejeitar Pedido Completo?',
            text: `Deseja rejeitar e cancelar o Pedido #${pedido.id}? Esta ação não poderá ser desfeita.`,
            input: 'textarea',
            inputPlaceholder: 'Informe o motivo da rejeição do pedido...',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'Sim, Rejeitar Pedido',
            cancelButtonText: 'Voltar',
            preConfirm: (texto) => {
                if (!texto || texto.trim().length < 3) {
                    Swal.showValidationMessage('Por favor, informe um motivo válido (mínimo 3 caracteres).');
                    return false;
                }
                return texto;
            },
        });

        if (isConfirmed && motivo) {
            setProcessando(true);
            router.post(
                route('pedidos.rejeitar', pedido.id),
                { motivo },
                {
                    onFinish: () => setProcessando(false),
                }
            );
        }
    };

    const todosIdentificados = pedido.itens.every((i) => rascunho[i.id]?.peca_id);
    const identificadosCount = pedido.itens.filter((i) => rascunho[i.id]?.peca_id).length;

    return (
        <div className="space-y-4">
            {/* Header do Pedido */}
            <Card padding="sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-bold text-content-primary">
                                Pedido #{pedido.id}
                            </span>
                            <StatusBadge status={pedido.status} />
                        </div>
                        <p className="text-sm font-semibold text-content-primary mt-0.5">
                            Destino: <span className="text-brand-600 font-bold">{pedido.loja}</span>
                        </p>
                        <p className="text-xs text-content-muted">
                            Solicitado por {pedido.solicitante} em {formatData(pedido.created_at)}
                        </p>
                    </div>

                    <div className="text-right">
                        <span className="text-xs text-content-muted block">Progresso da Triagem</span>
                        <span className="font-mono text-base font-bold text-content-primary">
                            {identificadosCount} / {pedido.itens.length} identificados
                        </span>
                    </div>
                </div>

                {pedido.observacao && (
                    <div className="mt-3 rounded-lg border border-line bg-surface-sunken p-3 text-xs text-content-secondary">
                        <span className="font-bold text-content-primary uppercase tracking-wide">Observação da Loja: </span>
                        {pedido.observacao}
                    </div>
                )}
            </Card>

            {/* Lista de Itens para Identificação */}
            <div className="space-y-3">
                {pedido.itens.map((item) => (
                    <LinhaTriagemItem
                        key={item.id}
                        item={item}
                        rascunho={rascunho[item.id]}
                        onDefinir={definir}
                    />
                ))}
            </div>

            {/* Painel de Ações de Triagem */}
            <Card padding="sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold text-content-primary">
                            {todosIdentificados
                                ? '✅ Todos os itens têm código e preço preenchidos. Pronto para envio.'
                                : '⚠️ Identifique o código de todos os itens para liberar o envio ao Pós-Venda.'}
                        </p>
                        <p className="text-[11px] text-content-secondary mt-0.5">
                            Ao enviar, o pedido avança para a mesa de aprovação do Pós-Venda (Gate 1).
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="secondary"
                            icon={XCircleIcon}
                            loading={processando}
                            onClick={rejeitarPedidoCompleto}
                            className="!text-status-danger-fg hover:!bg-status-danger-bg border-status-danger-border"
                        >
                            Rejeitar Pedido
                        </Button>

                        <Button
                            variant="secondary"
                            loading={processando}
                            onClick={() => salvar(false)}
                        >
                            Salvar Rascunho
                        </Button>

                        <Button
                            icon={PaperAirplaneIcon}
                            loading={processando}
                            disabled={!todosIdentificados}
                            onClick={() => salvar(true)}
                        >
                            Enviar para Liberação do Pós-Venda
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* LINHA DE ITEM NA TRIAGEM                                           */
/* ------------------------------------------------------------------ */

function LinhaTriagemItem({ item, rascunho, onDefinir }) {
    const [termo, setTermo] = useState('');
    const [resultados, setResultados] = useState([]);
    const [buscando, setBuscando] = useState(false);
    const [editando, setEditando] = useState(!rascunho?.peca_id);

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

        if (!rascunho?.preco_unitario && peca.preco) {
            onDefinir(item.id, 'preco_unitario', peca.preco);
        }

        setTermo('');
        setResultados([]);
        setEditando(false);
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
                ) : escolhida ? (
                    <span className="rounded bg-status-info-bg px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-status-info-fg">
                        Identificado
                    </span>
                ) : (
                    <span className="rounded bg-status-warning-bg px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-status-warning-fg">
                        Sem código no e-Part
                    </span>
                )}
            </div>

            {item.recusa_motivo && (
                <div className="mt-3 flex items-start gap-2 rounded border border-status-danger-solid/30 bg-status-danger-bg p-2">
                    <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-status-danger-fg" />
                    <p className="text-[11px] text-status-danger-fg">
                        <span className="font-bold">Recusado na liberação anterior: </span>
                        {item.recusa_motivo}
                    </p>
                </div>
            )}

            <div className="mt-3 space-y-3">
                {escolhida && !editando ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded bg-surface-sunken p-2.5 border border-line">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                                    {escolhida.codigo}
                                </span>
                                <span className="truncate text-xs font-semibold text-content-primary">
                                    {escolhida.descricao}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-[11px] font-semibold text-content-secondary">
                                R$
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={rascunho?.preco_unitario ?? ''}
                                    onChange={(e) => onDefinir(item.id, 'preco_unitario', e.target.value)}
                                    className="w-24 rounded border-line-strong bg-surface py-1 text-xs tabular-nums font-mono"
                                />
                            </label>

                            <label className="flex items-center gap-1 text-[11px] font-semibold text-content-secondary">
                                Qtd
                                <input
                                    type="number"
                                    min="1"
                                    max={item.quantidade}
                                    value={rascunho?.quantidade ?? item.quantidade}
                                    onChange={(e) => onDefinir(item.id, 'quantidade', e.target.value)}
                                    className="w-16 rounded border-line-strong bg-surface py-1 text-xs tabular-nums font-mono"
                                />
                            </label>

                            <button
                                type="button"
                                onClick={() => setEditando(true)}
                                className="text-[11px] font-semibold text-brand-600 hover:underline inline-flex items-center gap-1"
                            >
                                <ArrowsRightLeftIcon className="h-3.5 w-3.5" /> Trocar
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="relative">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-content-muted" />
                                <input
                                    value={termo}
                                    onChange={(e) => buscar(e.target.value)}
                                    placeholder="Buscar código SKU ou descrição no catálogo do e-Part / Microwork..."
                                    className="w-full rounded border-line-strong bg-surface py-2 pl-9 pr-3 text-xs placeholder-content-muted focus:ring-brand-500"
                                />
                            </div>
                            {escolhida && editando && (
                                <Button variant="secondary" size="sm" onClick={() => setEditando(false)}>
                                    Manter atual
                                </Button>
                            )}
                        </div>

                        {(resultados.length > 0 || buscando) && (
                            <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-surface shadow-lg divide-y divide-line">
                                {buscando && (
                                    <li className="px-3 py-2 text-xs text-content-muted">Pesquisando no catálogo...</li>
                                )}
                                {resultados.map((p) => (
                                    <li key={p.id}>
                                        <button
                                            type="button"
                                            onClick={() => escolher(p)}
                                            className="w-full px-3 py-2 text-left hover:bg-surface-sunken transition"
                                        >
                                            <div className="flex items-center justify-between">
                                                <p className="font-mono text-xs font-bold text-brand-700">
                                                    {p.codigo}
                                                </p>
                                                {p.preco && (
                                                    <span className="font-mono text-xs text-content-secondary font-semibold">
                                                        {formatMoeda(p.preco)}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-content-primary">{p.descricao}</p>
                                            {p.onde_tem?.length > 0 && (
                                                <p className="mt-0.5 text-[10px] text-content-muted">
                                                    Saldos: {p.onde_tem.map((o) => `${o.local}: ${o.saldo}`).join(' · ')}
                                                </p>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
}
