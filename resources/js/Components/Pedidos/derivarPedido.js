/**
 * O que a tela do pedido precisa saber sobre QUEM está olhando e EM QUE PONTO
 * o pedido está. Calculado uma vez na página e repassado aos painéis, para
 * que nenhum deles refaça a conta por conta própria.
 */
export function derivarPedido({ pedido, user, atribuicao, peca }) {
    const ehPeca = !!peca?.ativo || pedido.tipo_carga === 'peca';
    const motos = pedido.motos || [];

    // V2.6: cotas do pedido. Pedidos legados vêm com atribuicao.legado = true.
    const cotas = pedido.itens_pedido || [];
    const cotasPendentes = ehPeca ? [] : cotas.filter((c) => c.qtd_pendente > 0);

    const souOrigem = user.id === pedido.origem_user_id;
    const souDestino = user.id === pedido.user_id;
    const souCD = user.perfil === 'cd';
    const souAdmin = user.perfil === 'admin' || user.perfil === 'gestor';
    // Exclusivo do perfil admin (não inclui gestor): remoção direta de itens.
    const souAdminExclusivo = user.perfil === 'admin';

    // O CD só recebe quando o destino final é ele (transferência ou devolução para o CD/Matriz).
    const isDestinoCD =
        !pedido.user_id || ['cd', 'admin'].includes(pedido.user?.perfil) || pedido.status === 'em_transito_cd';

    // Só é transferência se a origem for uma loja: envio do CD não é transferência.
    const isTransferencia = !ehPeca && !!(pedido.origem_user_id && pedido.origem && pedido.origem.perfil === 'loja');

    // --- Embarque parcial (v2.6/v3) ---
    const saldoPendente = atribuicao?.saldo_pendente ?? 0;
    const motosEmTransito = motos.filter((m) => ['em_transito', 'transito_loja'].includes(m.status)).length;
    const motosNoCd = motos.filter((m) =>
        ['em_analise', 'solicitado', 'separado', 'aguardando_rota', 'estoque_fabrica'].includes(m.status)
    ).length;
    const totalNaoDespachado = saldoPendente + motosNoCd;

    const totalItensSolicitados =
        (cotas.length > 0
            ? cotas.reduce((acc, i) => acc + Math.max(0, (i.quantidade || 0) - (i.qtd_cancelada || 0)), 0)
            : motos.length) || motosEmTransito + totalNaoDespachado;

    // Destinos reais a partir do pivot.
    const destinosReais = [...new Set(motos.map((m) => m.pivot?.destino).filter(Boolean))];

    return {
        ehPeca,
        cotas,
        cotasPendentes,
        podeAtribuir: !ehPeca && !!atribuicao?.permitido && !atribuicao?.legado,
        souOrigem,
        souDestino,
        souCD,
        souAdmin,
        souAdminExclusivo,
        isTransferencia,
        ehDestinatarioFinal: souDestino || (souCD && isDestinoCD) || souAdmin,
        saldoPendente,
        motosEmTransito,
        totalNaoDespachado,
        isEmbarqueParcial: !ehPeca && motosEmTransito > 0 && totalNaoDespachado > 0,
        totalItensSolicitados,
        destinoFinalLabel:
            destinosReais.length > 0 ? destinosReais.join(', ') : pedido.user?.filial || 'Destino não definido',
    };
}
