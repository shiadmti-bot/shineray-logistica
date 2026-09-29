import {
    AdjustmentsHorizontalIcon,
    ChatBubbleLeftRightIcon,
    CheckBadgeIcon,
    ClipboardDocumentCheckIcon,
    CubeIcon,
    DocumentTextIcon,
    FunnelIcon,
    HashtagIcon,
    MagnifyingGlassIcon,
    PaperAirplaneIcon,
    ScissorsIcon,
    ShoppingCartIcon,
    Squares2X2Icon,
    SwatchIcon,
    TagIcon,
    TruckIcon,
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
