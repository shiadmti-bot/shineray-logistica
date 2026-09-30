import {
    ArchiveBoxXMarkIcon,
    CalendarDaysIcon,
    ScissorsIcon,
    UserCircleIcon,
} from '@heroicons/react/24/outline';

/**
 * Por que este pedido foi recusado — o dossiê que o sistema não tinha.
 *
 * O MOTIVO ERA UM DADO FANTASMA. `pedidos.motivo_rejeicao` existia desde
 * 26/12/2025, era gravado em toda recusa e NENHUMA tela lia. A loja recebia a
 * notificação "Pedido #X rejeitado: <motivo>" e, ao abrir a lista, não achava o
 * pedido (soft delete) nem o motivo em lugar algum. O texto só sobrevivia
 * dentro de uma frase da linha do tempo — que também estava inacessível,
 * porque `show` dava 404 num pedido excluído.
 *
 * Não renderiza nada em pedido ativo: `recusa` vem null do controller.
 *
 * COR: aqui é vermelho de estado, não de marca, e sai todo de tokens
 * (`status-danger-*`) para acompanhar claro e escuro.
 */
export default function AvisoRecusa({ recusa }) {
    if (!recusa) return null;

    const ehRejeicao = recusa.tipo === 'rejeitado';
    const cortes = recusa.cortes || [];

    return (
        <section
            aria-labelledby="titulo-recusa"
            className="overflow-hidden rounded-3xl border border-status-danger-border bg-status-danger-bg shadow-card"
        >
            <div className="flex items-start gap-4 p-5 sm:p-6">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-status-danger-solid/15 text-status-danger-fg">
                    <ArchiveBoxXMarkIcon className="h-6 w-6" />
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                    <div>
                        <h2
                            id="titulo-recusa"
                            className="text-base font-black leading-tight text-status-danger-fg"
                        >
                            {ehRejeicao ? 'Pedido rejeitado' : 'Pedido cancelado'}
                        </h2>
                        <p className="mt-0.5 text-xs font-medium text-content-secondary">
                            Este pedido está encerrado e aberto apenas para consulta. Nada
                            aqui pode ser alterado.
                        </p>
                    </div>

                    <blockquote className="rounded-xl border border-status-danger-border/60 bg-surface-card px-4 py-3">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-content-muted">
                            Motivo registrado
                        </span>
                        <p className="mt-1 whitespace-pre-line text-sm font-semibold leading-relaxed text-content-primary">
                            {recusa.motivo || 'Nenhum motivo foi informado no registro.'}
                        </p>
                    </blockquote>

                    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                        <div className="flex items-center gap-1.5">
                            <UserCircleIcon className="h-4 w-4 shrink-0 text-content-muted" />
                            <dt className="font-bold text-content-muted">Responsável:</dt>
                            {/*
                                Recusa anterior à v3.6 não tem autor gravado em
                                coluna — o nome só existe no texto da linha do
                                tempo, e a migration não o adivinha por heurística.
                            */}
                            <dd className="font-black text-content-primary">
                                {recusa.autor || 'não registrado (recusa anterior à v3.6)'}
                            </dd>
                        </div>

                        {recusa.em && (
                            <div className="flex items-center gap-1.5">
                                <CalendarDaysIcon className="h-4 w-4 shrink-0 text-content-muted" />
                                <dt className="font-bold text-content-muted">Quando:</dt>
                                <dd className="font-black text-content-primary">
                                    {new Date(recusa.em).toLocaleString('pt-BR')}
                                </dd>
                            </div>
                        )}
                    </dl>
                </div>
            </div>

            {cortes.length > 0 && (
                <div className="border-t border-status-danger-border/60 bg-surface-card px-5 py-4 sm:px-6">
                    <h3 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-content-muted">
                        <ScissorsIcon className="h-3.5 w-3.5" />
                        Itens cortados na análise
                    </h3>

                    <ul className="mt-3 space-y-2">
                        {cortes.map((corte, i) => (
                            <li
                                key={i}
                                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-l-2 border-status-danger-solid/40 pl-3"
                            >
                                <span className="text-sm font-black text-content-primary">
                                    {corte.quantidade}x {corte.descricao}
                                </span>
                                <span className="text-xs text-content-secondary">
                                    {corte.motivo || 'motivo não informado'}
                                </span>
                                {corte.por && (
                                    <span className="text-[11px] font-medium text-content-muted">
                                        — por {corte.por}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
