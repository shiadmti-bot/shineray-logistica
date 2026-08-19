import { useState, useEffect, useMemo } from 'react';
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

    const perfil = user?.perfil || 'loja';

    // Passos do tour estruturados especificamente por perfil
    const steps = useMemo(() => {
        const passosLoja = [
            {
                id: 'dashboard',
                badge: 'Visão Geral',
                icon: HomeIcon,
                title: 'Painel da Loja (Dashboard)',
                description: 'Acompanhe em tempo real o resumo das suas solicitações, pedidos em trânsito, alertas de separação e atalhos rápidos do dia a dia.',
                tip: 'Fique atento aos cards de destaque: pedidos em trânsito exigem conferência física na chegada do caminhão!',
            },
            {
                id: 'calendario',
                badge: 'Planejamento',
                icon: CalendarIcon,
                title: 'Calendário de Entregas & Rotas',
                description: 'Consulte a programação semanal de chegadas na sua filial. Veja as viagens em planejamento (amarelo) e viagens confirmadas (verde).',
                tip: 'O calendário permite à equipe da loja organizar espaço físico e equipe antes do caminhão descarregar.',
            },
            {
                id: 'motos-solicitar',
                badge: 'Motos',
                icon: PlusCircleIcon,
                title: 'Nova Solicitação de Motos',
                description: 'Crie pedidos de motos para diferentes finalidades: Reposição ao CD, Venda Confirmada com Chassi, Transferência entre Lojas ou Devolução.',
                tip: 'Regra de Ouro: Para Reposição/Estoque ao CD, preencha apenas Modelo, Cor e Quantidade! O Chassi só é exigido em Venda Confirmada, Transferências ou Devoluções.',
            },
            {
                id: 'motos-pedidos',
                badge: 'Motos',
                icon: ArchiveBoxIcon,
                title: 'Meus Pedidos & Finalização com Canhoto',
                description: 'Acompanhe a aprovação do gestor e o despacho pelo CD. Quando a moto for entregue, clique em "Conferir e Finalizar" e faça o upload do comprovante assinado.',
                tip: 'Mantenha seus recebimentos em dia! Pedidos sem confirmação de entrega podem gerar bloqueio temporário em novos envios.',
            },
            {
                id: 'pecas-catalogo',
                badge: 'Peças & Acessórios',
                icon: WrenchScrewdriverIcon,
                title: 'Catálogo de Peças & Saldos Microwork',
                description: 'Consulte mais de 2.380 SKUs de peças com inteligência de compatibilidade por modelo de moto e utilize a função "Onde Encontrar" para ver o saldo em todas as filiais.',
                tip: 'Precisa de reposição? Monte seu carrinho em "Solicitar Peças" e informe a prioridade caso seja atendimento de box ou garantia.',
            },
            {
                id: 'notificacoes',
                badge: 'Comunicação',
                icon: BellAlertIcon,
                title: 'Notificações em Tempo Real & PWA',
                description: 'Receba alertas instantâneos no sininho da barra superior sempre que seu pedido for aprovado, despachado ou entrar em trânsito, inclusive no celular via aplicativo PWA.',
                tip: 'Ative as permissões de notificação no navegador para receber avisos mesmo com a tela fechada.',
            },
            {
                id: 'ajuda',
                badge: 'Suporte',
                icon: QuestionMarkCircleIcon,
                title: 'Central de Ajuda & Manuais',
                description: 'Acesse o manual operacional completo em 5 abas com regras de faturamento, prazos, resolução de dúvidas e FAQ com busca inteligente.',
                tip: 'Você pode reiniciar este tour guiado a qualquer momento clicando no botão de tour dentro da tela de Ajuda!',
            },
        ];

        const passosCD = [
            {
                id: 'dashboard',
                badge: 'Operação Central',
                icon: HomeIcon,
                title: 'Painel do Centro de Distribuição (CD)',
                description: 'Controle o volume de pedidos aprovados para separação, estoque físico disponível no galpão e romaneios em preparação.',
                tip: 'Priorize os pedidos de "Venda Confirmada" para garantir o atendimento rápido aos clientes finais das lojas.',
            },
            {
                id: 'calendario',
                badge: 'Logística',
                icon: CalendarIcon,
                title: 'Agendamento & Calendário de Viagens',
                description: 'Monte a grade semanal de viagens da frota. Alterne eventos entre "Planejado" (para prévias de carga) e "Confirmado" (com motoristas escalados).',
                tip: 'Lojas e gestores utilizam este calendário como referência de entrega.',
            },
            {
                id: 'motos-separacao',
                badge: 'Pátio',
                icon: CubeIcon,
                title: 'Separação Física & Vinculação de Chassis',
                description: 'Nos pedidos de reposição aprovados pela diretoria, a equipe do CD vincula os chassis físicos do pátio e aciona a separação para liberar as unidades para a expedição.',
                tip: 'O sistema valida chassis válidos e impede duplicidade de despacho.',
            },
            {
                id: 'expedicao',
                badge: 'Expedição',
                icon: TruckIcon,
                title: 'Montagem de Romaneios & Manifestos de Carga',
                description: 'Emita novos romaneios selecionando o motorista, placa e rota. O sistema consolida motos e pacotes de peças com cálculo automático de cubagem e manifesto em PDF.',
                tip: 'Suporta entregas parciais: envie o que couber hoje e o saldo restante continua na fila para o próximo caminhão.',
            },
            {
                id: 'cargas-transito',
                badge: 'Monitoramento',
                icon: TruckIcon,
                title: 'Aprovação de Saída & Coletas Milk Run',
                description: 'Libere a portaria do CD com um clique em "Aprovar Saída", disparando o status "Em Trânsito" para todas as lojas da rota e gerencie coletas reversas de filiais.',
                tip: 'O controle de romaneios e rotas é exclusivo para as equipes do CD, Gestão e Admin.',
            },
            {
                id: 'pecas-movimento',
                badge: 'Almoxarifado',
                icon: WrenchScrewdriverIcon,
                title: 'Gestão de Peças & Entradas',
                description: 'Controle o inventário físico de peças, atenda requisições de oficinas e acompanhe movimentações sincronizadas com o ERP Microwork.',
                tip: 'Fique atento às pendências de peças críticas com alerta de urgência de garantia.',
            },
            {
                id: 'ajuda',
                badge: 'Suporte',
                icon: QuestionMarkCircleIcon,
                title: 'Manual da Operação CD',
                description: 'Guia completo com o fluxo de pátio, emissão de manifestos, checklist de carregamento e atalho para reiniciar o tour quando desejar.',
                tip: 'Sempre que houver atualizações na operação, consulte a aba CD na Central de Ajuda.',
            },
        ];

        const passosGestor = [
            {
                id: 'dashboard',
                badge: 'Governança',
                icon: HomeIcon,
                title: 'Painel Comercial & Faturamento',
                description: 'Visão consolidada de todas as solicitações da rede, faturamento pendente no Microwork e volume de pedidos aguardando autorização.',
                tip: 'Gerencie as prioridades de atendimento entre filiais com base na demanda comercial.',
            },
            {
                id: 'aprovacoes',
                badge: 'Aprovações',
                icon: ClipboardDocumentCheckIcon,
                title: 'Fila de Aprovação & Cortes Parciais',
                description: 'Analise crédito e disponibilidade de cada pedido. Realize aprovações integrais, cortes parciais de cota/unidades ou rejeições justificadas.',
                tip: 'A aprovação web autoriza a separação no CD. O faturamento oficial no Microwork ocorre antes da liberação do caminhão.',
            },
            {
                id: 'bi',
                badge: 'Business Intelligence',
                icon: PresentationChartLineIcon,
                title: 'BI Logística & Indicadores Gerenciais',
                description: 'Métricas de lead time, cumprimento de prazos de entrega, volume transportado por rota e comparativos de desempenho entre filiais.',
                tip: 'Utilize os filtros por período e região para identificar gargalos logísticos na distribuição.',
            },
            {
                id: 'cargas',
                badge: 'Rastreabilidade',
                icon: TruckIcon,
                title: 'Acompanhamento de Cargas em Trânsito',
                description: 'Monitore em tempo real os romaneios em rota, motoristas em trânsito e prazos estimados de chegada nas lojas.',
                tip: 'Identifique rapidamente comprovantes pendentes de upload pelas filiais.',
            },
            {
                id: 'pecas',
                badge: 'Peças & Estoque',
                icon: WrenchScrewdriverIcon,
                title: 'Estoque Multiloja de Peças',
                description: 'Consulte a disponibilidade de peças em toda a rede de concessionárias e autorize pedidos urgentes de oficinas.',
                tip: 'A consulta integrada ao Microwork evita compras duplicadas permitindo remanejamentos.',
            },
            {
                id: 'ajuda',
                badge: 'Suporte',
                icon: QuestionMarkCircleIcon,
                title: 'Manual de Governança',
                description: 'Documentação completa com regras de alçada, distinção contábil Web vs ERP e atalho para reiniciar o tour guiado.',
                tip: 'Clique na aba Gestor no menu Ajuda para rever as diretrizes operacionais.',
            },
        ];

        const passosAdmin = [
            {
                id: 'dashboard',
                badge: 'Administração',
                icon: ShieldCheckIcon,
                title: 'Painel Geral do Sistema V3.0',
                description: 'Visão integral de todas as frentes: solicitações de motos, pedidos de peças, operação do CD, calendário e fluxos de auditoria.',
                tip: 'Como Administrador, você possui acesso irrestrito a todos os módulos e parâmetros da plataforma.',
            },
            {
                id: 'usuarios',
                badge: 'Acessos & Segurança',
                icon: UsersIcon,
                title: 'Gestão de Usuários & Perfis',
                description: 'Cadastre novos colaboradores, defina permissões (Admin, Gestor, CD, Loja), vincule filiais e gerencie credenciais de acesso.',
                tip: 'Mantenha o vínculo de filiais atualizado para que os filtros automáticos de estoque operem corretamente.',
            },
            {
                id: 'motos-pecas',
                badge: 'Operação Completa',
                icon: CubeIcon,
                title: 'Motos & Peças Integradas',
                description: 'Acesse o catálogo de mais de 2.380 peças com saldo Microwork, estoque de motos, filas de pedidos e relatórios de inventário.',
                tip: 'Todas as movimentações físicas geram histórico detalhado para conciliação.',
            },
            {
                id: 'expedicao-cargas',
                badge: 'Logística',
                icon: TruckIcon,
                title: 'Expedição, Romaneios & Calendário',
                description: 'Gerencie o agendamento de viagens, criação de romaneios, manifesto em PDF, controle de portaria e rotas Milk Run.',
                tip: 'O sistema bloqueia novas cargas para lojas com pendências antigas de comprovante em trânsito.',
            },
            {
                id: 'gestao-bi',
                badge: 'BI & Auditoria',
                icon: PresentationChartLineIcon,
                title: 'BI Logística & Fila de Aprovações',
                description: 'Acompanhe métricas consolidadas de desempenho, auditoria de ações no sistema e fila comercial de aprovações.',
                tip: 'Logs de auditoria registram cada alteração de status, aprovação ou cancelamento de pedido.',
            },
            {
                id: 'notificacoes-push',
                badge: 'Integrações',
                icon: BellAlertIcon,
                title: 'Notificações Real-Time & PWA Push',
                description: 'Integração dupla via WebSockets (Pusher) e notificações push (OneSignal) para desktop e dispositivos móveis.',
                tip: 'O sistema notifica automaticamente gestores, CD e lojas a cada avanço no ciclo do pedido.',
            },
            {
                id: 'ajuda',
                badge: 'Suporte',
                icon: QuestionMarkCircleIcon,
                title: 'Central de Ajuda & Treinamento',
                description: 'Manual interativo em 5 abas cobrindo todos os perfis operacionais, regras de negócio e acionamento deste Tour Guiado.',
                tip: 'Oriente novos membros da equipe a realizarem este Tour no primeiro acesso!',
            },
        ];

        if (perfil === 'cd') return passosCD;
        if (perfil === 'gestor') return passosGestor;
        if (perfil === 'admin') return passosAdmin;
        return passosLoja;
    }, [perfil]);

    // Checagem de primeiro login após atualização
    useEffect(() => {
        if (!user?.id) return;

        const hasCompletedTour = localStorage.getItem(TOUR_STORAGE_KEY + user.id);
        if (!hasCompletedTour) {
            setIsOpen(true);
            setIsWelcome(true);
            setCurrentStep(0);
        }

        // Listener para reinício manual via botão na Ajuda ou Layout
        const handleStartTour = () => {
            setCurrentStep(0);
            setIsWelcome(false);
            setIsOpen(true);
        };

        window.addEventListener('start-guided-tour', handleStartTour);
        return () => window.removeEventListener('start-guided-tour', handleStartTour);
    }, [user?.id]);

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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
            {/* Modal de Boas-Vindas Inicial */}
            {isWelcome ? (
                <div className="w-full max-w-lg bg-surface-card rounded-3xl border border-line shadow-2xl overflow-hidden relative animate-scaleUp">
                    <div className="h-2 bg-gradient-to-r from-brand-700 via-brand-500 to-brand-700"></div>

                    <div className="p-6 sm:p-8 space-y-6 text-center">
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center shadow-inner">
                            <SparklesIcon className="w-8 h-8 animate-pulse" />
                        </div>

                        <div className="space-y-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-black uppercase tracking-wider border border-brand-200">
                                Versão 3.0 • Sistema Atualizado
                            </span>
                            <h2 className="text-2xl sm:text-3xl font-black text-content-primary tracking-tight">
                                Bem-vindo ao Sistema Logístico!
                            </h2>
                            <p className="text-sm text-content-secondary max-w-md mx-auto leading-relaxed">
                                Preparamos um tour guiado rápido e personalizado para o seu perfil (<strong>{perfil.toUpperCase()}</strong>) para apresentar as novas abas, ferramentas e fluxos de trabalho.
                            </p>
                        </div>

                        <div className="bg-surface-sunken p-4 rounded-2xl border border-line text-left text-xs text-content-secondary space-y-1.5">
                            <p className="font-bold text-content-primary flex items-center gap-1.5">
                                <span>🧭</span> O que você vai conferir no Tour:
                            </p>
                            <p>• Navegação completa pelas abas e módulos do seu perfil</p>
                            <p>• Novas regras de solicitação de motos e catálogo de peças</p>
                            <p>• Dicas operacionais para agilizar seus pedidos e entregas</p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleStartTour}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-black text-sm shadow-lg hover:shadow-brand-600/30 active:scale-95 transition cursor-pointer"
                            >
                                <span>Iniciar Tour Guiado</span>
                                <ArrowRightIcon className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={handleSkip}
                                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl border border-line hover:bg-surface-sunken text-content-secondary font-bold text-sm transition cursor-pointer"
                            >
                                Pular Tour
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Modal com os Passos do Tour */
                <div className="w-full max-w-xl bg-surface-card rounded-3xl border border-line shadow-2xl overflow-hidden relative animate-scaleUp">
                    {/* Barra de Progresso Superior */}
                    <div className="h-1.5 bg-surface-sunken w-full">
                        <div
                            className="h-full bg-gradient-to-r from-brand-600 to-brand-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>

                    {/* Cabeçalho do Card */}
                    <div className="p-6 sm:p-8 space-y-6">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 rounded-xl bg-brand-50 border border-brand-200 text-brand-700">
                                    <Icon className="w-6 h-6" />
                                </div>
                                <div>
                                    <span className="text-[11px] font-black uppercase tracking-wider text-brand-600">
                                        {step.badge}
                                    </span>
                                    <h3 className="text-lg sm:text-xl font-black text-content-primary">
                                        {step.title}
                                    </h3>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleSkip}
                                className="p-2 rounded-xl text-content-muted hover:text-content-primary hover:bg-surface-sunken transition cursor-pointer"
                                title="Pular Tour"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Conteúdo do Passo */}
                        <div className="space-y-4">
                            <p className="text-sm text-content-secondary leading-relaxed">
                                {step.description}
                            </p>

                            {/* Card de Dica */}
                            {step.tip && (
                                <div className="bg-brand-50/60 border border-brand-200/80 rounded-2xl p-4 flex items-start gap-3">
                                    <span className="text-lg">💡</span>
                                    <div className="text-xs text-brand-900 leading-relaxed font-medium">
                                        {step.tip}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pílulas de Progresso */}
                        <div className="flex items-center justify-between pt-2 border-t border-line">
                            <div className="flex items-center gap-1.5">
                                {steps.map((s, idx) => (
                                    <button
                                        key={s.id}
                                        onClick={() => setCurrentStep(idx)}
                                        className={`h-2 rounded-full transition-all cursor-pointer ${
                                            idx === currentStep
                                                ? 'w-6 bg-brand-600'
                                                : idx < currentStep
                                                ? 'w-2 bg-brand-300'
                                                : 'w-2 bg-line'
                                        }`}
                                        title={`Passo ${idx + 1}: ${s.title}`}
                                    />
                                ))}
                            </div>

                            <span className="text-xs font-bold text-content-muted tabular-nums">
                                Passo {currentStep + 1} de {steps.length}
                            </span>
                        </div>

                        {/* Ações de Navegação */}
                        <div className="flex items-center justify-between gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handlePrev}
                                disabled={currentStep === 0}
                                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-line text-xs font-bold transition ${
                                    currentStep === 0
                                        ? 'opacity-40 cursor-not-allowed text-content-muted'
                                        : 'hover:bg-surface-sunken text-content-secondary cursor-pointer'
                                }`}
                            >
                                <ArrowLeftIcon className="w-3.5 h-3.5" />
                                <span>Anterior</span>
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleSkip}
                                    className="px-3 py-2 text-xs font-bold text-content-muted hover:text-content-secondary transition cursor-pointer"
                                >
                                    Pular
                                </button>

                                {currentStep < steps.length - 1 ? (
                                    <button
                                        type="button"
                                        onClick={handleNext}
                                        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-black shadow-md hover:shadow-brand-600/30 active:scale-95 transition cursor-pointer"
                                    >
                                        <span>Próximo</span>
                                        <ArrowRightIcon className="w-3.5 h-3.5" />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleComplete}
                                        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-status-success-fg hover:opacity-90 text-white text-xs font-black shadow-md active:scale-95 transition cursor-pointer"
                                    >
                                        <CheckCircleIcon className="w-4 h-4" />
                                        <span>Concluir Tour</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
