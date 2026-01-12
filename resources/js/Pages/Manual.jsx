import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState } from 'react';

export default function Manual({ auth }) {
    // Lógica inteligente para abrir a aba certa conforme o usuário
    const perfilInicial = auth.user.perfil === 'admin' ? 'faq' : auth.user.perfil === 'cd' ? 'cd' : 'loja';
    const [activeTab, setActiveTab] = useState(perfilInicial);

    // Configuração das Abas
    const tabs = [
        { id: 'loja', label: '🏪 Para Lojas', color: 'red', icon: '🛍️' },
        { id: 'cd', label: '🏭 Para CD/Expedição', color: 'blue', icon: '📦' },
        { id: 'comprovantes', label: '📄 Drive & Entregas', color: 'green', icon: '☁️' },
        { id: 'faq', label: '❓ Dúvidas & Suporte', color: 'gray', icon: '🆘' },
    ];

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-bold text-2xl text-gray-800">Central de Ajuda & Treinamento</h2>}
        >
            <Head title="Manual do Sistema" />

            <div className="py-10 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    
                    {/* NAVEGAÇÃO SUPERIOR (ABAS) */}
                    <div className="flex flex-wrap gap-3 mb-8 justify-center md:justify-start px-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-sm text-sm uppercase tracking-wide flex items-center gap-2 border-2
                                    ${activeTab === tab.id 
                                        ? `bg-white border-${tab.color}-600 text-${tab.color}-700 shadow-md transform -translate-y-1` 
                                        : 'bg-white text-gray-400 border-transparent hover:bg-gray-50'
                                    }`}
                            >
                                <span className="text-xl">{tab.icon}</span> {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white overflow-hidden shadow-xl rounded-2xl border-t-4 border-gray-800 animate-fade-in-up">
                        <div className="p-8 md:p-12">
                            
                            {/* =======================================================
                                ABA 1: LOJA / REVENDA
                               ======================================================= */}
                            {activeTab === 'loja' && (
                                <div className="space-y-10">
                                    <HeaderSection 
                                        title="Manual da Loja" 
                                        subtitle="Fluxo completo: Da solicitação até a entrega na sua porta."
                                        color="red"
                                    />
                                    
                                    <Step number="1" title="Criando um Pedido">
                                        <p>No menu, clique em <strong className="text-red-600">Nova Solicitação</strong>. O sistema permite pedir várias motos de uma vez.</p>
                                        <ul className="mt-2 space-y-1 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                            <li>✅ <strong>Modelo:</strong> Obrigatório. Escolha na lista.</li>
                                            <li>✅ <strong>Chassi:</strong> Digite pelo menos os últimos 6 dígitos ou o chassi completo.</li>
                                            <li>✅ <strong>Cor:</strong> Informe a cor exata para evitar erros de separação.</li>
                                        </ul>
                                    </Step>

                                    <Step number="2" title="Monitoramento em Tempo Real">
                                        <p>Não precisa ligar para o CD. Acompanhe a barra de progresso no menu <strong>"Meus Pedidos"</strong>:</p>
                                        <div className="flex gap-2 mt-3 text-xs font-bold uppercase text-white">
                                            <span className="bg-yellow-500 px-2 py-1 rounded">1. Solicitado</span>
                                            <span className="text-gray-400 py-1">→</span>
                                            <span className="bg-blue-500 px-2 py-1 rounded">2. Separado</span>
                                            <span className="text-gray-400 py-1">→</span>
                                            <span className="bg-orange-500 px-2 py-1 rounded">3. Em Trânsito</span>
                                        </div>
                                    </Step>

                                    <Step number="3" title="Chat Integrado (Novo!)">
                                        <p>Precisa avisar que a cor mudou? Ou que o pedido é urgente?</p>
                                        <p className="mt-1 text-sm text-gray-600">
                                            Entre no detalhe do pedido e use o chat no canto inferior direito. 
                                            O CD recebe um alerta sonoro ("Plim") instantaneamente.
                                        </p>
                                    </Step>

                                    <Step number="4" title="Confirmar Recebimento (Baixa)">
                                        <p>Quando o caminhão chegar:</p>
                                        <ol className="list-decimal ml-6 mt-2 text-sm text-gray-700 space-y-1">
                                            <li>Confira as motos fisicamente.</li>
                                            <li>Assine o documento (Romaneio) do motorista.</li>
                                            <li>No sistema, abra o pedido e vá até a área verde <strong>"Finalizar Entrega"</strong>.</li>
                                            <li>Tire uma foto do papel assinado e envie. O sistema arquiva automaticamente no Google Drive.</li>
                                        </ol>
                                    </Step>
                                </div>
                            )}

                            {/* =======================================================
                                ABA 2: CD / EXPEDIÇÃO
                               ======================================================= */}
                            {activeTab === 'cd' && (
                                <div className="space-y-10">
                                    <HeaderSection 
                                        title="Manual do Centro de Distribuição" 
                                        subtitle="Gestão de Estoque, Separação e Logística de Cargas."
                                        color="blue"
                                    />

                                    <Step number="1" title="Dashboard Operacional">
                                        <p>Seu painel atualiza a cada 10 segundos automaticamente.</p>
                                        <div className="grid grid-cols-2 gap-4 mt-3 max-w-lg">
                                            <div className="bg-yellow-50 p-2 rounded border border-yellow-200 text-xs">
                                                <strong>Pendentes:</strong> Pedidos novos que precisam de atenção.
                                            </div>
                                            <div className="bg-indigo-50 p-2 rounded border border-indigo-200 text-xs">
                                                <strong>No Pátio:</strong> Motos já separadas aguardando caminhão.
                                            </div>
                                        </div>
                                    </Step>

                                    <Step number="2" title="Separação de Pedidos">
                                        <p>Ao receber um pedido:</p>
                                        <ol className="list-decimal ml-6 text-sm text-gray-600 space-y-1 mt-2">
                                            <li>Valide se os chassis solicitados estão no pátio.</li>
                                            <li>Clique em <strong className="text-blue-600">Marcar como Separado</strong>.</li>
                                            <li>Isso reserva a moto e avisa a loja que o pedido foi aceito.</li>
                                            <li><em>Se não tiver a moto:</em> Clique em "Rejeitar" e informe o motivo no chat.</li>
                                        </ol>
                                    </Step>

                                    <Step number="3" title="Criar Carga (Romaneio) com Scanner">
                                        <p>Vá em <strong>Expedição</strong> para montar a carga do caminhão.</p>
                                        <div className="mt-3 p-4 bg-gray-800 text-white rounded-lg shadow-lg">
                                            <h4 className="font-bold flex items-center gap-2">🔫 Uso do Leitor de Código de Barras</h4>
                                            <p className="text-sm mt-1 text-gray-300">
                                                O sistema possui proteção inteligente. Ao bipar um chassi:
                                            </p>
                                            <ul className="text-xs mt-2 list-disc ml-4 text-gray-400">
                                                <li>Se a moto for válida e estiver "Separada": <span className="text-green-400">Bip Verde (Adiciona)</span>.</li>
                                                <li>Se for duplicada ou de outro pedido: <span className="text-red-400">Erro Sonoro (Bloqueia)</span>.</li>
                                            </ul>
                                        </div>
                                    </Step>

                                    <Step number="4" title="Saída e Documentação">
                                        <p>Após adicionar todas as motos:</p>
                                        <ul className="list-disc ml-6 mt-1 text-gray-600 text-sm">
                                            <li>Clique em <strong>Gerar Romaneio</strong>.</li>
                                            <li>Imprima o Manifesto (Layout Oficial) para o motorista.</li>
                                            <li>Clique em <strong>Liberar Saída</strong> para mudar o status para "Em Trânsito".</li>
                                        </ul>
                                    </Step>
                                </div>
                            )}

                            {/* =======================================================
                                ABA 3: COMPROVANTES & DRIVE
                               ======================================================= */}
                            {activeTab === 'comprovantes' && (
                                <div className="space-y-10">
                                    <HeaderSection 
                                        title="Arquivamento Digital Inteligente" 
                                        subtitle="Como o sistema organiza os comprovantes na nuvem (Google Drive)."
                                        color="green"
                                    />

                                    <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                                        <h4 className="font-bold text-green-900 mb-2">☁️ Integração Google Drive API v3</h4>
                                        <p className="text-sm text-green-800">
                                            O sistema não salva arquivos no servidor local. Tudo vai direto para a nuvem segura da Shineray.
                                            Isso garante backup eterno e acesso fácil para a auditoria.
                                        </p>
                                    </div>

                                    <Step number="1" title="Árvore de Pastas Automática">
                                        <p>O sistema organiza os arquivos por data sozinho. Você não precisa criar pastas.</p>
                                        <div className="mt-4 font-mono text-xs md:text-sm bg-gray-900 text-green-400 p-4 rounded-lg shadow-inner overflow-x-auto">
                                            📁 Google Drive (Raiz)<br/>
                                            │<br/>
                                            ├── 📂 2025<br/>
                                            │<br/>
                                            └── 📂 2026<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;│<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;├── 📂 01 - Janeiro<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;│<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;├── 📄 Romaneio-105_12-01-2026_Belem_ID-550.jpg<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;&nbsp;└── 📄 Romaneio-105_12-01-2026_Ananindeua_ID-551.pdf<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;│<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;└── 📂 02 - Fevereiro...
                                        </div>
                                    </Step>

                                    <Step number="2" title="Fechamento de Carga">
                                        <p>O Romaneio (Carga) permanece com status <span className="text-orange-500 font-bold">EM TRÂNSITO</span> enquanto houver pedidos pendentes.</p>
                                        <p className="mt-2 text-sm text-gray-600">
                                            Assim que o <strong>último pedido</strong> daquela carga tiver o comprovante enviado, o sistema fecha o Romaneio para <span className="text-green-600 font-bold">FINALIZADO</span> automaticamente.
                                        </p>
                                    </Step>
                                </div>
                            )}

                            {/* =======================================================
                                ABA 4: FAQ / SUPORTE
                               ======================================================= */}
                            {activeTab === 'faq' && (
                                <div className="space-y-8">
                                    <HeaderSection 
                                        title="Dúvidas Frequentes" 
                                        subtitle="Soluções rápidas para o dia a dia."
                                        color="gray"
                                    />

                                    <div className="grid gap-4">
                                        <FaqItem question="O botão 'Nova Carga' sumiu no celular.">
                                            No celular, o layout muda para facilitar o uso. Role a página para baixo ou verifique se você está na aba "Expedição". O sistema é 100% compatível com Android e iOS.
                                        </FaqItem>

                                        <FaqItem question="Errei o chassi no pedido. Posso editar?">
                                            Por segurança, pedidos não podem ser editados após criados. Você deve <strong>Cancelar</strong> o pedido (se ainda não foi separado) e criar um novo. Se já foi separado, peça no Chat para o CD rejeitar.
                                        </FaqItem>

                                        <FaqItem question="Erro: 'A pasta do Google Drive não foi encontrada'.">
                                            Isso acontece se a pasta do ano/mês foi apagada manualmente no Drive. O sistema tentará recriá-la automaticamente na próxima tentativa. Apenas tente enviar de novo.
                                        </FaqItem>

                                        <FaqItem question="Como instalo o sistema no meu celular? (PWA)">
                                            No Android (Chrome), clique nos 3 pontinhos e selecione <strong>"Adicionar à Tela Inicial"</strong>. O ícone da Shineray aparecerá como um aplicativo nativo.
                                        </FaqItem>
                                    </div>

                                    <div className="mt-10 p-6 bg-gray-50 rounded-xl border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-lg">📞 Suporte TI Sabel</h4>
                                            <p className="text-gray-500 text-sm mt-1">Horário de atendimento: Seg-Sex, 08h às 18h.</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-gray-700">Ramal Interno: 8535</p>
                                            <p className="text-sm text-blue-600">shiadmti@gmail.com</p>
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

// --- COMPONENTES AUXILIARES DE DESIGN ---

function HeaderSection({ title, subtitle, color }) {
    const colors = {
        red: 'text-red-700 border-red-500',
        blue: 'text-blue-700 border-blue-500',
        green: 'text-green-700 border-green-500',
        gray: 'text-gray-700 border-gray-500',
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
                <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-xl shadow-lg group-hover:bg-red-600 transition-colors duration-300 ring-4 ring-gray-100">
                    {number}
                </div>
                <div className="h-full w-0.5 bg-gray-200 mx-auto my-2 group-last:hidden"></div>
            </div>
            <div className="flex-1 pb-8 border-b border-gray-100 last:border-0">
                <h4 className="text-xl font-bold text-gray-800 mb-3 group-hover:text-red-700 transition-colors">{title}</h4>
                <div className="text-gray-600 leading-relaxed">
                    {children}
                </div>
            </div>
        </div>
    );
}

function FaqItem({ question, children }) {
    return (
        <details className="group bg-white border border-gray-200 rounded-lg overflow-hidden transition-all duration-300 open:shadow-md open:border-red-200">
            <summary className="font-bold text-gray-700 p-5 cursor-pointer flex items-center justify-between hover:bg-gray-50 select-none">
                <div className="flex items-center gap-3">
                    <span className="text-red-500 bg-red-50 p-1 rounded">❓</span> 
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