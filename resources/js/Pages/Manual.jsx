import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState } from 'react';

export default function Manual({ auth }) {
    // Define qual aba abrir por padrão baseado no perfil do usuário logado
    const perfilInicial = auth.user.perfil === 'admin' ? 'admin' : auth.user.perfil === 'cd' ? 'cd' : 'loja';
    const [activeTab, setActiveTab] = useState(perfilInicial);

    const tabs = [
        { id: 'loja', label: '🏪 Para Lojas', color: 'red' },
        { id: 'cd', label: '🏭 Para CD/Expedição', color: 'blue' },
        { id: 'admin', label: '🛡️ Para Admin', color: 'black' },
        { id: 'faq', label: '❓ Dúvidas Frequentes', color: 'green' },
    ];

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-bold text-2xl text-gray-800">Central de Ajuda & Treinamento</h2>}
        >
            <Head title="Manual do Sistema" />

            <div className="py-12 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    
                    {/* NAVEGAÇÃO ENTRE ABAS */}
                    <div className="flex flex-wrap gap-2 mb-6 justify-center md:justify-start">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-6 py-3 rounded-full font-bold transition shadow-sm text-sm uppercase tracking-wide
                                    ${activeTab === tab.id 
                                        ? `bg-${tab.color}-600 text-white shadow-lg scale-105` 
                                        : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white overflow-hidden shadow-xl sm:rounded-2xl border-t-4 border-gray-800">
                        <div className="p-8">
                            
                            {/* --- CONTEÚDO: LOJA --- */}
                            {activeTab === 'loja' && (
                                <div className="space-y-8 animate-fade-in">
                                    <HeaderSection icon="🏪" title="Manual da Loja / Revenda" desc="Como solicitar motos e acompanhar seus pedidos." />
                                    
                                    <Step number="1" title="Criar Nova Solicitação">
                                        <p>No menu superior ou Dashboard, clique em <strong>"Nova Solicitação"</strong>.</p>
                                        <p className="mt-2">Preencha a lista de motos desejadas:</p>
                                        <ul className="list-disc ml-6 mt-1 text-gray-600">
                                            <li><strong>Modelo:</strong> Selecione na lista ou digite.</li>
                                            <li><strong>Chassi:</strong> Digite os 11 dígitos (apenas letras e números).</li>
                                            <li><strong>Cor:</strong> Obrigatório.</li>
                                        </ul>
                                        <div className="mt-3 bg-yellow-50 p-3 rounded border border-yellow-200 text-yellow-800 text-sm">
                                            ⚠️ <strong>Atenção:</strong> O envio com a tecla "Enter" é bloqueado para evitar erros. Clique no botão azul "Finalizar Solicitação".
                                        </div>
                                    </Step>

                                    <Step number="2" title="Acompanhar Status">
                                        <p>Acesse <strong>"Meus Pedidos"</strong> para ver o andamento:</p>
                                        <StatusBadge status="solicitado" desc="Aguardando o CD ver seu pedido. Você ainda pode cancelar." />
                                        <StatusBadge status="separado" desc="O CD já reservou as motos. Não é possível mais cancelar." />
                                        <StatusBadge status="em_transito" desc="O caminhão saiu do CD. Aguarde a chegada." />
                                    </Step>
                                </div>
                            )}

                            {/* --- CONTEÚDO: CD --- */}
                            {activeTab === 'cd' && (
                                <div className="space-y-8 animate-fade-in">
                                    <HeaderSection icon="🏭" title="Manual do Operador Logístico (CD)" desc="Conferência, Separação e Expedição de Cargas." />

                                    <Step number="1" title="Painel de Controle (Dashboard)">
                                        <p>Mantenha o Dashboard aberto. Ele atualiza automaticamente a cada <strong>10 segundos</strong>.</p>
                                        <p>Fique atento ao cartão amarelo <strong>"Novas Solicitações"</strong>.</p>
                                    </Step>

                                    <Step number="2" title="Conferência e Separação">
                                        <ol className="list-decimal ml-6 text-gray-700 space-y-2">
                                            <li>Acesse o menu <strong>"Conferência"</strong>.</li>
                                            <li>Entre em um pedido com status <strong>"Solicitado"</strong>.</li>
                                            <li>Verifique se as motos existem no estoque físico.</li>
                                            <li>Clique em <span className="text-green-600 font-bold">✅ Confirmar Separação</span>.</li>
                                        </ol>
                                        <p className="mt-2 text-sm text-gray-500">Isso envia as motos para o "Pool" (Pátio Virtual), prontas para serem carregadas.</p>
                                    </Step>

                                    <Step number="3" title="Montagem de Carga (Expedição)">
                                        <p>Vá em <strong>Expedição {'>'} Nova Carga</strong>.</p>
                                        <div className="flex flex-col md:flex-row gap-4 mt-3">
                                            <div className="flex-1 bg-gray-50 p-4 rounded border">
                                                <h4 className="font-bold text-gray-800 mb-2">Opção A: Leitor de Código de Barras (Recomendado)</h4>
                                                <p className="text-sm">1. Clique no campo preto "Leitura".</p>
                                                <p className="text-sm">2. Bipe o chassi da moto física.</p>
                                                <p className="text-sm">3. O sistema marcará a moto em <span className="text-green-600 font-bold">VERDE</span> automaticamente.</p>
                                            </div>
                                            <div className="flex-1 bg-gray-50 p-4 rounded border">
                                                <h4 className="font-bold text-gray-800 mb-2">Opção B: Manual</h4>
                                                <p className="text-sm">Clique nos cartões das motos na lista para selecionar.</p>
                                            </div>
                                        </div>
                                        <p className="mt-4">Ao final, clique em <strong>"Gerar Romaneio"</strong>.</p>
                                    </Step>

                                    <Step number="4" title="Saída do Caminhão">
                                        <p>Na tela do Romaneio:</p>
                                        <ul className="list-disc ml-6 mt-1 text-gray-600">
                                            <li>Imprima o <strong>Manifesto</strong> (Botão Imprimir).</li>
                                            <li>Quando o motorista estiver saindo, clique em <span className="bg-green-600 text-white px-2 py-0.5 rounded text-xs font-bold">🚛 Liberar Saída</span>.</li>
                                        </ul>
                                        <div className="mt-3 bg-red-50 p-3 rounded border border-red-200 text-red-800 text-sm">
                                            🛑 <strong>Importante:</strong> Se montou a carga errada, clique em <strong>"Desfazer"</strong> ANTES de liberar a saída. Isso devolve as motos para o pátio.
                                        </div>
                                    </Step>
                                </div>
                            )}

                            {/* --- CONTEÚDO: ADMIN --- */}
                            {activeTab === 'admin' && (
                                <div className="space-y-8 animate-fade-in">
                                    <HeaderSection icon="🛡️" title="Manual do Administrador" desc="Gestão de usuários, auditoria e relatórios." />

                                    <Step number="1" title="Gestão de Usuários">
                                        <p>Acesse o menu <strong>Usuários</strong>.</p>
                                        <ul className="list-disc ml-6 mt-1 text-gray-600">
                                            <li>Crie contas para novas Lojas ou funcionários do CD.</li>
                                            <li>Use o botão "Remover" para revogar acesso de ex-funcionários imediatamente.</li>
                                            <li><strong>Monitoramento:</strong> A bolinha <span className="text-green-500 font-bold">verde pulsante</span> indica que o usuário está online agora.</li>
                                        </ul>
                                    </Step>

                                    <Step number="2" title="Auditoria (Rastreabilidade)">
                                        <p>O sistema grava logs de todas as ações críticas.</p>
                                        <p>Acesse o menu <strong>Auditoria</strong> para investigar:</p>
                                        <ul className="list-disc ml-6 mt-1 text-gray-600">
                                            <li>Quem alterou a placa de um romaneio?</li>
                                            <li>Quem editou o perfil de um usuário?</li>
                                            <li>O sistema mostra o valor <strong>ANTIGO</strong> e o <strong>NOVO</strong>.</li>
                                        </ul>
                                    </Step>

                                    <Step number="3" title="Relatórios e Excel">
                                        <p>Para baixar dados para reuniões:</p>
                                        <ol className="list-decimal ml-6 text-gray-600">
                                            <li>Vá em <strong>Auditoria de Pedidos</strong>.</li>
                                            <li>Use a busca para filtrar (Ex: "Loja Centro" ou "2025").</li>
                                            <li>Clique no botão <strong>"📊 Excel"</strong>.</li>
                                        </ol>
                                        <p className="text-sm text-gray-500 mt-2">O arquivo CSV gerado já possui formatação para evitar a quebra dos números de chassi no Excel.</p>
                                    </Step>
                                </div>
                            )}

                            {/* --- CONTEÚDO: FAQ --- */}
                            {activeTab === 'faq' && (
                                <div className="space-y-6 animate-fade-in">
                                    <HeaderSection icon="❓" title="Solução de Problemas (Troubleshooting)" desc="Respostas rápidas para erros comuns." />

                                    <FaqItem question="Apareceu uma tela vermelha com 'Server Error' (500). O que eu faço?">
                                        Isso indica uma falha de conexão momentânea ou erro no servidor. <strong>Tire um print</strong> da tela (se houver detalhes), aguarde 5 minutos e tente novamente. Se persistir, envie o print para o suporte de TI.
                                    </FaqItem>

                                    <FaqItem question="O Leitor de Código de Barras não está 'bipando' na tela.">
                                        O leitor funciona como um teclado. Para ele funcionar, o cursor do mouse precisa estar piscando dentro do campo preto <strong>"Leitura"</strong>. Clique no campo e tente novamente.
                                    </FaqItem>

                                    <FaqItem question="No Excel, o chassi aparece como '9.9E+10' (Número Científico).">
                                        O sistema tenta evitar isso automaticamente, mas se ocorrer: Selecione a coluna do Chassi no Excel, clique com o botão direito &gt; Formatar Células &gt; Escolha <strong>"Texto"</strong>.
                                    </FaqItem>

                                    <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                                        <h4 className="font-bold text-gray-800 mb-2">📞 Contatos de Suporte (SLA 4h)</h4>
                                        <p><strong>E-mail:</strong> shiadmti@gmail.com</p>
                                        <p><strong>Ramal TI:</strong> 1000</p>
                                        <p className="text-xs text-gray-500 mt-2">Horário de Atendimento: Seg-Sex, 08:00 às 18:00.</p>
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

// --- SUBCOMPONENTES PARA ORGANIZAÇÃO ---

function HeaderSection({ icon, title, desc }) {
    return (
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100">
            <div className="text-5xl">{icon}</div>
            <div>
                <h3 className="text-2xl font-black text-gray-800">{title}</h3>
                <p className="text-gray-500">{desc}</p>
            </div>
        </div>
    );
}

function Step({ number, title, children }) {
    return (
        <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
                {number}
            </div>
            <div className="flex-1">
                <h4 className="text-lg font-bold text-gray-800 mb-2">{title}</h4>
                <div className="text-gray-600 leading-relaxed text-sm md:text-base">
                    {children}
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status, desc }) {
    const colors = {
        solicitado: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        separado: 'bg-blue-100 text-blue-800 border-blue-200',
        em_transito: 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return (
        <div className="flex items-center gap-3 mt-3 p-2 rounded bg-gray-50 border border-gray-100">
            <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${colors[status] || 'bg-gray-100'}`}>
                {status.replace('_', ' ')}
            </span>
            <span className="text-sm text-gray-600">{desc}</span>
        </div>
    );
}

function FaqItem({ question, children }) {
    return (
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition bg-white">
            <h5 className="font-bold text-red-600 mb-2 flex items-center gap-2">
                <span>❓</span> {question}
            </h5>
            <p className="text-gray-600 text-sm ml-6">{children}</p>
        </div>
    );
}