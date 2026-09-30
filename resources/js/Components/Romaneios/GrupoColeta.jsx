import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { Button, Card } from '@/Components/UI';
import PedidoDaCarga from './PedidoDaCarga';
import { idsDasMotos } from './agrupar';

/** Uma loja de origem na coleta Milk Run: as motos que o caminhão recolhe ali. */
export default function GrupoColeta({ origem, pedidos, selecao, pedidosAbertos, alternarPedidoAberto }) {
    const todasMotos = idsDasMotos(pedidos);
    const grupoSelecionado = todasMotos.length > 0 && todasMotos.every((id) => selecao.motoIds.includes(id));
    const selecionadas = todasMotos.filter((id) => selecao.motoIds.includes(id)).length;

    return (
        <Card padding="none" className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-line bg-surface-sunken/80 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-surface-card p-2 text-status-warning-fg shadow-sm ring-1 ring-line">
                        <ArrowPathIcon className="h-5 w-5" />
                    </span>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-extrabold text-content-primary">{origem}</h3>
                            <span className="rounded-full bg-status-warning-bg px-2.5 py-0.5 text-xs font-bold text-status-warning-fg">
                                {selecionadas} / {todasMotos.length} motos
                            </span>
                        </div>
                        <p className="text-xs text-content-secondary">
                            Origem da Coleta (Loja) · {pedidos.length} pedido(s)
                        </p>
                    </div>
                </div>

                <Button
                    variant={grupoSelecionado ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => selecao.alternarMotos(todasMotos)}
                >
                    {grupoSelecionado ? 'Desmarcar Coleta' : 'Selecionar Coleta'}
                </Button>
            </div>

            <div className="divide-y divide-line">
                {pedidos.map((pedido) => (
                    <PedidoDaCarga
                        key={pedido.id}
                        pedido={pedido}
                        motoIds={selecao.motoIds}
                        expandido={pedidosAbertos.includes(pedido.id)}
                        subtitulo={
                            <>
                                Destino da Moto: <strong>{pedido.user?.filial || pedido.user?.name || 'CD Matriz'}</strong>
                            </>
                        }
                        rotuloMotos="Motos para coleta:"
                        onAlternarPedido={() => selecao.alternarMotos(idsDasMotos([pedido]))}
                        onAlternarMoto={selecao.alternarMoto}
                        onAlternarExpandido={() => alternarPedidoAberto(pedido.id)}
                    />
                ))}
            </div>
        </Card>
    );
}
