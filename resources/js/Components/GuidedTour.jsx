import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
    PlusCircleIcon,
    ArchiveBoxIcon,
    WrenchScrewdriverIcon,
    TruckIcon,
    PresentationChartLineIcon,
    ClipboardDocumentCheckIcon,
    UsersIcon,
    BellAlertIcon,
    ShieldCheckIcon
} from '@heroicons/react/24/outline';

const TOUR_STORAGE_KEY = 'shineray_tour_v3_completed_user_';

export default function GuidedTour({ user }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isWelcome, setIsWelcome] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);

    const perfil = user?.perfil || 'loja';

    // Passos do tour estruturados com seletores reais de alvo da barra de navegação
    const steps = useMemo(() => {
        const passosLoja = [
            {
                id: 'dashboard',
                targetSelector: '[data-tour="dashboard"]',
                badge: 'Aba Geral',
                icon: HomeIcon,
                title: 'Aba Início (Dashboard)',
                description: 'Visão panorâmica da sua filial. Exibe o status de solicitações em andamento, motos em trânsito com previsão de chegada e alertas de separação.',
                subItems: [
                    { name: 'Cards de Resumo', desc: 'Totais de pedidos em análise, aprovados e em trânsito.' },
                    { name: 'Avisos da Loja', desc: 'Notificações de motos que outras lojas solicitaram do seu pátio.' }
                ],
                tip: 'Acesse diariamente para verificar se há caminhões chegando na sua filial!',
            },
            {
                id: 'calendario',
                targetSelector: '[data-tour="calendario"]',
                badge: 'Aba Geral',
                icon: CalendarIcon,
                title: 'Aba Calendário de Rotas',
                description: 'Programação semanal de saídas do CD e previsão de entregas na sua loja. Permite planejar a equipe e o espaço físico antes do descarregamento.',
                subItems: [
                    { name: 'Eventos Amarelos', desc: 'Viagens em planejamento prévio pela logística.' },
                    { name: 'Eventos Verdes', desc: 'Viagens confirmadas com rota e motorista definidos.' }
                ],
                tip: 'O calendário é atualizado pelo CD em tempo real conforme as rotas são aprovadas.',
            },
            {
                id: 'motos',
                targetSelector: '[data-tour="motos"]',
                badge: 'Menu Suspenso',
                icon: CubeIcon,
                title: 'Módulo de Motos',
                description: 'Gerenciamento completo do ciclo de vida das motos para sua filial:',
                subItems: [
                    { name: 'Nova Solicitação', desc: 'Faça pedidos ao CD (somente Modelo, Cor e Qtd) ou pedidos de Venda Confirmada com Chassi.' },
                    { name: 'Estoque', desc: 'Consulte a disponibilidade de motos físicas no estoque central e na sua loja.' },
                    { name: 'Meus Pedidos', desc: 'Acompanhe a aprovação do gestor e realize a conferência física com foto do canhoto assinado.' }
                ],
                tip: 'Regra Oficial: Em pedidos de reposição ao CD, você NÃO precisa preencher chassi! O chassi só é obrigatório para Venda Confirmada, Transferências ou Devoluções.',
            },
            {
                id: 'pecas',
                targetSelector: '[data-tour="pecas"]',
                badge: 'Menu Suspenso',
                icon: WrenchScrewdriverIcon,
                title: 'Módulo de Peças & Acessórios',
                description: 'Catálogo integrado com mais de 2.380 SKUs e sincronização com o ERP Microwork:',
                subItems: [
                    { name: 'Solicitar Peças', desc: 'Adicione peças ao carrinho e informe se é atendimento urgente de box/garantia.' },
                    { name: 'Estoque de Peças', desc: 'Consulte compatibilidade por modelo e use o botão "Onde Encontrar" para ver o saldo em todas as filiais.' },
                    { name: 'Entrada / Inventário', desc: 'Registro de recebimento de peças e conferência local.' },
                    { name: 'Pendências', desc: 'Acompanhe o status de separação das peças solicitadas ao CD.' }
                ],
                tip: 'Use o botão "Onde Encontrar" antes de solicitar compras externas — você pode remanejar de uma filial parceira!',
            },
            {
                id: 'notificacoes',
                targetSelector: '[data-tour="notificacoes"]',
                badge: 'Barra de Ações',
                icon: BellAlertIcon,
                title: 'Central de Notificações (Sininho & Push)',
                description: 'Alertas instantâneos via WebSocket e notificações Push no smartphone/PWA sempre que seus pedidos avançarem de status.',
                tip: 'Ao receber motos na loja, o sininho avisará a liberação de portaria para que você confira os chassis.',
            },
            {
                id: 'manual',
                targetSelector: '[data-tour="manual"]',
                badge: 'Aba Geral',
                icon: QuestionMarkCircleIcon,
                title: 'Central de Ajuda & Conhecimento',
                description: 'Manuais detalhados em 5 abas com regras de faturamento, prazos, fluxo de avarias, perguntas frequentes e atalho para reiniciar este Tour Guiado.',
                tip: 'Você pode rever este tour sempre que quiser clicando no banner interativo dentro da Ajuda!',
            },
            {
                id: 'perfil',
                targetSelector: '[data-tour="perfil"]',
                badge: 'Menu de Conta',
                icon: ShieldCheckIcon,
                title: 'Perfil & Configurações de Usuário',
                description: 'Visualize suas informações cadastrais, altere sua senha de acesso corporativa e encerre sua sessão com segurança.',
                tip: 'Recomendamos manter uma senha segura e atualizada regularmente.',
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
                    { name: 'Fila de Separação', desc: 'Pedidos liberados pelo gestor prontos para atendimento.' },
                    { name: 'Status do Pátio', desc: 'Unidades disponíveis para alocação nas cargas.' }
                ],
                tip: 'Dê prioridade aos pedidos com motivo "Venda Confirmada" para agilizar a entrega ao cliente final!',
            },
            {
                id: 'calendario',
                targetSelector: '[data-tour="calendario"]',
                badge: 'Aba Geral',
                icon: CalendarIcon,
                title: 'Aba Calendário de Viagens da Frota',
                description: 'Planeje e confirme as rotas de entrega semanais. Arraste e configure viagens para que as lojas e gestores visualizem a estimativa de entrega.',
                subItems: [
                    { name: 'Planejado (Amarelo)', desc: 'Prévia interna da expedição.' },
                    { name: 'Confirmado (Verde)', desc: 'Viagem oficializada com motorista escalado.' }
                ],
                tip: 'Lojas consultam este calendário para preparar o recebimento de descarregamento.',
            },
            {
                id: 'motos',
                targetSelector: '[data-tour="motos"]',
                badge: 'Menu Suspenso',
                icon: CubeIcon,
                title: 'Módulo de Motos (Pátio & Separação)',
                description: 'Controle de estoque e separação física de unidades:',
                subItems: [
                    { name: 'Estoque de Motos', desc: 'Visão de todas as motos e chassis presentes no CD.' },
                    { name: 'Separação de Pedidos', desc: 'Vincule os chassis físicos do estoque aos pedidos de reposição e clique em "Separar" para liberar para a expedição.' }
                ],
                tip: 'O sistema bloqueia automaticamente chassis duplicados ou já despachados.',
            },
            {
                id: 'logistica',
                targetSelector: '[data-tour="logistica"]',
                badge: 'Menu Suspenso',
                icon: TruckIcon,
                title: 'Módulo de Logística (Expedição & Cargas)',
                description: 'Operação de transporte, montagem de romaneios e despacho:',
                subItems: [
                    { name: 'Expedição', desc: 'Monte novos romaneios escolhendo Motorista, Placa, Rota e itens com cálculo de cubagem.' },
                    { name: 'Conferência', desc: 'Checklist físico de conferência antes do caminhão fechar o baú.' },
                    { name: 'Cargas', desc: 'Histórico de cargas, emissão do Manifesto PDF, aprovação de saída de portaria e Milk Run.' }
                ],
                tip: 'Ao clicar em "Aprovar Saída", todos os pedidos da carga entram automaticamente no status "Em Trânsito"!',
            },
            {
                id: 'pecas',
                targetSelector: '[data-tour="pecas"]',
                badge: 'Menu Suspenso',
                icon: WrenchScrewdriverIcon,
                title: 'Módulo de Peças & Almoxarifado',
                description: 'Gestão de entradas, conferência de inventário e separação de peças solicitadas pela rede.',
                subItems: [
                    { name: 'Estoque de Peças', desc: 'Catálogo de SKUs com saldos e empresas Microwork.' },
                    { name: 'Pendências', desc: 'Fila de separação de pacotes de peças para inclusão nos romaneios.' }
                ],
                tip: 'Peças separadas podem ser adicionadas diretamente no romaneio de motos!',
            },
            {
                id: 'notificacoes-manual',
                targetSelector: '[data-tour="manual"]',
                badge: 'Aba Geral',
                icon: QuestionMarkCircleIcon,
                title: 'Central de Ajuda da Operação CD',
                description: 'Manuais práticos de operação de pátio, emissão de manifestos e reinício deste Tour Guiado.',
                tip: 'Consulte a aba CD na Ajuda para conferir o passo a passo de coletas Milk Run.',
            },
            {
                id: 'perfil',
                targetSelector: '[data-tour="perfil"]',
                badge: 'Menu de Conta',
                icon: ShieldCheckIcon,
                title: 'Perfil & Sessão',
                description: 'Acesse suas preferências de usuário, atalho rápido do Tour Guiado e encerramento de sessão.',
                tip: 'Use o atalho "Tour Guiado" no menu sempre que precisar revisar o fluxo.',
            },
        ];

        const passosGestor = [
            {
                id: 'dashboard',
                targetSelector: '[data-tour="dashboard"]',
                badge: 'Aba Geral',
                icon: HomeIcon,
                title: 'Aba Início (Painel Comercial & Faturamento)',
                description: 'Indicadores gerenciais de solicitações recebidas, pedidos pendentes de faturamento e fluxo comercial da rede de lojas.',
                subItems: [
                    { name: 'Volume de Pedidos', desc: 'Totalizadores consolidados por filial e modelo.' },
                    { name: 'Status da Fila', desc: 'Visão de pedidos aguardando autorização da diretoria.' }
                ],
                tip: 'O painel auxilia na priorização de entregas para as lojas com maior demanda.',
            },
            {
                id: 'gestao',
                targetSelector: '[data-tour="gestao"]',
                badge: 'Menu Suspenso',
                icon: ClipboardDocumentCheckIcon,
                title: 'Módulo de Gestão & BI',
                description: 'Governança comercial, auditoria e inteligência de dados:',
                subItems: [
                    { name: 'Aprovações', desc: 'Fila de autorização comercial com suporte a aprovação total, cortes parciais de cota/unidades e recusas justificadas.' },
                    { name: 'BI Logística', desc: 'Painel de métricas de cumprimento de prazos (OTIF), lead time de rotas e desempenho regional.' }
                ],
                tip: 'A aprovação Web autoriza a separação física no CD. A NF-e oficial é faturada no Microwork antes da saída do caminhão.',
            },
            {
                id: 'calendario',
                targetSelector: '[data-tour="calendario"]',
                badge: 'Aba Geral',
                icon: CalendarIcon,
                title: 'Aba Calendário de Rotas',
                description: 'Acompanhe a grade logística semanal planejada pela equipe do CD para alinhar prazos com gerentes de lojas e clientes.',
                tip: 'Monitore as viagens confirmadas para prever a data de chegada das frotas.',
            },
            {
                id: 'logistica',
                targetSelector: '[data-tour="logistica"]',
                badge: 'Menu Suspenso',
                icon: TruckIcon,
                title: 'Módulo de Logística (Cargas)',
                description: 'Acompanhamento de romaneios em trânsito, motoristas em rota e controle de comprovantes pendentes de upload.',
                tip: 'Monitore os prazos de entrega e confirme a baixa do canhoto pelas lojas.',
            },
            {
                id: 'pecas',
                targetSelector: '[data-tour="pecas"]',
                badge: 'Menu Suspenso',
                icon: WrenchScrewdriverIcon,
                title: 'Módulo de Peças & Estoques Multiloja',
                description: 'Consulta de saldos de peças em todas as filiais e autorização de requisições emergenciais de garantias.',
                tip: 'Permite remanejar peças entre filiais próximas antes de realizar pedidos externos.',
            },
            {
                id: 'manual',
                targetSelector: '[data-tour="manual"]',
                badge: 'Aba Geral',
                icon: QuestionMarkCircleIcon,
                title: 'Central de Ajuda & Governança',
                description: 'Regras de alçada comercial, fluxos operacionais e atalho para reiniciar o tour guiado.',
                tip: 'Consulte as orientações fiscais e contábeis na aba Gestor.',
            },
            {
                id: 'perfil',
                targetSelector: '[data-tour="perfil"]',
                badge: 'Menu de Conta',
                icon: ShieldCheckIcon,
                title: 'Perfil & Acesso',
                description: 'Gerenciamento da sua conta corporativa, segurança e atalhos rápidos.',
                tip: 'Alterne opções de segurança ou revise o tour a qualquer momento.',
            },
        ];

        const passosAdmin = [
            {
                id: 'dashboard',
                targetSelector: '[data-tour="dashboard"]',
                badge: 'Aba Geral',
                icon: ShieldCheckIcon,
                title: 'Aba Início (Painel Administrativo)',
                description: 'Visão holística de todo o sistema: solicitações de motos, catálogo de peças, frotas em trânsito, alertas de auditoria e usuários ativos.',
                tip: 'Acesso pleno a todos os parâmetros e rotinas operacionais.',
            },
            {
                id: 'gestao',
                targetSelector: '[data-tour="gestao"]',
                badge: 'Menu Suspenso',
                icon: UsersIcon,
                title: 'Módulo de Gestão & Administração',
                description: 'Controle de acessos, inteligência e governança comercial:',
                subItems: [
                    { name: 'Usuários', desc: 'Cadastro de operadores, definição de perfis (Admin, Gestor, CD, Loja) e vínculo com filiais.' },
                    { name: 'BI Logística', desc: 'Relatórios consolidados de lead time, desempenho de rotas e volumes transportados.' },
                    { name: 'Aprovações', desc: 'Fila de autorização comercial com histórico e auditoria.' }
                ],
                tip: 'Mantenha o vínculo de filiais correto para que os filtros de estoque atuem com precisão.',
            },
            {
                id: 'motos',
                targetSelector: '[data-tour="motos"]',
                badge: 'Menu Suspenso',
                icon: CubeIcon,
                title: 'Módulo de Motos',
                description: 'Acompanhamento e intervenção em solicitações, controle de estoque do CD e histórico completo de pedidos.',
                tip: 'Permite acompanhar desde a solicitação inicial até a finalização com canhoto.',
            },
            {
                id: 'pecas',
                targetSelector: '[data-tour="pecas"]',
                badge: 'Menu Suspenso',
                icon: WrenchScrewdriverIcon,
                title: 'Módulo de Peças & Saldos Microwork',
                description: 'Mais de 2.380 SKUs integrados ao ERP Microwork, consulta multiloja, requisições de oficinas e controle de inventário.',
                tip: 'Sincronização em tempo real de saldos físicos e disponíveis.',
            },
            {
                id: 'logistica',
                targetSelector: '[data-tour="logistica"]',
                badge: 'Menu Suspenso',
                icon: TruckIcon,
                title: 'Módulo de Logística (Expedição & Cargas)',
                description: 'Gestão de frotas, montagem de romaneios, manifesto PDF, controle de portaria e rotas Milk Run.',
                tip: 'Bloqueio automático de cargas em lojas com pendências antigas de comprovante.',
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
                id: 'notificacoes-manual',
                targetSelector: '[data-tour="manual"]',
                badge: 'Aba Geral',
                icon: QuestionMarkCircleIcon,
                title: 'Central de Conhecimento & Treinamento',
                description: 'Manual interativo em 5 abas cobrindo todos os perfis e recurso de Tour Guiado para capacitação de novos colaboradores.',
                tip: 'Utilize este tour para treinamento inicial de novos operadores da equipe!',
            },
            {
                id: 'perfil',
                targetSelector: '[data-tour="perfil"]',
                badge: 'Menu de Conta',
                icon: ShieldCheckIcon,
                title: 'Perfil & Gestão de Sessão',
                description: 'Configurações de segurança, gerenciamento de perfil e atalhos de navegação.',
                tip: 'Encerre sempre sua sessão ao utilizar computadores compartilhados.',
            },
        ];

        if (perfil === 'cd') return passosCD;
        if (perfil === 'gestor') return passosGestor;
        if (perfil === 'admin') return passosAdmin;
        return passosLoja;
    }, [perfil]);

    // Atualiza a posição do elemento alvo na tela
    const updateTargetPosition = useCallback(() => {
        if (isWelcome || !isOpen) {
            setTargetRect(null);
            return;
        }

        const step = steps[currentStep];
        if (!step?.targetSelector) {
            setTargetRect(null);
            return;
        }

        const el = document.querySelector(step.targetSelector);
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

    // Checagem de primeiro login após atualização
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

    // Recalcula posição ao mudar de passo ou redimensionar a janela
    useEffect(() => {
        const timer = setTimeout(updateTargetPosition, 100);
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

    if (!isOpen) return null;

    const step = steps[currentStep];
    const Icon = step?.icon || SparklesIcon;
    const progress = Math.round(((currentStep + 1) / steps.length) * 100);

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-auto select-none">
            {/* Modal de Boas-Vindas Inicial (Centralizado) */}
            {isWelcome ? (
                <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
                    <div className="w-full max-w-lg bg-white rounded-3xl border border-gray-200 shadow-2xl shadow-black/60 overflow-hidden relative animate-scaleUp">
                        <div className="h-2 bg-gradient-to-r from-brand-700 via-brand-500 to-brand-700"></div>

                        <div className="p-6 sm:p-8 space-y-6 text-center">
                            <div className="mx-auto w-16 h-16 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center shadow-inner">
                                <SparklesIcon className="w-8 h-8 animate-pulse text-brand-600" />
                            </div>

                            <div className="space-y-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-black uppercase tracking-wider border border-brand-200">
                                    Versão 3.0 • Sistema Atualizado
                                </span>
                                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                                    Tour Guiado pelas Abas & Páginas
                                </h2>
                                <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                                    Vamos percorrer cada uma das <strong>abas e menus</strong> liberados para o seu perfil (<strong>{perfil.toUpperCase()}</strong>), mostrando o que cada recurso faz.
                                </p>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-left text-xs text-gray-700 space-y-2">
                                <p className="font-bold text-gray-900 flex items-center gap-1.5">
                                    <span>🧭</span> O que vamos explorar no Tour:
                                </p>
                                <p>• Apontamento direto para cada aba da barra de navegação</p>
                                <p>• Apresentação das funções de cada menu e sub-página</p>
                                <p>• Regras operacionais atualizadas de motos e catálogo de peças</p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleStartTour}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black text-sm shadow-xl hover:shadow-brand-600/30 active:scale-95 transition cursor-pointer"
                                >
                                    <span>Iniciar Tour pelas Abas</span>
                                    <ArrowRightIcon className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSkip}
                                    className="w-full sm:w-auto px-6 py-3.5 rounded-2xl border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-sm transition cursor-pointer"
                                >
                                    Pular Tour
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* ================= COACHMARK TOUR (SPOTLIGHT APONTANDO PARA A ABA) ================= */
                <div className="fixed inset-0 overflow-hidden">
                    {/* Backdrop escurecido */}
                    <div className="absolute inset-0 bg-[#0b1a2b]/80 transition-all duration-300 pointer-events-auto" onClick={handleNext}></div>

                    {/* Spotlight no Elemento Alvo */}
                    {targetRect && (
                        <div
                            className="absolute rounded-xl transition-all duration-300 pointer-events-none ring-4 ring-brand-500 ring-offset-4 ring-offset-brand-900 shadow-[0_0_0_9999px_rgba(11,26,43,0.75)] animate-pulse"
                            style={{
                                top: `${targetRect.top - 4}px`,
                                left: `${targetRect.left - 6}px`,
                                width: `${targetRect.width + 12}px`,
                                height: `${targetRect.height + 8}px`,
                            }}
                        >
                            {/* Feixe de Luz / Indicador pulsante */}
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-brand-500 rotate-45 rounded-sm shadow-md"></div>
                        </div>
                    )}

                    {/* Botão Pular Fixo no Topo Direito */}
                    <button
                        type="button"
                        onClick={handleSkip}
                        className="absolute top-4 right-4 z-50 px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-bold backdrop-blur-md shadow-lg transition cursor-pointer"
                    >
                        Pular Tour ✕
                    </button>

                    {/* Balão / Card Informativo Flutuante Posicionado */}
                    <div
                        className="absolute z-50 transition-all duration-300 p-4 w-full max-w-lg pointer-events-auto"
                        style={{
                            top: targetRect ? `${Math.min(targetRect.bottom + 16, window.innerHeight - 450)}px` : '20%',
                            left: targetRect ? `${Math.max(16, Math.min(targetRect.left - 40, window.innerWidth - 530))}px` : '50%',
                            transform: !targetRect ? 'translateX(-50%)' : 'none',
                        }}
                    >
                        <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl shadow-black/60 overflow-hidden animate-scaleUp">
                            {/* Barra de Progresso */}
                            <div className="h-1.5 bg-gray-100 w-full">
                                <div
                                    className="h-full bg-gradient-to-r from-brand-600 to-brand-500 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>

                            <div className="p-6 sm:p-7 space-y-5">
                                {/* Header do Passo */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 rounded-2xl bg-brand-50 border border-brand-200 text-brand-700 shadow-xs">
                                            <Icon className="w-6 h-6 text-brand-600" />
                                        </div>
                                        <div>
                                            <span className="text-[11px] font-black uppercase tracking-wider text-brand-600">
                                                {step.badge}
                                            </span>
                                            <h3 className="text-xl font-black text-gray-900 tracking-tight">
                                                {step.title}
                                            </h3>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleSkip}
                                        className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                                        title="Pular Tour"
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Descrição Principal */}
                                <p className="text-sm text-gray-700 leading-relaxed font-normal">
                                    {step.description}
                                </p>

                                {/* Lista de Sub-Itens / Sub-Páginas da Aba */}
                                {step.subItems && step.subItems.length > 0 && (
                                    <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 space-y-2">
                                        <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5 uppercase tracking-wide">
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
                                    <div className="bg-brand-50/70 border border-brand-200 rounded-2xl p-3.5 flex items-start gap-2.5">
                                        <span className="text-base shrink-0">💡</span>
                                        <div className="text-xs text-brand-950 leading-relaxed font-medium">
                                            {step.tip}
                                        </div>
                                    </div>
                                )}

                                {/* Pílulas de Progresso & Ações */}
                                <div className="pt-2 border-t border-gray-100 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            {steps.map((s, idx) => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => setCurrentStep(idx)}
                                                    className={`h-2 rounded-full transition-all cursor-pointer ${
                                                        idx === currentStep
                                                            ? 'w-6 bg-brand-600'
                                                            : idx < currentStep
                                                            ? 'w-2.5 bg-brand-300'
                                                            : 'w-2 bg-gray-200'
                                                    }`}
                                                    title={`Aba ${idx + 1}: ${s.title}`}
                                                />
                                            ))}
                                        </div>

                                        <span className="text-xs font-black text-gray-500 tabular-nums">
                                            Aba {currentStep + 1} de {steps.length}
                                        </span>
                                    </div>

                                    {/* Botões de Navegação */}
                                    <div className="flex items-center justify-between gap-3">
                                        <button
                                            type="button"
                                            onClick={handlePrev}
                                            disabled={currentStep === 0}
                                            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 text-xs font-bold transition ${
                                                currentStep === 0
                                                    ? 'opacity-40 cursor-not-allowed text-gray-400 bg-gray-50'
                                                    : 'hover:bg-gray-100 text-gray-700 cursor-pointer'
                                            }`}
                                        >
                                            <ArrowLeftIcon className="w-3.5 h-3.5" />
                                            <span>Anterior</span>
                                        </button>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSkip}
                                                className="px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 transition cursor-pointer"
                                            >
                                                Pular
                                            </button>

                                            {currentStep < steps.length - 1 ? (
                                                <button
                                                    type="button"
                                                    onClick={handleNext}
                                                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-black shadow-md hover:shadow-brand-600/30 active:scale-95 transition cursor-pointer"
                                                >
                                                    <span>Próxima Aba</span>
                                                    <ArrowRightIcon className="w-3.5 h-3.5" />
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={handleComplete}
                                                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md active:scale-95 transition cursor-pointer"
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
                </div>
            )}
        </div>
    );
}
