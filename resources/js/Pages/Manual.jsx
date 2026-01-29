import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';

export default function Manual({ auth }) {
    // Define qual aba abrir por padrão baseado no perfil logado
    const getPerfilInicial = () => {
        if (auth.user.perfil === 'gestor') return 'gestor';
        if (auth.user.perfil === 'cd') return 'cd';
        if (auth.user.perfil === 'admin') return 'faq';
        return 'loja';
    };

    const [activeTab, setActiveTab] = useState(getPerfilInicial());

    // Efeito para rolar ao topo quando troca a aba
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [activeTab]);

    const tabs = [
        { id: 'loja',   label: '🏪 Lojas',    color: 'red',    icon: '🛍️', desc: 'Solicitação e Recebimento' },
        { id: 'gestor', label: '👮 Gestão',   color: 'purple', icon: '🛡️', desc: 'Auditoria e Aprovação' },
        { id: 'cd',     label: '🏭 CD/Log',   color: 'blue',   icon: '📦', desc: 'Separação e Expedição' },
        { id: 'drive',  label: '☁️ Drive',    color: 'green',  icon: '📄', desc: 'Arquivamento' },
        { id: 'faq',    label: '❓ Suporte',  color: 'gray',   icon: '🆘', desc: 'Dúvidas Frequentes' },
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
                                ABA 1: LOJA / REVENDA
                               ======================================================= */}
                            {activeTab === 'loja' && (
                                <div className="space-y-10 animate-fade-in">
                                    <HeaderSection 
                                        title="Manual da Loja" 
                                        subtitle="Do pedido à entrega: Entenda o novo fluxo de aprovação."
                                        color="red"
                                    />
                                    
                                    <Step number="1" title="Nova Solicitação">
                                        <p>No menu, clique em <strong className="text-red-600">Nova Solicitação</strong>. Preencha os dados com atenção:</p>
                                        <ul className="mt-3 space-y-2 text-sm text-gray-600 bg-red-50 p-4 rounded-lg border border-red-100">
                                            <li>📌 <strong>Destino:</strong> Selecione para onde a moto vai (ex: sua própria loja ou um cliente em outra cidade). Isso agrupa a carga corretamente.</li>
                                            <li>🔑 <strong>Chassi:</strong> Obrigatório entre <strong>11 e 17 caracteres</strong>. Apenas letras e números (sem traços). O sistema valida se já existe no estoque.</li>
                                            <li>🎨 <strong>Cor:</strong> Essencial para a separação correta no CD.</li>
                                        </ul>
                                    </Step>

                                    <Step number="2" title="Fluxo de Aprovação (Auditoria)">
                                        <p>Seu pedido agora passa por uma auditoria comercial antes de ir para o CD.</p>
                                        <div className="flex flex-col md:flex-row gap-4 mt-4">
                                            <StatusCard color="bg-purple-100 text-purple-800 border-purple-200" title="1. Em Análise" desc="O Gestor está conferindo crédito e estoque." />
                                            <div className="hidden md:flex items-center text-gray-300">➜</div>
                                            <StatusCard color="bg-yellow-100 text-yellow-800 border-yellow-200" title="2. Aprovado/Solicitado" desc="O Gestor liberou. O CD iniciará a separação." />
                                            <div className="hidden md:flex items-center text-gray-300">➜</div>
                                            <StatusCard color="bg-blue-100 text-blue-800 border-blue-200" title="3. Em Trânsito" desc="Nota fiscal emitida e caminhão na estrada." />
                                        </div>
                                    </Step>

                                    <Step number="3" title="Motos Rejeitadas (Cortes)">
                                        <p>O Gestor pode aprovar o pedido parcialmente (ex: você pediu 10 motos, ele aprovou 8).</p>
                                        <p className="text-sm mt-2 text-gray-600">
                                            ⚠️ <strong>Atenção:</strong> Itens rejeitados somem da lista de entrega e aparecem na <strong>Timeline do Pedido</strong> com o motivo do corte (ex: "Sem limite de crédito").
                                        </p>
                                    </Step>

                                    <Step number="4" title="Confirmação de Entrega">
                                        <p>Quando o caminhão chegar na sua loja:</p>
                                        <ol className="list-decimal ml-6 mt-3 text-sm text-gray-700 space-y-2">
                                            <li>Confira fisicamente se os chassis batem com o Romaneio.</li>
                                            <li>Assine e carimbe o documento do motorista.</li>
                                            <li>Acesse o sistema, abra o pedido (Status "Em Trânsito").</li>
                                            <li>Tire uma foto legível do comprovante assinado e clique em <strong>📸 Finalizar Entrega</strong>.</li>
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
                                        title="Painel do Gestor Comercial" 
                                        subtitle="Auditoria, Aprovação e Corte de Pedidos."
                                        color="purple"
                                    />

                                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 mb-6 flex items-start gap-3">
                                        <span className="text-2xl">📱</span>
                                        <div>
                                            <h4 className="font-bold text-purple-900">Modo Tablet Otimizado</h4>
                                            <p className="text-sm text-purple-800">
                                                Use o painel em um iPad ou Tablet Android. A interface é adaptada para toque, permitindo aprovar/rejeitar itens com rapidez.
                                            </p>
                                        </div>
                                    </div>

                                    <Step number="1" title="Alerta de Novos Pedidos">
                                        <p>Sempre que uma loja faz um pedido, você ouve um alerta sonoro ("Plim") e o contador no menu lateral aumenta.</p>
                                        <p className="text-sm text-gray-600">O status inicial é <span className="font-bold text-purple-600">EM ANÁLISE</span>. O CD não visualiza o pedido até você aprovar.</p>
                                    </Step>

                                    <Step number="2" title="Conferência e Corte (Touch)">
                                        <p>Na tela de auditoria, você verá a lista de motos. O sistema padrão é <strong>Tudo Aprovado</strong>.</p>
                                        <ul className="mt-3 space-y-2 text-sm text-gray-700">
                                            <li className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                                                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                                <strong>Verde (Padrão):</strong> Item aprovado. Seguirá para o CD.
                                            </li>
                                            <li className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                                                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                                <strong>Vermelho (Ao Clicar):</strong> Item REJEITADO.
                                            </li>
                                        </ul>
                                        <p className="text-xs text-red-600 mt-2 font-bold ml-1">
                                            ❌ Cuidado: Ao finalizar, os itens vermelhos são EXCLUÍDOS do pedido permanentemente.
                                        </p>
                                    </Step>

                                    <Step number="3" title="Finalização">
                                        <p>Adicione uma observação (opcional) e clique em <strong>Autorizar Pedido</strong>.</p>
                                        <p className="text-sm mt-1">A loja recebe uma notificação e o pedido muda para <span className="text-yellow-600 font-bold">SOLICITADO</span>, ficando visível para o CD separar.</p>
                                    </Step>
                                </div>
                            )}

                            {/* =======================================================
                                ABA 3: CD / EXPEDIÇÃO
                               ======================================================= */}
                            {activeTab === 'cd' && (
                                <div className="space-y-10 animate-fade-in">
                                    <HeaderSection 
                                        title="Manual do Centro de Distribuição" 
                                        subtitle="Separação, Montagem de Carga Inteligente e Expedição."
                                        color="blue"
                                    />

                                    <Step number="1" title="Separação Física">
                                        <p>Você recebe apenas pedidos já aprovados pelo Gestor (Status Amarelo).</p>
                                        <ol className="list-decimal ml-6 text-sm text-gray-600 space-y-2 mt-2">
                                            <li>Localize as motos no pátio conforme o pedido.</li>
                                            <li>Clique em <strong>✅ Confirmar Separação</strong> no sistema.</li>
                                            <li>O status muda para "Separado". As motos agora ficam disponíveis para montar carga.</li>
                                        </ol>
                                    </Step>

                                    <Step number="2" title="Montagem de Carga (Scanner)">
                                        <p>Vá em <strong>Expedição {'>'} Nova Carga</strong>.</p>
                                        <div className="grid md:grid-cols-2 gap-4 mt-3">
                                            <div className="p-4 bg-gray-800 text-white rounded-lg">
                                                <h4 className="font-bold flex items-center gap-2">🔫 Leitor de Código</h4>
                                                <p className="text-sm mt-1 text-gray-300">
                                                    Use o leitor USB ou a Câmera. O sistema valida instantaneamente se a moto bipada pertence a um pedido separado.
                                                </p>
                                            </div>
                                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-blue-900">
                                                <h4 className="font-bold">📍 Agrupamento Inteligente</h4>
                                                <p className="text-sm mt-1">
                                                    O sistema agrupa as motos por <strong>Destino Final</strong> (Ex: Belém, Castanhal). Mesmo que a Loja Acará peça motos para 3 cidades diferentes, o sistema organizará em 3 blocos visuais na tela.
                                                </p>
                                            </div>
                                        </div>
                                    </Step>

                                    <Step number="3" title="Manifesto e Saída">
                                        <p>Após bipar todas as motos do caminhão:</p>
                                        <ul className="list-disc ml-6 mt-1 text-gray-600 text-sm">
                                            <li>Clique em <strong>Gerar Romaneio</strong>.</li>
                                            <li>O sistema gera um PDF oficial (Manifesto) já dividido por destino.</li>
                                            <li>Clique em <strong>Liberar Saída</strong>. Isso muda todos os pedidos vinculados para "Em Trânsito".</li>
                                        </ul>
                                    </Step>

                                    <Step number="4" title="Desfazer Carga (Correção)">
                                        <p>Se errou a carga, use o botão vermelho <strong>🗑️ Desfazer</strong>.</p>
                                        <p className="text-xs text-gray-500">Isso apaga o romaneio e devolve as motos para o status "Separado" no pátio.</p>
                                    </Step>
                                </div>
                            )}

                            {/* =======================================================
                                ABA 4: DRIVE (COMPROVANTES)
                               ======================================================= */}
                            {activeTab === 'drive' && (
                                <div className="space-y-10 animate-fade-in">
                                    <HeaderSection 
                                        title="Arquivamento Digital (Google Drive)" 
                                        subtitle="Backup automático e organização de documentos."
                                        color="green"
                                    />

                                    <Step number="1" title="Estrutura de Pastas">
                                        <p>O sistema organiza os arquivos na nuvem automaticamente. Não é necessário criar pastas manualmente.</p>
                                        <div className="mt-4 font-mono text-xs md:text-sm bg-gray-100 p-4 rounded-lg border border-gray-300 text-gray-700 overflow-x-auto shadow-inner">
                                            📁 Google Drive (Shineray)<br/>
                                            &nbsp;&nbsp;└── 📂 2026<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 📂 01 - Janeiro<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── 📄 Pedido-1093_Aprovado.pdf<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 🖼️ Comprovante_Entrega_Pedido-1093.jpg
                                        </div>
                                    </Step>

                                    <Step number="2" title="Conclusão Automática de Carga">
                                        <p>O Romaneio (Carga) permanece com status "Em Trânsito" até que a última moto seja entregue.</p>
                                        <p className="mt-2 text-sm text-gray-600 bg-green-50 p-3 rounded border border-green-200">
                                            ✅ <strong>Automação:</strong> Assim que a última loja da rota enviar a foto do comprovante, o Romaneio muda automaticamente para <span className="text-green-700 font-bold">FINALIZADO</span>.
                                        </p>
                                    </Step>
                                </div>
                            )}

                            {/* =======================================================
                                ABA 5: FAQ / SUPORTE
                               ======================================================= */}
                            {activeTab === 'faq' && (
                                <div className="space-y-8 animate-fade-in">
                                    <HeaderSection 
                                        title="Suporte Técnico" 
                                        subtitle="Solução de problemas comuns."
                                        color="gray"
                                    />

                                    <div className="grid gap-4">
                                        <FaqItem question="O sistema diz 'Chassi Inválido' na solicitação.">
                                            Verifique se o chassi possui entre <strong>11 e 17 caracteres</strong>. O sistema não aceita caracteres especiais (traços, pontos, barras), apenas letras e números. Espaços em branco no final também podem gerar erro.
                                        </FaqItem>

                                        <FaqItem question="Errei o pedido e o Gestor já aprovou. E agora?">
                                            Se o pedido já está com o CD ("Solicitado"), entre em contato urgente via Chat ou WhatsApp. O CD pode rejeitar o pedido antes de separar, devolvendo-o para você corrigir. Se já foi separado, o CD precisará desfazer a separação primeiro.
                                        </FaqItem>

                                        <FaqItem question="O som de notificação ('Plim') não toca.">
                                            Navegadores modernos (Chrome, Edge) bloqueiam reprodução automática de som. Você precisa interagir com a página (clicar em qualquer lugar) pelo menos uma vez após abrir o sistema para que o navegador libere o áudio.
                                        </FaqItem>

                                        <FaqItem question="Erro ao enviar foto: 'Payload too large'.">
                                            O sistema aceita fotos de até 5MB e tenta comprimir automaticamente. Se o erro persistir, tente tirar a foto em uma resolução menor, envie via PDF ou envie a foto pelo WhatsApp do suporte informando o número do pedido.
                                        </FaqItem>

                                        <FaqItem question="A impressão do Manifesto sai cortada.">
                                            O manifesto é configurado para folha A4. Nas configurações de impressão do navegador, verifique se a opção "Escala" está em "Padrão" ou "Ajustar à página" e se as margens estão zeradas ou mínimas.
                                        </FaqItem>
                                    </div>

                                    <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div>
                                            <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                                <span>📞</span> TI Sabel Logística
                                            </h4>
                                            <p className="text-gray-500 text-sm mt-1">Dúvidas sobre acesso, senhas ou erros no sistema.</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-gray-700">Ramal Interno: <span className="bg-gray-100 px-2 py-1 rounded">8535</span></p>
                                            <p className="text-sm text-blue-600 font-bold mt-1">shiadmti@gmail.com</p>
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

function StatusCard({ color, title, desc }) {
    return (
        <div className={`p-4 rounded-lg border flex-1 ${color}`}>
            <h5 className="font-bold text-sm uppercase mb-1">{title}</h5>
            <p className="text-xs opacity-80 leading-snug">{desc}</p>
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