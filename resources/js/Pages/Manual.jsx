import { PageHeader } from '@/Components/UI';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { 
    BuildingStorefrontIcon, 
    ClipboardDocumentCheckIcon, 
    TruckIcon, 
    QuestionMarkCircleIcon, 
    ArchiveBoxIcon, 
    PhoneIcon,
    EnvelopeIcon,
    WrenchScrewdriverIcon,
    ShieldCheckIcon,
    SparklesIcon
} from '@heroicons/react/24/outline';

export default function Manual({ auth }) {
    const getPerfilInicial = () => {
        if (auth.user.perfil === 'gestor') return 'gestor';
        if (auth.user.perfil === 'cd') return 'cd';
        if (auth.user.perfil === 'admin') return 'faq';
        return 'loja';
    };

    const [activeTab, setActiveTab] = useState(getPerfilInicial());

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [activeTab]);

    const tabs = [
        { id: 'loja',   label: 'Lojas / Revenda',   color: 'brand',  icon: <BuildingStorefrontIcon className="w-5 h-5" />, desc: 'Motos, Pedidos e Recebimento' },
        { id: 'pecas',  label: 'Módulo de Peças',   color: 'amber',  icon: <WrenchScrewdriverIcon className="w-5 h-5" />, desc: 'Ciclo Completo, Gates 1 e 2 e Basquetas' },
        { id: 'gestor', label: 'Gestão Comercial',  color: 'purple', icon: <ClipboardDocumentCheckIcon className="w-5 h-5" />, desc: 'Aprovações e BI Executivo' },
        { id: 'cd',     label: 'Logística / CD',    color: 'blue',   icon: <TruckIcon className="w-5 h-5" />, desc: 'Expedição, Romaneios e Rotas' },
        { id: 'faq',    label: 'Suporte TI & FAQ',  color: 'emerald',icon: <QuestionMarkCircleIcon className="w-5 h-5" />, desc: 'Regras, Dúvidas e Contatos' },
    ];

    return (
        <>
            <Head title="Manual do Sistema — BySabel Logística" />
            
            <PageHeader
                title="Central de Conhecimento"
                description="Guia oficial de operação e fluxos de trabalho da plataforma BySabel Logística (BS Log)"
                breadcrumbs={[
                    { label: 'Início', href: route('dashboard') },
                    { label: 'Manual do Sistema' },
                ]}
            />

            {/* BANNER INTERATIVO: TOUR GUIADO */}
            <div className="mb-8 bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                
                <div className="space-y-1.5 relative z-10">
                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-black uppercase tracking-wider">
                        <span>✨</span> Apresentação Interativa
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                        Prefere uma apresentação guiada passo a passo?
                    </h3>
                    <p className="text-xs text-white/80 max-w-xl leading-relaxed">
                        Inicie o tour guiado do sistema para conhecer todas as abas, novas regras de motos e catálogo de peças liberados especificamente para o perfil <strong>{auth.user?.perfil?.toUpperCase()}</strong>.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('start-guided-tour'))}
                    className="shrink-0 inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-white hover:bg-white/95 text-brand-700 font-black text-sm shadow-xl active:scale-95 transition-all duration-200 cursor-pointer"
                >
                    <SparklesIcon className="w-5 h-5 text-brand-600 animate-pulse" />
                    <span>Fazer Tour Guiado</span>
                </button>
            </div>

            {/* BARRA DE ABAS COM DESIGN V3 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`p-4 rounded-2xl transition-all duration-300 shadow-sm flex flex-col items-start justify-between gap-3 border text-left relative overflow-hidden ${
                                isActive 
                                    ? 'bg-surface-card border-brand-600 shadow-md ring-2 ring-brand-600/10' 
                                    : 'bg-surface-card border-line text-content-muted hover:border-line-strong hover:bg-surface-sunken'
                            }`}
                        >
                            <div className="flex items-center justify-between w-full">
                                <span className={`p-2 rounded-xl ${isActive ? 'bg-brand-50 text-brand-600' : 'bg-surface-sunken text-content-muted'}`}>
                                    {tab.icon}
                                </span>
                                {isActive && (
                                    <span className="w-2 h-2 rounded-full bg-brand-600"></span>
                                )}
                            </div>
                            <div>
                                <div className={`font-black text-sm tracking-tight ${isActive ? 'text-content-primary' : 'text-content-secondary'}`}>
                                    {tab.label}
                                </div>
                                <div className="text-[11px] text-content-muted mt-0.5 line-clamp-1">
                                    {tab.desc}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* CONTEÚDO DA CENTRAL */}
            <div className="bg-surface-card overflow-hidden shadow-card rounded-2xl border border-line p-6 md:p-10 min-h-[600px]">
                
                {/* ==================== 1. ABA LOJA ==================== */}
                {activeTab === 'loja' && (
                    <div className="space-y-10 animate-fade-in">
                        <HeaderSection 
                            title="Manual da Loja (Pontos de Venda)" 
                            subtitle="Instruções para solicitação de motos, conferência de transferências e recebimento definitivo de carga."
                            tag="Perfil: Loja"
                        />
                        
                        <div className="bg-surface-card p-6 md:p-8 rounded-2xl border border-line shadow-sm space-y-8">
                            <h3 className="text-xl font-black text-content-primary border-b border-line pb-4 flex items-center gap-2">
                                <span>🏍️</span> Ciclo de Solicitação e Recebimento de Motos
                            </h3>
                            
                            <Step number="1" title="Criando a Solicitação de Motos">
                                <p>No menu lateral, acesse <strong>Motos ➔ Nova Solicitação</strong>. O preenchimento varia conforme a finalidade do pedido:</p>
                                
                                <div className="mt-4 space-y-3">
                                    {/* Caso 1: Estoque e Reposição */}
                                    <div className="bg-status-info-bg/50 border border-status-info-solid/30 rounded-2xl p-4 space-y-2">
                                        <div className="flex items-center gap-2 text-status-info-fg font-black text-sm uppercase">
                                            <span>📦</span> 1. Pedidos para Estoque e Reposição Regular (Giro ao CD)
                                        </div>
                                        <p className="text-sm text-content-secondary leading-relaxed">
                                            Preencha <strong>somente o Modelo, a Cor e a Quantidade</strong> desejada (ex: <em>5x SHI 175 EFI - Vermelha</em>).
                                        </p>
                                        <p className="text-xs text-status-info-fg font-medium">
                                            💡 <strong>Importante:</strong> Nestes pedidos de reposição ao CD, <u>não se preenche chassi</u>. A equipe de expedição do CD é quem define e vincula quais chassis físicos serão separados e despachados.
                                        </p>
                                    </div>

                                    {/* Caso 2: Venda Confirmada */}
                                    <div className="bg-status-success-bg/50 border border-status-success-solid/30 rounded-2xl p-4 space-y-2">
                                        <div className="flex items-center gap-2 text-status-success-fg font-black text-sm uppercase">
                                            <span>🎯</span> 2. Motos Já Vendidas (Motivo: "Venda Confirmada (Cliente)")
                                        </div>
                                        <p className="text-sm text-content-secondary leading-relaxed">
                                            Quando a moto já foi vendida na ponta para um cliente específico, selecione o motivo <strong>"Venda Confirmada (Cliente)"</strong> e informe <strong>todas as informações completas da moto, incluindo obrigatoriamente o Chassi</strong> (mínimo de 11 a 17 dígitos).
                                        </p>
                                        <p className="text-xs text-status-success-fg font-medium">
                                            🔒 Isso garante a reserva daquela unidade física exata no estoque central do CD.
                                        </p>
                                    </div>

                                    {/* Caso 3: Transferência entre Filiais */}
                                    <div className="bg-status-warning-bg/50 border border-status-warning-solid/30 rounded-2xl p-4 space-y-2">
                                        <div className="flex items-center gap-2 text-status-warning-fg font-black text-sm uppercase">
                                            <span>🔄</span> 3. Transferência entre Lojas & Devolução ao CD
                                        </div>
                                        <p className="text-sm text-content-secondary leading-relaxed">
                                            Em movimentações entre lojas ou devoluções à Matriz/CD, é exigido o preenchimento de <strong>todas as informações com o Chassi obrigatório</strong> de cada moto física, pois a unidade já existe fisicamente no pátio da loja cedente.
                                        </p>
                                    </div>
                                </div>
                            </Step>

                            <Step number="2" title="Acompanhamento e Análise do Gestor">
                                <p>Ao salvar, o pedido entra com o status <span className="text-brand-600 font-bold bg-brand-50 px-2 py-0.5 rounded border border-brand-200 text-xs">Em Análise</span>.</p>
                                <p className="mt-2 text-sm text-content-secondary">A Diretoria Comercial receberá notificação imediata para avaliar o crédito, viabilidade e autorizar o pedido.</p>
                            </Step>

                            <Step number="3" title="Separação de Motos Solicitadas de Sua Loja">
                                <p>Quando outra filial pedir uma moto que está na sua loja (transferência passiva), você receberá um alerta destacado no Dashboard:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-content-secondary">
                                    <li>Vá ao seu pátio físico e confirme a presença do chassi solicitado.</li>
                                    <li>Clique em <strong>Confirmar Separação</strong> para que a logística (CD) inclua a moto no cronograma de coleta.</li>
                                </ul>
                            </Step>

                            <Step number="4" title="Trânsito, Rota em Tempo Real & WhatsApp do Motorista">
                                <p>Assim que o caminhão for carregado e a equipe do CD liberar a saída de portaria, o status muda para <span className="text-status-warning-fg font-bold bg-status-warning-bg px-2 py-0.5 rounded border border-status-warning-solid/30 text-xs">Em Trânsito</span>.</p>
                                <div className="mt-3 space-y-2">
                                    <p className="text-sm text-content-secondary">
                                        Na tela de detalhes do pedido, a filial conta com recursos dedicados de acompanhamento:
                                    </p>
                                    <ul className="list-disc ml-6 space-y-1 text-sm text-content-secondary">
                                        <li><strong>Linha do Tempo de Paradas:</strong> Visualize o trajeto sequencial do caminhão com a tag <em>📍 Sua Loja</em> destacando a ordem exata em que sua mercadoria será entregue.</li>
                                        <li><strong>Botão de WhatsApp do Motorista:</strong> Abra um diálogo direto no WhatsApp em 1 clique (<code>wa.me</code>) já com mensagem pré-formatada contendo o número do romaneio e a placa do caminhão.</li>
                                    </ul>
                                </div>
                            </Step>

                            <Step number="5" title="Recebimento Rápido '100% Conforme' (Modal Nativo V3)">
                                <p className="font-bold text-content-primary mb-2">Quando o caminhão descarregar na sua concessionária:</p>
                                <ol className="list-decimal ml-6 mt-2 space-y-2 text-sm text-content-secondary">
                                    <li>Abra o pedido e clique no botão verde <strong>Conferir e Finalizar</strong>.</li>
                                    <li><strong>Fluxo Ágil (Padrão Conforme):</strong> O novo modal nativo da V3 já carrega todas as motos marcadas como <em>100% conferidas e em perfeito estado</em>. Se tudo estiver correto, você não precisa clicar em unidade por unidade.</li>
                                    <li><strong>Foto do Canhoto / Documento:</strong> Tire uma foto direta pelo celular (suporte automático a <code>câmera traseira</code>) ou anexe o arquivo. O modal exibe preview instantâneo e botão de remoção para correções rápidas.</li>
                                    <li><strong>Tratamento de Exceções (Avarias):</strong> Somente se alguma moto tiver dano de transporte (ex: risco na carenagem, espelho quebrado), desmarque a chave daquela unidade. Uma gaveta retrátil se abrirá para descrever o dano.</li>
                                    <li>Clique em <strong>Confirmar e Finalizar Recebimento</strong>. As motos passam para <strong>Concluído</strong> e são integradas imediatamente ao estoque da loja em menos de 45 segundos!</li>
                                </ol>
                                <div className="mt-4 bg-status-warning-bg border border-status-warning-solid/30 rounded-xl p-4">
                                    <p className="text-xs font-bold text-status-warning-fg uppercase mb-1">🔒 Bloqueio Automático em Trânsito</p>
                                    <p className="text-sm text-status-warning-fg">Se a loja mantiver pedidos "Em Trânsito" pendentes de finalização após a entrega física, novas solicitações serão temporariamente bloqueadas até o upload do comprovante de entrega.</p>
                                </div>
                            </Step>

                            <Step number="6" title="Censo e Auditoria de Estoque de Pátio com Bipagem Contínua">
                                <p className="font-bold text-content-primary mb-2">Inventário instantâneo de pátio com latência zero (Menu: Motos ➔ Censo de Pátio):</p>
                                <p className="text-sm text-content-secondary leading-relaxed">
                                    Acesse o botão <strong>Censo de Pátio</strong> no topo da listagem de motos para realizar contagens físicas de estoque sem papel nem prancheta:
                                </p>
                                <ul className="list-disc ml-6 mt-2 space-y-1.5 text-sm text-content-secondary">
                                    <li><strong>Leitor de Código de Barras / Câmera:</strong> Mantenha o foco no campo de chassi e bipe sucessivamente. O sistema processa tudo no navegador sem travar, mesmo em áreas do pátio com internet lenta.</li>
                                    <li><strong>Feedback Sonoro Diferenciado:</strong> Bip agudo confirma a moto esperada; tom grave alerta duplicatas já bipadas; sinal sonoro duplo adverte sobre <strong>Motos Intrusas</strong> (veículos de outras filiais descarregados por equívoco).</li>
                                    <li><strong>Abas de Auditoria:</strong> Acompanhe os totais de <em>Confirmadas</em>, <em>Faltantes</em> e <em>Intrusas</em> em tempo real.</li>
                                    <li><strong>Relatório Oficial de Auditoria:</strong> Clique em <strong>Imprimir Relatório</strong> para gerar a ata formal de censo com data, hora e assinatura do auditor de pátio.</li>
                                </ul>
                            </Step>
                        </div>
                    </div>
                )}

                {/* ==================== 2. ABA PEÇAS ==================== */}
                {activeTab === 'pecas' && (
                    <div className="space-y-10 animate-fade-in">
                        <HeaderSection 
                            title="Módulo de Peças & Acessórios (V3.3)" 
                            subtitle="Ciclo completo de ponta a ponta: do catálogo à loja, passando por Triagem, Gate 1, Basquetas, Faturamento, Gate 2 e Ledger contábil."
                            tag="Novo Fluxo Integrado v3.3"
                        />

                        {/* VISÃO GERAL DIDÁTICA DO CICLO DE PEÇAS */}
                        <div className="bg-surface-card p-6 md:p-8 rounded-2xl border border-line shadow-sm space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
                                <div>
                                    <h3 className="text-xl font-black text-content-primary flex items-center gap-2">
                                        <span>⚙️</span> Mapa do Fluxo de Peças (Ciclo em 6 Etapas)
                                    </h3>
                                    <p className="text-xs text-content-muted mt-0.5">
                                        Entenda cada etapa do ciclo de reposição de peças e os atores responsáveis por cada ação
                                    </p>
                                </div>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200">
                                    <SparklesIcon className="w-3.5 h-3.5" /> Arquitetura V3.3
                                </span>
                            </div>

                            {/* GRID RESUMO DOS PASSOS */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div className="p-4 rounded-xl bg-surface-sunken border border-line space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-brand-600 bg-brand-50 px-2 py-0.5 rounded">Etapa 1</span>
                                        <span className="text-[10px] font-bold text-content-muted">Ator: Loja</span>
                                    </div>
                                    <h4 className="font-bold text-sm text-content-primary">Solicitação no Catálogo</h4>
                                    <p className="text-xs text-content-secondary leading-relaxed">
                                        A loja pesquisa SKUs por família de moto, verifica saldos no botão "Onde Encontrar" e envia o carrinho.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-surface-sunken border border-line space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-status-warning-fg bg-status-warning-bg px-2 py-0.5 rounded">Etapa 2</span>
                                        <span className="text-[10px] font-bold text-content-muted">Ator: Pós-Venda</span>
                                    </div>
                                    <h4 className="font-bold text-sm text-content-primary">Gate 1: Liberação Técnica</h4>
                                    <p className="text-xs text-content-secondary leading-relaxed">
                                        Após triagem de itens sem código, o Pós-Venda analisa a garantia e aprova tecnicamente os itens para o CD.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-surface-sunken border border-line space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-status-info-fg bg-status-info-bg px-2 py-0.5 rounded">Etapa 3</span>
                                        <span className="text-[10px] font-bold text-content-muted">Ator: Estoque CD</span>
                                    </div>
                                    <h4 className="font-bold text-sm text-content-primary">Separação na Basqueta</h4>
                                    <p className="text-xs text-content-secondary leading-relaxed">
                                        O galpão localiza as peças físicas e insere na basqueta da filial, gerando reserva contábil no sistema.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-surface-sunken border border-line space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded">Etapa 4</span>
                                        <span className="text-[10px] font-bold text-content-muted">Ator: CD / Faturamento</span>
                                    </div>
                                    <h4 className="font-bold text-sm text-content-primary">Faturamento da Basqueta</h4>
                                    <p className="text-xs text-content-secondary leading-relaxed">
                                        O CD emite a NF-e oficial no ERP Microwork, vincula a chave de acesso e total de volumes na basqueta.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-surface-sunken border border-line space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Etapa 5</span>
                                        <span className="text-[10px] font-bold text-content-muted">Ator: Loja Destino</span>
                                    </div>
                                    <h4 className="font-bold text-sm text-content-primary">Gate 2: Conferência Romaneio</h4>
                                    <p className="text-xs text-content-secondary leading-relaxed">
                                        A loja confere os itens faturados no romaneio digital e anexa a foto do canhoto assinado para liberar embarque.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-surface-sunken border border-line space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black uppercase tracking-wider text-status-success-fg bg-status-success-bg px-2 py-0.5 rounded">Etapa 6</span>
                                        <span className="text-[10px] font-bold text-content-muted">Ator: Logística & Loja</span>
                                    </div>
                                    <h4 className="font-bold text-sm text-content-primary">Carga Mista & Ledger</h4>
                                    <p className="text-xs text-content-secondary leading-relaxed">
                                        A basqueta embarca no caminhão com as motos e, no destino, o recebimento alimenta o livro-razão contábil.
                                    </p>
                                </div>
                            </div>

                            {/* CALLOUTS: CONCEITOS-CHAVE */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <ArchiveBoxIcon className="w-5 h-5 text-brand-600" />
                                        <p className="text-xs font-black uppercase tracking-wider text-brand-900">📦 O que é a Basqueta de Peças?</p>
                                    </div>
                                    <p className="text-xs text-brand-800 leading-relaxed">
                                        Diferente de motos (onde cada veículo é rastreado unitariamente por chassi), peças são fungíveis e acondicionadas em caixas de transporte chamadas <strong>Basquetas</strong>. Cada filial possui sua basqueta aberta no CD. Múltiplos pedidos da mesma filial são agrupados na mesma basqueta até o faturamento unificado.
                                    </p>
                                </div>

                                <div className="bg-status-info-bg border border-status-info-solid/30 rounded-xl p-4 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheckIcon className="w-5 h-5 text-status-info-fg" />
                                        <p className="text-xs font-black uppercase tracking-wider text-status-info-fg">🛡️ Por que Peças não passam pelo Gestor?</p>
                                    </div>
                                    <p className="text-xs text-status-info-fg leading-relaxed">
                                        Motos exigem aprovação comercial do Gestor para controle de cotas de faturamento e limites de crédito. Peças são insumos de oficina e reposição técnica: seu controle reside na validação técnica de garantia (<strong>Gate 1</strong>) e na conferência fiscal e documental (<strong>Gate 2</strong>).
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* PASSO A PASSO OPERACIONAL COMPLETO */}
                        <div className="bg-surface-card p-6 md:p-8 rounded-2xl border border-line shadow-sm space-y-8">
                            <h3 className="text-xl font-black text-content-primary border-b border-line pb-4 flex items-center gap-2">
                                <span>📋</span> Guia Operacional Passo a Passo
                            </h3>

                            <Step number="1" title="Catálogo Inteligente, Kits de Revisão & Reposição Rápida (Loja)">
                                <p>Acesse <strong>Peças ➔ Solicitar Peças</strong> ou <strong>Peças ➔ Estoque</strong> para montar seu carrinho com os mais de 2.380 SKUs homologados:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1.5 text-sm text-content-secondary">
                                    <li><strong>Kits de Revisão Periódica (1 Clique):</strong> Para agilizar o atendimento da oficina, o topo da tela exibe 4 pacotes pré-montados (<em>Revisão Essencial 1k/3k</em>, <em>Revisão Intermediária 6k</em>, <em>Kit Transmissão & Relação</em> e <em>Kit Frenagem Segura</em>). O sistema localiza automaticamente os SKUs compatíveis e adiciona todos ao carrinho de uma só vez.</li>
                                    <li><strong>Seção "Pedir Novamente" (Itens Recorrentes):</strong> Baseada no histórico dos últimos 90 dias da sua filial, lista os 8 produtos de maior giro para reposição expressa em 1 clique (óleo, velas, pastilhas, lâmpadas).</li>
                                    <li><strong>Filtro por Família:</strong> Localize peças compatíveis com JET 50, JEF 150, SHI 175, STORM 200, FLASH 120 e outros modelos.</li>
                                    <li><strong>Botão 'Onde Encontrar':</strong> Consulta em tempo real o saldo físico e disponível no ERP Microwork em todas as filiais (CD Matriz, Ananindeua, Capanema, Castanhal, etc.).</li>
                                    <li><strong>Itens sem Código:</strong> Se precisar de uma peça de balcão ainda não cadastrada, use a opção "Solicitar sem código" com foto e descrição da peça avulsa.</li>
                                    <li><strong>Carrinho & Urgência:</strong> Preencha as quantidades e marque se o pedido é emergencial (cliente em box ou garantia expressa).</li>
                                </ul>
                            </Step>

                            <Step number="2" title="Triagem Técnica de Itens de Balcão (Call Center / CD)">
                                <p>Quando a loja solicita peças sem código de catálogo, o pedido entra na fila de <strong>Triagem</strong> (<em>Peças ➔ Atendimento</em>):</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-content-secondary">
                                    <li>O operador do CD consulta o catálogo e-Part da montadora a partir da descrição e foto informada pela loja.</li>
                                    <li>Vincula o SKU oficial do sistema e o custo de reposição da peça.</li>
                                    <li>Ao concluir a identificação de todos os itens, o pedido é despachado automaticamente para a fila do Gate 1.</li>
                                </ul>
                            </Step>

                            <Step number="3" title="Gate 1: Liberação Técnica pelo Pós-Venda">
                                <p>Na aba <strong>Aprovações</strong> de <em>Peças ➔ Atendimento</em>, o responsável técnico analisa a solicitação:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-content-secondary">
                                    <li>Valida os itens solicitados, quantidades e custos previstos.</li>
                                    <li>Possui autonomia para aprovar o pedido integralmente ou realizar cortes/recusas parciais de itens com justificativa.</li>
                                    <li><strong>Trava de Segurança:</strong> O armazém do CD fica completamente impedido de separar peças de um pedido que ainda não foi liberado no Gate 1.</li>
                                </ul>
                            </Step>

                            <Step number="4" title="Separação Física e Alocação na Basqueta (Estoque CD)">
                                <p>Após a liberação no Gate 1, o pedido fica disponível para separação pelo armazém do CD:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-content-secondary">
                                    <li>O operador acessa a tela do pedido e digita as quantidades físicas localizadas nas prateleiras.</li>
                                    <li>O sistema desconta do saldo disponível e aloca as peças na <strong>Basqueta aberta</strong> da filial destino.</li>
                                    <li>Quando 100% dos itens forem separados, o formulário de separação é automaticamente desabilitado, evitando erros de "nenhum item informado".</li>
                                    <li>O pedido permanece em status <code>separado</code> aguardando o faturamento da basqueta.</li>
                                </ul>
                            </Step>

                            <Step number="5" title="Faturamento da Basqueta no ERP Microwork (CD)">
                                <p>Na tela <strong>Peças ➔ Basquetas</strong>, o CD realiza o fechamento dos volumes da filial:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-content-secondary">
                                    <li>Gera a Nota Fiscal oficial de remessa no ERP Microwork.</li>
                                    <li>Clica em <strong>Faturar Basqueta</strong> e preenche: <em>Número da Nota Fiscal</em>, <em>Chave de Acesso (44 dígitos)</em> e <em>Total de Volumes/Caixas</em>.</li>
                                    <li>A basqueta ganha o status <code>faturada</code> e libera o link do Romaneio de Peças para conferência.</li>
                                </ul>
                            </Step>

                            <Step number="6" title="Gate 2: Conferência de Romaneio e Canhoto Digital (Loja Destino)">
                                <p>Antes que a basqueta possa ser embarcada no caminhão, a loja destino deve validar o romaneio:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-content-secondary">
                                    <li>A filial clica no botão <strong>Conferir Romaneio (Gate 2)</strong> presente no pedido ou no card da basqueta.</li>
                                    <li>Verifica a listagem de peças faturadas e anexa a foto do canhoto assinado ou comprovante de romaneio.</li>
                                    <li><strong>Compressão Inteligente:</strong> O sistema realiza compressão automática da foto no próprio navegador antes do envio, funcionando com fotos de alta resolução mesmo em 4G/redes instáveis.</li>
                                    <li>Após a validação, a basqueta adquire status <code>liberada</code>, ficando apta para embarque físico.</li>
                                </ul>
                            </Step>

                            <Step number="7" title="Embarque em Cargas Mistas e Início de Trânsito (Logística CD)">
                                <p>No menu <strong>Logística ➔ Expedição</strong>, o CD monta o romaneio de transporte:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-content-secondary">
                                    <li>O sistema suporta <strong>cargas mistas</strong>: selecione as motos a transportar e marque as basquetas de peças liberadas no mesmo manifesto.</li>
                                    <li>Atribui motorista, placa do caminhão e rota programada.</li>
                                    <li>Ao clicar em <strong>Aprovar Saída</strong>, tanto as motos quanto as basquetas entram simultaneamente em status <code>em_transito</code>.</li>
                                </ul>
                            </Step>

                            <Step number="8" title="Recebimento Físico e Livro-Razão Contábil / Ledger (Loja)">
                                <p>Ao descarregar a carga na filial, o responsável realiza o recebimento no sistema:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-content-secondary">
                                    <li>Clica em <strong>Receber Basqueta</strong> após conferência física dos volumes e lacres.</li>
                                    <li>O sistema executa a liquidação contábil atômica: baixa o saldo do CD e credita o inventário da filial.</li>
                                    <li>Cada unidade recebida é registrada no <strong>Livro-Razão (Ledger de Peças)</strong>, com rastreabilidade completa para inventários e auditorias.</li>
                                </ul>
                            </Step>
                        </div>

                        {/* FAQ DEDICADO DE PEÇAS */}
                        <div className="bg-surface-card p-6 md:p-8 rounded-2xl border border-line shadow-sm space-y-4">
                            <h3 className="text-xl font-black text-content-primary border-b border-line pb-4 flex items-center gap-2">
                                <span>❓</span> Perguntas Frequentes do Módulo de Peças
                            </h3>

                            <div className="grid gap-3 pt-2">
                                <FaqItem question="Separei 100% das peças do pedido, mas o status continua 'separado'. O que fazer?">
                                    Isso é o comportamento correto do sistema! No fluxo de peças, o pedido permanece como <strong>separado</strong> enquanto as peças aguardam na basqueta da filial. O próximo passo é o CD emitir a NF no ERP Microwork e faturar a basqueta em <em>Peças ➔ Basquetas</em>. Logo em seguida, a loja confere o romaneio e anexa o canhoto (Gate 2).
                                </FaqItem>

                                <FaqItem question="Por que o Gestor Comercial não tem botão de aprovação para peças?">
                                    Motos exigem validação comercial para controle de limites financeiros e cotas de faturamento. Peças são materiais de oficina e garantia: a aprovação técnica é feita exclusivamente pelo responsável do <strong>Pós-Venda (Gate 1)</strong> no painel de Atendimento de Peças.
                                </FaqItem>

                                <FaqItem question="Como funciona a separação parcial se o CD não tiver todas as peças?">
                                    O operador de estoque do CD separa as quantidades disponíveis no momento e confirma. As peças separadas vão para a basqueta e podem seguir viagem normalmente. O saldo não atendido continua registrado como pendente no pedido até a chegada de novo lote ou encerramento formal.
                                </FaqItem>

                                <FaqItem question="A foto do romaneio de peças falhou no upload. O que fazer?">
                                    O sistema inclui compressão automática via Javascript antes do upload, aceitando fotos de câmeras modernas em JPG, PNG e WEBP. Se o upload falhar, verifique se a conexão com a internet está estável ou tire um print da foto na galeria do aparelho para reduzir ainda mais o tamanho do arquivo.
                                </FaqItem>

                                <FaqItem question="O que acontece se uma carga com basquetas de peças for desfeita pelo CD?">
                                    O sistema possui proteção de integridade: caso um romaneio de carga mista seja desfeito antes da saída, as basquetas de peças retornam automaticamente ao status liberado no galpão, preservando as notas fiscais e permitindo reagendamento em outra viagem sem perda de dados.
                                </FaqItem>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== 3. ABA GESTOR ==================== */}
                {activeTab === 'gestor' && (
                    <div className="space-y-10 animate-fade-in">
                        <HeaderSection 
                            title="Manual da Gestão Comercial & Diretoria" 
                            subtitle="Aprovações táticas, controle de crédito, auditoria de estornos e BI Executivo."
                            tag="Perfil: Gestor / Diretoria"
                        />

                        <div className="bg-surface-card p-6 md:p-8 rounded-2xl border border-line shadow-sm space-y-8">
                            <h3 className="text-xl font-black text-content-primary border-b border-line pb-4 flex items-center gap-2">
                                <span>🛡️</span> Governança Comercial e Aprovações
                            </h3>

                            <Step number="1" title="Aprovação e Cortes Parciais de Pedidos">
                                <ul className="list-disc ml-6 mt-2 space-y-2 text-sm text-content-secondary">
                                    <li><strong>Aprovação Total:</strong> Autoriza o pedido completo para o CD iniciar a separação.</li>
                                    <li><strong>Cortes Parciais:</strong> Se a loja solicitou 5 motos mas o crédito ou cota comporta apenas 3, o gestor pode ajustar quantidades ou reprovar itens específicos antes de aprovar.</li>
                                    <li><strong>Rejeição:</strong> Cancela o pedido com justificativa registrada no log de auditoria.</li>
                                </ul>
                            </Step>

                            <Step number="2" title="Distinção: Liberação Web vs Faturamento ERP">
                                <div className="bg-brand-50 border border-brand-600/20 rounded-xl p-4">
                                    <p className="text-sm text-brand-900 font-bold mb-1">📌 Regra Contábil Importante:</p>
                                    <p className="text-sm text-brand-800">A aprovação no sistema web autoriza a <em>separação e montagem de carga</em> pela logística. O faturamento e emissão da NF-e oficial devem ser executados no sistema Microwork antes da liberação do caminhão.</p>
                                </div>
                            </Step>

                            <Step number="3" title="BI Executivo e Indicadores de Desempenho (SLA)">
                                <p>No menu <strong>BI Logística</strong>, a diretoria visualiza métricas em tempo real:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-content-secondary">
                                    <li>Lead Time total por etapa (Análise ➔ Separação ➔ Expedição ➔ Trânsito ➔ Entrega).</li>
                                    <li>Ranking das 10 lojas com maior volume de solicitações.</li>
                                    <li>Taxa de sucesso e percentual de devoluções por filial.</li>
                                </ul>
                            </Step>
                        </div>
                    </div>
                )}

                {/* ==================== 4. ABA CD / LOGÍSTICA ==================== */}
                {activeTab === 'cd' && (
                    <div className="space-y-10 animate-fade-in">
                        <HeaderSection 
                            title="Manual da Operação CD (Expedição e Pátio)" 
                            subtitle="Separação de chassis, agendamento no Calendário, montagem de Romaneios e manifesto de carga."
                            tag="Perfil: CD / Operação"
                        />

                        <div className="bg-surface-card p-6 md:p-8 rounded-2xl border border-line shadow-sm space-y-8">
                            <h3 className="text-xl font-black text-content-primary border-b border-line pb-4 flex items-center gap-2">
                                <span>🚚</span> Fluxo Físico da Expedição
                            </h3>

                            <Step number="1" title="Separação de Pedidos no Pátio">
                                <p>Assim que o Gestor aprova, o pedido entra como <span className="text-status-success-fg font-bold bg-status-success-bg px-2 py-0.5 rounded text-xs">Solicitado</span>. Nos pedidos de estoque, a equipe do CD vincula os chassis físicos do pátio e clica em <strong>Separar</strong> para liberar as unidades para o pool de montagem de carga.</p>
                            </Step>

                            <Step number="2" title="Planejamento no Calendário de Rotas">
                                <p>No módulo de <strong>Calendário</strong>, o CD agenda as viagens da semana:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-content-secondary">
                                    <li><span className="font-bold text-status-warning-fg">Amarelo (Planejado):</span> Prévia interna. Os pedidos recebem data estimada.</li>
                                    <li><span className="font-bold text-status-success-fg">Verde (Confirmado):</span> Viagem oficializada com rota consolidada.</li>
                                </ul>
                            </Step>

                            <Step number="3" title="Montagem de Romaneio de Carga, Termômetro de Ocupação & Estivagem LIFO">
                                <p>Acesse <strong>Logística ➔ Expedição ➔ Novo Romaneio</strong>:</p>
                                <ol className="list-decimal ml-6 mt-2 space-y-2.5 text-sm text-content-secondary">
                                    <li><strong>Configuração do Veículo e Motorista:</strong> Informe o nome do motorista, a placa do veículo e o <strong>Telefone de WhatsApp</strong> (para permitir contato das filiais). Selecione o tipo de veículo da frota (<em>Furgão [4], 3/4 [16], Toco [22], Truck [30], Carreta [60]</em> ou defina uma capacidade personalizada).</li>
                                    <li><strong>Termômetro Visual de Ocupação:</strong> À medida que você adiciona motos e basquetas, o termômetro calcula a cubagem em tempo real (1 moto = 1 un; cada 2 basquetas de peças = 0.5 moto equivalente). A barra fica <span className="text-status-success-fg font-bold">verde até 90%</span>, <span className="text-status-warning-fg font-bold">âmbar até 100%</span> e <span className="text-status-danger-fg font-bold">vermelha pulsante se houver sobrecarga</span>.</li>
                                    <li><strong>Sequenciamento LIFO (Estivagem Inversa):</strong> Ordene as paradas da viagem (1ª Parada $\rightarrow$ 2ª Parada $\rightarrow$ ...). A interface informa a <strong>ordem física de estivagem na doca</strong>: o fundo do baú recebe a última parada da rota, enquanto a 1ª parada fica junto à porta traseira, garantindo descarga imediata sem retrabalho.</li>
                                    <li><strong>Carga Mista:</strong> Selecione as motos liberadas e marque as basquetas de peças faturadas. O sistema unifica ambos no manifesto.</li>
                                    <li>Clique em <strong>Salvar e Gerar Carga</strong> para emitir o Manifesto de Transporte em PDF.</li>
                                </ol>
                            </Step>

                            <Step number="4" title="Saída do Galpão e Coleta Milk Run">
                                <p>Após o carregamento e conferência dos papéis, clique em <strong>Aprovar Saída</strong>. Todos os pedidos da carga entram simultaneamente em <strong>Em Trânsito</strong>.</p>
                                <p className="mt-2 text-sm text-content-secondary">Se a rota incluir coletas em lojas do interior (*Milk Run*), o operador confirma a coleta na tela da carga assim que o motorista embarcar a moto.</p>
                            </Step>

                            <Step number="5" title="Censo e Auditoria Periódica do Pátio do CD Matriz">
                                <p>No menu <strong>Motos ➔ Censo de Pátio</strong>, a equipe do CD audita centenas de chassis com alta velocidade:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-content-secondary">
                                    <li><strong>Bipagem em Massa:</strong> Bipagem direta sem latência de rede. A cada leitura de chassi, o sistema emite bips sonoros e atualiza o painel instantaneamente.</li>
                                    <li><strong>Controle de Divergências:</strong> Identifique na hora veículos com status divergente, chassis faltantes no lote de expedição ou unidades não registradas no pátio.</li>
                                    <li><strong>Exportação:</strong> Emita a ata oficial de auditoria para o fechamento mensal de inventário.</li>
                                </ul>
                            </Step>
                        </div>
                    </div>
                )}

                {/* ==================== 5. ABA FAQ & SUPORTE ==================== */}
                {activeTab === 'faq' && (
                    <div className="space-y-8 animate-fade-in">
                        <HeaderSection 
                            title="Suporte Técnico TI & Perguntas Frequentes" 
                            subtitle="Dúvidas comuns, regras de negócio e contatos do suporte corporativo."
                            tag="Ajuda & TI"
                        />

                        <div className="grid gap-3">
                            <FaqItem question="O que é o Recebimento Rápido 100% Conforme nas concessionárias?">
                                É o fluxo simplificado em modal nativo V3 onde mais de 95% das entregas chegam em perfeito estado. O sistema já abre com todas as unidades dadas como conferidas. Basta acionar a câmera do celular para fotografar o canhoto assinado e confirmar. O registro detalhado de avarias só é preenchido como exceção ao desmarcar a moto afetada.
                            </FaqItem>

                            <FaqItem question="Como funciona o Censo de Pátio com leitor de código de barras e bipes sonoros?">
                                Em <em>Motos ➔ Censo de Pátio</em>, o auditor usa o leitor de código de barras ou a câmera sem tocar no teclado. Toda a validação ocorre instantaneamente no navegador com latência zero: bipes agudos para acerto, graves para duplicata e sinal duplo para moto intrusa. No fim, gera-se uma ata de conferência com data e hora pronta para impressão.
                            </FaqItem>

                            <FaqItem question="O que significa uma moto marcada como 'Intrusa' no Censo de Pátio?">
                                Uma moto é classificada como <strong>Intrusa</strong> quando seu chassi físico foi bipado no pátio da sua loja, mas no sistema ela pertence ao estoque de outra filial ou do CD Matriz. Isso indica que a transportadora descarregou o veículo na loja errada durante a rota.
                            </FaqItem>

                            <FaqItem question="Como funciona o Termômetro de Ocupação da Carga e a cubagem de basquetas de peças?">
                                O expedidor escolhe o porte do veículo (Furgão, 3/4, Toco, Truck ou Carreta) e o termômetro calcula a cubagem mista em tempo real: cada moto ocupa 1 unidade de vaga e cada 2 basquetas plásticas de peças equivalem ao espaço volumétrico de 0.5 moto. Se a carga exceder a capacidade nominal, o termômetro pulsa em vermelho alertando sobrecarga física.
                            </FaqItem>

                            <FaqItem question="O que é o Sequenciamento LIFO na montagem de carga?">
                                LIFO significa <em>Last In, First Out</em> (Último a Entrar, Primeiro a Sair). Em rotas com paradas múltiplas, as motos da última parada devem ser carregadas no fundo do caminhão (primeiras a entrar), enquanto as motos da 1ª parada ficam junto à porta traseira (últimas a entrar e primeiras a sair), evitando que o motorista tenha que descarregar motos alheias na doca.
                            </FaqItem>

                            <FaqItem question="Como usar os Kits de Revisão Periódica e a lista 'Pedir Novamente' no módulo de peças?">
                                Na tela de <em>Solicitar Peças</em>, o topo da página oferece 4 kits prontos para revisões de oficina (1k/3k, 6k, transmissão e freios) que adicionam os SKUs ideais em 1 clique. Além disso, a seção 'Pedir Novamente' lista os 8 produtos mais comprados pela sua filial nos últimos 90 dias para reposição instantânea.
                            </FaqItem>

                            <FaqItem question="Como entrar em contato com o motorista que transporta meu pedido?">
                                Na tela de acompanhamento do pedido em trânsito, a filial visualiza o card do romaneio com a Timeline de Paradas e um botão direto de WhatsApp. Um toque abre a conversa no WhatsApp oficial do motorista com o número da carga e a placa do caminhão já preenchidos.
                            </FaqItem>

                            <FaqItem question="Por que o sistema bloqueia novas solicitações para minha loja?">
                                O sistema possui trava de conformidade: se houver pedidos com status <strong>Em Trânsito</strong> já descarregados na sua loja que não tiveram o comprovante finalizado, o sistema bloqueia novos pedidos até a conclusão do upload da foto do canhoto assinado.
                            </FaqItem>

                            <FaqItem question="Como funciona a entrega parcial de um pedido?">
                                Se o CD enviar apenas parte das motos de um pedido no caminhão de hoje, a loja só finalizará o recebimento quando 100% da carga for despachada e entregue. As motos restantes continuam programadas para a próxima rota.
                            </FaqItem>

                            <FaqItem question="Quem pode cadastrar e editar usuários no sistema?">
                                Por determinação de segurança na versão 3.0, a <strong>Gestão de Acessos</strong> (`/usuarios`) é de uso restrito do perfil <strong>Administrador</strong>. Gestores, CD e Lojas não possuem acesso às telas de cadastro de login.
                            </FaqItem>

                            <FaqItem question="O que fazer se a foto do comprovante der erro no envio?">
                                Câmeras de celulares modernos geram imagens pesadas. O sistema realiza compressão automática. Caso sua conexão esteja instável ou o aparelho trave, tire um print da foto na galeria do celular e envie o print, que possui tamanho reduzido.
                            </FaqItem>

                            <FaqItem question="Qual a diferença entre a aprovação de pedidos de Motos e de Peças?">
                                Pedidos de <strong>Motos</strong> nascem em análise e exigem autorização comercial do <strong>Gestor</strong> (limite financeiro e cota da loja) antes da vinculação de chassis. Pedidos de <strong>Peças</strong> são insumos técnicos de oficina/garantia: a validação é exclusivamente técnica pelo <strong>Pós-Venda (Gate 1)</strong> e fiscal/documental pela loja no romaneio (<strong>Gate 2</strong>), não passando pela mesa comercial do gestor.
                            </FaqItem>

                            <FaqItem question="Separei todas as peças de um pedido, por que o status continua 'separado'?">
                                No fluxo de peças, o pedido permanece com status <strong>separado</strong> enquanto os itens aguardam na Basqueta da filial. O próximo passo é o CD emitir a Nota Fiscal no ERP e faturar a basqueta em <em>Peças ➔ Basquetas</em>. Logo em seguida, a loja valida o romaneio e anexa o canhoto assinado (Gate 2) para liberar o embarque no caminhão.
                            </FaqItem>

                            <FaqItem question="Qual a diferença entre Capital e Interior no roteamento?">
                                Lojas marcadas como <strong>Capital</strong> operam fluxo direto entre filiais. Lojas marcadas como <strong>Interior</strong> realizam transbordo e consolidação obrigatórios via Centro de Distribuição (CD Matriz).
                            </FaqItem>
                        </div>

                        {/* CONTATO TI */}
                        <div className="mt-8 pt-8 border-t border-line">
                            <div className="bg-surface-inverted text-white p-8 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-8">
                                <div>
                                    <h4 className="text-xl font-bold flex items-center gap-2">
                                        <WrenchScrewdriverIcon className="w-6 h-6 text-brand-500" /> Suporte Corporativo TI
                                    </h4>
                                    <p className="text-content-muted mt-1 text-sm">Plantão técnico para desbloqueios de carga, senhas e dúvidas.</p>
                                    
                                    <div className="mt-4 flex flex-wrap gap-4">
                                        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl text-sm font-bold">
                                            <PhoneIcon className="w-5 h-5 text-status-success-fg" /> (91) 98492-8535
                                        </div>
                                        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl text-sm font-bold">
                                            <EnvelopeIcon className="w-5 h-5 text-status-info-fg" /> ti@shineraybysabel.com.br
                                        </div>
                                    </div>
                                </div>

                                <div className="text-center md:text-right border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-8">
                                    <p className="text-[10px] uppercase tracking-widest text-content-muted font-bold">Desenvolvimento & Arquitetura</p>
                                    <h5 className="text-lg font-black text-white mt-1">Délcio Farias Dias Neto</h5>
                                    <p className="text-content-muted text-xs">BySabel Logística • BS Log v3.0</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </>
    );
}

// --- SUB-COMPONENTES AUXILIARES ---

function HeaderSection({ title, subtitle, tag }) {
    return (
        <div className="border-l-4 border-brand-600 pl-4 py-1">
            {tag && (
                <span className="inline-block text-[10px] font-black uppercase tracking-wider text-brand-600 bg-brand-50 px-2 py-0.5 rounded mb-1">
                    {tag}
                </span>
            )}
            <h2 className="text-2xl md:text-3xl font-black text-content-primary tracking-tight">{title}</h2>
            <p className="text-content-secondary text-sm mt-1">{subtitle}</p>
        </div>
    );
}

function Step({ number, title, children }) {
    return (
        <div className="flex gap-4 group">
            <div className="flex-shrink-0 flex flex-col items-center">
                <div className="w-10 h-10 rounded-xl bg-surface-inverted text-white flex items-center justify-center font-black text-base shadow-sm group-hover:bg-brand-600 transition-colors">
                    {number}
                </div>
                <div className="flex-1 w-0.5 bg-line my-2 group-last:hidden"></div>
            </div>
            <div className="flex-1 pb-6 border-b border-line group-last:border-0">
                <h4 className="text-base font-bold text-content-primary mb-2">{title}</h4>
                <div className="text-content-secondary text-sm leading-relaxed">
                    {children}
                </div>
            </div>
        </div>
    );
}

function FaqItem({ question, children }) {
    return (
        <details className="group bg-surface-sunken border border-line rounded-xl overflow-hidden transition-all duration-200 open:bg-surface-card open:shadow-sm open:border-line-strong">
            <summary className="font-bold text-sm text-content-primary p-4 cursor-pointer flex items-center justify-between hover:bg-surface-card select-none">
                <div className="flex items-center gap-3">
                    <span className="text-brand-600 bg-surface-card p-1 rounded-lg border border-line">
                        <QuestionMarkCircleIcon className="w-4 h-4" />
                    </span> 
                    {question}
                </div>
                <span className="text-content-muted text-xs group-open:rotate-180 transition-transform duration-200">▼</span>
            </summary>
            <div className="p-4 pt-2 text-content-secondary text-xs leading-relaxed border-t border-line ml-9">
                {children}
            </div>
        </details>
    );
}