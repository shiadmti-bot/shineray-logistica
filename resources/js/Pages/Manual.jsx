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
        { id: 'comprovantes', label: '📄 Entrega & Drive', color: 'green' }, // NOVA ABA
        { id: 'faq', label: '❓ Dúvidas Frequentes', color: 'gray' },
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
                                className={`px-6 py-3 rounded-full font-bold transition shadow-sm text-sm uppercase tracking-wide flex items-center gap-2
                                    ${activeTab === tab.id 
                                        ? `bg-${tab.color}-600 text-white shadow-lg scale-105 border-transparent` 
                                        : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                                    }`}
                                style={{
                                    backgroundColor: activeTab === tab.id ? undefined : 'white',
                                    // Hack para cores dinâmicas no Tailwind JIT se não estiverem no safelist
                                    ...(activeTab === tab.id && tab.color === 'red' ? { backgroundColor: '#dc2626' } : {}),
                                    ...(activeTab === tab.id && tab.color === 'blue' ? { backgroundColor: '#2563eb' } : {}),
                                    ...(activeTab === tab.id && tab.color === 'green' ? { backgroundColor: '#16a34a' } : {}),
                                    ...(activeTab === tab.id && tab.color === 'gray' ? { backgroundColor: '#4b5563' } : {}),
                                }}
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
                                    <HeaderSection icon="🏪" title="Manual da Loja / Revenda" desc="Como solicitar motos, usar o chat e acompanhar entregas." />
                                    
                                    <Step number="1" title="Criar Nova Solicitação">
                                        <p>No menu superior ou Dashboard, clique em <strong>"Nova Solicitação"</strong>.</p>
                                        <p className="mt-2">Preencha a lista de motos desejadas:</p>
                                        <ul className="list-disc ml-6 mt-1 text-gray-600">
                                            <li><strong>Modelo:</strong> Selecione na lista ou digite.</li>
                                            <li><strong>Chassi:</strong> Digite os 11 dígitos (apenas letras e números).</li>
                                            <li><strong>Cor:</strong> Obrigatório.</li>
                                        </ul>
                                    </Step>

                                    <Step number="2" title="Cancelar ou Corrigir (Antes da Separação)">
                                        <p>Se você errou um chassi ou desistiu do pedido, você pode cancelar sozinho <strong>enquanto o CD ainda não começou a trabalhar</strong>.</p>
                                        <ol className="list-decimal ml-6 mt-2 text-sm text-gray-700">
                                            <li>Entre no pedido com status <span className="text-yellow-600 font-bold bg-yellow-50 px-1 rounded">SOLICITADO</span>.</li>
                                            <li>Procure o quadro amarelo de aviso no topo.</li>
                                            <li>Clique no botão vermelho <strong>🗑️ Cancelar Solicitação</strong>.</li>
                                        </ol>
                                        <p className="mt-2 text-xs text-gray-500 italic">Isso libera o chassi imediatamente para ser pedido de novo.</p>
                                    </Step>

                                    <Step number="3" title="Conversar com o CD (Chat em Tempo Real)">
                                        <p>Precisa avisar algo urgente sobre um pedido específico?</p>
                                        <ul className="list-disc ml-6 mt-1 text-gray-600">
                                            <li>Abra o pedido desejado.</li>
                                            <li>No canto inferior direito, clique no botão flutuante <strong>🔵 Chat do Pedido</strong>.</li>
                                            <li>Envie sua mensagem. O CD receberá uma notificação sonora na hora! 🔔</li>
                                        </ul>
                                        <div className="mt-2 flex gap-2 text-xs font-bold text-gray-400">
                                            <span>✓ Enviado</span>
                                            <span className="text-blue-500">✓✓ Lido</span>
                                        </div>
                                    </Step>

                                    <Step number="4" title="Confirmar Recebimento (Finalizar)">
                                        <p>Quando o caminhão chegar na sua loja:</p>
                                        <ol className="list-decimal ml-6 mt-2 text-sm text-gray-700">
                                            <li>Confira as motos físicas.</li>
                                            <li>Assine o canhoto do romaneio.</li>
                                            <li>No sistema, abra o pedido (que estará "Em Trânsito").</li>
                                            <li>No quadro verde <strong>"Confirmar Recebimento"</strong>, tire uma foto do canhoto assinado.</li>
                                            <li>O sistema vai comprimir a foto automaticamente e enviar. <strong>Pronto! Pedido Concluído. 🎉</strong></li>
                                        </ol>
                                    </Step>
                                </div>
                            )}

                            {/* --- CONTEÚDO: CD --- */}
                            {activeTab === 'cd' && (
                                <div className="space-y-8 animate-fade-in">
                                    <HeaderSection icon="🏭" title="Manual do Operador Logístico (CD)" desc="Gestão total: Separação, Carga e Finalização." />

                                    <Step number="1" title="Dashboard e Alertas">
                                        <p>Mantenha o Dashboard aberto. Ele atualiza sozinho.</p>
                                        <ul className="list-disc ml-6 mt-1 text-gray-600">
                                            <li><strong>Cartão Amarelo:</strong> Novos pedidos para separar.</li>
                                            <li><strong>Cartão Azul:</strong> Motos separadas aguardando carga.</li>
                                        </ul>
                                    </Step>

                                    <Step number="2" title="Conferência e Separação">
                                        <p>Ao abrir um pedido "Solicitado":</p>
                                        <ol className="list-decimal ml-6 text-gray-700 space-y-2">
                                            <li>Verifique se as motos existem no estoque.</li>
                                            <li>Se tudo estiver ok, clique em <span className="text-blue-600 font-bold">✅ Confirmar Separação</span>.</li>
                                            <li><strong>Se houver problema:</strong> Use o botão "Rejeitar" e escreva o motivo (ex: "Chassi não localizado"). O pedido volta para a loja corrigir.</li>
                                        </ol>
                                    </Step>

                                    <Step number="3" title="Montagem de Carga (Expedição)">
                                        <p>Vá em <strong>Expedição {'>'} Nova Carga</strong>.</p>
                                        <div className="bg-blue-50 p-4 rounded border border-blue-100 mt-2">
                                            <h4 className="font-bold text-blue-900 mb-2">💡 Dica de Ouro: Leitor de Código de Barras</h4>
                                            <p className="text-sm text-blue-800">Clique no campo preto "Leitura" e bipe o chassi das motos. O sistema marca em verde automaticamente e evita erros de digitação.</p>
                                        </div>
                                    </Step>

                                    <Step number="4" title="Saída e Trânsito">
                                        <p>Depois de gerar o Romaneio:</p>
                                        <ul className="list-disc ml-6 mt-1 text-gray-600">
                                            <li>Imprima o Manifesto para o motorista.</li>
                                            <li>Quando o caminhão sair, clique em <strong>🚛 Confirmar Saída</strong>.</li>
                                            <li>Isso dispara um aviso para a Loja que o pedido está a caminho.</li>
                                        </ul>
                                    </Step>

                                    <Step number="5" title="Baixa Manual (Se a Loja não fizer)">
                                        <p>A Loja deve dar baixa no pedido, mas se ela estiver sem internet:</p>
                                        <p className="text-sm mt-1">O motorista trará o papel assinado de volta. Você pode entrar no pedido e usar o mesmo quadro verde <strong>"Confirmar Recebimento"</strong> para digitalizar o papel e encerrar o processo.</p>
                                    </Step>
                                </div>
                            )}

                            {/* --- CONTEÚDO: COMPROVANTES E DRIVE --- */}
                            {activeTab === 'comprovantes' && (
                                <div className="space-y-8 animate-fade-in">
                                    <HeaderSection icon="📂" title="Arquivamento Digital (Google Drive)" desc="Como o sistema organiza seus documentos automaticamente." />

                                    <Step number="1" title="Organização Automática de Pastas">
                                        <p>Você não precisa criar pastas no Google Drive. O sistema faz isso sozinho!</p>
                                        <div className="mt-4 bg-gray-50 p-4 rounded border border-gray-200 font-mono text-sm">
                                            📂 Shineray Logistica (Raiz)<br/>
                                            &nbsp;&nbsp;📂 2026<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;📂 01 - Janeiro<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;📄 Romaneio-150_09-01-2026_Recife.jpg<br/>
                                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;📄 Romaneio-151_09-01-2026_Belem.pdf
                                        </div>
                                        <p className="mt-2 text-sm text-gray-500">O sistema cria a pasta do Ano e do Mês automaticamente no primeiro upload do dia.</p>
                                    </Step>

                                    <Step number="2" title="Nomenclatura Padrão">
                                        <p>Para facilitar a busca futura, todos os arquivos são renomeados para:</p>
                                        <p className="font-bold text-gray-800 mt-1">Romaneio-[NUMERO]_[DATA]_[FILIAL]_ID-[PEDIDO].ext</p>
                                        <p className="text-xs text-gray-500 mt-2">Exemplo: Romaneio-123_09-01-2026_Filial-Centro_ID-555.jpg</p>
                                    </Step>

                                    <Step number="3" title="Fechamento Automático de Carga">
                                        <p>Uma carga (Romaneio) pode ter 10 pedidos diferentes.</p>
                                        <p>O sistema monitora cada entrega. Quando o <strong>último</strong> pedido daquela carga é entregue, o status do Romaneio muda para <span className="text-green-600 font-bold">FINALIZADO</span> automaticamente.</p>
                                    </Step>
                                </div>
                            )}

                            {/* --- CONTEÚDO: FAQ --- */}
                            {activeTab === 'faq' && (
                                <div className="space-y-6 animate-fade-in">
                                    <HeaderSection icon="❓" title="Solução de Problemas" desc="Respostas rápidas para erros comuns." />

                                    <FaqItem question="O Chat não toca som quando chega mensagem.">
                                        Os navegadores bloqueiam sons automáticos se você não interagiu com a página. Clique em qualquer lugar da tela pelo menos uma vez. Verifique também se o volume da aba não está mudo.
                                    </FaqItem>

                                    <FaqItem question="A foto do comprovante está demorando muito para enviar.">
                                        O sistema possui um <strong>Compressor Inteligente</strong>. Se a foto for muito grande (4K), o botão ficará como "Processando..." por alguns segundos antes de enviar. Isso é normal e economiza seus dados móveis.
                                    </FaqItem>

                                    <FaqItem question="Errei o chassi no pedido e já foi separado. Como corrigir?">
                                        Neste estágio (Separado), você não pode mais cancelar sozinho. Use o <strong>Chat do Pedido</strong> para pedir ao CD que rejeite o pedido. Assim ele volta para você editar.
                                    </FaqItem>

                                    <FaqItem question="Erro 500 / Tela Vermelha ao tentar enviar arquivo.">
                                        Geralmente isso é uma instabilidade momentânea do Google Drive. Aguarde 1 minuto e tente de novo. Se persistir, contate o suporte.
                                    </FaqItem>

                                    <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                                        <h4 className="font-bold text-gray-800 mb-2">📞 Suporte Técnico</h4>
                                        <p><strong>E-mail:</strong> shiadmti@gmail.com</p>
                                        <p className="text-xs text-gray-500 mt-2">O sistema roda em ambiente seguro com backups diários.</p>
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

// --- SUBCOMPONENTES ---

function HeaderSection({ icon, title, desc }) {
    return (
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100">
            <div className="text-4xl md:text-5xl bg-white p-3 rounded-full shadow-sm border border-gray-100">{icon}</div>
            <div>
                <h3 className="text-2xl font-black text-gray-800">{title}</h3>
                <p className="text-gray-500">{desc}</p>
            </div>
        </div>
    );
}

function Step({ number, title, children }) {
    return (
        <div className="flex gap-4 group">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold text-lg shadow-md group-hover:bg-red-600 transition-colors duration-300">
                {number}
            </div>
            <div className="flex-1 bg-white p-4 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all">
                <h4 className="text-lg font-bold text-gray-800 mb-2">{title}</h4>
                <div className="text-gray-600 leading-relaxed text-sm md:text-base">
                    {children}
                </div>
            </div>
        </div>
    );
}

function FaqItem({ question, children }) {
    return (
        <details className="group border border-gray-200 rounded-lg bg-white overflow-hidden transition-all duration-300 open:shadow-md">
            <summary className="font-bold text-gray-700 p-4 cursor-pointer flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-2">
                    <span className="text-red-500">❓</span> {question}
                </div>
                <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="p-4 pt-0 text-gray-600 text-sm ml-8 leading-relaxed border-t border-transparent group-open:border-gray-100">
                {children}
            </div>
        </details>
    );
}