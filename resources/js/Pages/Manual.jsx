import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState } from 'react';

export default function Manual({ auth }) {
    // Define qual aba abrir por padrão baseado no perfil
    const getPerfilInicial = () => {
        if (auth.user.perfil === 'gestor') return 'gestor';
        if (auth.user.perfil === 'cd') return 'cd';
        if (auth.user.perfil === 'admin') return 'faq';
        return 'loja';
    };

    const [activeTab, setActiveTab] = useState(getPerfilInicial());

    const tabs = [
        { id: 'loja',   label: '🏪 Lojas',    color: 'red',    icon: '🛍️' },
        { id: 'gestor', label: '👮 Gestão',   color: 'purple', icon: '🛡️' }, // NOVA ABA
        { id: 'cd',     label: '🏭 CD/Log',   color: 'blue',   icon: '📦' },
        { id: 'drive',  label: '☁️ Drive',    color: 'green',  icon: '📄' },
        { id: 'faq',    label: '❓ Ajuda',    color: 'gray',   icon: '🆘' },
    ];

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-bold text-2xl text-gray-800">Central de Conhecimento Shineray</h2>}
        >
            <Head title="Manual do Sistema" />

            <div className="py-10 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    
                    {/* NAVEGAÇÃO SUPERIOR */}
                    <div className="flex flex-wrap gap-3 mb-8 justify-center md:justify-start px-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-5 py-3 rounded-xl font-bold transition-all duration-300 shadow-sm text-sm uppercase tracking-wide flex items-center gap-2 border-2
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
                                        subtitle="Do pedido à entrega: Entenda o novo fluxo de aprovação."
                                        color="red"
                                    />
                                    
                                    <Step number="1" title="Nova Solicitação">
                                        <p>No menu, clique em <strong className="text-red-600">Nova Solicitação</strong>. Preencha os dados com atenção:</p>
                                        <ul className="mt-2 space-y-2 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <li>✅ <strong>Modelo:</strong> Utilize a lista de sugestões.</li>
                                            <li>✅ <strong>Chassi:</strong> Obrigatório entre <strong>11 e 17 caracteres</strong>. O sistema valida automaticamente.</li>
                                            <li>✅ <strong>Cor:</strong> Essencial para a separação correta no CD.</li>
                                        </ul>
                                    </Step>

                                    <Step number="2" title="Fluxo de Aprovação (Novo!)">
                                        <p>Seu pedido não vai direto para o CD. Ele passa por uma auditoria comercial.</p>
                                        <div className="flex flex-wrap gap-2 mt-4 text-[10px] md:text-xs font-bold uppercase text-white">
                                            <span className="bg-purple-600 px-3 py-2 rounded-lg shadow">1. Em Análise (Gestor)</span>
                                            <span className="text-gray-400 py-2">➜</span>
                                            <span className="bg-yellow-500 px-3 py-2 rounded-lg opacity-50">2. Solicitado (CD)</span>
                                            <span className="text-gray-400 py-2">➜</span>
                                            <span className="bg-green-500 px-3 py-2 rounded-lg opacity-50">3. Entregue</span>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-2">Você receberá uma notificação assim que o Gestor aprovar.</p>
                                    </Step>

                                    <Step number="3" title="Motos Rejeitadas/Cortadas">
                                        <p>O Gestor pode aprovar o pedido parcialmente (ex: pedir 10 motos e aprovar 8).</p>
                                        <p className="text-sm mt-1">
                                            Se isso acontecer, verifique a <strong>Timeline do Pedido</strong>. 
                                            Lá aparecerá a lista de itens cortados e o motivo (ex: "Sem limite de crédito").
                                        </p>
                                    </Step>

                                    <Step number="4" title="Confirmação de Entrega">
                                        <p>Quando o caminhão chegar:</p>
                                        <ol className="list-decimal ml-6 mt-2 text-sm text-gray-700 space-y-1">
                                            <li>Confira as motos físicas.</li>
                                            <li>Assine o Romaneio do motorista.</li>
                                            <li>Abra o pedido no sistema (Status "Em Trânsito").</li>
                                            <li>Tire uma foto do papel assinado e clique em <strong>Finalizar Entrega</strong>.</li>
                                        </ol>
                                    </Step>
                                </div>
                            )}

                            {/* =======================================================
                                ABA 2: GESTÃO COMERCIAL (DIEGO)
                               ======================================================= */}
                            {activeTab === 'gestor' && (
                                <div className="space-y-10">
                                    <HeaderSection 
                                        title="Painel do Gestor Comercial" 
                                        subtitle="Auditoria, Aprovação e Corte de Pedidos."
                                        color="purple"
                                    />

                                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 mb-6">
                                        <h4 className="font-bold text-purple-900 flex items-center gap-2">📱 Modo Tablet</h4>
                                        <p className="text-sm text-purple-800">
                                            Seu painel foi desenhado para uso em tablets (iPad/Android). 
                                            Acesse <strong>painel.shineray.../gestor</strong> para uma visão limpa.
                                        </p>
                                    </div>

                                    <Step number="1" title="Recebimento de Solicitações">
                                        <p>Sempre que uma loja faz um pedido, você recebe um alerta sonoro ("Plim").</p>
                                        <p className="text-sm text-gray-600">O pedido entra com status roxo <strong>EM ANÁLISE</strong>. O CD ainda não vê esse pedido.</p>
                                    </Step>

                                    <Step number="2" title="Conferência e Corte de Itens">
                                        <p>Ao abrir um pedido, você verá a lista de motos solicitadas.</p>
                                        <ul className="mt-3 space-y-2 text-sm text-gray-700">
                                            <li className="flex items-center gap-2">
                                                <span className="bg-green-100 text-green-700 px-2 rounded font-bold">VERDE (Padrão)</span>
                                                <span>A moto está aprovada e seguirá para o CD.</span>
                                            </li>
                                            <li className="flex items-center gap-2">
                                                <span className="bg-red-100 text-red-700 px-2 rounded font-bold">VERMELHO (Clique)</span>
                                                <span>Ao clicar no item, você o <strong>REJEITA</strong>.</span>
                                            </li>
                                        </ul>
                                        <p className="text-xs text-red-600 mt-2 font-bold">⚠️ Importante: Itens rejeitados são EXCLUÍDOS do pedido e do banco de dados para não sujar o estoque com erros de digitação da loja.</p>
                                    </Step>

                                    <Step number="3" title="Justificativa e Finalização">
                                        <p>Antes de clicar em "Autorizar", você pode escrever uma observação (ex: "Liberado exceção").</p>
                                        <p className="text-sm mt-1">Ao finalizar, a loja recebe um aviso e o pedido (apenas com os itens aprovados) aparece para o CD separar.</p>
                                    </Step>

                                    <Step number="4" title="Histórico de Auditoria">
                                        <p>Acesse o botão <strong>"Ver Histórico"</strong> no seu dashboard para ver um log completo de tudo que foi aprovado ou cortado, com datas e quem autorizou.</p>
                                    </Step>
                                </div>
                            )}

                            {/* =======================================================
                                ABA 3: CD / EXPEDIÇÃO
                               ======================================================= */}
                            {activeTab === 'cd' && (
                                <div className="space-y-10">
                                    <HeaderSection 
                                        title="Manual do Centro de Distribuição" 
                                        subtitle="Separação, Montagem de Carga e Expedição."
                                        color="blue"
                                    />

                                    <Step number="1" title="Novos Pedidos (Apenas Aprovados)">
                                        <p>Você só recebe pedidos que já passaram pelo Gestor Comercial.</p>
                                        <p className="text-sm text-gray-600">Pedidos novos aparecem em Amarelo (Solicitado) no seu Dashboard.</p>
                                    </Step>

                                    <Step number="2" title="Separação Física">
                                        <ol className="list-decimal ml-6 text-sm text-gray-600 space-y-1 mt-2">
                                            <li>Abra o pedido e localize as motos no pátio.</li>
                                            <li>Clique em <strong>✅ Confirmar Separação</strong>.</li>
                                            <li>Isso avisa a loja que a moto já está reservada para ela.</li>
                                        </ol>
                                    </Step>

                                    <Step number="3" title="Expedição com Scanner (Bipar)">
                                        <p>Vá em <strong>Expedição {'>'} Nova Carga</strong>.</p>
                                        <div className="mt-3 p-4 bg-gray-800 text-white rounded-lg">
                                            <h4 className="font-bold flex items-center gap-2">🔫 Leitor de Código de Barras</h4>
                                            <p className="text-sm mt-1 text-gray-300">
                                                Use o leitor USB ou a Câmera do celular. O sistema valida se a moto bipada pertence a um pedido separado.
                                            </p>
                                        </div>
                                    </Step>

                                    <Step number="4" title="Saída e Manifesto">
                                        <p>Após bipar todas as motos do caminhão:</p>
                                        <ul className="list-disc ml-6 mt-1 text-gray-600 text-sm">
                                            <li>Clique em <strong>Gerar Romaneio</strong>.</li>
                                            <li>O sistema gera um PDF oficial com layout de Manifesto.</li>
                                            <li>Clique em <strong>Liberar Saída</strong> para mudar o status para "Em Trânsito".</li>
                                        </ul>
                                    </Step>
                                </div>
                            )}

                            {/* =======================================================
                                ABA 4: DRIVE (COMPROVANTES)
                               ======================================================= */}
                            {activeTab === 'drive' && (
                                <div className="space-y-10">
                                    <HeaderSection 
                                        title="Arquivamento Digital (Google Drive)" 
                                        subtitle="Backup automático e organização de documentos."
                                        color="green"
                                    />

                                    <Step number="1" title="Estrutura de Pastas">
                                        <p>O sistema organiza os arquivos na nuvem automaticamente:</p>
                                        <div className="mt-4 font-mono text-xs md:text-sm bg-gray-100 p-4 rounded-lg border border-gray-300 text-gray-700 overflow-x-auto">
                                            📁 Google Drive<br/>
                                            &nbsp;&nbsp;└── 📂 2026<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 📂 01 - Janeiro<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── 📄 Romaneio-105_13-01-2026_Belem.jpg<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 📄 Romaneio-106_13-01-2026_Matriz.pdf
                                        </div>
                                    </Step>

                                    <Step number="2" title="Conclusão Automática">
                                        <p>O Romaneio (Carga) fica aberto enquanto tiver pedidos pendentes.</p>
                                        <p className="mt-2 text-sm text-gray-600">
                                            Assim que o <strong>último pedido</strong> daquela carga for entregue (com upload da foto), o status do Romaneio muda para <span className="text-green-600 font-bold">FINALIZADO</span>.
                                        </p>
                                    </Step>
                                </div>
                            )}

                            {/* =======================================================
                                ABA 5: FAQ
                               ======================================================= */}
                            {activeTab === 'faq' && (
                                <div className="space-y-8">
                                    <HeaderSection 
                                        title="Suporte Técnico" 
                                        subtitle="Solução de problemas comuns."
                                        color="gray"
                                    />

                                    <div className="grid gap-4">
                                        <FaqItem question="O sistema diz 'Chassi Inválido' na solicitação.">
                                            Verifique se você digitou entre 11 e 17 caracteres. O sistema não aceita caracteres especiais (traços, pontos), apenas letras e números.
                                        </FaqItem>

                                        <FaqItem question="Errei o pedido e o Gestor já aprovou. E agora?">
                                            Se o pedido já está com o CD ("Solicitado" ou "Separado"), use o <strong>Chat do Pedido</strong> para pedir ao CD que rejeite o item. Se ainda não foi separado, o CD pode rejeitar e ele volta para você.
                                        </FaqItem>

                                        <FaqItem question="Não recebo o som de notificação ('Plim').">
                                            Os navegadores bloqueiam sons automáticos. Você precisa clicar em qualquer lugar da página pelo menos uma vez após abrir o sistema para "ativar" o áudio.
                                        </FaqItem>

                                        <FaqItem question="Erro ao enviar foto: 'Payload too large'.">
                                            O sistema já comprime as fotos automaticamente. Se o erro persistir, tente tirar a foto em uma resolução menor ou enviar via PDF.
                                        </FaqItem>
                                    </div>

                                    <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-lg">📞 TI Sabel Logística</h4>
                                            <p className="text-gray-500 text-sm mt-1">Dúvidas sobre acesso ou erros no sistema.</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-gray-700">Ramal: 8535</p>
                                            <p className="text-sm text-blue-600 font-bold">shiadmti@gmail.com</p>
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

// --- COMPONENTES VISUAIS ---

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