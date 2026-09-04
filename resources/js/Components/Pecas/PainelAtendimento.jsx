import { useState } from 'react';
import { router, Link } from '@inertiajs/react';
import {
    WrenchScrewdriverIcon,
    TruckIcon,
    ClipboardDocumentCheckIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';

import { Card, Button, StatusBadge } from '@/Components/UI';

/**
 * Painel de atendimento de pedido de PEÇA.
 *
 * Renderizado dentro de Pedidos/Show apenas quando `peca.ativo` é true — pedido
 * de moto não é afetado e a tela continua idêntica ao que era.
 *
 * As três ações refletem os três momentos do estoque:
 *   Separar  -> reserva no CD (saldo físico não muda)
 *   Carregar -> entra na carga (nada muda no estoque)
 *   Receber  -> transfere de verdade CD -> loja
 */
export default function PainelAtendimento({ pedido, peca }) {
    const [quantidades, setQuantidades] = useState(() =>
        Object.fromEntries(
            (pedido.itens_pedido ?? []).map((i) => [i.id, i.qtd_pendente ?? 0])
        )
    );
    const [recebidas, setRecebidas] = useState(() =>
        Object.fromEntries((peca.itens_carga ?? []).map((i) => [i.id, i.enviado]))
    );
    const [cargaId, setCargaId] = useState('');
    const [obsRecebimento, setObsRecebimento] = useState('');
    const [processando, setProcessando] = useState(false);

    if (!peca.ativo) return null;

    const itens = pedido.itens_pedido ?? [];

    const separar = () => {
        setProcessando(true);
        router.post(
            route('pecas.separar', pedido.id),
            {
                itens: Object.entries(quantidades)
                    .map(([item_id, quantidade]) => ({ item_id: Number(item_id), quantidade: Number(quantidade) || 0 }))
                    .filter((i) => i.quantidade > 0),
            },
            { preserveScroll: true, onFinish: () => setProcessando(false) }
        );
    };

    const carregar = () => {
        if (!cargaId) return;
        setProcessando(true);
        router.post(
            route('pecas.carga', pedido.id),
            { romaneio_id: cargaId },
            { preserveScroll: true, onFinish: () => setProcessando(false) }
        );
    };

    const receber = () => {
        setProcessando(true);
        router.post(
            route('pecas.receber', pedido.id),
            {
                itens: Object.entries(recebidas).map(([item_id, quantidade]) => ({
                    item_id: Number(item_id),
                    quantidade: Number(quantidade) || 0,
                })),
                observacao: obsRecebimento,
            },
            { preserveScroll: true, onFinish: () => setProcessando(false) }
        );
    };

    return (
        <div className="space-y-4">
            {/* --- SEPARAÇÃO (CD) --- */}
            {peca.pode_separar && (
                <Card
                    title="Separar peças"
                    subtitle="Informe o que foi localizado. Separar reserva o saldo — a peça só sai do CD no recebimento."
                    padding="none"
                >
                    <div className="divide-y divide-line">
                        {itens.map((item) => {
                            const pendente = item.qtd_pendente ?? 0;
                            const concluido = pendente === 0;

                            return (
                                <div key={item.id} className="flex items-center gap-3 p-4">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-content-primary">
                                            {item.peca?.descricao ?? 'Peça'}
                                        </p>
                                        <p className="font-mono text-[10px] text-content-muted">
                                            {item.peca?.codigo}
                                        </p>
                                        <p className="mt-0.5 text-xs text-content-secondary">
                                            Pedido: <strong>{item.quantidade}</strong> · Separado:{' '}
                                            <strong className="text-status-success-fg">{item.qtd_atribuida}</strong>
                                            {pendente > 0 && (
                                                <> · Falta: <strong className="text-status-warning-fg">{pendente}</strong></>
                                            )}
                                        </p>
                                    </div>

                                    {concluido ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-status-success-fg">
                                            <CheckCircleIcon className="h-4 w-4" /> Completo
                                        </span>
                                    ) : (
                                        <input
                                            type="number"
                                            min="0"
                                            max={pendente}
                                            value={quantidades[item.id] ?? 0}
                                            onChange={(e) =>
                                                setQuantidades((q) => ({ ...q, [item.id]: e.target.value }))
                                            }
                                            className="w-20 rounded-lg border-line bg-surface-card py-1.5 text-center text-sm font-bold tabular-nums focus:border-brand-500 focus:ring-brand-500"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="border-t border-line p-4">
                        <Button
                            icon={WrenchScrewdriverIcon}
                            loading={processando}
                            onClick={separar}
                            className="w-full sm:w-auto"
                        >
                            Confirmar separação
                        </Button>
                    </div>
                </Card>
            )}

            {/* --- CARGA (CD) --- */}
            {peca.pode_carregar && (
                <Card
                    title="Incluir na carga"
                    subtitle="As peças separadas embarcam junto com as motos — a mesma carga leva os dois."
                >
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <select
                            value={cargaId}
                            onChange={(e) => setCargaId(e.target.value)}
                            className="flex-1 rounded-lg border-line bg-surface-card py-2 text-sm focus:border-brand-500 focus:ring-brand-500"
                        >
                            <option value="">Escolha a carga…</option>
                            {(peca.cargas_abertas ?? []).map((c) => (
                                <option key={c.id} value={c.id}>
                                    Carga #{c.id} — {c.motorista} {c.placa ? `(${c.placa})` : ''} {c.rota ?? ''}
                                </option>
                            ))}
                        </select>

                        <Button icon={TruckIcon} loading={processando} disabled={!cargaId} onClick={carregar}>
                            Embarcar
                        </Button>
                    </div>
                </Card>
            )}

            {/* --- RECEBIMENTO (LOJA) --- */}
            {peca.pode_receber && (
                <Card
                    title="Conferir recebimento"
                    subtitle="Confira a quantidade física. Divergência abre pendência para o CD — não some."
                    padding="none"
                >
                    <div className="divide-y divide-line">
                        {(peca.itens_carga ?? []).map((item) => {
                            const divergiu = Number(recebidas[item.id]) !== item.enviado;
                            const jaConferido = item.recebido !== null;

                            return (
                                <div key={item.id} className="flex items-center gap-3 p-4">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-content-primary">
                                            {item.descricao}
                                        </p>
                                        <p className="font-mono text-[10px] text-content-muted">{item.codigo}</p>
                                        <p className="mt-0.5 text-xs text-content-secondary">
                                            Enviado: <strong>{item.enviado}</strong> {item.unidade}
                                        </p>
                                    </div>

                                    {jaConferido ? (
                                        <div className="text-right">
                                            <StatusBadge status={item.status} size="sm" />
                                            <p className="mt-1 text-xs tabular-nums text-content-secondary">
                                                recebido: {item.recebido}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            {divergiu && (
                                                <ExclamationTriangleIcon
                                                    className="h-4 w-4 text-status-warning-fg"
                                                    title="Diferente do enviado"
                                                />
                                            )}
                                            <input
                                                type="number"
                                                min="0"
                                                max={item.enviado}
                                                value={recebidas[item.id] ?? 0}
                                                onChange={(e) =>
                                                    setRecebidas((r) => ({ ...r, [item.id]: e.target.value }))
                                                }
                                                className={`w-20 rounded-lg py-1.5 text-center text-sm font-bold tabular-nums focus:ring-brand-500 ${
                                                    divergiu
                                                        ? 'border-status-warning-solid bg-status-warning-bg'
                                                        : 'border-line bg-surface-card'
                                                }`}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="space-y-3 border-t border-line p-4">
                        <input
                            type="text"
                            value={obsRecebimento}
                            onChange={(e) => setObsRecebimento(e.target.value)}
                            placeholder="Observação da conferência (opcional)"
                            className="w-full rounded-lg border-line bg-surface-card py-2 text-sm focus:border-brand-500 focus:ring-brand-500"
                        />

                        <Button
                            icon={ClipboardDocumentCheckIcon}
                            variant="success"
                            loading={processando}
                            onClick={receber}
                            className="w-full sm:w-auto"
                        >
                            Confirmar recebimento
                        </Button>
                    </div>
                </Card>
            )}

            {/* --- ESTADO INFORMATIVO QUANDO NÃO HÁ AÇÃO DIRETA NESTA TELA --- */}
            {!peca.pode_separar && !peca.pode_carregar && !peca.pode_receber && (
                <Card>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 text-sm text-content-secondary">
                            <ClockIcon className="h-6 w-6 text-status-info-fg shrink-0" />
                            <div>
                                <p className="font-bold text-content-primary">
                                    {pedido.status === 'solicitado' && "Aguardando Atendimento do CD / Call Center"}
                                    {pedido.status === 'em_atendimento' && "Em Atendimento no CD"}
                                    {pedido.status === 'aguardando_confirmacao' && "Aguardando Liberação do Pós-Venda (Gate 1)"}
                                    {pedido.status === 'aprovado' && "Aprovado — Aguardando Separação no CD"}
                                    {pedido.status === 'separado' && "Separado — Aguardando Montagem da Carga"}
                                    {['expedido', 'em_transito'].includes(pedido.status) && "Em Trânsito para a Loja"}
                                    {pedido.status === 'concluido' && "Pedido de Peças Concluído e Recebido"}
                                </p>
                                <p className="text-xs text-content-muted mt-0.5">
                                    {pedido.status === 'solicitado' && "Os itens solicitados estão na fila do Call Center para conferência técnica de SKU e catálogo."}
                                    {pedido.status === 'aguardando_confirmacao' && "Os códigos de peças foram vinculados e aguardam assinatura de liberação do Pós-Venda."}
                                    {pedido.status === 'aprovado' && "Pedido liberado tecnicamente. O operador do CD fará a separação e alocação na basqueta."}
                                    {pedido.status === 'separado' && "Peças devidamente acondicionadas na basqueta da filial, aguardando embarque em caminhão."}
                                    {['expedido', 'em_transito'].includes(pedido.status) && "A carga contendo as basquetas deste pedido está a caminho do destino."}
                                    {pedido.status === 'concluido' && "Conferência física finalizada com sucesso."}
                                </p>
                            </div>
                        </div>

                        {(peca.pode_atender || peca.pode_liberar) && ['solicitado', 'em_atendimento', 'aguardando_confirmacao'].includes(pedido.status) && (
                            <Link
                                href={route('pecas.atendimento')}
                                className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-700 transition"
                            >
                                <WrenchScrewdriverIcon className="w-4 h-4" />
                                {peca.pode_liberar ? 'Ir para Liberação Pós-Venda' : 'Ir para Atendimento'}
                            </Link>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
}
