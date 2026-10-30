import { useState } from 'react';
import {
    ArrowPathIcon,
    ShoppingCartIcon,
    PlusIcon,
    CheckIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    FireIcon,
    TagIcon,
    GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/Components/UI';

/**
 * Componente de Itens Recorrentes e Reposição Rápida para Oficinas Shineray.
 *
 * Apresenta as peças mais solicitadas pela concessionária nos últimos 90 dias,
 * permitindo que a equipe de pós-venda e oficina recomponha seu estoque de giro
 * com 1 clique por item ou adicione a lista completa em lote ao pedido.
 */
export default function ItensRecorrentes({
    itens = [],
    lojaNome = '',
    carrinho = [],
    onAdicionarItem,
    onAdicionarTodos,
}) {
    const [expandido, setExpandido] = useState(true);
    const [itemAdicionadoRecente, setItemAdicionadoRecente] = useState(null);
    const [todosAdicionadosRecente, setTodosAdicionadosRecente] = useState(false);

    if (!itens || itens.length === 0) {
        return null;
    }

    const handleAdicionarItem = (peca) => {
        if (onAdicionarItem) {
            onAdicionarItem(peca);
            setItemAdicionadoRecente(peca.id);
            setTimeout(() => {
                setItemAdicionadoRecente((prev) => (prev === peca.id ? null : prev));
            }, 1800);
        }
    };

    const handleAdicionarTodos = () => {
        if (onAdicionarTodos) {
            onAdicionarTodos(itens);
            setTodosAdicionadosRecente(true);
            setTimeout(() => {
                setTodosAdicionadosRecente(false);
            }, 2200);
        }
    };

    return (
        <section
            data-tour="pecas-solicitar.recorrentes"
            aria-label="Itens Recorrentes da Sua Concessionária"
            className="mb-6 rounded-card border border-brand-500/25 bg-gradient-to-b from-brand-500/5 via-surface-card to-surface-card p-4 shadow-card ring-1 ring-brand-500/10 transition-all"
        >
            {/* Header da Seção */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                        <ArrowPathIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-sm font-bold text-content-primary sm:text-base">
                                🔁 Itens Recorrentes da Sua Concessionária (Pedir Novamente)
                            </h2>
                            {lojaNome && (
                                <span className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-semibold text-content-secondary border border-line">
                                    {lojaNome}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-content-secondary">
                            Peças de maior giro pedidas pela sua oficina nos últimos 90 dias. Reponha seu estoque em 1 clique.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant={todosAdicionadosRecente ? 'success' : 'secondary'}
                        icon={todosAdicionadosRecente ? CheckIcon : ShoppingCartIcon}
                        onClick={handleAdicionarTodos}
                        title="Adicionar todos os itens recorrentes de uma vez ao pedido"
                    >
                        {todosAdicionadosRecente
                            ? 'Adicionados ao Pedido!'
                            : `Adicionar Todos ao Carrinho (${itens.length} itens)`}
                    </Button>

                    <button
                        type="button"
                        onClick={() => setExpandido(!expandido)}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-content-secondary hover:bg-surface-sunken hover:text-content-primary transition-colors"
                        aria-expanded={expandido}
                        aria-label={expandido ? 'Ocultar itens recorrentes' : 'Mostrar itens recorrentes'}
                    >
                        {expandido ? (
                            <>
                                <span>Ocultar</span>
                                <ChevronUpIcon className="h-4 w-4" />
                            </>
                        ) : (
                            <>
                                <span>Mostrar ({itens.length})</span>
                                <ChevronDownIcon className="h-4 w-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Grid dos Itens Recorrentes */}
            {expandido && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {itens.map((item) => {
                        const noCarrinho = carrinho.find(
                            (c) => c.key === `peca-${item.id}` || c.peca_id === item.id
                        );
                        const recente = itemAdicionadoRecente === item.id;

                        // Saldo no CD / Matriz se disponível
                        const saldoDisponivel = item.onde_tem?.reduce(
                            (acc, o) => acc + (Number(o.saldo) || 0),
                            0
                        );

                        return (
                            <div
                                key={item.id}
                                className="flex flex-col justify-between rounded-xl border border-line bg-surface-card p-3 shadow-sm transition-all hover:border-brand-500/40 hover:shadow-md"
                            >
                                <div className="space-y-2">
                                    {/* Linha superior: Giro e Código */}
                                    <div className="flex items-center justify-between gap-1.5">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">
                                            <FireIcon className="h-3 w-3" />
                                            {item.total_quantidade || 1} un. pedidas
                                            {item.total_pedidos > 1 && (
                                                <span className="font-normal text-content-muted">
                                                    ({item.total_pedidos}x)
                                                </span>
                                            )}
                                        </span>

                                        <span className="font-mono text-[11px] font-semibold text-content-muted">
                                            {item.codigo}
                                        </span>
                                    </div>

                                    {/* Descrição da Peça */}
                                    <div>
                                        <h3
                                            className="font-bold text-xs leading-snug text-content-primary line-clamp-2"
                                            title={item.descricao}
                                        >
                                            {item.descricao}
                                        </h3>
                                        {item.categoria && (
                                            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-content-muted">
                                                <TagIcon className="h-3 w-3 shrink-0" />
                                                <span className="truncate">{item.categoria}</span>
                                            </p>
                                        )}
                                    </div>

                                    {/* Compatibilidade / Aplicação */}
                                    <div className="flex flex-wrap gap-1 text-[10px]">
                                        {item.tipo_item === 'universal' ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-status-info-bg px-2 py-0.5 font-semibold text-status-info-fg">
                                                <GlobeAltIcon className="h-3 w-3" />
                                                Qualquer moto
                                            </span>
                                        ) : item.modelos && item.modelos.length > 0 ? (
                                            item.modelos.slice(0, 2).map((m, i) => (
                                                <span
                                                    key={i}
                                                    className="rounded-full bg-surface-sunken px-2 py-0.5 font-medium text-content-secondary border border-line"
                                                >
                                                    {m.label}
                                                </span>
                                            ))
                                        ) : null}
                                        {item.modelos && item.modelos.length > 2 && (
                                            <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-content-muted">
                                                +{item.modelos.length - 2}
                                            </span>
                                        )}
                                    </div>

                                    {/* Saldo Indicativo no CD */}
                                    {saldoDisponivel > 0 && (
                                        <p className="text-[10px] text-content-muted">
                                            Disponível na rede:{' '}
                                            <strong className="text-status-success-fg">
                                                {saldoDisponivel} {item.unidade || 'UN'}
                                            </strong>
                                        </p>
                                    )}
                                </div>

                                {/* Rodapé: Preço e Botão de Ação */}
                                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/80 pt-2.5">
                                    <span className="text-xs font-bold text-content-primary">
                                        {item.preco != null
                                            ? Number(item.preco).toLocaleString('pt-BR', {
                                                  style: 'currency',
                                                  currency: 'BRL',
                                              })
                                            : '—'}
                                    </span>

                                    <Button
                                        size="sm"
                                        variant={recente || noCarrinho ? 'success' : 'primary'}
                                        icon={recente ? CheckIcon : PlusIcon}
                                        onClick={() => handleAdicionarItem(item)}
                                    >
                                        {recente
                                            ? 'Adicionado!'
                                            : noCarrinho
                                            ? `No pedido (${noCarrinho.quantidade})`
                                            : '+ Pedir'}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
