import AppLayout from '@/Layouts/AppLayout';
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
    TrashIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowUturnLeftIcon,
    ArrowPathIcon,
    InformationCircleIcon,
    CubeIcon,
    ArrowsRightLeftIcon,
    ShieldCheckIcon,
    DocumentTextIcon,
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
        { id: 'pecas',  label: 'Módulo de Peças',   color: 'amber',  icon: <WrenchScrewdriverIcon className="w-5 h-5" />, desc: 'Catálogo, Onde Encontrar e Estoque' },
        { id: 'gestor', label: 'Gestão Comercial',  color: 'purple', icon: <ClipboardDocumentCheckIcon className="w-5 h-5" />, desc: 'Aprovações e BI Executivo' },
        { id: 'cd',     label: 'Logística / CD',    color: 'blue',   icon: <TruckIcon className="w-5 h-5" />, desc: 'Expedição, Romaneios e Rotas' },
        { id: 'faq',    label: 'Suporte TI & FAQ',  color: 'emerald',icon: <QuestionMarkCircleIcon className="w-5 h-5" />, desc: 'Regras, Dúvidas e Contatos' },
    ];

    return (
        <AppLayout user={auth.user}>
            <Head title="Manual do Sistema - V3.0" />
            
            <PageHeader
                title="Central de Conhecimento"
                description="Guia oficial de operação e fluxos de trabalho do Sistema de Logística Shineray By Sabel v3.0"
                breadcrumbs={[
                    { label: 'Início', href: route('dashboard') },
                    { label: 'Manual do Sistema' },
                ]}
            />

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
                                <p>No menu lateral, acesse <strong>Motos ➔ Nova Solicitação</strong>. Escolha o tipo de operação:</p>
                                <ul className="list-disc ml-6 mt-3 space-y-2 text-sm text-content-secondary">
                                    <li><strong>Reposição CD (Fábrica):</strong> Selecione a origem "Matriz / CD", informe o modelo, cor e o <strong>chassi exato</strong> disponível no estoque central do CD.</li>
                                    <li><strong>Transferência entre Lojas:</strong> Selecione a loja cedente no campo "Origem", preencha o modelo e o <strong>chassi exato</strong> da moto física que se encontra na outra filial.</li>
                                    <li><strong>Devolução ao CD:</strong> Alterne a chave para devolução caso precise devolver uma unidade por defeito, troca ou renegociação.</li>
                                </ul>
                                <div className="mt-3 bg-status-danger-bg border border-status-danger-solid/20 rounded-xl p-3">
                                    <p className="text-sm text-status-danger-fg font-bold">⚠️ OBRIGATÓRIO: O preenchimento do Chassi é obrigatório em 100% dos pedidos. O sistema bloqueia chassis duplicados ou com formato inválido.</p>
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

                            <Step number="4" title="Trânsito e Despacho pelo CD">
                                <p>Assim que o caminhão for carregado e a equipe do CD liberar a saída de portaria, o status muda para <span className="text-status-warning-fg font-bold bg-status-warning-bg px-2 py-0.5 rounded border border-status-warning-solid/30 text-xs">Em Trânsito</span>.</p>
                                <p className="mt-2 text-sm text-content-muted italic">Nota: Lojas acompanham a evolução pelo menu "Meus Pedidos". O controle de romaneios e rotas de caminhão é restrito ao CD.</p>
                            </Step>

                            <Step number="5" title="Conferência Física e Finalização (Upload do Canhoto)">
                                <p className="font-bold text-content-primary mb-2">Quando o caminhão descarregar na sua loja:</p>
                                <ol className="list-decimal ml-6 mt-2 space-y-2 text-sm text-content-secondary">
                                    <li>Confira fisicamente o chassi de cada moto com o documento do motorista.</li>
                                    <li>Assine e carimbe o comprovante de entrega do transportador.</li>
                                    <li>Abra o pedido na tela e clique no botão verde <strong>Conferir e Finalizar</strong>.</li>
                                    <li>Faça o upload da foto nítida do documento assinado.</li>
                                    <li>Caso haja avaria (arranhões, peças quebradas), descreva no campo específico e anexe a foto do dano no mesmo ato.</li>
                                    <li>Clique em <strong>Salvar</strong>. As motos passam para o status <strong>Concluído</strong> e integram seu estoque!</li>
                                </ol>
                                <div className="mt-4 bg-status-warning-bg border border-status-warning-solid/30 rounded-xl p-4">
                                    <p className="text-xs font-bold text-status-warning-fg uppercase mb-1">🔒 Bloqueio Automático em Trânsito</p>
                                    <p className="text-sm text-status-warning-fg">Se a loja mantiver pedidos "Em Trânsito" pendentes de finalização após a entrega, novas solicitações serão temporariamente bloqueadas até o upload do comprovante.</p>
                                </div>
                            </Step>
                        </div>
                    </div>
                )}

                {/* ==================== 2. ABA PEÇAS ==================== */}
                {activeTab === 'pecas' && (
                    <div className="space-y-10 animate-fade-in">
                        <HeaderSection 
                            title="Módulo de Peças e Acessórios (V3.0)" 
                            subtitle="Catálogo com mais de 2.380 SKUs, consulta multiloja no ERP Microwork e fluxo de reposição."
                            tag="Novo Módulo v3"
                        />

                        <div className="bg-surface-card p-6 md:p-8 rounded-2xl border border-line shadow-sm space-y-8">
                            <h3 className="text-xl font-black text-content-primary border-b border-line pb-4 flex items-center gap-2">
                                <span>⚙️</span> Como Operar o Estoque e Pedidos de Peças
                            </h3>

                            <Step number="1" title="Catálogo Inteligente & Compatibilidade por Modelo">
                                <p>Acesse <strong>Peças ➔ Estoque de Peças</strong> para consultar todos os SKUs disponíveis. O sistema possui inteligência de compatibilidade:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-content-secondary">
                                    <li>Filtre por família de modelo (Ex: JET 50, JEF 150, SHI 175, STORM 200, FLASH 120).</li>
                                    <li>Busque por código SKU ou descrição da peça.</li>
                                    <li>Visualize se a peça é original, paralela ou universal com badges coloridos.</li>
                                </ul>
                            </Step>

                            <Step number="2" title="Consulta 'Onde Encontrar' (Saldos Microwork)">
                                <p>Na tabela de peças, clique no botão <strong>Onde Encontrar</strong> de qualquer SKU para abrir a consulta em tempo real no ERP:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-content-secondary">
                                    <li>Veja o saldo físico e disponível de cada empresa da rede (CD Matriz, Ananindeua, Capanema, Castanhal, etc.).</li>
                                    <li>Facilita o remanejamento imediato de peças críticas entre filiais parceiras.</li>
                                </ul>
                            </Step>

                            <Step number="3" title="Fazendo Pedidos de Peças (Carrinho & Urgência)">
                                <p>Acesse <strong>Peças ➔ Solicitar Peças</strong>:</p>
                                <ol className="list-decimal ml-6 mt-2 space-y-2 text-sm text-content-secondary">
                                    <li>Adicione as peças desejadas ao carrinho informando a quantidade necessária.</li>
                                    <li>Marque o nível de urgência caso seja um atendimento de cliente em box ou garantia expressa.</li>
                                    <li>Envie o pedido para validação e separação logística pelo CD.</li>
                                </ol>
                            </Step>

                            <Step number="4" title="Entrada, Inventário & Livro-Razão (Visão CD/Admin)">
                                <p>A equipe do CD gerencia o saldo controlado pelo menu <strong>Entrada / Inventário</strong>:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-content-secondary">
                                    <li>Registro de entradas por nota fiscal com data, lote e quantidade.</li>
                                    <li>Histórico auditável (ledger) de todas as saídas, transferências e acertos de inventário.</li>
                                    <li>Acompanhamento de pendências e divergências de recebimento.</li>
                                </ul>
                            </Step>
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
                                <p>No menu <strong>Aprovações</strong>, o gestor analisa cada solicitação recebida:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-2 text-sm text-content-secondary">
                                    <li><strong>Aprovação Total:</strong> Autoriza o pedido completo para o CD iniciar a separação.</li>
                                    <li><strong>Cortes Parciais:</strong> Se a loja solicitou 5 motos mas o crédito comporta apenas 3, o gestor pode reprovar chassis individuais clicando no ícone correspondente antes de aprovar.</li>
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

                {/* ==================== 4. ABA CD ==================== */}
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
                                <p>Assim que o Gestor aprova, o pedido entra como <span className="text-status-success-fg font-bold bg-status-success-bg px-2 py-0.5 rounded text-xs">Solicitado</span>. A equipe do CD localiza os chassis no pátio físico e clica em <strong>Separar</strong> para liberar as unidades para o pool de montagem de carga.</p>
                            </Step>

                            <Step number="2" title="Planejamento no Calendário de Rotas">
                                <p>No módulo de <strong>Calendário</strong>, o CD agenda as viagens da semana:</p>
                                <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-content-secondary">
                                    <li><span className="font-bold text-status-warning-fg">Amarelo (Planejado):</span> Prévia interna. Os pedidos recebem data estimada.</li>
                                    <li><span className="font-bold text-status-success-fg">Verde (Confirmado):</span> Viagem oficializada com rota consolidada.</li>
                                </ul>
                            </Step>

                            <Step number="3" title="Montagem de Romaneio de Carga (Novo Romaneio)">
                                <p>Acesse <strong>Logística ➔ Expedição</strong>:</p>
                                <ol className="list-decimal ml-6 mt-2 space-y-2 text-sm text-content-secondary">
                                    <li>Informe o nome do Motorista, Placa do Veículo e Rota de destino.</li>
                                    <li>Selecione as motos e pacotes de peças no checklist com contadores automáticos de volume no rodapé.</li>
                                    <li>Suporta <strong>entregas parciais</strong>: envie apenas o que couber no caminhão de hoje; o saldo continuará na fila.</li>
                                    <li>Clique em <strong>Salvar e Gerar Carga</strong> para emitir o Manifesto em PDF.</li>
                                </ol>
                            </Step>

                            <Step number="4" title="Saída do Galpão e Coleta Milk Run">
                                <p>Após o carregamento e conferência dos papéis, clique em <strong>Aprovar Saída</strong>. Todos os pedidos da carga entram simultaneamente em <strong>Em Trânsito</strong>.</p>
                                <p className="mt-2 text-sm text-content-secondary">Se a rota incluir coletas em lojas do interior (*Milk Run*), o operador confirma a coleta na tela da carga assim que o motorista embarcar a moto.</p>
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
                                    <p className="text-content-muted text-xs">Shineray By Sabel • Sistema Logístico V3.0</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </AppLayout>
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