import { useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { CheckCircleIcon, QrCodeIcon } from '@heroicons/react/24/outline';
import { Button, Card, EmptyState } from '@/Components/UI';
import { avisar, avisarErro } from '@/Lib/alertas';
import { comZeros } from './agrupar';

/**
 * Fluxo B da atribuição de chassi: bipagem na doca, vinculando ao pedido mais
 * antigo que espera aquele modelo e cor (ou a um pedido forçado).
 */
export default function AbaBiparChassi({ aguardandoChassi, filaFiltrada }) {
    const [chassi, setChassi] = useState('');
    const [pedidoAlvo, setPedidoAlvo] = useState('');
    const [bipando, setBipando] = useState(false);
    const campo = useRef(null);

    const bipar = () => {
        const valor = chassi.trim().toUpperCase();

        if (valor.length < 11) {
            avisar('Chassi Inválido', 'Informe ao menos 11 caracteres para buscar o chassi.', 'warning');
            return;
        }

        setBipando(true);

        router.post(
            route('romaneios.atribuir_chassi'),
            { chassi: valor, pedido_id: pedidoAlvo || null },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setChassi('');
                    new Audio('/plim.mp3').play().catch(() => {});
                    campo.current?.focus();
                },
                onError: (erros) => avisarErro(erros, 'Não foi possível atribuir', 'Erro desconhecido ao validar chassi.'),
                onFinish: () => setBipando(false),
            }
        );
    };

    return (
        <div className="space-y-6">
            <Card
                title="Bipagem Rápida de Chassis no Embarque"
                subtitle="Bipe o chassi da moto nas docas. O sistema identifica o modelo e cor e vincula automaticamente ao pedido mais antigo (FIFO) que aguarda a moto."
            >
                <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                        <QrCodeIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-600" />
                        <input
                            ref={campo}
                            type="text"
                            aria-label="Chassi"
                            placeholder="Bipe ou digite o número do chassi (11 a 17 dígitos)..."
                            value={chassi}
                            maxLength={17}
                            disabled={bipando}
                            onChange={(e) => setChassi(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    bipar();
                                }
                            }}
                            className="w-full rounded-lg border-line-strong py-3 pl-10 pr-4 font-mono text-base font-bold tracking-widest text-content-primary placeholder-content-muted focus:border-brand-500 focus:ring-brand-500"
                        />
                    </div>

                    <select
                        aria-label="Pedido de destino"
                        value={pedidoAlvo}
                        onChange={(e) => setPedidoAlvo(e.target.value)}
                        className="rounded-lg border-line-strong text-sm font-bold text-content-primary focus:border-brand-500 focus:ring-brand-500"
                    >
                        <option value="">Descoberta Automática (FIFO)</option>
                        {aguardandoChassi.map((p) => (
                            <option key={p.id} value={p.id}>
                                Forçar Pedido #{p.id} — {p.loja}
                            </option>
                        ))}
                    </select>

                    <Button type="button" variant="primary" loading={bipando} onClick={bipar} icon={QrCodeIcon} className="px-6 py-3">
                        Atribuir
                    </Button>
                </div>
            </Card>

            {filaFiltrada.length === 0 ? (
                <EmptyState
                    icon={CheckCircleIcon}
                    title="Nenhum pedido aguardando chassi"
                    description="Todos os pedidos aprovados já possuem motos vinculadas e estão prontos para expedição."
                />
            ) : (
                <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-content-muted">
                        Fila de Pedidos Aguardando Atribuição ({filaFiltrada.length})
                    </h4>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {filaFiltrada.map((pedido) => (
                            <Card key={pedido.id} padding="none" className="overflow-hidden">
                                <div className="flex items-center justify-between border-b border-line bg-surface-sunken px-4 py-3">
                                    <div>
                                        <h5 className="text-sm font-bold text-content-primary">Pedido #{comZeros(pedido.id)}</h5>
                                        <p className="text-xs text-content-secondary">{pedido.loja}</p>
                                    </div>
                                    <a
                                        href={route('pedidos.show', pedido.id)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs font-bold text-brand-600 hover:underline"
                                    >
                                        Abrir ↗
                                    </a>
                                </div>

                                <div className="divide-y divide-line p-3">
                                    {pedido.itens.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between py-2 text-xs">
                                            <div>
                                                <span className="font-bold text-content-primary">{item.modelo}</span>{' '}
                                                <span className="text-content-secondary">{item.cor}</span>
                                            </div>
                                            <span className="rounded-full bg-status-warning-bg px-2.5 py-0.5 font-bold text-status-warning-fg">
                                                Faltam {item.qtd_pendente} de {item.quantidade}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
