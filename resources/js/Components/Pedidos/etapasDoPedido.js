import {
    BuildingOffice2Icon,
    CalendarIcon,
    CheckCircleIcon,
    ClipboardDocumentCheckIcon,
    CubeIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
    TruckIcon,
    WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

/**
 * Etapas didáticas do pedido e o texto da etapa atual.
 *
 * Só dados e regra — a renderização é de TimelinePedido. Três fluxos: peça
 * (6 etapas), transferência de moto entre lojas (7) e reposição de moto do CD
 * para a loja (7).
 *
 * @returns {{ steps: Array, activeStepId: ?string, activeStepWeight: number, infoEtapa: ?object }}
 */
export function etapasDoPedido({ status, isTransferencia, isEmbarqueParcial = false, isPeca = false, peca = null, pedido = null }) {
    if (isPeca) return etapasDePeca(status, peca, pedido);
    if (isTransferencia) return etapasDeTransferencia(status, pedido);
    return etapasDeReposicao(status, isEmbarqueParcial, pedido);
}

function etapasDePeca(status, peca, pedido) {
    const steps = [
        { id: 'solicitado', weight: 1, label: '1. Solicitação', sub: 'Catálogo', ator: 'Loja', icon: DocumentTextIcon },
        { id: 'aguardando_confirmacao', weight: 2, label: '2. Liberação', sub: 'Gate 1', ator: 'Pós-Venda', icon: ShieldCheckIcon },
        { id: 'separado', weight: 3, label: '3. Separação', sub: 'Basqueta CD', ator: 'Estoque CD', icon: WrenchScrewdriverIcon },
        { id: 'faturamento_gate2', weight: 4, label: '4. Faturamento', sub: 'Gate 2 (NF)', ator: 'CD & Loja', icon: ClipboardDocumentCheckIcon },
        { id: 'em_transito', weight: 5, label: '5. Em Trânsito', sub: 'Carga', ator: 'Transporte', icon: TruckIcon },
        { id: 'concluido', weight: 6, label: '6. Recebimento', sub: 'Baixa Estoque', ator: 'Filial Destino', icon: CheckCircleIcon },
    ];

    const basqueta = peca?.basquetas?.[0];
    const basquetaStatus = basqueta?.status;
    const itens = pedido?.itens_pedido ?? [];
    const todasSeparadas = itens.length > 0 && itens.every((i) => (i.qtd_pendente ?? 0) === 0);

    const etapa = (activeStepId, activeStepWeight, infoEtapa) => ({ steps, activeStepId, activeStepWeight, infoEtapa });

    if (status === 'cancelado') {
        return etapa('cancelado', 0, {
            badge: 'Cancelado',
            titulo: 'Pedido Cancelado',
            ator: 'Sistema / Usuário',
            tom: 'danger',
            descricao: 'A solicitação foi cancelada e os saldos reservados foram liberados no estoque do CD.',
            proximo: 'Nenhuma ação pendente.',
        });
    }

    if (status === 'solicitado') {
        return etapa('solicitado', 1, {
            badge: 'Etapa 1 de 6',
            titulo: 'Aguardando Atendimento do CD / Call Center',
            ator: 'Equipe de Peças do CD',
            tom: 'info',
            descricao: 'A loja enviou a solicitação de peças. O CD está conferindo os itens no catálogo oficial, definindo os SKUs e valores de reposição.',
            proximo: 'Assim que todos os itens tiverem códigos SKU atribuídos, o pedido segue automaticamente para liberação técnica do Pós-Venda.',
        });
    }

    if (status === 'em_atendimento') {
        return etapa('solicitado', 1.5, {
            badge: 'Etapa 1 de 6',
            titulo: 'Em Triagem Técnica no CD',
            ator: 'Operador de Peças (CD)',
            tom: 'info',
            descricao: 'O operador do Call Center está identificando as peças de balcão e vinculando ao catálogo oficial da montadora.',
            proximo: 'Conclusão da triagem e encaminhamento ao Gate 1.',
        });
    }

    if (status === 'aguardando_confirmacao') {
        return etapa('aguardando_confirmacao', 2, {
            badge: 'Etapa 2 de 6',
            titulo: 'Gate 1: Aguardando Assinatura do Pós-Venda',
            ator: 'Validador Técnico (Pós-Venda)',
            tom: 'warning',
            descricao: 'Todos os itens foram identificados. O validador do Pós-Venda precisa aprovar os itens e preços para autorizar a separação física.',
            proximo: 'O validador assina a liberação no painel de Atendimento de Peças. Sem essa assinatura, o galpão não pode separar.',
        });
    }

    if (status === 'aprovado') {
        return etapa('separado', 2.5, {
            badge: 'Etapa 3 de 6',
            titulo: 'Aprovado no Gate 1 — Aguardando Separação no CD',
            ator: 'Operador de Estoque (Galpão CD)',
            tom: 'info',
            descricao: 'Solicitação liberada tecnicamente pelo Pós-Venda. O operador do galpão deve localizar as peças nas prateleiras e colocá-las na basqueta.',
            proximo: 'O CD confirma a separação física dos itens.',
        });
    }

    if (status === 'separado') {
        if (basquetaStatus === 'faturada' || basquetaStatus === 'em_conferencia') {
            return etapa('faturamento_gate2', 4, {
                badge: 'Etapa 4 de 6',
                titulo: 'Gate 2: Basqueta Faturada — Aguardando Conferência da Filial',
                ator: 'Filial de Destino (Loja)',
                tom: 'warning',
                descricao: `A basqueta #${basqueta?.id} foi faturada pelo CD sob a NF ${basqueta?.nota_fiscal || 'emitida'}. O romaneio de peças está pronto para conferência.`,
                proximo: 'A filial deve abrir o romaneio digital da basqueta e anexar a foto do canhoto assinado para liberar o embarque.',
            });
        }

        if (basquetaStatus === 'liberada') {
            return etapa('faturamento_gate2', 4.5, {
                badge: 'Etapa 4 de 6',
                titulo: 'Gate 2 Concluído — Basqueta Liberada para Carga',
                ator: 'Expedição CD',
                tom: 'success',
                descricao: `A basqueta #${basqueta?.id} foi conferida e liberada pela filial. Está pronta no CD para ser embarcada no caminhão.`,
                proximo: 'A expedição do CD vincula a basqueta à carga no caminhão.',
            });
        }

        if (todasSeparadas) {
            return etapa('faturamento_gate2', 3.5, {
                badge: 'Etapa 3 de 6 (Concluída)',
                titulo: 'Peças 100% Separadas na Basqueta — Próximo: Faturamento',
                ator: 'Equipe de Faturamento (CD)',
                tom: 'info',
                descricao: `Todos os itens foram reservados e acondicionados na Basqueta #${basqueta?.id || ''} da filial.`,
                proximo: 'O CD deve emitir a Nota Fiscal em Peças > Basquetas para liberar o romaneio e conferência da filial.',
            });
        }

        return etapa('separado', 3, {
            badge: 'Etapa 3 de 6',
            titulo: 'Separação Parcial em Andamento no CD',
            ator: 'Operador de Estoque (CD)',
            tom: 'info',
            descricao: 'Parte dos itens já foi colocada na basqueta. Restam peças pendentes a localizar no estoque.',
            proximo: 'Concluir a separação dos itens restantes.',
        });
    }

    if (['rota_confirmada', 'expedido', 'aguardando_rota'].includes(status)) {
        return etapa('faturamento_gate2', 4.8, {
            badge: 'Etapa 4 de 6',
            titulo: 'Carga Agendada — Aguardando Saída da Frota',
            ator: 'Logística & Frota CD',
            tom: 'info',
            descricao: 'A basqueta de peças foi embarcada na carga e a rota está agendada no Calendário.',
            proximo: 'O status mudará para Em Trânsito assim que o caminhão for liberado na portaria do CD.',
        });
    }

    if (['em_transito', 'em_transito_cd'].includes(status)) {
        return etapa('em_transito', 5, {
            badge: 'Etapa 5 de 6',
            titulo: 'Em Trânsito Rodoviário para a Filial',
            ator: 'Transporte / Motorista',
            tom: 'info',
            descricao: 'O caminhão está na estrada realizando a rota de entrega das peças até a loja.',
            proximo: 'Ao descarregar na filial, o responsável deve conferir fisicamente os volumes e confirmar o recebimento na tela.',
        });
    }

    if (status === 'concluido') {
        return etapa('concluido', 6, {
            badge: 'Etapa 6 de 6 (Concluído)',
            titulo: 'Pedido Entregue e Saldo Integrado ao Estoque',
            ator: 'Filial Destino',
            tom: 'success',
            descricao: 'Conferência física finalizada com sucesso. O saldo das peças foi transferido definitivamente do CD para o estoque local da filial.',
            proximo: 'Ciclo encerrado. Peças disponíveis no inventário da loja.',
        });
    }

    return etapa(null, 1, null);
}

function etapasDeTransferencia(status, pedido) {
    const steps = [
        { id: 'solicitado_origem', weight: 1, label: '1. Solicitação', sub: 'Loja Destino', ator: 'Loja Solicitante', icon: DocumentTextIcon },
        { id: 'em_analise', weight: 2, label: '2. Análise', sub: 'Diretoria', ator: 'Gestor Comercial', icon: ShieldCheckIcon },
        { id: 'solicitado', weight: 3, label: '3. Confirmação', sub: 'Pátio Cedente', ator: 'Loja Cedente', icon: BuildingOffice2Icon },
        { id: 'separado', weight: 4, label: '4. Separação', sub: 'Pronta p/ Coleta', ator: 'Loja Cedente', icon: CubeIcon },
        { id: 'rota_confirmada', weight: 5, label: '5. Agendamento', sub: 'Calendário', ator: 'Logística Frota', icon: CalendarIcon },
        { id: 'em_transito', weight: 6, label: '6. Em Trânsito', sub: 'Transporte', ator: 'Motorista Frota', icon: TruckIcon },
        { id: 'concluido', weight: 7, label: '7. Recebimento', sub: 'Entrada Estoque', ator: 'Loja Destino', icon: CheckCircleIcon },
    ];

    const etapa = (activeStepId, activeStepWeight, infoEtapa) => ({ steps, activeStepId, activeStepWeight, infoEtapa });

    if (status === 'cancelado') {
        return etapa('cancelado', 0, {
            badge: 'Cancelado',
            titulo: 'Transferência Cancelada',
            ator: 'Sistema / Diretoria',
            tom: 'danger',
            descricao: 'A transferência de motocicleta foi cancelada e a unidade permanece no estoque regular da filial cedente.',
            proximo: 'Nenhuma ação pendente.',
        });
    }

    if (status === 'em_analise') {
        return etapa('em_analise', 2, {
            badge: 'Etapa 2 de 7',
            titulo: 'Aguardando Análise Comercial da Diretoria',
            ator: 'Diretoria Comercial / Gestor',
            tom: 'warning',
            descricao: 'A transferência entre filiais foi solicitada pela loja de destino e aguarda autorização da diretoria comercial.',
            proximo: 'O gestor autoriza a movimentação no sistema para liberar a confirmação da loja cedente.',
        });
    }

    if (status === 'solicitado') {
        return etapa('solicitado', 3, {
            badge: 'Etapa 3 de 7',
            titulo: 'Aguardando Confirmação da Loja Cedente',
            ator: 'Loja Cedente (Origem)',
            tom: 'warning',
            descricao: `A transferência foi autorizada pela diretoria. A filial cedente (${pedido?.origem?.filial || 'Origem'}) precisa inspecionar a unidade no pátio e confirmar a separação.`,
            proximo: 'A loja de origem clica em Confirmar Separação na tela do pedido.',
        });
    }

    if (status === 'separado') {
        return etapa('separado', 4, {
            badge: 'Etapa 4 de 7',
            titulo: 'Moto Separada no Pátio — Pronta para Coleta',
            ator: 'Loja Cedente & Logística',
            tom: 'info',
            descricao: 'A motocicleta foi inspecionada, limpa e alocada na área de coleta da filial cedente com os documentos separados.',
            proximo: 'A equipe de logística do CD inclui o recolhimento no roteiro do Calendário da frota.',
        });
    }

    if (['rota_confirmada', 'aguardando_coleta', 'coletado', 'expedido', 'aguardando_rota'].includes(status)) {
        return etapa('rota_confirmada', 5, {
            badge: 'Etapa 5 de 7',
            titulo: 'Coleta Agendada no Calendário da Frota',
            ator: 'Logística & Frota CD',
            tom: 'info',
            descricao: 'A viagem para recolhimento da unidade foi programada no roteiro de transporte da frota.',
            proximo: 'O caminhão fará a parada na filial de origem para coletar a moto.',
        });
    }

    if (['em_transito', 'em_transito_cd'].includes(status)) {
        return etapa('em_transito', 6, {
            badge: 'Etapa 6 de 7',
            titulo: 'Moto em Transporte para a Filial Destino',
            ator: 'Transporte / Motorista',
            tom: 'info',
            descricao: `A unidade está embarcada no caminhão da frota a caminho da loja de destino (${pedido?.user?.filial || 'Destino'}).`,
            proximo: 'Conferência do chassi no descarregamento na filial e upload da foto do canhoto assinado.',
        });
    }

    if (status === 'concluido') {
        return etapa('concluido', 7, {
            badge: 'Etapa 7 de 7 (Concluído)',
            titulo: 'Transferência Concluída e Chassi Integrado',
            ator: 'Loja Destino',
            tom: 'success',
            descricao: 'Moto recebida e conferida pela filial de destino com comprovante anexado. A posse do chassi agora pertence formalmente ao estoque da loja.',
            proximo: 'Unidade pronta para exposição e venda ao cliente final.',
        });
    }

    return etapa(null, 1, null);
}

function etapasDeReposicao(status, isEmbarqueParcial, pedido) {
    const steps = [
        { id: 'solicitado_loja', weight: 1, label: '1. Solicitação', sub: 'Grade & Cota', ator: 'Loja Destino', icon: DocumentTextIcon },
        { id: 'em_analise', weight: 2, label: '2. Análise', sub: 'Diretoria', ator: 'Gestor Comercial', icon: ShieldCheckIcon },
        { id: 'atribuicao', weight: 3, label: '3. Atribuição', sub: 'Chassi no Pátio', ator: 'Operação CD', icon: CubeIcon },
        { id: 'separado', weight: 4, label: '4. Separação', sub: 'Baia Expedição', ator: 'Expedição CD', icon: WrenchScrewdriverIcon },
        { id: 'rota_confirmada', weight: 5, label: '5. Agendamento', sub: 'Calendário', ator: 'Logística CD', icon: CalendarIcon },
        { id: 'em_transito', weight: 6, label: '6. Em Trânsito', sub: isEmbarqueParcial ? 'Parcial' : 'Cegonha Frota', ator: 'Transporte', icon: TruckIcon },
        { id: 'concluido', weight: 7, label: '7. Recebimento', sub: 'Canhoto & Estoque', ator: 'Filial Destino', icon: CheckCircleIcon },
    ];

    const cotas = pedido?.itens_pedido || [];
    const cotasPendentes = cotas.filter((c) => (c.qtd_pendente ?? 0) > 0);
    const totalItens = cotas.reduce((acc, c) => acc + (c.quantidade ?? 0), 0);
    const totalAtribuidos = cotas.reduce((acc, c) => acc + (c.qtd_atribuida ?? 0), 0);

    const etapa = (activeStepId, activeStepWeight, infoEtapa) => ({ steps, activeStepId, activeStepWeight, infoEtapa });

    if (status === 'cancelado') {
        return etapa('cancelado', 0, {
            badge: 'Cancelado',
            titulo: 'Pedido Cancelado',
            ator: 'Sistema / Gestor',
            tom: 'danger',
            descricao: 'O pedido foi cancelado e eventuais reservas de chassi foram desfeitas no estoque do CD.',
            proximo: 'Nenhuma ação pendente.',
        });
    }

    if (status === 'em_analise') {
        return etapa('em_analise', 2, {
            badge: 'Etapa 2 de 7',
            titulo: 'Aguardando Análise Comercial do Gestor',
            ator: 'Diretoria Comercial / Gestor',
            tom: 'warning',
            descricao: 'O pedido de reposição foi emitido pela filial e está na fila da diretoria para validação de crédito e cota comercial.',
            proximo: 'O gestor avalia a grade solicitada e clica em Aprovar Pedido.',
        });
    }

    if (status === 'solicitado') {
        if (cotas.length > 0 && cotasPendentes.length > 0) {
            return etapa('atribuicao', 3, {
                badge: 'Etapa 3 de 7',
                titulo: 'Aprovado — Bipagem e Vinculação de Chassis no CD',
                ator: 'Operação de Pátio (CD)',
                tom: 'warning',
                descricao: `Pedido aprovado pela diretoria. O operador do CD precisa bipar ou vincular os chassis físicos no pátio para cada modelo solicitado (${totalAtribuidos} de ${totalItens} unidades bipadas).`,
                proximo: 'O CD bipa os chassis pendentes (ou encerra o saldo em falta) para liberar a separação física.',
            });
        }

        if (cotas.length > 0) {
            return etapa('separado', 3.8, {
                badge: 'Etapa 3 de 7 (Concluída)',
                titulo: 'Chassis 100% Atribuídos — Aguardando Separação no CD',
                ator: 'Expedição do CD',
                tom: 'info',
                descricao: `Todos os ${totalAtribuidos} números de chassi foram vinculados com sucesso no sistema. As motos estão prontas para serem alocadas na baia de expedição.`,
                proximo: 'A equipe de expedição confirma a separação física das motos para liberar o agendamento no Calendário.',
            });
        }

        return etapa('atribuicao', 3, {
            badge: 'Etapa 3 de 7',
            titulo: 'Aprovado — Vinculação de Chassi no CD',
            ator: 'Equipe de Pátio (CD)',
            tom: 'info',
            descricao: 'O pedido foi aprovado comercialmente. O CD está atribuindo os números de chassi das motos reservadas.',
            proximo: 'O CD vincula os chassis físicos para encaminhar à separação.',
        });
    }

    if (status === 'separado') {
        return etapa('separado', 4, {
            badge: 'Etapa 4 de 7',
            titulo: 'Motos Separadas na Baia de Expedição do CD',
            ator: 'Expedição CD & Logística',
            tom: 'info',
            descricao: 'As motos foram inspecionadas e alocadas fisicamente na baia de expedição do CD, aguardando inclusão no romaneio de carga.',
            proximo: 'A equipe de logística agenda a rota no Calendário semanal e gera o romaneio de carga.',
        });
    }

    if (['rota_confirmada', 'expedido', 'aguardando_coleta', 'coletado', 'aguardando_rota'].includes(status)) {
        return etapa('rota_confirmada', 5, {
            badge: 'Etapa 5 de 7',
            titulo: 'Viagem Agendada no Calendário da Frota',
            ator: 'Logística & Expedição CD',
            tom: 'info',
            descricao: 'O romaneio de carga foi gerado e a viagem está confirmada no Calendário semanal da frota.',
            proximo: 'Carregamento do caminhão cegonha e liberação da viagem pela portaria do CD.',
        });
    }

    if (['em_transito', 'em_transito_cd'].includes(status)) {
        return etapa('em_transito', 6, {
            badge: 'Etapa 6 de 7',
            titulo: isEmbarqueParcial ? 'Carga em Trânsito Parcial' : 'Caminhão Cegonha em Trânsito Rodoviário',
            ator: 'Transporte / Motorista',
            tom: 'info',
            descricao: 'As motos estão embarcadas na cegonha e em deslocamento rodoviário a caminho da loja.',
            proximo: 'Descarregamento na filial, conferência dos chassis e upload do canhoto assinado.',
        });
    }

    if (status === 'concluido') {
        return etapa('concluido', 7, {
            badge: 'Etapa 7 de 7 (Concluído)',
            titulo: 'Entrega Realizada e Concluída',
            ator: 'Filial Destino',
            tom: 'success',
            descricao: 'Conferência física finalizada na loja, canhoto assinado arquivado no sistema e motos integradas ao estoque.',
            proximo: 'Unidades prontas no pátio da loja para venda e entrega ao cliente.',
        });
    }

    return etapa(null, 1, null);
}
