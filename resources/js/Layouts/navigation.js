import {
    HomeIcon,
    ArchiveBoxIcon,
    PlusCircleIcon,
    CubeIcon,
    TruckIcon,
    ClipboardDocumentCheckIcon,
    FolderIcon,
    UsersIcon,
    PresentationChartLineIcon,
    QuestionMarkCircleIcon,
    ClipboardDocumentListIcon,
    ArrowsRightLeftIcon,
    CalendarIcon,
    WrenchScrewdriverIcon,
    ExclamationTriangleIcon,
    ArrowUturnLeftIcon,
    BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';

/**
 * ESTRUTURA GLOBAL DE NAVEGAÇÃO
 *
 * Itens separados estritamente por contexto:
 * - Motos: operações, estoque, pedidos e aprovação de motos.
 * - Peças: catálogo, pedidos de peças, validação técnica (Gate 1) e basquetas.
 * - Logística: expedição e cargas.
 * - Gestão: relatórios, auditoria e usuários.
 */
export const NAV_SECTIONS = [
    {
        id: 'geral',
        label: null,
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
                label: 'Estoque de Motos',
                icon: CubeIcon,
                route: 'motos.index',
                match: 'motos.*',
            },
            {
                key: 'motos-pedidos',
                label: 'Pedidos de Motos',
                icon: ArchiveBoxIcon,
                route: 'pedidos.index',
                params: { tipo: 'moto' },
                match: 'pedidos.*',
                badge: 'pedidosPendentes',
            },
            {
                key: 'motos-devolucoes',
                label: 'Devoluções',
                icon: ArrowUturnLeftIcon,
                route: 'devolucoes.index',
                match: 'devolucoes.*',
                badge: 'devolucoesPendentes',
            },
            {
                // Validação e corte comercial exclusivo de motos
                key: 'motos-aprovacoes',
                label: 'Aprovações de Motos',
                icon: ClipboardDocumentCheckIcon,
                route: 'gestor.index',
                match: 'gestor.*',
                requireValidaMotos: true,
                badge: 'aprovacoesPendentes',
            },
        ],
    },

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
                key: 'pecas-pedidos',
                label: 'Pedidos de Peças',
                icon: ArchiveBoxIcon,
                route: 'pedidos.index',
                params: { tipo: 'peca' },
                match: 'pedidos.*',
            },
            {
                // Gate 1: Identificação técnica e liberação pelo Pós-Venda
                key: 'pecas-atendimento',
                label: 'Validação & Atendimento',
                icon: ClipboardDocumentCheckIcon,
                route: 'pecas.atendimento',
                match: 'pecas.atendimento*',
                requireValidaPecas: true,
            },
            {
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
                key: 'usuarios',
                label: 'Usuários',
                icon: UsersIcon,
                route: 'users.index',
                match: 'users.*',
                perfis: ['admin'],
            },
            {
                key: 'filiais',
                label: 'Filiais',
                icon: BuildingStorefrontIcon,
                route: 'filiais.index',
                match: 'filiais.*',
                perfis: ['admin', 'gestor'],
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
 * Seções visíveis para um perfil/usuário, com respeito estrito a validações independentes.
 */
export function navegacaoPara(userOrPerfil) {
    const perfil = typeof userOrPerfil === 'string' ? userOrPerfil : (userOrPerfil?.perfil || 'loja');
    const validaPecas = typeof userOrPerfil === 'object'
        ? Boolean(userOrPerfil?.valida_pecas)
        : (perfil === 'admin' || perfil === 'cd');
    const validaMotos = typeof userOrPerfil === 'object'
        ? Boolean(userOrPerfil?.valida_motos)
        : (perfil === 'admin');
    const isAdmin = perfil === 'admin';

    return NAV_SECTIONS
        .map((secao) => ({
            ...secao,
            items: secao.items.filter((item) => {
                if (item.pronto === false) return false;

                // Restrição por perfil genérico
                if (item.perfis && !item.perfis.includes(perfil)) {
                    return false;
                }

                // Restrição específica: Validador de Motos (Gestor Comercial / Diretoria)
                if (item.requireValidaMotos && !validaMotos && !isAdmin) {
                    return false;
                }

                // Restrição específica: Validador de Peças (Pós-Venda - Gate 1) ou Operação CD
                if (item.requireValidaPecas && !validaPecas && perfil !== 'cd' && !isAdmin) {
                    return false;
                }

                return true;
            }),
        }))
        .filter((secao) => secao.items.length > 0);
}
