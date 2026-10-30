import { useState, useEffect, useMemo, useCallback } from 'react';
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

    const perfil = user?.perfil || 'loja';

    const steps = useMemo(() => {
        const passosLoja = [
            {
                id: 'dashboard',
                targetSelector: '[data-tour="dashboard"]',
                badge: 'Aba Início',
                icon: HomeIcon,
                title: 'Painel da Sua Filial',
                description: 'Visão central dos seus pedidos: motos em trânsito com previsão de chegada, histórico e solicitações ativas.',
                tip: 'Verifique diariamente se há caminhões previstos para descarregar na sua loja!',
            },
            {
                id: 'calendario',
                targetSelector: '[data-tour="calendario"]',
                badge: 'Logística',
                icon: CalendarIcon,
                title: 'Calendário de Rotas da Frota',
                description: 'Cronograma semanal de saídas do CD e estimativa de chegada na sua cidade.',
                tip: 'Viagens em verde já estão confirmadas com motorista escalado.',
            },
            {
                id: 'motos',
                targetSelector: '[data-tour="motos"]',
                badge: 'Módulo Principal',
                icon: CubeIcon,
                title: 'Motos & Reposição',
                description: 'Faça novos pedidos de reposição ao CD, consulte estoque da rede e acompanhe a aprovação comercial.',
                tip: 'Regra Oficial: Em pedidos normais de reposição, você NÃO precisa de chassi! Peça apenas Modelo, Cor e Quantidade.',
            },
            {
                id: 'pecas',
                targetSelector: '[data-tour="pecas"]',
                badge: 'Pós-Venda',
                icon: WrenchScrewdriverIcon,
                title: 'Peças & Acessórios',
                description: 'Catálogo integrado ao ERP Microwork. Permite solicitar peças por modelo de moto e checar saldos em outras lojas.',
                tip: 'Não sabe o código? Use a opção "Peça sem código" e o Call Center identifica para você.',
            },
            {
                id: 'notificacoes',
                targetSelector: '[data-tour="notificacoes"]',
                badge: 'Comunicação',
                icon: BellAlertIcon,
                title: 'Central de Notificações & Alertas',
                description: 'Avisos em tempo real sempre que seu pedido for aprovado, separado ou despachado pelo CD.',
            },
            {
                id: 'manual',
                targetSelector: '[data-tour="manual"]',
                badge: 'Base de Conhecimento',
                icon: QuestionMarkCircleIcon,
                title: 'Manuais & Regras Operacionais',
                description: 'Regras fiscais, prazos de garantia e procedimentos de conferência com foto do canhoto.',
            },
            {
                id: 'perfil',
                targetSelector: '[data-tour="perfil"]',
                badge: 'Sua Conta',
                icon: ShieldCheckIcon,
                title: 'Perfil & Sessão',
                description: 'Altere sua senha de acesso e reinicie este tour guiado a qualquer momento.',
            },
        ];

        const passosCD = [
            {
                id: 'dashboard',
                targetSelector: '[data-tour="dashboard"]',
                badge: 'Mesa de Operações',
                icon: HomeIcon,
                title: 'Painel da Expedição CD',
                description: 'Controle em tempo real de pedidos liberados para separação física, motos no pátio e caminhões em rota.',
            },
            {
                id: 'motos',
                targetSelector: '[data-tour="motos"]',
                badge: 'Módulo de Motos',
                icon: CubeIcon,
                title: 'Separação & Pátio',
                description: 'Estoque de motos do CD e conferência de chassis físicos vinculados aos pedidos.',
            },
            {
                id: 'logistica',
                targetSelector: '[data-tour="logistica"]',
                badge: 'Expedição',
                icon: TruckIcon,
                title: 'Montagem de Romaneios',
                description: 'Mesa de expedição: agrupe motos e basquetas de peças por filial, aloque motorista e emita o Manifesto.',
                tip: 'Ao aprovar a saída de portaria, todos os pedidos entram automaticamente no status "Em Trânsito"!',
            },
            {
                id: 'pecas',
                targetSelector: '[data-tour="pecas"]',
                badge: 'Almoxarifado',
                icon: WrenchScrewdriverIcon,
                title: 'Peças & Basquetas',
                description: 'Triagem de pedidos do Pós-Venda, conferência de inventário e separação de basquetas de peças para inclusão nas cargas.',
            },
            {
                id: 'calendario',
                targetSelector: '[data-tour="calendario"]',
                badge: 'Planejamento',
                icon: CalendarIcon,
                title: 'Grade Semanal de Viagens',
                description: 'Cadastre e confirme viagens planejadas para que as lojas visualizem a previsão de chegada.',
            },
            {
                id: 'perfil',
                targetSelector: '[data-tour="perfil"]',
                badge: 'Sua Conta',
                icon: ShieldCheckIcon,
                title: 'Perfil & Preferências',
                description: 'Ajustes da conta e encerramento seguro de sessão.',
            },
        ];

        const passosGestor = [
            {
                id: 'dashboard',
                targetSelector: '[data-tour="dashboard"]',
                badge: 'Visão Geral',
                icon: HomeIcon,
                title: 'Painel Comercial & Faturamento',
                description: 'Visão consolidada de pedidos pendentes de validação comercial e volume de vendas da rede.',
            },
            {
                id: 'motos',
                targetSelector: '[data-tour="motos"]',
                badge: 'Aprovações Comerciais',
                icon: CubeIcon,
                title: 'Módulo de Motos & Aprovações',
                description: 'Acesse a fila de Aprovações de Motos: aprove o pedido integralmente, realize cortes parciais com justificativa ou converse no chat com a loja.',
                tip: 'As aprovações comerciais de motos ficam neste menu!',
            },
            {
                id: 'pecas',
                targetSelector: '[data-tour="pecas"]',
                badge: 'Validação de Peças',
                icon: WrenchScrewdriverIcon,
                title: 'Módulo de Peças & Estoques Multiloja',
                description: 'Consulta de saldos de peças em todas as filiais e validação de requisições emergenciais de garantia.',
            },
            {
                id: 'logistica',
                targetSelector: '[data-tour="logistica"]',
                badge: 'Monitoramento',
                icon: TruckIcon,
                title: 'Logística & Cargas',
                description: 'Acompanhe romaneios em trânsito, motoristas e controle de canhotos pendentes de baixa.',
            },
            {
                id: 'gestao',
                targetSelector: '[data-tour="gestao"]',
                badge: 'Governança & BI',
                icon: ClipboardDocumentCheckIcon,
                title: 'Módulo de Gestão & Relatórios',
                description: 'Indicadores estratégicos de desempenho logístico (OTIF), tempo médio de rota e filiais.',
            },
            {
                id: 'perfil',
                targetSelector: '[data-tour="perfil"]',
                badge: 'Conta',
                icon: ShieldCheckIcon,
                title: 'Perfil do Gestor',
                description: 'Gerenciamento de credenciais e atalhos rápidos.',
            },
        ];

        const passosAdmin = [
            {
                id: 'dashboard',
                targetSelector: '[data-tour="dashboard"]',
                badge: 'Administração',
                icon: ShieldCheckIcon,
                title: 'Painel de Auditoria & Sistema',
                description: 'Visão unificada de frotas, movimentações de pedidos, logs de auditoria e usuários online.',
            },
            {
                id: 'motos',
                targetSelector: '[data-tour="motos"]',
                badge: 'Motos',
                icon: CubeIcon,
                title: 'Módulo de Motos Completo',
                description: 'Gestão de estoque físico, aprovação de solicitações e auditoria de chassis.',
            },
            {
                id: 'pecas',
                targetSelector: '[data-tour="pecas"]',
                badge: 'Peças',
                icon: WrenchScrewdriverIcon,
                title: 'Catálogo de Peças & SKUs',
                description: 'Mais de 2.380 SKUs sincronizados com o ERP Microwork, saldos por filial e triagem do Call Center.',
            },
            {
                id: 'logistica',
                targetSelector: '[data-tour="logistica"]',
                badge: 'Expedição',
                icon: TruckIcon,
                title: 'Módulo de Logística',
                description: 'Expedição, manifesto de transporte, conferência de carga e rotas Milk Run.',
            },
            {
                id: 'gestao',
                targetSelector: '[data-tour="gestao"]',
                badge: 'Governança',
                icon: UsersIcon,
                title: 'Gestão de Usuários & Parâmetros',
                description: 'Controle de permissões (Admin, Gestor, CD, Loja), filiais, auditoria e ativação de módulos opcionais.',
            },
            {
                id: 'perfil',
                targetSelector: '[data-tour="perfil"]',
                badge: 'Conta',
                icon: ShieldCheckIcon,
                title: 'Perfil & Sessão',
                description: 'Configurações de segurança e auditoria pessoal.',
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
            // Em telas móveis ou elementos ocultos, fica centralizado suavemente sem quebrar
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

    if (!isOpen) return null;

    const step = steps[currentStep];
    const Icon = step?.icon || SparklesIcon;
    const progress = Math.round(((currentStep + 1) / steps.length) * 100);

    return (
        <div className="fixed inset-0 z-modal select-none">
            {isWelcome ? (
                /* Modal de Acolhimento Padronizado V3 */
                <div className="fixed inset-0 flex items-center justify-center p-4 bg-content-primary/70 backdrop-blur-sm animate-fadeIn">
                    <div className="w-full max-w-lg overflow-hidden rounded-card bg-surface-card border border-line shadow-overlay relative">
                        <div className="h-1.5 bg-gradient-to-r from-brand-700 via-brand-500 to-brand-700" />

                        <div className="p-6 sm:p-8 space-y-5 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 shadow-inner">
                                <SparklesIcon className="w-7 h-7 text-brand-600 animate-pulse" />
                            </div>

                            <div className="space-y-1.5">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-black uppercase tracking-wider border border-brand-200">
                                    Perfil {perfil.toUpperCase()}
                                </span>
                                <h2 className="text-2xl font-black text-content-primary tracking-tight">
                                    Bem-vindo à Shineray V3
                                </h2>
                                <p className="text-sm text-content-secondary max-w-md mx-auto leading-relaxed">
                                    Vamos percorrer os recursos e fluxos operacionais preparados especificamente para o seu perfil.
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
                                    className="w-full sm:w-auto px-5 py-3 rounded-xl border border-line hover:bg-surface-sunken text-content-secondary font-bold text-sm transition cursor-pointer"
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
                    <div
                        className="absolute inset-0 bg-content-primary/65 backdrop-blur-[2px] transition-all duration-300"
                        onClick={handleNext}
                    />

                    {targetRect && (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none fixed rounded-xl ring-4 ring-brand-500 ring-offset-2 ring-offset-black/50 transition-all duration-300 shadow-2xl"
                            style={{
                                top: `${targetRect.top - 4}px`,
                                left: `${targetRect.left - 4}px`,
                                width: `${targetRect.width + 8}px`,
                                height: `${targetRect.height + 8}px`,
                            }}
                        />
                    )}

                    <div
                        className="fixed z-modal transition-all duration-300 p-4 w-[min(26rem,calc(100vw-2rem))]"
                        style={{
                            top: targetRect
                                ? `${Math.min(targetRect.bottom + 12, window.innerHeight - 340)}px`
                                : '50%',
                            left: targetRect
                                ? `${Math.min(Math.max(16, targetRect.left - 20), window.innerWidth - 430)}px`
                                : '50%',
                            transform: !targetRect ? 'translate(-50%, -50%)' : 'none',
                        }}
                    >
                        <div className="overflow-hidden rounded-card bg-surface-card border border-line shadow-overlay">
                            <div className="h-1 bg-surface-sunken w-full">
                                <div
                                    className="h-full bg-brand-600 transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>

                            <div className="p-5 space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-content-muted">
                                                {step.badge} · {currentStep + 1} de {steps.length}
                                            </span>
                                            <h3 className="text-base font-black text-content-primary leading-tight">
                                                {step.title}
                                            </h3>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleSkip}
                                        className="rounded-lg p-1 text-content-muted hover:bg-surface-sunken hover:text-content-primary transition cursor-pointer"
                                        title="Fechar tour"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>

                                <p className="text-sm text-content-secondary leading-relaxed">
                                    {step.description}
                                </p>

                                {step.tip && (
                                    <div className="bg-brand-50/70 border border-brand-200 rounded-xl p-3 flex items-start gap-2.5">
                                        <span className="text-sm shrink-0">💡</span>
                                        <div className="text-xs text-brand-950 font-medium leading-relaxed">
                                            {step.tip}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-2 border-t border-line flex items-center justify-between gap-3">
                                    <button
                                        type="button"
                                        onClick={handlePrev}
                                        disabled={currentStep === 0}
                                        className={`inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                                            currentStep === 0
                                                ? 'opacity-30 cursor-not-allowed text-content-muted'
                                                : 'hover:bg-surface-sunken text-content-secondary'
                                        }`}
                                    >
                                        <ArrowLeftIcon className="w-3.5 h-3.5" />
                                        <span>Voltar</span>
                                    </button>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleSkip}
                                            className="px-2.5 py-1.5 text-xs font-bold text-content-muted hover:text-content-primary cursor-pointer"
                                        >
                                            Sair
                                        </button>

                                        {currentStep < steps.length - 1 ? (
                                            <button
                                                type="button"
                                                onClick={handleNext}
                                                className="inline-flex items-center gap-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-sm transition cursor-pointer"
                                            >
                                                <span>Próximo</span>
                                                <ArrowRightIcon className="w-3.5 h-3.5" />
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleComplete}
                                                className="inline-flex items-center gap-1 rounded-lg bg-status-success-solid hover:brightness-95 text-white px-3.5 py-1.5 text-xs font-bold shadow-sm transition cursor-pointer"
                                            >
                                                <CheckCircleIcon className="w-4 h-4" />
                                                <span>Concluir</span>
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
}
