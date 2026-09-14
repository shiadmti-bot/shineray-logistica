import { router } from '@inertiajs/react';
import {
    CameraIcon,
    ChatBubbleBottomCenterTextIcon,
    ExclamationTriangleIcon,
    PlayIcon,
    ScissorsIcon,
    TrashIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import { avisar, avisarErro, confirmar, pedirTexto } from '@/Lib/alertas';

function estiloDoMotivo(motivo) {
    const m = (motivo || '').toLowerCase();
    if (m.includes('venda')) return 'bg-status-success-bg text-status-success-fg border-status-success-solid/20';
    if (m.includes('garantia') || m.includes('frota')) return 'bg-status-danger-bg text-status-danger-fg border-status-danger-solid/20';
    if (m.includes('exposição')) return 'bg-status-warning-bg text-status-warning-fg border-status-warning-solid/20';
    return 'bg-status-info-bg text-status-info-fg border-status-info-solid/20';
}

// Amostra de cor da moto: é a cor física do produto, não um token do tema.
const CORES = {
    vermelho: '#ef4444',
    vermelha: '#ef4444',
    azul: '#3b82f6',
    'azul escuro': '#1e3a8a',
    preto: '#111827',
    preta: '#111827',
    branco: '#ffffff',
    branca: '#ffffff',
    prata: '#9ca3af',
    cinza: '#6b7280',
    amarelo: '#eab308',
    amarela: '#eab308',
    verde: '#22c55e',
};

const hexDaCor = (cor) => (cor ? CORES[cor.toLowerCase().trim()] || '#9ca3af' : '#e5e7eb');

/**
 * Motos do pedido e as ações por moto: desfazer bipagem (CD), pedir corte
 * (CD ou origem) e remoção direta (só admin).
 */
export default function ListaMotosPedido({ pedido, papel }) {
    const { cotas, podeAtribuir, souCD, souOrigem, souAdminExclusivo } = papel;

    // Pedido novo, ainda sem moto vinculada, mostra o espelho da solicitação;
    // depois disso vale só o vínculo real (pivot).
    const itens = pedido.status === 'em_analise' && pedido.motos.length === 0 ? pedido.itens || [] : pedido.motos;

    const unidades =
        (cotas.length > 0
            ? cotas.reduce((acc, c) => acc + Math.max(0, (c.quantidade || 0) - (c.qtd_cancelada || 0)), 0)
            : pedido.motos?.length) || 0;

    const solicitarCorte = async (motoId) => {
        const motivo = await pedirTexto({
            titulo: 'Solicitar Retirada/Corte',
            texto: 'Motivo do corte?',
            placeholder: 'Motivo (Ex: Avaria no estoque, Erro de sistema...)',
            textoConfirmar: 'Enviar Solicitação',
            mensagemObrigatorio: 'Você precisa escrever o motivo!',
            tom: 'perigo',
        });

        if (!motivo) return;

        router.post(
            route('motos.solicitarRetirada', motoId),
            { motivo },
            { onSuccess: () => avisar('Enviado!', 'Solicitação de corte enviada para análise.', 'success') }
        );
    };

    const desfazerAtribuicao = async (moto) => {
        const confirmou = await confirmar({
            titulo: 'Desfazer atribuição?',
            texto: `O chassi ${moto.chassi} será desvinculado deste pedido e voltará ao estoque do CD.`,
            icone: 'warning',
            textoConfirmar: 'Sim, desfazer',
            tom: 'perigo',
        });

        if (!confirmou) return;

        router.delete(route('pedidos.desatribuir_chassi', [pedido.id, moto.id]), {
            preserveScroll: true,
            onError: (erros) => avisarErro(erros, 'Erro', 'Não foi possível desfazer.'),
        });
    };

    const removerComoAdmin = async (moto) => {
        const motivo = await pedirTexto({
            titulo: 'Remover Moto (Admin)',
            texto: `Você está prestes a remover a moto ${moto.modelo} (${moto.chassi}) deste pedido imediatamente, sem passar pelo fluxo de aprovação de estorno.`,
            icone: 'warning',
            placeholder: 'Motivo da remoção (obrigatório)',
            textoConfirmar: 'Remover Agora',
            mensagemObrigatorio: 'Você precisa informar o motivo!',
            tom: 'perigo',
        });

        if (!motivo) return;

        router.delete(route('pedidos.removerMoto', { id: pedido.id, motoId: moto.id }), {
            data: { motivo },
            onSuccess: () => avisar('Removida!', 'A moto foi removida do pedido e devolvida ao estoque.', 'success'),
        });
    };

    return (
        <div className="bg-surface-card rounded-card shadow-sm border border-line overflow-hidden">
            <div className="px-6 py-4 bg-surface-sunken/80 border-b border-line flex justify-between items-center backdrop-blur-sm">
                <h3 className="font-black text-content-primary text-sm uppercase tracking-wide flex items-center gap-2">
                    <span className="text-content-secondary">
                        <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                    </span>{' '}
                    Motocicletas
                </h3>
                <span className="bg-surface-inverted text-content-inverted text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                    {unidades} Unidades
                </span>
            </div>

            <div className="divide-y divide-line">
                {itens.map((item, idx) => {
                    // Motivo: pivot (vínculo real) > item do espelho > coluna legada da moto.
                    const motivoReal = item.pivot?.motivo || item.motivo || item.motivo_solicitacao || 'Venda';
                    const avariaTexto = item.pivot?.detalhes_avaria || item.detalhes_avaria;
                    const avariaFoto = item.pivot?.foto_avaria || item.foto_avaria;
                    const temAvaria = item.status === 'avariado' || !!avariaTexto;

                    return (
                        <div
                            key={item.id || idx}
                            className="group p-5 flex flex-col md:flex-row items-center gap-6 hover:bg-surface-sunken transition duration-150 ease-in-out"
                        >
                            <div className="flex items-center gap-5 flex-1 w-full md:w-auto">
                                <div className="h-14 w-14 rounded-card bg-surface-card border border-line flex items-center justify-center text-content-muted shadow-sm flex-shrink-0 group-hover:scale-105 transition">
                                    <PlayIcon className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="font-extrabold text-content-primary text-base">
                                            {/* V2.6: itens genéricos exibem a quantidade pedida */}
                                            {!item.chassi && item.quantidade > 1 && `${item.quantidade}x `}
                                            {item.modelo}
                                        </h4>
                                        {item.chassi ? (
                                            <span className="font-mono text-[10px] text-status-info-fg bg-status-info-bg/50 px-2 py-0.5 rounded border border-status-info-solid/20 tracking-wider">
                                                {item.chassi}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-status-warning-fg bg-status-warning-bg/50 px-2 py-0.5 rounded border border-status-warning-solid/20 font-bold uppercase tracking-wide">
                                                Chassi a definir pelo CD
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 px-2 py-1 rounded-full border border-line bg-surface-card shadow-sm w-fit">
                                        <span
                                            className="h-3 w-3 rounded-full border border-line shadow-inner"
                                            style={{ backgroundColor: hexDaCor(item.cor) }}
                                        ></span>
                                        <span className="text-[10px] font-bold text-content-secondary uppercase tracking-wide">
                                            {item.cor || 'COR NÃO DEFINIDA'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-6 md:pl-6 md:border-l border-line">
                                {/* min-w só a partir de md: dois blocos de 140px + gap estouravam em 320px. */}
                                <div className="flex flex-col items-start md:items-end md:min-w-[140px]">
                                    <span className="text-[9px] font-bold text-content-muted uppercase tracking-widest mb-1">
                                        Motivo
                                    </span>
                                    <span
                                        className={`px-3 py-1.5 rounded-lg border text-[10px] uppercase font-black tracking-wide shadow-sm whitespace-nowrap ${estiloDoMotivo(motivoReal)}`}
                                    >
                                        {motivoReal}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {temAvaria ? (
                                        <div className="flex flex-col gap-2 items-end">
                                            <span className="flex items-center gap-1 text-[10px] bg-status-danger-bg text-status-danger-fg px-3 py-1.5 rounded-lg border border-status-danger-solid/20 font-bold uppercase">
                                                <ExclamationTriangleIcon className="w-3 h-3" /> Avariado
                                            </span>
                                            {avariaTexto && (
                                                <span className="text-[10px] text-status-danger-fg bg-status-danger-bg/50 px-2 py-1 rounded max-w-[200px] text-right">
                                                    &quot;{avariaTexto}&quot;
                                                </span>
                                            )}
                                            {avariaFoto && (
                                                <a
                                                    href={avariaFoto}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-[10px] text-status-info-fg hover:underline"
                                                >
                                                    <CameraIcon className="w-3 h-3" /> Ver Foto
                                                </a>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            {/* V2.6: desfazer bipagem errada (só chassis atribuídos pelo CD) */}
                                            {podeAtribuir && item.pivot?.pedido_item_id && (
                                                <button
                                                    type="button"
                                                    onClick={() => desfazerAtribuicao(item)}
                                                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-surface-card border border-line text-content-secondary hover:text-status-warning-fg hover:border-status-warning-solid/40 hover:bg-status-warning-bg/50 transition shadow-sm"
                                                    title="Desfazer atribuição deste chassi"
                                                >
                                                    <XCircleIcon className="w-4 h-4" />
                                                    <span className="text-xs font-bold hidden md:inline">Desfazer</span>
                                                </button>
                                            )}

                                            {(souCD || souOrigem) && ['solicitado', 'separado', 'estoque_fabrica'].includes(item.status) && (
                                                <button
                                                    type="button"
                                                    onClick={() => solicitarCorte(item.id)}
                                                    className="group/btn flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-surface-card border border-line text-content-secondary hover:text-status-danger-fg hover:border-status-danger-solid/20 hover:bg-status-danger-bg/50 transition shadow-sm"
                                                    title="Cortar Item"
                                                >
                                                    <ScissorsIcon className="w-4 h-4" />
                                                    <span className="text-xs font-bold hidden md:inline">Cortar</span>
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* EXCLUSIVO ADMIN: remoção direta, sem fluxo de aprovação */}
                                    {souAdminExclusivo && item.pivot && !['concluido', 'cancelado'].includes(pedido.status) && (
                                        <button
                                            type="button"
                                            onClick={() => removerComoAdmin(item)}
                                            className="group/btn flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-status-danger-solid border border-status-danger-solid text-white hover:brightness-95 transition shadow-sm"
                                            title="Remover do pedido imediatamente (Exclusivo Admin)"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                            <span className="text-xs font-bold hidden md:inline">Remover</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {itens.length === 0 && (
                    <div className="p-8 text-center text-content-secondary">
                        <ExclamationTriangleIcon className="w-12 h-12 mx-auto text-content-muted mb-3" />
                        <p className="font-bold text-content-secondary text-lg">Nenhuma motocicleta neste pedido.</p>
                        <p className="text-sm text-content-muted mt-1">
                            Todos os itens foram estornados ou rejeitados na etapa de análise.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
