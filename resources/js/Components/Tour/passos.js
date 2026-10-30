import {
    AdjustmentsHorizontalIcon,
    ArrowPathIcon,
    BellAlertIcon,
    BoltIcon,
    ChartBarIcon,
    ChatBubbleLeftRightIcon,
    CheckBadgeIcon,
    ClipboardDocumentCheckIcon,
    CubeIcon,
    DocumentTextIcon,
    FunnelIcon,
    HashtagIcon,
    HomeIcon,
    MagnifyingGlassIcon,
    PaperAirplaneIcon,
    PrinterIcon,
    QrCodeIcon,
    ScissorsIcon,
    ShoppingCartIcon,
    Squares2X2Icon,
    SwatchIcon,
    TagIcon,
    TruckIcon,
    WrenchScrewdriverIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';

/**
 * O CONTEÚDO dos tours por módulo — o que cada botão faz, na tela em que ele está.
 *
 * POR QUE ISTO EXISTE SEPARADO DO MOTOR. Até a v3.7 havia um único
 * `GuidedTour.jsx` de 710 linhas com os passos escritos dentro do componente, e
 * TODOS os 29 passos apontavam para a barra de navegação (`data-tour="pedidos"`,
 * `data-tour="pecas"`…). O tour ensinava onde ficam os menus. Nenhum passo
 * explicava um botão de dentro de um módulo — que é onde a operação de fato
 * erra: qual o motivo certo, por que o chassi apareceu, o que "Rejeitar" faz
 * com o estoque.
 *
 * COMO UM PASSO SE LIGA À TELA. `alvo` é um seletor CSS, e a convenção é
 * `[data-tour="modulo.elemento"]` posto no próprio botão. Um seletor que não
 * casa com nada NÃO é erro de execução: o motor mostra o cartão centralizado.
 * Mas é erro de manutenção, e `TourAncorasTest` falha quando um `alvo` daqui
 * não existe em nenhum arquivo do front — um tour apontando para um botão
 * removido é pior do que nenhum tour.
 *
 * `exigeAlvo: true` marca o passo que só faz sentido com o botão na tela (uma
 * ação que depende de perfil ou de estágio do pedido). O motor PULA esses
 * passos quando o alvo não está presente, e renumera — explicar um botão que a
 * pessoa não tem é pior do que ficar calado.
 *
 * `perfis` limita quem vê o passo. Vazio ou ausente = todos.
 */

/** Onde cada tour vive, para o botão "?" saber qual abrir. */
export const TOURS = {
    'pedidos.lista': {
        titulo: 'Lista de pedidos',
        descricao: 'Como ler a lista, filtrar e entender cada selo.',
        passos: [
            {
                alvo: '[data-tour="pedidos.abas-tipo"]',
                icone: Squares2X2Icon,
                titulo: 'Motos ou peças',
                descricao:
                    'A lista mistura os dois fluxos. Estas abas separam: moto segue por chassi e romaneio; peça segue por basqueta e liberação do Pós-Venda.',
                dica: 'O número em cada aba é a contagem real do seu perfil — a loja conta só os pedidos dela.',
            },
            {
                alvo: '[data-tour="pedidos.busca"]',
                icone: MagnifyingGlassIcon,
                titulo: 'Busca',
                descricao:
                    'Procura em quatro campos ao mesmo tempo: número do pedido, status, chassi e nome da filial (de origem ou de destino).',
                dica: 'Colar um chassi inteiro aqui é o jeito mais rápido de descobrir em que pedido a moto está.',
            },
            {
                alvo: '[data-tour="pedidos.filtro-status"]',
                icone: FunnelIcon,
                titulo: 'Filtro de status',
                descricao:
                    'Filtra por etapa do fluxo. "Cancelado" e "Rejeitado" também trazem resultado: o pedido recusado é arquivado, não apagado.',
                atencao:
                    'Até a v3.6 estes dois filtros devolviam lista vazia sempre — o pedido recusado ficava invisível no sistema.',
            },
            {
                alvo: '[data-tour="pedidos.filtro-datas"]',
                icone: AdjustmentsHorizontalIcon,
                titulo: 'Período',
                descricao:
                    'Recorta pela data de CRIAÇÃO do pedido, não pela data de entrega. Para fechar um mês de expedição, use o módulo de Expedição.',
            },
            {
                alvo: '[data-tour="pedidos.novo"]',
                icone: ShoppingCartIcon,
                titulo: 'Nova solicitação',
                descricao:
                    'Abre o formulário de pedido. Só loja e administrador criam pedido: é a filial que sabe o que falta na vitrine dela.',
                perfis: ['loja', 'admin'],
                exigeAlvo: true,
            },
            {
                alvo: '[data-tour="pedidos.linha-status"]',
                icone: TagIcon,
                titulo: 'Selo e barra de progresso',
                descricao:
                    'O selo é a etapa atual; a barra mostra o quanto falta até a conclusão. Em pedido recusado, aparece abaixo o motivo que o responsável escreveu.',
                exigeAlvo: true,
                dica: 'Pedido ativo vem sempre no topo; concluído e recusado descem para o fim.',
            },
        ],
    },

    'pedidos.criacao': {
        titulo: 'Criar pedido',
        descricao: 'Campo por campo, e o que cada escolha muda no fluxo.',
        passos: [
            {
                alvo: '[data-tour="criar.modo"]',
                icone: TruckIcon,
                titulo: 'De onde vem a moto',
                descricao:
                    'Esta é a escolha que muda todo o resto do formulário.',
                oQueFaz: [
                    { nome: 'Pedido ao CD', desc: 'reposição. Você pede modelo, cor e quantidade; o CD escolhe os chassis.' },
                    { nome: 'Transferência', desc: 'a moto já existe no pátio de outra loja, e por isso o chassi é obrigatório.' },
                ],
            },
            {
                alvo: '[data-tour="criar.modelo"]',
                icone: MagnifyingGlassIcon,
                titulo: 'Modelo — digite para buscar',
                descricao:
                    'A lista é o catálogo COMPLETO, com o nome exato do Microwork ("XY150-8 - MOTO JEF S"). Digite um pedaço do nome de rua — "jef", "shi", "jet" — e o filtro acha a variante.',
                oQueFaz: [
                    { nome: 'Selo verde', desc: 'quantas unidades o CD tem agora.' },
                    { nome: 'Selo cinza "sem estoque"', desc: 'o modelo existe e pode ser pedido; o CD é que não tem unidade neste momento.' },
                ],
                atencao:
                    'Antes da v3.7 a lista vinha dos chassis em pátio: modelo esgotado não aparecia, justamente o que mais precisa de reposição.',
            },
            {
                alvo: '[data-tour="criar.cor"]',
                icone: SwatchIcon,
                titulo: 'Cor',
                descricao:
                    'As cores são as que o Microwork já registrou PARA AQUELE MODELO, com o saldo de cada uma entre parênteses. Trocar o modelo limpa a cor, porque a cor anterior pode não existir na nova linha.',
                atencao:
                    'Antes havia sete cores fixas no código. Dava para pedir uma variante que não existe, e o pedido nascia com um nome que não casava com o cadastro.',
            },
            {
                alvo: '[data-tour="criar.motivo"]',
                icone: DocumentTextIcon,
                titulo: 'Motivo — define se pede chassi',
                descricao:
                    'Não é só etiqueta: o motivo decide a forma do pedido. "Venda Confirmada (Cliente)" faz aparecer o campo de chassi, porque aí existe um cliente esperando uma moto específica.',
                dica: 'Para repor vitrine, use "Estoque Regular (Giro)" e deixe o CD escolher o chassi — sai mais rápido.',
            },
            {
                alvo: '[data-tour="criar.quantidade"]',
                icone: HashtagIcon,
                titulo: 'Quantidade ou chassi',
                descricao:
                    'O mesmo espaço muda de campo conforme o motivo: quantidade no pedido genérico, chassi quando a moto é específica. Abaixo da quantidade aparece quanto o CD tem, e um aviso se você pedir mais do que existe.',
                dica: 'Pedir mais do que o saldo é permitido: o CD atende o que tem e encerra o restante com justificativa.',
            },
            {
                alvo: '[data-tour="criar.destino"]',
                icone: CubeIcon,
                titulo: 'Destino da unidade',
                descricao:
                    'Para onde cada linha vai. Vem preenchido com a sua filial e só muda se a moto for para outro ponto — inclusive PDVs que não têm login no sistema.',
            },
            {
                alvo: '[data-tour="criar.adicionar"]',
                icone: Squares2X2Icon,
                titulo: 'Mais de um item no mesmo pedido',
                descricao:
                    'Cada linha é uma cota independente: modelo, cor, motivo e destino próprios. Um pedido com cinco linhas viaja como uma carga só.',
                exigeAlvo: true,
            },
            {
                alvo: '[data-tour="criar.enviar"]',
                icone: PaperAirplaneIcon,
                titulo: 'Enviar para aprovação',
                descricao:
                    'O pedido nasce em "Em Análise" e vai para a Gestão Comercial. Nada sai do estoque até a aprovação, e você é avisado no sininho quando ela acontecer — ou quando for recusado, com o motivo.',
            },
        ],
    },

    'gestor.analise': {
        titulo: 'Análise comercial',
        descricao: 'O que cada botão desta tela faz com o estoque.',
        perfis: ['gestor', 'admin'],
        passos: [
            {
                alvo: '[data-tour="gestor.itens"]',
                icone: ClipboardDocumentCheckIcon,
                titulo: 'Item por item',
                descricao:
                    'Cada linha é aprovada ou cortada em separado. Desmarcar uma linha corta APENAS ela — o resto do pedido segue para separação.',
                exigeAlvo: true,
            },
            {
                alvo: '[data-tour="gestor.motivo-item"]',
                icone: ScissorsIcon,
                titulo: 'Motivo do corte',
                descricao:
                    'Obrigatório por item cortado. Vai para o histórico do pedido e para a tela da loja — é o que evita a filial pedir a mesma coisa de novo na semana seguinte.',
                exigeAlvo: true,
            },
            {
                alvo: '[data-tour="gestor.justificativa"]',
                icone: DocumentTextIcon,
                titulo: 'Observação geral',
                descricao:
                    'Um recado sobre a decisão inteira, separado do motivo de cada item. Aparece na auditoria comercial junto com os cortes.',
                exigeAlvo: true,
            },
            {
                alvo: '[data-tour="gestor.aprovar"]',
                icone: CheckBadgeIcon,
                titulo: 'Autorizar',
                descricao:
                    'Aprova o que ficou marcado e corta o que foi desmarcado, numa única operação. O pedido vai para "Solicitado" e o CD passa a enxergá-lo na mesa de separação.',
                atencao:
                    'Se todos os itens forem cortados, o pedido é cancelado por inteiro — o sistema avisa e não deixa um pedido vazio seguir no fluxo.',
            },
            {
                alvo: '[data-tour="gestor.rejeitar"]',
                icone: XCircleIcon,
                titulo: 'Rejeitar o pedido completo',
                descricao:
                    'Recusa tudo de uma vez. As motos com chassi voltam ao estoque de onde saíram e o pedido é arquivado com o seu nome e a data.',
                atencao:
                    'A justificativa é obrigatória, e agora também no servidor: sem ela a recusa não é aceita. É esse texto que a loja lê no lugar do pedido.',
            },
            {
                alvo: '[data-tour="gestor.chat"]',
                icone: ChatBubbleLeftRightIcon,
                titulo: 'Falar com a filial antes de decidir',
                descricao:
                    'Conversa ligada a este pedido. Serve para resolver a dúvida sem cortar — cortar e a loja pedir de novo custa um ciclo inteiro de análise.',
                exigeAlvo: true,
            },
        ],
    },

    'dashboard.geral': {
        titulo: 'Painel de controle',
        descricao: 'Visão geral da sua operação, alertas prioritários e atalhos rápidos.',
        passos: [
            {
                alvo: '[data-tour="dashboard.boas-vindas"]',
                icone: HomeIcon,
                titulo: 'Identificação e status',
                descricao:
                    'Mostra sua saudação, filial ativa e perfil de acesso. Para CD e Admin, exibe também o pulso de atualização automática em tempo real.',
            },
            {
                alvo: '[data-tour="dashboard.avisos"]',
                icone: BellAlertIcon,
                titulo: 'Quadro de avisos e alertas',
                descricao:
                    'Comunicados internos da matriz, alertas de pedidos aguardando separação física ou avisos de recusas recentes com justificativa.',
                exigeAlvo: true,
            },
            {
                alvo: '[data-tour="dashboard.kpis"]',
                icone: ChartBarIcon,
                titulo: 'Indicadores operacionais (KPIs)',
                descricao:
                    'Cartões com contagens consolidadas: pedidos em andamento, cargas na rua e estoque físico no CD sincronizado direto do Microwork.',
                dica: 'Clique em qualquer cartão com seta para navegar direto para a lista filtrada correspondente.',
            },
            {
                alvo: '[data-tour="dashboard.acoes-rapidas"]',
                icone: BoltIcon,
                titulo: 'Atalhos e mesa de operação',
                descricao:
                    'Acesso direto aos fluxos mais frequentes do seu dia a dia: nova solicitação de motos, reposição de peças, separação de pedidos ou montagem de cargas.',
            },
        ],
    },

    'motos.estoque': {
        titulo: 'Estoque de motos',
        descricao: 'Consulta de motos, histórico do sistema e pátio do CD em tempo real.',
        passos: [
            {
                alvo: '[data-tour="motos.censo"]',
                icone: QrCodeIcon,
                titulo: 'Censo e inventário de pátio',
                descricao:
                    'Auditoria física rápida com bipagem contínua de chassis via leitor USB, Bluetooth ou smartphone. Identifica unidades presentes, pendentes e intrusas.',
            },
            {
                alvo: '[data-tour="motos.abas"]',
                icone: Squares2X2Icon,
                titulo: 'Origem dos dados',
                descricao:
                    'Alterna entre o histórico registrado no BySabel (movimentações e pedidos) e o estoque físico real no CD (sincronizado do Microwork).',
                dica: 'A loja consulta diretamente a aba do CD para checar disponibilidade antes de pedir.',
            },
            {
                alvo: '[data-tour="motos.busca"]',
                icone: MagnifyingGlassIcon,
                titulo: 'Filtros e pesquisa',
                descricao:
                    'Localize motos por chassi, modelo, loja alocada ou status da unidade no fluxo logístico.',
            },
            {
                alvo: '[data-tour="motos.tabela"]',
                icone: CubeIcon,
                titulo: 'Listagem e linha do tempo',
                descricao:
                    'Exibe o chassi, cor, localização atual e status. O ícone de relógio abre a linha do tempo completa do chassi desde a fabricação até a entrega.',
            },
        ],
    },

    'motos.censo': {
        titulo: 'Censo e inventário de pátio',
        descricao: 'Bipagem contínua para conferência de estoque físico com zero latência.',
        passos: [
            {
                alvo: '[data-tour="censo.bipagem"]',
                icone: QrCodeIcon,
                titulo: 'Bipagem contínua de chassis',
                descricao:
                    'Aponte o leitor de código de barras ou digite o chassi e pressione Enter. O campo mantém o foco ativo para leituras consecutivas e emite sons distintos de aprovação ou divergência.',
            },
            {
                alvo: '[data-tour="censo.kpis"]',
                icone: ChartBarIcon,
                titulo: 'Progresso da auditoria',
                descricao:
                    'Monitore em tempo real o percentual de conformidade física e as contagens de motos confirmadas, faltantes e intrusas.',
            },
            {
                alvo: '[data-tour="censo.abas"]',
                icone: Squares2X2Icon,
                titulo: 'Listas e divergências',
                descricao:
                    'Navegue entre as motos confirmadas no pátio, as que ainda não foram localizadas e eventuais motos intrusas que pertencem a outra loja.',
            },
            {
                alvo: '[data-tour="censo.acoes"]',
                icone: PrinterIcon,
                titulo: 'Relatório e finalização',
                descricao:
                    'Imprima o relatório resumido de conferência para assinatura da gestão ou reinicie a contagem quando necessário.',
            },
        ],
    },

    'pecas.estoque': {
        titulo: 'Estoque de peças',
        descricao: 'Saldo por SKU, controle de reservas e compatibilidade por modelo.',
        passos: [
            {
                alvo: '[data-tour="pecas.kpis"]',
                icone: ChartBarIcon,
                titulo: 'Resumo do catálogo',
                descricao:
                    'Total de itens cadastrados, SKUs com saldo positivo, peças prometidas a pedidos abertos e itens abaixo do estoque mínimo de segurança.',
            },
            {
                alvo: '[data-tour="pecas.filtro-modelo"]',
                icone: FunnelIcon,
                titulo: 'Compatibilidade por modelo',
                descricao:
                    'O jeito mais inteligente de encontrar peças: escolha a moto do cliente para ver apenas os itens compatíveis (ou universais).',
                dica: 'Peças universais são marcadas com selo azul e atendem qualquer modelo.',
            },
            {
                alvo: '[data-tour="pecas.busca"]',
                icone: MagnifyingGlassIcon,
                titulo: 'Busca rápida',
                descricao:
                    'Pesquise por código interno da peça, código de barras original ou palavras da descrição comercial.',
            },
            {
                alvo: '[data-tour="pecas.tabela"]',
                icone: WrenchScrewdriverIcon,
                titulo: 'Saldo disponível vs físico',
                descricao:
                    'Diferença crucial: "Disponível" é o saldo livre para pedidos. "Onde tem" reflete a localização física no Microwork para orientar a separação.',
            },
        ],
    },

    'pecas.solicitar': {
        titulo: 'Solicitação de peças',
        descricao: 'Como pedir reposição de peças para sua filial.',
        passos: [
            {
                alvo: '[data-tour="pecas-solicitar.modelo"]',
                icone: FunnelIcon,
                titulo: 'Filtre pela moto',
                descricao:
                    'Selecione o modelo da moto para carregar as peças compatíveis. Você também pode digitar palavras na busca textual ao lado.',
            },
            {
                alvo: '[data-tour="pecas-solicitar.recorrentes"]',
                icone: ArrowPathIcon,
                titulo: '🔁 Pedir Novamente / Reposição Rápida',
                descricao:
                    'Reúne os itens mais solicitados pela sua concessionária nos últimos 90 dias. Adicione peças de alto giro com 1 clique ou adicione a lista completa em lote.',
                exigeAlvo: true,
            },
            {
                alvo: '[data-tour="pecas-solicitar.kits"]',
                icone: BoltIcon,
                titulo: '⚡ Kits Rápidos de Revisão',
                descricao:
                    'Ao selecionar o modelo, pacotes de revisão de alta frequência (Básica, Relação, Freios e Periódica) aparecem prontos para adicionar todos os itens ao pedido com 1 clique.',
            },
            {
                alvo: '[data-tour="pecas-solicitar.sem-codigo"]',
                icone: DocumentTextIcon,
                titulo: 'Não achou o código?',
                descricao:
                    'Se a peça não estiver cadastrada, digite a descrição do defeito ou da peça aqui. O Estoque Central identifica o código correto antes de faturar.',
            },
            {
                alvo: '[data-tour="pecas-solicitar.carrinho"]',
                icone: ShoppingCartIcon,
                titulo: 'Conferência do pedido',
                descricao:
                    'Revise os itens adicionados, ajuste as quantidades necessárias e envie para análise do CD com apenas um clique.',
            },
        ],
    },

    'romaneios.lista': {
        titulo: 'Histórico de cargas',
        descricao: 'Acompanhamento de romaneios, rotas e status das entregas.',
        passos: [
            {
                alvo: '[data-tour="romaneios.novo"]',
                icone: TruckIcon,
                titulo: 'Nova expedição',
                descricao:
                    'Inicia a montagem de uma nova carga mista ou coleta Milk Run para despacho.',
                perfis: ['cd', 'admin'],
                exigeAlvo: true,
            },
            {
                alvo: '[data-tour="romaneios.busca"]',
                icone: MagnifyingGlassIcon,
                titulo: 'Busca e filtros de período',
                descricao:
                    'Filtre cargas por placa do caminhão, nome do motorista, rota ou data de saída.',
            },
            {
                alvo: '[data-tour="romaneios.tabela"]',
                icone: ClipboardDocumentCheckIcon,
                titulo: 'Detalhamento do romaneio',
                descricao:
                    'Consulte o volume transportado (motos e basquetas de peças), motorista responsável e barra de progresso do trânsito até a confirmação de recebimento.',
            },
        ],
    },

    'romaneios.expedicao': {
        titulo: 'Montagem de carga',
        descricao: 'Expedição unificada de motos, basquetas e coletas Milk Run.',
        perfis: ['cd', 'admin'],
        passos: [
            {
                alvo: '[data-tour="expedicao.kpis"]',
                icone: ChartBarIcon,
                titulo: 'Fila de itens prontos',
                descricao:
                    'Painel de motos aguardando saída, basquetas de peças faturadas prontas para viagem e coletas programadas nas lojas.',
            },
            {
                alvo: '[data-tour="expedicao.viagem"]',
                icone: TruckIcon,
                titulo: 'Configuração da viagem',
                descricao:
                    'Informe motorista, placa e rota. Você também pode anexar itens a uma carga que já está em aberto.',
            },
            {
                alvo: '[data-tour="expedicao.abas"]',
                icone: Squares2X2Icon,
                titulo: 'Abas operacionais',
                descricao:
                    'Selecione motos prontas no CD, inclua basquetas de peças embaladas, adicione coletas Milk Run ou bipe chassis com leitor de código de barras.',
            },
            {
                alvo: '[data-tour="expedicao.resumo"]',
                icone: ClipboardDocumentCheckIcon,
                titulo: 'Barra de resumo e finalização',
                descricao:
                    'Acompanhe o total de paradas, volume ocupado e clique em "Gerar Carga" para emitir o romaneio e iniciar o trânsito.',
            },
        ],
    },
};

/**
 * O tour de um módulo, filtrado pelo perfil de quem está olhando.
 *
 * Devolve null quando o módulo não tem tour ou quando o perfil não tem nenhum
 * passo nele — é o que faz o botão "?" simplesmente não aparecer, em vez de
 * abrir um tour vazio.
 */
export function tourDoModulo(chave, perfil) {
    const tour = TOURS[chave];

    if (!tour) return null;

    if (tour.perfis?.length && !tour.perfis.includes(perfil)) return null;

    const passos = tour.passos.filter(
        (passo) => !passo.perfis?.length || passo.perfis.includes(perfil),
    );

    return passos.length > 0 ? { ...tour, passos } : null;
}
