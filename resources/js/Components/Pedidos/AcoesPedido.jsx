import { useForm } from '@inertiajs/react';
import { BoltIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { Button } from '@/Components/UI';
import { confirmar } from '@/Lib/alertas';
import { rejeitarPedido } from './acoes';

/**
 * Ações de fluxo do pedido.
 *
 * O botão "Confirmar saída manual" saiu na v3.5: chamava a rota
 * `pedidos.saida`, que nunca existiu, e quebrava ao clicar. A saída real de
 * uma carga é a do romaneio.
 */
export default function AcoesPedido({ pedido, peca, papel }) {
    const { ehPeca, isTransferencia, souOrigem, souCD, souAdmin } = papel;
    const form = useForm({});

    const podeSeparar = pedido.status === 'solicitado' && (souOrigem || (souCD && !isTransferencia) || souAdmin);

    const confirmarSeparacao = async () => {
        const confirmou = await confirmar({
            titulo: 'Confirmar Separação',
            texto: isTransferencia
                ? 'Confirma que as motos foram separadas e estão prontas para coleta?'
                : 'Confirma a separação física destas motos no CD?',
            textoConfirmar: 'Sim',
        });

        if (confirmou) form.post(route('pedidos.separar', pedido.id));
    };

    if (ehPeca) {
        if (!peca?.pode_cancelar) return null;

        return (
            <div className="mt-8 rounded-card border-l-4 border-status-danger-solid bg-surface-card p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="flex items-center gap-2 text-base font-bold text-content-primary">
                        <span className="rounded-lg bg-status-danger-bg p-1.5 text-status-danger-fg">
                            <XCircleIcon className="h-5 w-5" />
                        </span>
                        Cancelar Pedido de Peças
                    </h3>
                    <p className="text-xs text-content-secondary mt-1">
                        Caso este pedido tenha sido criado por engano, em testes, ou não seja mais necessário, você pode
                        cancelá-lo. As reservas serão liberadas.
                    </p>
                </div>
                <Button
                    onClick={() => rejeitarPedido(pedido.id)}
                    icon={XCircleIcon}
                    variant="secondary"
                    size="md"
                    className="!text-status-danger-fg hover:!bg-status-danger-bg border-status-danger-border shrink-0"
                >
                    Cancelar / Rejeitar Pedido
                </Button>
            </div>
        );
    }

    if (['cancelado', 'concluido'].includes(pedido.status) || !podeSeparar) return null;

    return (
        <div className="mt-8 rounded-card border-l-4 border-brand-600 bg-surface-card p-6 shadow-card">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-content-primary">
                <span className="rounded-lg bg-brand-50 p-1.5 text-brand-600">
                    <BoltIcon className="h-5 w-5" />
                </span>
                Ações
            </h3>
            <div className="flex flex-wrap gap-4">
                <Button
                    onClick={confirmarSeparacao}
                    loading={form.processing}
                    icon={CheckCircleIcon}
                    size="lg"
                    className="flex-1 justify-center"
                >
                    Confirmar separação
                </Button>
                <Button
                    onClick={() => rejeitarPedido(pedido.id)}
                    icon={XCircleIcon}
                    variant="secondary"
                    size="lg"
                    className="flex-1 justify-center text-status-danger-fg"
                >
                    Rejeitar
                </Button>
            </div>
        </div>
    );
}
