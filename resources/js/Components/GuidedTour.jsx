import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    SparklesIcon,
    ArrowRightIcon,
    ArrowLeftIcon,
    XMarkIcon,
    CheckCircleIcon,
    QuestionMarkCircleIcon,
    HomeIcon,
    CalendarIcon,
    CubeIcon,
    WrenchScrewdriverIcon,
    TruckIcon,
    ClipboardDocumentCheckIcon,
    UsersIcon,
    BellAlertIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const TOUR_STORAGE_KEY = 'shineray_tour_v3_completed_user_';

function getElementoVisivel(selector) {
    if (!selector) return null;
    const elementos = document.querySelectorAll(selector);
    for (const el of elementos) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            return el;
        }
    }
    return null;
}

export default function GuidedTour({ user }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isWelcome, setIsWelcome] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const perfil = user?.perfil || 'loja';

    const steps = useMemo(() => {
        const passosLoja = [
            {
                id: 'dashboard',
                targetSelector: '[data-tour="dashboard"]',
                badge: 'Aba Geral',
                icon: HomeIcon,
                title: 'Aba Início (Dashboard da Filial)',
                description: 'Visão panorâmica da sua filial: acompanhe solicitações ativas, previsão de caminhões na sua cidade e alertas operacionais.',
                subItems: [
                    { name: 'Cards de Resumo', desc: 'Totais de pedidos em análise, aprovados, em separação e em trânsito.' },
                    { name: 'Avisos da Loja & Mural', desc: 'Comunicados oficiais da matriz e alertas de motos solicitadas do seu pátio.' },
                    { name: 'Atalhos Rápidos', desc: 'Acesso direto para nova solicitação de motos, catálogo de peças e consultas.' }
                ],
                tip: 'Acesse diariamente para verificar se há caminhões previstos para descarregar na sua filial!',
            },
            {
                id: 'calendario',
                targetSelector: '[data-tour="calendario"]',
                badge: 'Aba Geral',
                icon: CalendarIcon,
                title: 'Aba Calendário de Rotas',
                description: 'Programação semanal de saídas do CD e previsão de entregas na sua filial para planejamento de equipe e pátio.',
                subItems: [
                    { name: 'Eventos Amarelos', desc: 'Viagens em planejamento prévio pela logística.' },
                    { name: 'Eventos Verdes', desc: 'Viagens confirmadas com rota, placa e motorista escalado.' }
                ],
                tip: 'O calendário é atualizado em tempo real pelo CD conforme as rotas e saídas são autorizadas.',
            },
            {
                id: 'motos',
                targetSelector: '[data-tour="motos"]',
                badge: 'Menu Suspenso',
                icon: CubeIcon,
                title: 'Módulo de Motos',
                description: 'Gerenciamento completo do ciclo de vida das motos para sua filial:',
                subItems: [
                    { name: 'Nova Solicitação', desc: 'Reposição ao CD (somente Modelo, Cor e Qtd) ou Venda Confirmada com Chassi específico.' },
                    { name: 'Estoque de Motos', desc: 'Consulte a disponibilidade de motos físicas no estoque central e na sua loja.' },
                    { name: 'Meus Pedidos & Recebimento', desc: 'Acompanhe aprovação comercial e faça o Recebimento Rápido com foto do canhoto direto da câmera.' },
                    { name: 'Censo de Pátio', desc: 'Auditoria física rápida com bipagem contínua de chassis via leitor USB, Bluetooth ou celular.' }
                ],
                tip: 'Regra Oficial: Em pedidos de reposição ao CD, você NÃO precisa de chassi! Peça apenas Modelo, Cor e Quantidade.',
            },
            {
                id: 'pecas',
                targetSelector: '[data-tour="pecas"]',
                badge: 'Menu Suspenso',
                icon: WrenchScrewdriverIcon,
                title: 'Módulo de Peças & Acessórios',
                description: 'Catálogo integrado com mais de 2.380 SKUs e sincronização com o ERP Microwork:',
                subItems: [
                    { name: 'Solicitar Peças', desc: 'Busca rápida de itens com visualização de foto, código e modelos compatíveis.' },
                    { name: 'Kits de Revisão Periódica', desc: 'Adicione kits oficiais de revisão (1.000 km, 3.000 km, 6.000 km) com 1 clique no carrinho.' },
                    { name: 'Pedir Novamente (Recorrentes)', desc: 'Reencomende os itens mais pedidos da sua filial sem precisar pesquisar do zero.' },
                    { name: 'Onde Encontrar (Multiloja)', desc: 'Consulte saldos de peças em outras filiais parceiras para remanejamento rápido.' },
                    { name: 'Entrada / Inventário', desc: 'Registro de recebimento de peças e conferência local do estoque da oficina.' },
                    { name: 'Pendências', desc: 'Acompanhe a triagem e separação de peças solicitadas ao CD.' }
                ],
                tip: 'Use o botão "Onde Encontrar" antes de solicitar compras externas — você pode remanejar de uma loja vizinha!',
            },
            {
                id: 'notificacoes',
                targetSelector: '[data-tour="notificacoes"]',
                badge: 'Barra de Ações',
                icon: BellAlertIcon,
                title: 'Central de Notificações (Sininho & Push)',
                description: 'Alertas instantâneos via WebSocket e notificações Push no smartphone/PWA sempre que seus pedidos avançarem de status.',
                subItems: [
                    { name: 'Aprovações Comerciais', desc: 'Avisos de quando seu pedido foi autorizado ou se houve algum corte com motivo.' },
                    { name: 'Expedição & Portaria', desc: 'Notificação com dados do motorista e previsão de chegada na liberação da carga.' }
                ],
                tip: 'Ao receber motos na loja, o sininho avisará a liberação de portaria para você conferir os chassis.',
            },
            {
                id: 'manual',
                targetSelector: '[data-tour="manual"]',
                badge: 'Aba Geral',
                icon: QuestionMarkCircleIcon,
                title: 'Central de Ajuda & Manuais',
                description: 'Base de conhecimento completa: manuais de conferência, regras fiscais, prazos de garantia e procedimentos operacionais.',
                subItems: [
                    { name: 'Procedimento de Recebimento', desc: 'Passo a passo com foto do canhoto e conferência por exceção.' },
                    { name: 'FAQ & Dúvidas Frequentes', desc: 'Respostas para as principais regras comerciais e operacionais.' }
                ],
            },
            {
                id: 'perfil',
                targetSelector: '[data-tour="perfil"]',
                badge: 'Sua Conta',
                icon: ShieldCheckIcon,
                title: 'Perfil & Sessão',
                description: 'Altere sua senha de acesso corporativa e reinicie este tour guiado a qualquer momento pelo menu de perfil.',
            },
        ];

        const passosCD = [
            {
                id: 'dashboard',
                targetSelector: '[data-tour="dashboard"]',
                badge: 'Aba Geral',
                icon: HomeIcon,
                title: 'Aba Início (Painel da Operação CD)',
                description: 'Controle central da expedição: pedidos aprovados pela diretoria aguardando separação física, motos no pátio e romaneios em rota.',
                subItems: [
                    { name: 'Fila de Separação', desc: 'Pedidos liberados pelo gestor prontos para atendimento físico.' },
                    { name: 'Status do Pátio (ERP)', desc: 'Unidades montadas, desmontadas e prontas no pátio central.' },
                    { name: 'Tempo Real', desc: 'Painel com atualização automática e pulso de sincronização.' }
                ],
                tip: 'Dê prioridade aos pedidos com bandeira de urgência ou venda com cliente aguardando!',
            },
            {
                id: 'motos',
                targetSelector: '[data-tour="motos"]',
                badge: 'Menu Suspenso',
                icon: CubeIcon,
                title: 'Módulo de Motos & Separação',
                description: 'Gestão de estoque físico, separação e conferência de chassis:',
                subItems: [
                    { name: 'Estoque do CD', desc: 'Consulta de motos por modelo, cor, status de montagem e pátio.' },
                    { name: 'Censo de Pátio', desc: 'Auditoria rápida com leitor de código de barras, bipagem contínua e identificação de motos intrusas.' },
                    { name: 'Conferência de Pedidos', desc: 'Leitura e vinculação de chassis físicos às solicitações aprovadas.' }
                ],
                tip: 'O censo de pátio emite alerta sonoro diferenciado para chassis não cadastrados ou fora de lote!',
            },
            {
                id: 'logistica',
                targetSelector: '[data-tour="logistica"]',
                badge: 'Menu Suspenso',
                icon: TruckIcon,
                title: 'Módulo de Logística (Expedição & Cargas)',
                description: 'Mesa de expedição: agrupe pedidos, dimensione cargas e despache romaneios:',
                subItems: [
                    { name: 'Expedição / Montagem', desc: 'Criação de novos romaneios e agrupamento de motos e basquetas por filial.' },
                    { name: 'Termômetro de Ocupação', desc: 'Cálculo de cubagem mista (1 moto = 1 un; 2 basquetas = 0.5 moto eq.) com alerta de sobrecarga.' },
                    { name: 'Sequenciamento LIFO', desc: 'Estivagem inversa na doca: a última entrega fica no fundo do baú e a primeira na porta.' },
                    { name: 'Cargas & Manifesto', desc: 'Emissão de Manifesto em PDF, controle de portaria e timeline com WhatsApp do motorista.' }
                ],
                tip: 'Ao aprovar a saída de portaria, todos os pedidos entram automaticamente no status "Em Trânsito"!',
            },
            {
                id: 'pecas',
                targetSelector: '[data-tour="pecas"]',
                badge: 'Menu Suspenso',
                icon: WrenchScrewdriverIcon,
                title: 'Módulo de Peças & Almoxarifado',
                description: 'Triagem e expedição de peças solicitadas pela rede:',
                subItems: [
                    { name: 'Triagem de Peças', desc: 'Identificação no catálogo e-Part e triagem de pedidos técnicos do Pós-Venda.' },
                    { name: 'Basquetas de Carga', desc: 'Montagem de caixas plásticas com QR Code e inclusão nos romaneios.' },
                    { name: 'Estoque & Inventário', desc: 'Controle de saldos no almoxarifado central sincronizado com o ERP.' }
                ],
            },
            {
                id: 'calendario',
                targetSelector: '[data-tour="calendario"]',
                badge: 'Aba Geral',
                icon: CalendarIcon,
                title: 'Aba Calendário de Rotas',
                description: 'Cadastre e confirme viagens planejadas para que as lojas visualizem a previsão de chegada.',
                subItems: [
                    { name: 'Viagens Planejadas', desc: 'Rascunho de rotas para consolidação de frete e contratação de motoristas.' },
                    { name: 'Viagens Confirmadas', desc: 'Confirmação com rota e data fixada para notificação das filiais.' }
                ],
            },
            {
                id: 'perfil',
                targetSelector: '[data-tour="perfil"]',
                badge: 'Sua Conta',
                icon: ShieldCheckIcon,
                title: 'Perfil & Sessão',
                description: 'Ajustes da conta operacional e encerramento seguro de sessão.',
            },
        ];

        const passosGestor = [
            {
                id: 'dashboard',
                targetSelector: '[data-tour="dashboard"]',
                badge: 'Aba Geral',
                icon: HomeIcon,
                title: 'Aba Início (Painel Comercial & Faturamento)',
                description: 'Visão consolidada de pedidos pendentes de validação comercial, estoque geral e frotas.',
                subItems: [
                    { name: 'Fila Comercial', desc: 'Pedidos aguardando validação de cota e crédito.' },
                    { name: 'Indicadores Globais', desc: 'Contagem de romaneios em trânsito e pedidos por status.' },
                    { name: 'Avisos & Alertas', desc: 'Controle de recusas e comunicados para a rede.' }
                ],
            },
            {
                id: 'motos',
                targetSelector: '[data-tour="motos"]',
                badge: 'Menu Suspenso',
                icon: CubeIcon,
                title: 'Módulo de Motos & Aprovações',
                description: 'Validação e autorização comercial dos pedidos da rede:',
                subItems: [
                    { name: 'Aprovações de Motos', desc: 'Fila de autorização comercial com aprovação total, cortes parciais com justificativa e chat direto com a loja.' },
                    { name: 'Estoque da Rede', desc: 'Consulta de estoque no CD e saldos em todas as filiais.' },
                    { name: 'Pedidos de Motos', desc: 'Rastreabilidade de ponta a ponta e auditoria de canhotos entregues.' },
                    { name: 'Censo de Pátio', desc: 'Acompanhamento das atas de auditoria física realizadas pelas lojas.' }
                ],
                tip: 'As aprovações comerciais de motos ficam centralizadas neste menu!',
            },
            {
                id: 'pecas',
                targetSelector: '[data-tour="pecas"]',
                badge: 'Menu Suspenso',
                icon: WrenchScrewdriverIcon,
                title: 'Módulo de Peças & Estoques Multiloja',
                description: 'Validação técnica e consulta de peças em toda a rede:',
                subItems: [
                    { name: 'Aprovações de Peças (Gate 1)', desc: 'Validação técnica de pedidos pelo Pós-Venda antes da liberação ao almoxarifado.' },
                    { name: 'Estoque & Indicadores', desc: 'Consulta de saldos de peças em todas as filiais e métricas de atendimento.' },
                    { name: 'Kits de Revisão', desc: 'Monitoramento de giro dos kits periódicos e consumo por modelo de moto.' }
                ],
                tip: 'Remaneje peças entre filiais próximas antes de aprovar pedidos de compras externas.',
            },
            {
                id: 'logistica',
                targetSelector: '[data-tour="logistica"]',
                badge: 'Menu Suspenso',
                icon: TruckIcon,
                title: 'Módulo de Logística (Cargas)',
                description: 'Acompanhamento estratégico de romaneios em trânsito, motoristas em rota e canhotos:',
                subItems: [
                    { name: 'Termômetro de Ocupação', desc: 'Ocupação volumétrica e peso das cargas despachadas.' },
                    { name: 'Timeline LIFO', desc: 'Visualização sequencial das paradas e motoristas escalados.' },
                    { name: 'Controle de Canhotos', desc: 'Monitoramento de entregas e conferência de comprovantes assinados.' }
                ],
                tip: 'Monitore os prazos de entrega e confirme a baixa do canhoto pelas lojas.',
            },
            {
                id: 'gestao',
                targetSelector: '[data-tour="gestao"]',
                badge: 'Menu Suspenso',
                icon: ClipboardDocumentCheckIcon,
                title: 'Módulo de Gestão & BI',
                description: 'Governança comercial, auditoria e inteligência de dados:',
                subItems: [
                    { name: 'BI Logística', desc: 'Indicadores estratégicos de pontualidade (OTIF), tempo de rota e custos.' },
                    { name: 'Filiais', desc: 'Parâmetros e capacidades de estocagem das lojas.' }
                ],
                tip: 'A aprovação Web autoriza a separação física no CD. A NF-e oficial é faturada no Microwork.',
            },
            {
                id: 'calendario',
                targetSelector: '[data-tour="calendario"]',
                badge: 'Aba Geral',
                icon: CalendarIcon,
                title: 'Aba Calendário de Rotas',
                description: 'Acompanhe a grade logística semanal planejada pela equipe do CD para alinhar prazos com gerentes de lojas e clientes.',
            },
            {
                id: 'perfil',
                targetSelector: '[data-tour="perfil"]',
                badge: 'Sua Conta',
                icon: ShieldCheckIcon,
                title: 'Perfil do Gestor',
                description: 'Gerenciamento de credenciais e atalhos rápidos.',
            },
        ];

        const passosAdmin = [
            {
                id: 'dashboard',
                targetSelector: '[data-tour="dashboard"]',
                badge: 'Aba Geral',
                icon: ShieldCheckIcon,
                title: 'Aba Início (Painel Administrativo)',
                description: 'Visão holística de todo o sistema: solicitações de motos, catálogo de peças, frotas em trânsito, alertas de auditoria e estoque do ERP.',
                subItems: [
                    { name: 'Auditoria de Pedidos', desc: 'Visão geral de fluxos em andamento, cancelamentos e entregas.' },
                    { name: 'Estoque ERP em Tempo Real', desc: 'Monitoramento direto do saldo do CD Microwork (montadas, desmontadas, avarias).' },
                    { name: 'Mural de Avisos', desc: 'Publicação e gerenciamento de comunicados com formatação rica para a rede.' }
                ],
                tip: 'Acesso pleno a todos os parâmetros e rotinas operacionais.',
            },
            {
                id: 'gestao',
                targetSelector: '[data-tour="gestao"]',
                badge: 'Menu Suspenso',
                icon: UsersIcon,
                title: 'Módulo de Gestão & Governança',
                description: 'Controle de acessos, inteligência, parâmetros e auditoria:',
                subItems: [
                    { name: 'Usuários & Perfis', desc: 'Cadastro de operadores, definição de alçadas (Admin, Gestor, CD, Loja) e vínculo com filiais.' },
                    { name: 'Módulos Opcionais', desc: 'Ativação e desligamento seletivo de módulos (Pedidos de Peças, Devoluções, etc.) em tempo real.' },
                    { name: 'Filiais', desc: 'Cadastro, parametrização e endereçamento das unidades de distribuição.' },
                    { name: 'Auditoria Completa', desc: 'Trilha detalhada de ações, alterações de status e logs de segurança.' },
                    { name: 'BI Logística', desc: 'Relatórios consolidados de lead time, desempenho de rotas e volumes transportados.' }
                ],
                tip: 'Mantenha o vínculo de filiais correto para que os filtros de estoque atuem com precisão.',
            },
            {
                id: 'motos',
                targetSelector: '[data-tour="motos"]',
                badge: 'Menu Suspenso',
                icon: CubeIcon,
                title: 'Módulo de Motos Completo',
                description: 'Gestão de estoque físico, solicitações, censo e aprovação de chassis:',
                subItems: [
                    { name: 'Estoque & Censo de Pátio', desc: 'Inventário contínuo por bipagem via leitor USB/Bluetooth e geração de atas.' },
                    { name: 'Solicitações & Aprovações', desc: 'Fila unificada com controle de cortes parciais, recusas e histórico.' },
                    { name: 'Recebimento & Canhotos', desc: 'Auditoria dos comprovantes físicos fotografados pelas filiais.' }
                ],
            },
            {
                id: 'pecas',
                targetSelector: '[data-tour="pecas"]',
                badge: 'Menu Suspenso',
                icon: WrenchScrewdriverIcon,
                title: 'Módulo de Peças & Saldos Microwork',
                description: 'Mais de 2.380 SKUs integrados ao ERP Microwork, consulta multiloja, triagem e basquetas:',
                subItems: [
                    { name: 'Catálogo de Peças', desc: 'Sincronização em tempo real de saldos físicos e disponíveis.' },
                    { name: 'Kits de Revisão Periódica', desc: 'Parametrização e compra rápida de pacotes oficiais de manutenção preventiva.' },
                    { name: 'Aprovações & Triagem', desc: 'Gate 1 técnico do Pós-Venda e triagem no e-Part pelo almoxarifado.' },
                    { name: 'Basquetas & Pendências', desc: 'Rastreabilidade de caixas de peças vinculadas aos romaneios de motos.' }
                ],
            },
            {
                id: 'logistica',
                targetSelector: '[data-tour="logistica"]',
                badge: 'Menu Suspenso',
                icon: TruckIcon,
                title: 'Módulo de Logística (Expedição & Cargas)',
                description: 'Gestão de frotas, montagem de romaneios, manifesto PDF, controle de portaria e rotas Milk Run:',
                subItems: [
                    { name: 'Montagem de Romaneios', desc: 'Agrupamento inteligente de pedidos com cubagem mista.' },
                    { name: 'Termômetro de Ocupação & LIFO', desc: 'Controle de peso/volume do caminhão e sequenciamento de doca em ordem inversa.' },
                    { name: 'Controle de Portaria & Cargas', desc: 'Liberação de saída com geração de manifesto PDF e timeline de paradas.' }
                ],
            },
            {
                id: 'calendario',
                targetSelector: '[data-tour="calendario"]',
                badge: 'Aba Geral',
                icon: CalendarIcon,
                title: 'Aba Calendário de Rotas',
                description: 'Cronograma semanal completo de viagens planejadas e confirmadas da frota.',
                tip: 'Visão unificada das rotas de distribuição de toda a rede.',
            },
            {
                id: 'perfil',
                targetSelector: '[data-tour="perfil"]',
                badge: 'Sua Conta',
                icon: ShieldCheckIcon,
                title: 'Perfil & Sessão',
                description: 'Configurações de segurança, auditoria pessoal e reinicialização do tour.',
            },
        ];

        if (perfil === 'cd') return passosCD;
        if (perfil === 'gestor') return passosGestor;
        if (perfil === 'admin') return passosAdmin;
        return passosLoja;
    }, [perfil]);

    const updateTargetPosition = useCallback(() => {
        if (isWelcome || !isOpen) {
            setTargetRect(null);
            return;
        }

        const step = steps[currentStep];
        const el = getElementoVisivel(step?.targetSelector);

        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            const rect = el.getBoundingClientRect();
            setTargetRect({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                bottom: rect.bottom,
                right: rect.right,
            });
        } else {
            setTargetRect(null);
        }
    }, [isWelcome, isOpen, currentStep, steps]);

    useEffect(() => {
        if (!user?.id) return;
        const hasCompletedTour = localStorage.getItem(TOUR_STORAGE_KEY + user.id);
        if (!hasCompletedTour) {
            setIsOpen(true);
            setIsWelcome(true);
            setCurrentStep(0);
        }

        const handleStartTour = () => {
            setCurrentStep(0);
            setIsWelcome(false);
            setIsOpen(true);
        };

        window.addEventListener('start-guided-tour', handleStartTour);
        return () => window.removeEventListener('start-guided-tour', handleStartTour);
    }, [user?.id]);

    useEffect(() => {
        const timer = setTimeout(updateTargetPosition, 120);
        window.addEventListener('resize', updateTargetPosition);
        window.addEventListener('scroll', updateTargetPosition);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateTargetPosition);
            window.removeEventListener('scroll', updateTargetPosition);
        };
    }, [updateTargetPosition]);

    const handleSkip = () => {
        if (user?.id) {
            localStorage.setItem(TOUR_STORAGE_KEY + user.id, 'true');
        }
        setIsOpen(false);
    };

    const handleStartTour = () => {
        setIsWelcome(false);
        setCurrentStep(0);
    };

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleComplete = () => {
        if (user?.id) {
            localStorage.setItem(TOUR_STORAGE_KEY + user.id, 'true');
        }
        setIsOpen(false);
    };

    if (!isOpen || !mounted) return null;

    const step = steps[currentStep];
    const Icon = step?.icon || SparklesIcon;
    const progress = Math.round(((currentStep + 1) / steps.length) * 100);

    // ================= POSICIONAMENTO MATEMÁTICO PRECISO =================
    // Largura do card limitada responsivamente
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
    const CARD_WIDTH = Math.min(500, viewportWidth - 32);

    let cardLeft = '50%';
    let cardTop = '50%';
    let cardTransform = 'translate(-50%, -50%)';
    let arrowLeft = '50%';

    if (targetRect) {
        // Centro horizontal do elemento alvo da topbar
        const targetCenter = targetRect.left + (targetRect.width / 2);
        
        // Posição horizontal do card centralizada sob o alvo, delimitada com precisão (clamp)
        const idealLeft = targetCenter - (CARD_WIDTH / 2);
        const clampedLeft = Math.max(16, Math.min(idealLeft, viewportWidth - CARD_WIDTH - 16));
        
        // Posição vertical abaixo da barra de navegação sem corte de tela
        const idealTop = targetRect.bottom + 14;
        const maxAllowedTop = Math.max(16, viewportHeight - 380);
        const clampedTop = Math.min(idealTop, maxAllowedTop);

        cardLeft = `${clampedLeft}px`;
        cardTop = `${clampedTop}px`;
        cardTransform = 'none';

        // Posição relativa da seta/beak apontando exatamente para o centro do botão da topbar
        const relArrowLeft = targetCenter - clampedLeft;
        const clampedArrowLeft = Math.max(28, Math.min(relArrowLeft, CARD_WIDTH - 28));
        arrowLeft = `${clampedArrowLeft}px`;
    }

    const modalContent = (
        <div 
            className="fixed inset-0 select-none" 
            style={{ zIndex: 99999 }}
        >
            {isWelcome ? (
                /* Modal de Acolhimento Padronizado BySabel Log */
                <div className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
                    <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white border border-gray-200 shadow-2xl shadow-black/80 relative">
                        <div className="h-1.5 bg-gradient-to-r from-brand-700 via-brand-500 to-brand-700" />

                        <div className="p-6 sm:p-8 space-y-5 text-center">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 shadow-inner">
                                <SparklesIcon className="w-8 h-8 text-brand-600 animate-pulse" />
                            </div>

                            <div className="space-y-1.5">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-black uppercase tracking-wider border border-brand-200">
                                    BS Log • Perfil {perfil.toUpperCase()}
                                </span>
                                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                                    Bem-vindo ao BySabel Logística
                                </h2>
                                <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                                    Vamos percorrer os recursos e fluxos operacionais da plataforma <strong>BS Log</strong> preparados especificamente para o seu perfil.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={handleStartTour}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md transition active:scale-95 cursor-pointer"
                                >
                                    <span>Conhecer o Sistema</span>
                                    <ArrowRightIcon className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSkip}
                                    className="w-full sm:w-auto px-5 py-3 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-sm transition cursor-pointer"
                                >
                                    Pular Apresentação
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Spotlight e Cartão de Tour */
                <div className="fixed inset-0 overflow-hidden">
                    {/* Backdrop escurecido com recorte cirúrgico (SVG Mask) - ZERO BLUR e 100% de nitidez sobre o elemento alvo */}
                    <svg
                        className="fixed inset-0 w-full h-full cursor-pointer select-none transition-all duration-300"
                        style={{ zIndex: 99997 }}
                        onClick={handleNext}
                    >
                        <defs>
                            <mask id="tour-spotlight-mask">
                                {/* Máscara branca: cobre toda a tela com o backdrop escuro */}
                                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                
                                {/* Recorte preto: cria um furo 100% transparente exatamente sobre o elemento alvo */}
                                {targetRect && (
                                    <rect
                                        x={targetRect.left - 6}
                                        y={targetRect.top - 4}
                                        width={targetRect.width + 12}
                                        height={targetRect.height + 8}
                                        rx="12"
                                        fill="black"
                                    />
                                )}
                            </mask>
                        </defs>
                        
                        {/* O fundo escuro usa a máscara, garantindo que o buraco seja 100% livre de qualquer overlay */}
                        <rect
                            x="0"
                            y="0"
                            width="100%"
                            height="100%"
                            fill="rgba(11, 26, 43, 0.82)"
                            mask="url(#tour-spotlight-mask)"
                        />
                    </svg>

                    {/* Spotlight no Elemento Alvo com Moldura e Feixe de Luz */}
                    {targetRect && (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none fixed rounded-xl transition-all duration-300"
                            style={{
                                top: `${targetRect.top - 4}px`,
                                left: `${targetRect.left - 6}px`,
                                width: `${targetRect.width + 12}px`,
                                height: `${targetRect.height + 8}px`,
                                zIndex: 99998,
                            }}
                        >
                            {/* Moldura de destaque vibrante em vermelho BySabel */}
                            <div className="absolute inset-0 rounded-xl ring-2 ring-brand-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]" />

                            {/* Feixe indicador em diamante apontando para o card explicativo */}
                            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-brand-500 rotate-45 rounded-xs shadow-lg ring-2 ring-white"></div>
                        </div>
                    )}

                    {/* Botão Pular Fixo no Topo Direito */}
                    <button
                        type="button"
                        onClick={handleSkip}
                        className="fixed top-4 right-4 px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold backdrop-blur-md shadow-lg transition cursor-pointer"
                        style={{ zIndex: 100000 }}
                    >
                        Pular Tour ✕
                    </button>

                    {/* Balão / Card Informativo com Posicionamento Matemático */}
                    <div
                        className="fixed transition-all duration-300 p-2 sm:p-4"
                        style={{
                            top: cardTop,
                            left: cardLeft,
                            transform: cardTransform,
                            width: `${CARD_WIDTH}px`,
                            zIndex: 99999,
                        }}
                    >
                        <div className="relative overflow-hidden rounded-3xl bg-white border border-gray-200 shadow-2xl shadow-black/60">
                            {/* Seta superior apontando exatamente para o alvo */}
                            {targetRect && (
                                <div 
                                    className="absolute -top-2 w-4 h-4 bg-white border-t border-l border-gray-200 rotate-45"
                                    style={{ left: arrowLeft, transform: 'translateX(-50%) rotate(45deg)' }}
                                />
                            )}

                            {/* Barra de Progresso */}
                            <div className="h-1.5 bg-gray-100 w-full">
                                <div
                                    className="h-full bg-gradient-to-r from-brand-600 to-brand-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>

                            {/* Corpo com rolagem contida caso necessário (elimina corte de tela) */}
                            <div 
                                className="p-5 sm:p-6 space-y-4 overflow-y-auto scrollbar-slim"
                                style={{
                                    maxHeight: targetRect 
                                        ? `calc(100vh - ${Math.min(targetRect.bottom + 60, viewportHeight - 120)}px)`
                                        : '75vh'
                                }}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 shadow-xs">
                                            <Icon className="w-5 h-5 text-brand-600" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-600">
                                                {step.badge} · Passo {currentStep + 1} de {steps.length}
                                            </span>
                                            <h3 className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                                                {step.title}
                                            </h3>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleSkip}
                                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition cursor-pointer"
                                        title="Fechar tour"
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                <p className="text-sm text-gray-700 leading-relaxed">
                                    {step.description}
                                </p>

                                {/* Lista Restaurada de Sub-Itens / Sub-Páginas */}
                                {step.subItems && step.subItems.length > 0 && (
                                    <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-2">
                                        <p className="text-xs font-black text-gray-900 flex items-center gap-1.5 uppercase tracking-wide">
                                            <span>📄</span> O que você encontra nesta aba:
                                        </p>
                                        <ul className="space-y-1.5 text-xs text-gray-600">
                                            {step.subItems.map((item, idx) => (
                                                <li key={idx} className="flex items-start gap-1.5 leading-snug">
                                                    <span className="text-brand-600 font-bold">•</span>
                                                    <div>
                                                        <strong className="text-gray-900">{item.name}:</strong> {item.desc}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Dica de Ouro */}
                                {step.tip && (
                                    <div className="bg-brand-50/80 border border-brand-200 rounded-2xl p-3.5 flex items-start gap-2.5">
                                        <span className="text-base shrink-0">💡</span>
                                        <div className="text-xs text-brand-950 font-medium leading-relaxed">
                                            {step.tip}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                                    <button
                                        type="button"
                                        onClick={handlePrev}
                                        disabled={currentStep === 0}
                                        className={`inline-flex items-center gap-1 rounded-xl border border-gray-300 px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                                            currentStep === 0
                                                ? 'opacity-30 cursor-not-allowed text-gray-400 bg-gray-50'
                                                : 'hover:bg-gray-100 text-gray-700'
                                        }`}
                                    >
                                        <ArrowLeftIcon className="w-3.5 h-3.5" />
                                        <span>Voltar</span>
                                    </button>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleSkip}
                                            className="px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 transition cursor-pointer"
                                        >
                                            Sair
                                        </button>

                                        {currentStep < steps.length - 1 ? (
                                            <button
                                                type="button"
                                                onClick={handleNext}
                                                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-xs font-black shadow-md hover:shadow-brand-600/30 active:scale-95 transition cursor-pointer"
                                            >
                                                <span>Próxima Aba</span>
                                                <ArrowRightIcon className="w-3.5 h-3.5" />
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleComplete}
                                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-black shadow-md active:scale-95 transition cursor-pointer"
                                            >
                                                <CheckCircleIcon className="w-4 h-4" />
                                                <span>Concluir Tour</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return createPortal(modalContent, document.body);
}
