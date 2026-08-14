/**
 * DICIONÁRIO CENTRAL DE STATUS (v3)
 *
 * O sistema tem ~19 status distintos entre Pedido, Moto e Romaneio, e hoje o
 * mapeamento status -> cor/rótulo está reescrito em cada tela. O resultado é
 * que o mesmo 'em_transito' aparece azul numa tela e amarelo em outra, e um
 * status novo precisa ser adicionado em vários lugares.
 *
 * Este arquivo é a única fonte. `tone` referencia a semântica dos tokens
 * (status-*-fg / -bg em tailwind.config.js), nunca uma cor literal.
 *
 * Tons:
 *   neutral -> parado / inicial            success -> finalizado com êxito
 *   info    -> em movimento / em curso     warning -> requer ação humana
 *   danger  -> problema / encerrado mal
 */

export const STATUS_MAP = {
    // --- Fluxo de Pedido ---
    solicitado:        { label: 'Solicitado',        tone: 'warning' },
    aprovado:          { label: 'Aprovado',          tone: 'info'    },
    rejeitado:         { label: 'Rejeitado',         tone: 'danger'  },
    separado:          { label: 'Separado',          tone: 'info'    },
    aguardando_coleta: { label: 'Aguardando Coleta', tone: 'warning' },
    expedido:          { label: 'Expedido',          tone: 'info'    },
    em_transito:       { label: 'Em Trânsito',       tone: 'info'    },
    em_transito_cd:    { label: 'Em Trânsito p/ CD', tone: 'info'    },
    no_cd:             { label: 'No CD',             tone: 'neutral' },
    concluido:         { label: 'Concluído',         tone: 'success' },
    cancelado:         { label: 'Cancelado',         tone: 'danger'  },

    // --- Estoque de Moto ---
    disponivel:      { label: 'Disponível',      tone: 'success' },
    estoque_fabrica: { label: 'Estoque Fábrica', tone: 'neutral' },
    estoque_loja:    { label: 'Estoque Loja',    tone: 'success' },
    transito_loja:   { label: 'Trânsito Loja',   tone: 'info'    },
    reservado:       { label: 'Reservado',       tone: 'warning' },
    vendida:         { label: 'Vendida',         tone: 'neutral' },
    avariado:        { label: 'Avariado',        tone: 'danger'  },
    desmontada:      { label: 'Desmontada',      tone: 'warning' },

    // --- Carga ---
    aberto:    { label: 'Aberto',    tone: 'warning' },
    retornado: { label: 'Retornado', tone: 'danger'  },

    // --- Itens de carga (v3) ---
    carregado:   { label: 'Carregado',   tone: 'info'    },
    entregue:    { label: 'Entregue',    tone: 'success' },
    divergencia: { label: 'Divergência', tone: 'danger'  },

    // --- Movimento de peça (v3) ---
    entrada:       { label: 'Entrada',       tone: 'success' },
    saida:         { label: 'Saída',         tone: 'danger'  },
    reserva:       { label: 'Reserva',       tone: 'warning' },
    liberacao:     { label: 'Liberação',     tone: 'neutral' },
    transferencia: { label: 'Transferência', tone: 'info'    },
    ajuste:        { label: 'Ajuste',        tone: 'warning' },
    sync:          { label: 'Sincronização', tone: 'neutral' },
};

/** Classes Tailwind por tom. Chaves batem com os tokens de status. */
export const TONE_CLASSES = {
    success: 'bg-status-success-bg text-status-success-fg ring-status-success-solid/20',
    warning: 'bg-status-warning-bg text-status-warning-fg ring-status-warning-solid/20',
    danger:  'bg-status-danger-bg  text-status-danger-fg  ring-status-danger-solid/20',
    info:    'bg-status-info-bg    text-status-info-fg    ring-status-info-solid/20',
    neutral: 'bg-status-neutral-bg text-status-neutral-fg ring-status-neutral-solid/20',
};

export const TONE_DOT = {
    success: 'bg-status-success-solid',
    warning: 'bg-status-warning-solid',
    danger:  'bg-status-danger-solid',
    info:    'bg-status-info-solid',
    neutral: 'bg-status-neutral-solid',
};

/**
 * Resolve um status desconhecido sem quebrar a tela: um status novo no backend
 * aparece com o próprio nome legível em vez de sumir ou lançar erro.
 */
export function resolveStatus(status) {
    if (!status) return { label: '—', tone: 'neutral' };

    const known = STATUS_MAP[status];
    if (known) return known;

    return {
        label: String(status)
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase()),
        tone: 'neutral',
    };
}
