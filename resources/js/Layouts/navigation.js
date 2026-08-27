import {
    HomeIcon,
    CalendarIcon,
    PlusCircleIcon,
    ArchiveBoxIcon,
    TruckIcon,
    ClipboardDocumentListIcon,
    FolderIcon,
    CubeIcon,
    UsersIcon,
    QuestionMarkCircleIcon,
    PresentationChartLineIcon,
    WrenchScrewdriverIcon,
    ArrowsRightLeftIcon,
    ClipboardDocumentCheckIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

/**
 * NAVEGAÇÃO DO SISTEMA (v3)
 *
 * Antes o menu era JSX condicional dentro do layout: cada perfil tinha seu bloco
 * de <CustomNavLink>, com itens repetidos entre perfis. Com Peças entrando, o
 * menu horizontal passaria de ~8 para ~14 itens e o JSX ficaria impossível de
 * manter.
 *
 * Aqui a navegação é DADO, agrupado em seções. O layout só renderiza.
 * Adicionar uma tela = uma linha nesta lista.
 *
 * Cada item:
 *   route   -> nome da rota Laravel (resolvido com segurança pelo layout)
 *   match   -> padrão para marcar o item como ativo (default: a própria rota)
 *   perfis  -> quem enxerga. Omitir = todos.
 *   badge   -> chave em page.props.navCounts para o contador (ex.: pendências)
 *   pronto  -> false = tela ainda não construída; some do menu automaticamente
 */
export const NAV_SECTIONS = [
    {
        id: 'geral',
        label: null, // sem cabeçalho: itens de topo
        items: [
            { key: 'dashboard', label: 'Início', icon: HomeIcon, route: 'dashboard' },
            { key: 'calendario', label: 'Calendário', icon: CalendarIcon, route: 'calendar.index', match: 'calendar.*' },
        ],
    },

    {
        id: 'motos',
        label: 'Motos',
        items: [
            {
                key: 'motos-solicitar',
                label: 'Nova Solicitação',
                icon: PlusCircleIcon,
                route: 'solicitar',
                perfis: ['loja'],
            },
            {
                key: 'motos-estoque',
                label: 'Estoque',
                icon: CubeIcon,
                route: 'motos.index',
                match: 'motos.*',
            },
            {
                key: 'motos-pedidos',
                label: 'Pedidos',
                icon: ArchiveBoxIcon,
                route: 'pedidos.index',
                match: 'pedidos.*',
                badge: 'pedidosPendentes',
            },
        ],
    },

    /*
     * PEÇAS — a fundação de dados existe (pecas, peca_estoques, peca_movimentos,
     * EstoquePecaService). As telas ainda não. `pronto: false` mantém os itens
     * fora do menu até cada tela ser construída; basta virar para true.
     */
    {
        id: 'pecas',
        label: 'Peças',
        items: [
            {
                key: 'pecas-solicitar',
                label: 'Solicitar Peças',
                icon: PlusCircleIcon,
                route: 'pecas.solicitar',
                perfis: ['loja', 'admin'],
            },
            {
                // Passos 2 e 3 do manual do Call Center: identificar o código
                // e liberar. Sem passar por aqui, nada é separado.
                key: 'pecas-atendimento',
                label: 'Atendimento',
                icon: ClipboardDocumentCheckIcon,
                route: 'pecas.atendimento',
                match: 'pecas.atendimento*',
                perfis: ['admin', 'cd'],
            },
            {
                // Passo 4: o caixote de cada filial, enchendo até o dia da carga.
                key: 'pecas-basquetas',
                label: 'Basquetas',
                icon: ArchiveBoxIcon,
                route: 'pecas.basquetas',
                match: 'pecas.basquetas*',
                perfis: ['admin', 'cd', 'gestor'],
            },
            {
                key: 'pecas-estoque',
                label: 'Estoque de Peças',
                icon: WrenchScrewdriverIcon,
                route: 'pecas.index',
                match: 'pecas.*',
            },
            {
                key: 'pecas-entrada',
                label: 'Entrada / Inventário',
                icon: ArrowsRightLeftIcon,
                route: 'pecas.estoque.index',
                match: 'pecas.estoque.*',
                perfis: ['admin', 'cd', 'loja'],
            },
            {
                // Fase 5: mede onde o fluxo trava e o que o Gate 2 pegou.
                key: 'pecas-indicadores',
                icon: PresentationChartLineIcon,
                label: 'Indicadores',
                route: 'pecas.indicadores',
                match: 'pecas.indicadores*',
                perfis: ['admin', 'gestor', 'cd'],
            },
            {
                key: 'pecas-pendencias',
                label: 'Pendências',
                icon: ExclamationTriangleIcon,
                route: 'pecas.pendencias.index',
                match: 'pecas.pendencias.*',
                badge: 'pecasPendencias',
            },
        ],
    },

    {
        id: 'logistica',
        label: 'Logística',
        items: [
            {
                key: 'expedicao',
                label: 'Expedição',
                icon: TruckIcon,
                route: 'romaneios.create',
                perfis: ['cd', 'admin'],
            },
            {
                key: 'conferencia',
                label: 'Conferência',
                icon: ClipboardDocumentListIcon,
                route: 'pedidos.index',
                perfis: ['cd'],
            },
            {
                key: 'cargas',
                label: 'Cargas',
                icon: FolderIcon,
                route: 'romaneios.index',
                match: 'romaneios.*',
                perfis: ['cd', 'admin', 'gestor'],
            },
        ],
    },

    {
        id: 'gestao',
        label: 'Gestão',
        items: [
            {
                key: 'bi',
                label: 'BI Logística',
                icon: PresentationChartLineIcon,
                route: 'bi.index',
                match: 'bi.*',
                perfis: ['admin', 'gestor'],
            },
            {
                key: 'aprovacoes',
                label: 'Aprovações',
                icon: ClipboardDocumentCheckIcon,
                route: 'gestor.index',
                match: 'gestor.*',
                perfis: ['gestor', 'admin'],
                badge: 'aprovacoesPendentes',
            },
            {
                key: 'usuarios',
                label: 'Usuários',
                icon: UsersIcon,
                route: 'users.index',
                match: 'users.*',
                perfis: ['admin'],
            },
        ],
    },

    {
        id: 'suporte',
        label: null,
        items: [
            { key: 'manual', label: 'Ajuda', icon: QuestionMarkCircleIcon, route: 'manual' },
        ],
    },
];

/**
 * Seções visíveis para um perfil, já sem itens não prontos nem seções vazias.
 */
export function navegacaoPara(perfil) {
    return NAV_SECTIONS
        .map((secao) => ({
            ...secao,
            items: secao.items.filter(
                (item) =>
                    item.pronto !== false &&
                    (!item.perfis || item.perfis.includes(perfil))
            ),
        }))
        .filter((secao) => secao.items.length > 0);
}
