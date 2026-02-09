import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';

export default function Manual({ auth }) {
    // Define a aba inicial baseada no perfil
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
        { id: 'loja',   label: '🏪 Lojas',    color: 'red',    icon: '🛍️', desc: 'Solicitações e Transferências' },
        { id: 'gestor', label: '👮 Gestão',   color: 'purple', icon: '🛡️', desc: 'Auditoria Comercial' },
        { id: 'cd',     label: '🏭 Logística', color: 'blue',   icon: '🚛', desc: 'Expedição e Milk Run' },
        { id: 'drive',  label: '☁️ Arquivos',  color: 'green',  icon: '📄', desc: 'Comprovantes Digitais' },
        { id: 'faq',    label: '❓ Suporte',  color: 'gray',   icon: '🆘', desc: 'Ajuda e Contatos' },
    ];

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-bold text-2xl text-gray-800">Central de Conhecimento V2</h2>}
        >
            <Head title="Manual do Sistema" />

            <div className="py-10 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    
                    {/* NAVEGAÇÃO SUPERIOR */}
                    <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 mb-8 px-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-3 rounded-xl transition-all duration-300 shadow-sm flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 border-2 relative overflow-hidden group
                                    ${activeTab === tab.id 
                                        ? `bg-white border-${tab.color}-500 text-${tab.color}-700 shadow-md ring-2 ring-${tab.color}-100 transform -translate-y-1` 
                                        : 'bg-white text-gray-400 border-transparent hover:bg-gray-50 hover:border-gray-200'
                                    }`}
                            >
                                <span className="text-2xl">{tab.icon}</span> 
                                <div className="text-center md:text-left">
                                    <div className="font-bold text-sm uppercase tracking-wide">{tab.label}</div>
                                    <div className="text-[10px] hidden md:block opacity-70 font-normal">{tab.desc}</div>
                                </div>
                                {activeTab === tab.id && (
                                    <div className={`absolute bottom-0 left-0 w-full h-1 bg-${tab.color}-500`}></div>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white overflow-hidden shadow-xl rounded-2xl border-t-4 border-gray-800 animate-fade-in-up min-h-[600px]">
                        <div className="p-8 md:p-12">
                            
                            {/* =======================================================
                                ABA 1: LOJAS (REPOSIÇÃO E TRANSFERÊNCIAS)
                               ======================================================= */}
                            {activeTab === 'loja' && (
                                <div className="space-y-10 animate-fade-in">
                                    <HeaderSection 
                                        title="Manual da Loja (V2)" 
                                        subtitle="Fluxo Unificado: Reposição de Estoque e Transferência entre Filiais."
                                        color="red"
                                    />
                                    
                                    {/* CENÁRIO A: PEDIR MOTO */}
                                    <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                                        <h3 className="text-xl font-black text-red-800 mb-4 flex items-center gap-2">
                                            🅰️ Como Solicitar Motos (Entrada)
                                        </h3>
                                        
                                        <Step number="1" title="Nova Solicitação">
                                            <p>Acesse o menu e clique em <strong>Nova Solicitação</strong>. O formulário é o mesmo para qualquer tipo de pedido.</p>
                                            <ul className="mt-3 space-y-2 text-sm text-gray-600 bg-white p-4 rounded-lg border border-red-200">
                                                <li>🏭 <strong>Reposição CD:</strong> Deixe o campo "Origem" vazio. O sistema entende que virá da fábrica.</li>
                                                <li>🔁 <strong>Transferência:</strong> Selecione a loja de onde a moto virá no campo "Origem".</li>
                                                <li>🔑 <strong>Chassi:</strong> Digite o chassi exato (para transferências) ou o modelo desejado (para reposição).</li>
                                            </ul>
                                        </Step>

                                        <Step number="2" title="Aprovação e Rastreio">
                                            <p>Todo pedido entra como <span className="text-purple-600 font-bold">EM ANÁLISE</span>. O Gestor Comercial precisa aprovar.</p>
                                            <p className="mt-2 text-sm">Acompanhe pelo Dashboard:</p>
                                            <div className="flex gap-2 mt-2">
                                                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded border border-yellow-200">🟡 Solicitado (Aprovado)</span>
                                                <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded border border-orange-200">🟠 Em Trânsito (Caminhão saiu)</span>
                                            </div>
                                        </Step>
                                    </div>

                                    {/* CENÁRIO B: ENVIAR MOTO (TRANSFERÊNCIA PASSIVA) */}
                                    <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
                                        <h3 className="text-xl font-black text-orange-800 mb-4 flex items-center gap-2">
                                            🅱️ Como Enviar Motos (Saída/Transferência)
                                        </h3>
                                        <p className="text-sm text-orange-900 mb-6">
                                            Quando outra loja pede uma moto sua, você receberá um <strong>ALERTA GIGANTE</strong> no seu Dashboard.
                                        </p>

                                        <Step number="1" title="1. Separar no Pátio">
                                            <p>Ao ver o alerta "Pendente de Separação", clique no botão. Localize a moto física e clique em <strong>✅ Confirmar Separação</strong>.</p>
                                            <p className="text-xs text-gray-500 mt-1">O status muda para "Separado". Isso avisa a logística que a moto está pronta.</p>
                                        </Step>

                                        <Step number="2" title="2. Aguardar o Caminhão (Milk Run)">
                                            <p>O status mudará para <span className="font-bold text-orange-600">AGUARDANDO COLETA</span>. Isso significa que o romaneio foi gerado e o motorista está vindo.</p>
                                        </Step>

                                        <Step number="3" title="3. O Caminhão Chegou">
                                            <p>Entregue a moto ao motorista. Ele ligará para o CD para confirmar a coleta no sistema.</p>
                                            <p className="text-xs bg-white p-2 rounded border border-orange-200 mt-2">
                                                <strong>Nota:</strong> Você não dá baixa na saída. A baixa ocorre automaticamente quando o motorista confirma a coleta.
                                            </p>
                                        </Step>
                                    </div>

                                    <Step number="Final" title="Recebimento e Baixa">
                                        <p>Quando receber uma moto (seja do CD ou de outra loja):</p>
                                        <ol className="list-decimal ml-6 mt-3 text-sm text-gray-700 space-y-2">
                                            <li>Confira o chassi físico.</li>
                                            <li>Assine o manifesto do motorista.</li>
                                            <li>No sistema, clique em <strong>📝 Conferir e Finalizar</strong>.</li>
                                            <li>Tire uma foto legível do documento assinado e anexe.</li>
                                        </ol>
                                    </Step>
                                </div>
                            )}

                            {/* =======================================================
                                ABA 2: GESTÃO COMERCIAL
                               ======================================================= */}
                            {activeTab === 'gestor' && (
                                <div className="space-y-10 animate-fade-in">
                                    <HeaderSection 
                                        title="Painel do Gestor" 
                                        subtitle="O Gatekeeper: Nada sai ou entra sem sua aprovação."
                                        color="purple"
                                    />

                                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 mb-6 flex items-start gap-3">
                                        <span className="text-2xl">📱</span>
                                        <div>
                                            <h4 className="font-bold text-purple-900">Mobile First</h4>
                                            <p className="text-sm text-purple-800">
                                                O painel foi desenhado para ser usado em Tablets ou Celulares, permitindo aprovações rápidas de qualquer lugar.
                                            </p>
                                        </div>
                                    </div>

                                    <Step number="1" title="Auditoria de Pedidos">
                                        <p>Você verá uma lista de solicitações pendentes. Clique em um pedido para ver os detalhes (Cliente, Destino, Chassis).</p>
                                    </Step>

                                    <Step number="2" title="Cortes (Rejeição Parcial)">
                                        <p>Se um pedido tem 10 motos e o cliente só tem crédito para 8:</p>
                                        <ul className="mt-2 text-sm text-gray-700 space-y-1 ml-4">
                                            <li>🟢 <strong>Verde:</strong> Item Aprovado.</li>
                                            <li>🔴 <strong>Vermelho:</strong> Toque no item para Rejeitar/Cortar.</li>
                                        </ul>
                                        <p className="mt-2 text-xs text-red-600 font-bold">Itens vermelhos serão excluídos do pedido ao finalizar.</p>
                                    </Step>

                                    <Step number="3" title="Estornos">
                                        <p>Se uma loja pedir o estorno de uma venda ou devolução, a solicitação aparecerá no seu painel para autorização antes de liberar a logística reversa.</p>
                                    </Step>
                                </div>
                            )}

                            {/* =======================================================
                                ABA 3: CD / LOGÍSTICA (V2)
                               ======================================================= */}
                            {activeTab === 'cd' && (
                                <div className="space-y-10 animate-fade-in">
                                    <HeaderSection 
                                        title="Logística V2: Hub & Spoke" 
                                        subtitle="Gerenciamento de Cargas, Coletas e Transbordos."
                                        color="blue"
                                    />

                                    <Step number="1" title="Mesa de Operação (Montagem de Carga)">
                                        <p>Ao criar um novo Romaneio, você verá duas colunas:</p>
                                        <div className="grid md:grid-cols-2 gap-4 mt-3 text-sm">
                                            <div className="p-4 bg-blue-50 rounded border border-blue-200">
                                                <h4 className="font-bold text-blue-800">🏭 Expedição CD</h4>
                                                <p>Itens que estão fisicamente no seu estoque. <br/>Status ao salvar: <strong>Expedido</strong>.</p>
                                            </div>
                                            <div className="p-4 bg-orange-50 rounded border border-orange-200">
                                                <h4 className="font-bold text-orange-800">🚛 Coletas (Milk Run)</h4>
                                                <p>Itens em outras lojas que o caminhão deve buscar. <br/>Status ao salvar: <strong>Aguardando Coleta</strong>.</p>
                                            </div>
                                        </div>
                                    </Step>

                                    <Step number="2" title="O Processo de Milk Run">
                                        <p>O caminhão pode sair vazio do CD apenas para realizar coletas.</p>
                                        <ul className="list-disc ml-6 mt-2 text-gray-600 text-sm">
                                            <li>O motorista chega na loja de origem.</li>
                                            <li>Ele confere a moto e liga para o CD.</li>
                                            <li>O CD acessa o Romaneio e clica em <strong>📞 Confirmar Coleta</strong> no item específico.</li>
                                            <li>A moto passa a constar "A Bordo" do caminhão.</li>
                                        </ul>
                                    </Step>

                                    <Step number="3" title="Transbordo (Hub & Spoke)">
                                        <p>Se o caminhão coletar uma moto no interior e trouxer para o CD (para depois ir a outra loja):</p>
                                        <ul className="list-disc ml-6 mt-2 text-gray-600 text-sm">
                                            <li>Ao chegar no CD, clique em <strong>Receber Carga</strong>.</li>
                                            <li>Os itens de transbordo ficarão com status <span className="text-purple-600 font-bold">NO CD</span>.</li>
                                            <li>Eles aparecerão automaticamente na lista de "Expedição" para serem alocados no próximo caminhão de saída.</li>
                                        </ul>
                                    </Step>
                                </div>
                            )}

                            {/* =======================================================
                                ABA 4: DRIVE
                               ======================================================= */}
                            {activeTab === 'drive' && (
                                <div className="space-y-10 animate-fade-in">
                                    <HeaderSection 
                                        title="Arquivamento Digital" 
                                        subtitle="Backup automático e organização de documentos."
                                        color="green"
                                    />

                                    <Step number="1" title="Upload Obrigatório">
                                        <p>Nenhum pedido pode ser finalizado sem a foto do comprovante (Romaneio/Canhoto assinado).</p>
                                    </Step>

                                    <Step number="2" title="Organização Automática">
                                        <p>O sistema renomeia e organiza os arquivos na nuvem (Google Drive) seguindo a estrutura:</p>
                                        <div className="mt-4 font-mono text-xs md:text-sm bg-gray-100 p-4 rounded-lg border border-gray-300 text-gray-700 overflow-x-auto shadow-inner">
                                            📂 2026 / 📂 [Mês] / 📂 [Nome da Loja] / 📄 Pedido_[ID].pdf
                                        </div>
                                    </Step>
                                </div>
                            )}

                            {/* =======================================================
                                ABA 5: SUPORTE / FAQ
                               ======================================================= */}
                            {activeTab === 'faq' && (
                                <div className="space-y-8 animate-fade-in">
                                    <HeaderSection 
                                        title="Suporte Técnico" 
                                        subtitle="Solução de problemas e contato direto."
                                        color="gray"
                                    />

                                    <div className="grid gap-4">
                                        <FaqItem question="O sistema diz 'Chassi Inválido'.">
                                            Verifique se o chassi possui entre <strong>11 e 17 caracteres</strong>. Não use traços ou espaços. O sistema valida se o chassi já está em outro pedido ativo.
                                        </FaqItem>

                                        <FaqItem question="Errei a solicitação e o Gestor aprovou.">
                                            Entre em contato com o CD imediatamente. Eles podem rejeitar o pedido na fase de separação, devolvendo-o para correção.
                                        </FaqItem>

                                        <FaqItem question="Como desfaço uma carga errada?">
                                            No menu Expedição, entre no Romaneio e clique no botão vermelho <strong>🗑️ Desfazer</strong>. As motos voltarão para o status "Separado" nas lojas de origem.
                                        </FaqItem>
                                    </div>

                                    {/* CONTATOS E CRÉDITOS */}
                                    <div className="mt-10 pt-10 border-t border-gray-200">
                                        <div className="bg-gray-900 text-white p-8 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-8">
                                            
                                            {/* Contato TI */}
                                            <div className="text-center md:text-left">
                                                <h4 className="text-xl font-bold flex items-center gap-2 justify-center md:justify-start">
                                                    <span>🛠️</span> Suporte TI Sabel
                                                </h4>
                                                <p className="text-gray-400 mt-2 text-sm">Problemas técnicos, senhas ou erros.</p>
                                                
                                                <div className="mt-4 space-y-2">
                                                    <div className="flex items-center gap-3 justify-center md:justify-start bg-gray-800 px-4 py-2 rounded-lg">
                                                        <span className="text-2xl">📱</span>
                                                        <div className="text-left">
                                                            <p className="text-[10px] text-gray-400 uppercase">WhatsApp / Plantão</p>
                                                            <p className="font-mono text-lg font-bold text-green-400">(91) 98492-8535</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-3 justify-center md:justify-start bg-gray-800 px-4 py-2 rounded-lg">
                                                        <span className="text-2xl">📧</span>
                                                        <div className="text-left">
                                                            <p className="text-[10px] text-gray-400 uppercase">E-mail Corporativo</p>
                                                            <p className="font-mono text-sm font-bold text-blue-300">ti@shineraybysabel.com.br</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Créditos */}
                                            <div className="text-center md:text-right border-t md:border-t-0 md:border-l border-gray-700 pt-6 md:pt-0 md:pl-8">
                                                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Desenvolvimento & Arquitetura</p>
                                                <h5 className="text-2xl font-black text-white tracking-tight">Délcio Farias Dias Neto</h5>
                                                <p className="text-gray-400 text-xs mt-1">Full Stack Developer • Shineray System V2</p>
                                                <div className="mt-4 inline-flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full text-[10px] text-gray-400 border border-gray-700">
                                                    <span>© {new Date().getFullYear()} Shineray By Sabel</span>
                                                </div>
                                            </div>

                                        </div>
                                    </div>

                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// --- COMPONENTES VISUAIS AUXILIARES ---

function HeaderSection({ title, subtitle, color }) {
    const colors = {
        red: 'text-red-700 border-red-500',
        blue: 'text-blue-700 border-blue-500',
        green: 'text-green-700 border-green-500',
        gray: 'text-gray-700 border-gray-500',
        purple: 'text-purple-700 border-purple-500',
    };

    return (
        <div className={`border-l-4 ${colors[color].split(' ')[1]} pl-6 mb-8`}>
            <h3 className={`text-3xl font-black ${colors[color].split(' ')[0]} tracking-tight`}>{title}</h3>
            <p className="text-gray-500 text-lg mt-1">{subtitle}</p>
        </div>
    );
}

function Step({ number, title, children }) {
    return (
        <div className="flex gap-4 md:gap-6 group">
            <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-xl shadow-lg group-hover:bg-gray-700 transition-colors duration-300 ring-4 ring-gray-100">
                    {number}
                </div>
                <div className="h-full w-0.5 bg-gray-200 mx-auto my-2 group-last:hidden"></div>
            </div>
            <div className="flex-1 pb-8 border-b border-gray-100 last:border-0">
                <h4 className="text-xl font-bold text-gray-800 mb-3">{title}</h4>
                <div className="text-gray-600 leading-relaxed">
                    {children}
                </div>
            </div>
        </div>
    );
}

function FaqItem({ question, children }) {
    return (
        <details className="group bg-white border border-gray-200 rounded-lg overflow-hidden transition-all duration-300 open:shadow-md open:border-gray-400">
            <summary className="font-bold text-gray-700 p-5 cursor-pointer flex items-center justify-between hover:bg-gray-50 select-none transition-colors">
                <div className="flex items-center gap-3">
                    <span className="text-gray-500 bg-gray-100 p-1.5 rounded text-xs">❓</span> 
                    {question}
                </div>
                <span className="text-gray-400 group-open:rotate-180 transition-transform transform duration-300">▼</span>
            </summary>
            <div className="p-5 pt-0 text-gray-600 text-sm ml-10 leading-relaxed border-t border-transparent group-open:border-gray-100 animate-fade-in">
                {children}
            </div>
        </details>
    );
}