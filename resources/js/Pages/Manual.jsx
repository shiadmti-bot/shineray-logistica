import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { 
    BuildingStorefrontIcon, 
    ClipboardDocumentCheckIcon, 
    TruckIcon, 
    CloudArrowUpIcon, 
    QuestionMarkCircleIcon, 
    ArchiveBoxIcon, 
    ShieldCheckIcon, 
    DocumentTextIcon, 
    LifebuoyIcon,
    PhoneIcon,
    EnvelopeIcon,
    WrenchScrewdriverIcon,
    PencilSquareIcon,
    TrashIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowUturnLeftIcon,
    ArrowPathIcon,
    InformationCircleIcon
} from '@heroicons/react/24/outline';

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
        { id: 'loja',   label: 'Lojas',       color: 'red',    icon: <BuildingStorefrontIcon className="w-6 h-6" />, desc: 'Solicitações e Transferências' },
        { id: 'gestor', label: 'Gestão',      color: 'purple', icon: <ClipboardDocumentCheckIcon className="w-6 h-6" />, desc: 'Auditoria Comercial' },
        { id: 'cd',     label: 'Logística',   color: 'blue',   icon: <TruckIcon className="w-6 h-6" />, desc: 'Expedição e Milk Run' },
        { id: 'drive',  label: 'Arquivos',    color: 'green',  icon: <CloudArrowUpIcon className="w-6 h-6" />, desc: 'Comprovantes Digitais' },
        { id: 'faq',    label: 'Suporte',     color: 'gray',   icon: <QuestionMarkCircleIcon className="w-6 h-6" />, desc: 'Ajuda e Contatos' },
    ];

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-bold text-2xl text-gray-800">Central de Conhecimento V2.4</h2>}
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
                                <span className="mb-1 md:mb-0">{tab.icon}</span> 
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
                            
                            {activeTab === 'loja' && (
                                <div className="space-y-10 animate-fade-in">
                                    <HeaderSection 
                                        title="Manual da Loja (V2.4)" 
                                        subtitle="Tudo o que você precisa saber para gerenciar seu estoque, transferências e regras de recebimento."
                                        color="red"
                                    />
                                    
                                    {/* PASSO A PASSO GERAL DA LOJA */}
                                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-8">
                                        <h3 className="text-xl font-black text-gray-800 border-b pb-4">🔄 Ciclo Completo de uma Moto (Como Pedir e Receber)</h3>
                                        
                                        <Step number="1" title="Criando o Pedido">
                                            <p>Acesse o menu lateral e clique em <strong>Nova Solicitação</strong>. Preencha os dados da moto que você precisa.</p>
                                            <ul className="list-disc ml-6 mt-3 space-y-2 text-sm text-gray-600">
                                                <li><strong>Pedindo de outra Loja (Transferência):</strong> Selecione o nome da loja no campo "Origem", preencha o Modelo, Cor e digite o <strong>Chassi Exato</strong> da moto.</li>
                                                <li><strong>Pedindo da Fábrica (CD/Reposição):</strong> Selecione o modo "Reposição CD". Preencha o Modelo, Cor e o <strong>Chassi</strong> da moto disponível no estoque do CD.</li>
                                                <li><strong>Qual o Lote?:</strong> O campo "Destino" já vem preenchido com a sua loja. Não altere a menos que esteja pedindo para uma loja secundária.</li>
                                            </ul>
                                            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                                                <p className="text-sm text-red-800 font-bold">⚠️ OBRIGATÓRIO: O campo Chassi agora é obrigatório para TODOS os tipos de pedido (Reposição, Transferência e Devolução). O sistema não permitirá salvar sem o número do chassi preenchido (mínimo 11 caracteres).</p>
                                            </div>
                                        </Step>

                                        <Step number="2" title="Aguardando a Aprovação (Gestor)">
                                            <p>Ao salvar, seu pedido entra com o status <span className="text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded">Em Análise</span>. <br/>
                                            Neste momento, a Diretoria (Gestor) receberá um alerta para aprovar ou rejeitar o seu pedido com base no seu limite de crédito ou estoque da rede.</p>
                                            <p className="mt-2 text-sm text-gray-500 italic">Você não precisa fazer nada além de aguardar.</p>
                                        </Step>

                                        <Step number="3" title="Logística e Separação">
                                            <p>Quando aprovado, o status muda para <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">Solicitado</span>.</p>
                                            <ul className="list-disc ml-6 mt-3 space-y-2 text-sm text-gray-600">
                                                <li>Se for um pedido do CD, a equipe do galpão vai separar a moto e emitir a nota.</li>
                                                <li>Se for uma transferência de outra loja, a loja de origem precisará confirmar que a moto está separada no pátio dela clicando no botão de Separação.</li>
                                            </ul>
                                            <p className="mt-2 text-sm font-semibold text-gray-700">Logo após a separação, a equipe de logística encaixará sua moto na próxima rota de caminhão disponível.</p>
                                        </Step>

                                        <Step number="4" title="Agendamento e Confirmação de Rota">
                                            <p>A equipe de logística do CD usará o <strong>Calendário</strong> para agendar as entregas da semana. Existem <strong>duas etapas</strong> de agendamento:</p>
                                            <ul className="list-disc ml-6 mt-3 space-y-2 text-sm text-gray-600">
                                                <li><span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-1"></span> <strong>Agendado (Amarelo):</strong> O CD reservou uma data provisória para a sua rota. Seu pedido <strong>NÃO</strong> muda de status ainda, apenas recebe uma previsão de entrega. A rota pode mudar.</li>
                                                <li><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1"></span> <strong>Confirmado (Verde):</strong> O CD confirmou oficialmente a viagem. SÓ agora o pedido muda para <span className="text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded text-xs">Rota Confirmada</span> e a data de chegada é garantida.</li>
                                            </ul>
                                            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                                <p className="text-sm text-amber-800">🕐 <strong>Expiração Automática:</strong> Se o dia da rota confirmada chegar e o caminhão NÃO sair, o sistema automaticamente desfaz a confirmação e retorna o pedido para a fila de espera ("Aguardando Rota" ou "Separado"). Você será notificado caso isso aconteça.</p>
                                            </div>
                                        </Step>

                                        <Step number="5" title="Coleta e Trânsito">
                                            <ul className="list-disc ml-6 space-y-2 text-sm text-gray-600">
                                                <li>Se for transferência, o motorista vai até a loja de origem. Lá, o motorista bipa a carga e o sistema muda o status para <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded text-xs">Coletado</span> automaticamente. Nenhuma loja precisa apertar botão!</li>
                                                <li>Assim que o caminhão for carregado e o CD liberar a saída, seu pedido aparecerá como <span className="text-orange-600 font-bold border border-orange-500 shadow-sm px-2 py-0.5 rounded text-xs"><TruckIcon className="w-3 h-3 inline" /> Em Trânsito</span> no seu Painel.</li>
                                            </ul>
                                        </Step>

                                        <Step number="6" title="Recebimento Completo (Finalização e Foto)">
                                            <p className="font-bold text-red-600 mb-2">Atenção: Esta é a etapa mais importante para a segurança jurídica e financeira da loja!</p>
                                            <p>Quando o caminhão chegar na frente da sua loja com as motos:</p>
                                            <ol className="list-decimal ml-6 mt-3 space-y-3 text-sm text-gray-700">
                                                <li>Desça as motos do caminhão e <strong>confira fisicamente o chassi</strong> de cada uma com o Romaneio de Carga que o motorista tem em mãos.</li>
                                                <li>Se estiver tudo certo, assine o documento do motorista e bata o carimbo (se a loja tiver).</li>
                                                <li>Acesse o sistema, abra o Pedido na tela inicial e clique no botão verde <strong>Conferir e Finalizar</strong>.</li>
                                                <li>O sistema vai pedir o arquivo de <strong>Comprovante do Romaneio</strong>. Use o celular para tirar uma foto do documento assinado (bem legível) e faça o upload.</li>
                                                <li>Se alguma moto chegou arranhada ou quebrada, preencha o campo de "Avaria" daquela moto específica na mesma tela de finalização e envie uma foto do dano.</li>
                                                <li>Clique em Salvar. Pronto! O pedido está <strong>Concluído</strong> e as motos já fazem parte do seu saldo de estoque ativo.</li>
                                            </ol>
                                            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                                                <p className="text-sm text-red-800 font-bold">🔒 TRAVA DE RECEBIMENTO PARCIAL:</p>
                                                <p className="text-sm text-red-700">Se o seu pedido tem 4 motos, mas o CD só enviou 2 neste caminhão (entrega parcial), o sistema <strong>NÃO</strong> vai permitir que você clique em "Finalizar". Você terá que aguardar o CD despachar as motos restantes. Só quando 100% da carga do pedido for enviada é que a finalização será liberada.</p>
                                            </div>
                                        </Step>

                                        {/* ALERTA CRUCIAL: BLOQUEIO EM TRÂNSITO */}
                                        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-5 mt-4">
                                            <h4 className="text-lg font-black text-yellow-800 flex items-center gap-2 mb-3">
                                                <ExclamationTriangleIcon className="w-6 h-6" /> REGRA IMPORTANTE: Bloqueio de Novo Pedido
                                            </h4>
                                            <p className="text-sm text-yellow-900">Por determinação da gestão, se a sua loja possuir <strong>qualquer pedido</strong> com status <span className="font-bold text-orange-600">"Em Trânsito"</span> (ou seja, motos a caminho que ainda não foram finalizadas/recebidas no sistema), você estará <strong>BLOQUEADO</strong> de criar novos pedidos, transferências ou devoluções.</p>
                                            <p className="text-sm text-yellow-800 mt-2 font-bold">👉 Solução: Abra os pedidos com status "Em Trânsito", tire a foto do comprovante do motorista e finalize a entrega. Só assim o sistema liberará novas solicitações.</p>
                                        </div>
                                    </div>

                                    {/* CENÁRIO B: ENVIAR MOTO (TRANSFERÊNCIA PASSIVA) */}
                                    <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 mt-8 mb-8">
                                        <h3 className="text-xl font-black text-orange-800 mb-4 flex items-center gap-2">
                                            <ArrowPathIcon className="w-6 h-6" /> Como Enviar Motos (Saída / Transferência)
                                        </h3>
                                        <p className="text-sm text-orange-900 mb-6 flex items-center gap-2">
                                            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" /> Quando outra loja pede uma moto sua (ou o Gestor manda transferir), você receberá um <strong>ALERTA MÁXIMO</strong> no Dashboard informando que você tem motos pendentes de envio.
                                        </p>

                                        <Step number="1" title="Ação Urgente: Separar no Pátio">
                                            <p>Ao ver o alerta <span className="text-red-600 font-bold bg-white px-2 py-0.5 rounded border border-red-200">Ação Necessária: X Motos Pendentes de Separação</span> no painel inicial:</p>
                                            <ul className="list-disc ml-6 mt-2 space-y-2 text-sm text-gray-700">
                                                <li>Clique no botão de alerta para abrir a lista de chassis que estão sendo solicitados.</li>
                                                <li>Vá até o pátio/estoque físico da sua loja, localize a moto específica pedida.</li>
                                                <li>Volte ao sistema e clique no botão <strong>Confirmar Separação</strong> referente àquela moto.</li>
                                                <li><strong>Importante:</strong> Isso muda o status dela para "Separado", sinalizando para a logística (CD) de que o seu gerente já bateu o olho nela e ela está pronta na porta da loja esperando o caminhão.</li>
                                            </ul>
                                        </Step>

                                        <Step number="2" title="Logística (Agendamento e Milk Run)">
                                            <p>A partir do momento em que a moto foi separada, o pedido fica <span className="text-pink-600 font-bold bg-pink-50 px-2 py-0.5 rounded">Aguardando Rota</span>.</p>
                                            <ul className="list-disc ml-6 mt-2 space-y-2 text-sm text-gray-700">
                                                <li>O CD central vai gerar um agendamento no Calendário. Se a rota for <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-1"></span><strong>Amarela (Pré-Agendada)</strong>, o pedido continua aguardando. Quando o CD confirmar a rota como <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1"></span><strong>Verde</strong>, aí sim o status muda para <span className="text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded">Rota Confirmada</span>.</li>
                                                <li>O status evolui para <strong className="text-orange-600">Aguardando Coleta</strong> quando a viagem da semana for gerada no Romaneio.</li>
                                                <li>Quando o caminhão chegar na sua loja, <strong>entregue a moto presencialmente ao motorista</strong>. O motorista informará via aplicativo/rádio ao CD, que dará o "bip" de confirmação de coleta no painel gerencial.</li>
                                            </ul>
                                        </Step>

                                        <Step number="3" title="Baixa Automática">
                                            <p className="text-sm bg-white p-3 rounded border border-orange-200 flex items-start gap-2">
                                                <InformationCircleIcon className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                                                <span><strong>Você não precisa fazer mais nada!</strong> Assim que o CD confirma que o motorista coletou, a moto entra em status de Trânsito para a loja destino e a responsabilidade sai do seu colo.</span>
                                            </p>
                                        </Step>
                                    </div>

                                    {/* COMO DEVOLVER MOTO */}
                                    <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                                        <h3 className="text-xl font-black text-red-800 mb-4 flex items-center gap-2">
                                            <ArrowUturnLeftIcon className="w-6 h-6" /> Como Devolver Motos (Logística Reversa)
                                        </h3>
                                        <p className="text-sm text-red-900 mb-4">Caso precise devolver uma moto para o CD (Matriz) por renegociação, troca, defeito de fábrica ou sucata, o fluxo é o mesmo de pedir uma moto, só que ao contrário.</p>
                                        <ol className="list-decimal ml-6 space-y-2 text-sm text-gray-700">
                                            <li>Na tela de "Nova Solicitação", mude a chave principal de "Pedido Regular" para <strong>Devolução ao CD</strong>.</li>
                                            <li>O destino será travado automaticamente em "Matriz / CD".</li>
                                            <li>Preencha o chassi (obrigatório) da moto que está fisicamente na sua loja e será devolvida.</li>
                                            <li>O Gestor precisará aprovar essa devolução antes do CD mandar o caminhão ir buscar.</li>
                                        </ol>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'gestor' && (
                                <div className="space-y-10 animate-fade-in">
                                    <HeaderSection 
                                        title="Manual do Gestor" 
                                        subtitle="Gerenciamento comercial, aprovações e liberação de carga."
                                        color="purple"
                                    />

                                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-8">
                                        <h3 className="text-xl font-black text-gray-800 border-b pb-4">🛡️ O Fluxo de Aprovação Comercial</h3>

                                        <Step number="1" title="Notificação de Novo Pedido">
                                            <p>As filiais realizam as solicitações pelo sistema. Assim que a loja salva o carrinho de motos, você (Gestor) recebe uma notificação (no celular pelo app OneSignal e dentro do próprio sistema).</p>
                                            <p className="text-sm mt-2 text-gray-600">Acesse a aba <strong>Gestão</strong> no menu esquerdo para ver todos os pedidos aguardando o seu carimbo de liberação.</p>
                                        </Step>

                                        <Step number="2" title="Análise Financeira e de Cadastro">
                                            <p>Abra o pedido pendente. A tela mostrará os detalhes vitais:</p>
                                            <ul className="list-disc ml-6 mt-2 space-y-1 text-sm text-gray-700">
                                                <li><strong>Quem pediu:</strong> A loja solicitante (que vai pagar).</li>
                                                <li><strong>De onde sai:</strong> Se está saindo do CD (Fábrica) ou se é uma transferência roubando estoque de outra loja.</li>
                                                <li><strong>Quantidade de Motos:</strong> A lista completa com Chassis e Modelos.</li>
                                            </ul>
                                            <p className="text-sm mt-2 font-medium text-gray-800">Verifique nos seus controles financeiros (ERP/Planilhas) se a loja possui limite de crédito ou pagou pelo produto.</p>
                                        </Step>

                                        <Step number="3" title="Aprovação (Total ou Parcial)">
                                            <p>Se a loja pediu 5 motos, mas só pagou por 3, o sistema permite <strong>Cortes Parciais</strong>.</p>
                                            <div className="bg-gray-50 p-4 mt-3 rounded-lg border border-gray-200">
                                                <p className="text-sm mb-2 font-bold text-gray-700">Como fazer cortes de reprovação:</p>
                                                <ul className="text-sm text-gray-600 space-y-2">
                                                    <li className="flex items-center gap-2"><CheckCircleIcon className="w-5 h-5 text-green-600" /> Ao lado de cada moto listada existe um ícone Verde. Isso significa que essa unidade passará.</li>
                                                    <li className="flex items-center gap-2"><XCircleIcon className="w-5 h-5 text-red-600" /> Ao clicar no verde, ele fica Vermelho. As motos vermelhas <strong>serão sumariamente deletadas</strong> do pedido na hora da aprovação final.</li>
                                                </ul>
                                            </div>
                                            <p className="mt-4 text-sm">Após fazer as podas (ou manter tudo verde), clique em <strong>Aprovar Pedido</strong>.</p>
                                        </Step>

                                        <Step number="4" title="Faturamento vs Logística (Importante)">
                                            <p className="text-red-600 font-bold mb-1">Aprovar no Sistema Web não é a mesma coisa que faturar no ERP!</p>
                                            <p className="text-sm text-gray-700">Quando a Diretoria aperta o botão "Aprovar":</p>
                                            <ul className="list-disc ml-6 text-sm text-gray-600 mt-2 space-y-1">
                                                <li>A logística do CD é notificada que as motos foram autorizadas para subirem no caminhão.</li>
                                                <li>O Faturamento (NF-e) deve ser gerado pelo faturista <strong>utilizando o Microwork</strong> antes da saída do caminhão do Galpão. O sistema logístico não emite Notas Fiscais.</li>
                                            </ul>
                                        </Step>
                                        
                                        <Step number="5" title="Aprovações Restritas (Estornos)">
                                            <p>As vezes a loja erra no momento do recebimento (ou o cliente devolve no dia seguinte) e pede o "Estorno" da moto para que ela volte ao painel de "Disponível". Essa ação exige a sua senha. Você deverá analisar o "Motivo do Estorno" e clicar em conceder ou negar na mesma tela da Gestão.</p>
                                        </Step>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'cd' && (
                                <div className="space-y-10 animate-fade-in">
                                    <HeaderSection 
                                        title="Manual da Logística / Expedição CD" 
                                        subtitle="Montagem de cargas, controle de rotas e entrega final."
                                        color="blue"
                                    />

                                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-8">
                                        <h3 className="text-xl font-black text-gray-800 border-b pb-4">🚚 O Fluxo Físico da Moto (do Galpão ao Caminhão)</h3>

                                        <Step number="1" title="Motos 'No Radar' (Solicitadas)">
                                            <p>Assim que o <strong>Gestor</strong> Comercial aprova um pedido (da Fábrica ou de outra loja), o pedido cai no radar logístico com o status de "Solicitado".</p>
                                            <ul className="list-disc ml-6 mt-2 text-sm text-gray-600 space-y-2">
                                                <li><strong>Motos do CD:</strong> Cabe à equipe do Pátio do CD separar essa moto do lote, conferir os itens mecânicos e clicar fisicamente em "Separar" confirmando que a moto existe e está ali pronta para embarque.</li>
                                                <li><strong>Motos em Lojas (Transferência):</strong> A loja emitente clica em "Separar". O sistema coloca a moto como "Aguardando Rota".</li>
                                            </ul>
                                        </Step>

                                        <Step number="2" title="Agendamento de Rota no Calendário">
                                            <p>Acesse o módulo de <strong>Calendário</strong> e agende o dia de visita na Loja de Destino.</p>
                                            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                                                <p className="text-sm text-blue-900 font-bold">🟡 Agendado (Amarelo):</p>
                                                <p className="text-sm text-blue-800">Pré-reserva de data. Os pedidos recebem a previsão de entrega como informativo, mas <strong>NÃO</strong> mudam de status. A rota ainda pode ser cancelada ou remarcada.</p>
                                                <p className="text-sm text-blue-900 font-bold">🟢 Confirmado (Verde):</p>
                                                <p className="text-sm text-blue-800">Confirmação oficial. Os pedidos daquela rota mudam automaticamente para <span className="text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded text-xs">Rota Confirmada</span> e a loja já visualiza a previsão do dia de chegada.</p>
                                            </div>
                                            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                                <p className="text-sm text-amber-800">⏰ <strong>Rotas Expiradas:</strong> Se o dia da rota confirmada chegar e o caminhão não sair, o sistema AUTOMATICAMENTE regride os pedidos para a fila de espera e registra o motivo no log. Nenhuma ação manual é necessária.</p>
                                            </div>
                                        </Step>

                                        <Step number="3" title="Montando o Caminhão (Criando Romaneio)">
                                            <p>Quando o faturamento foi feito e o caminhão encostou na Doca para as rotas do dia, vá ao menu "Expedição" e clique em <strong>Novo Romaneio</strong>.</p>
                                            <p className="mt-2 text-sm text-gray-700">A tela mostrará a lista de tudo que está "Separado" no Pará inteiro naquele dia.</p>
                                            <ol className="list-decimal ml-6 mt-2 text-sm text-gray-600 space-y-2">
                                                <li>Preencha os dados do Motorista e a Placa do Caminhão.</li>
                                                <li><strong>Marque as caixinhas</strong> das motos individuais que subirão neste caminhão.</li>
                                                <li>Você pode escolher motos do CD (Saídas) e também motos de outras Lojas (Milk Run).</li>
                                                <li>Clique em Salvar e Gerar Carga.</li>
                                            </ol>
                                            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                                                <p className="text-sm text-green-800">🔧 <strong>Entregas Parciais:</strong> Agora é possível enviar PARTE de um pedido num caminhão e a outra parte depois. O romaneio trabalha por moto individual, não por pedido inteiro. Se um pedido tem 4 motos e só 2 cabem no caminhão de hoje, selecione apenas essas 2. As motos restantes continuarão na fila para a próxima viagem.</p>
                                            </div>
                                        </Step>

                                        <Step number="4" title="O Caminhão Caiu na Estrada">
                                            <p>Após imprimir os papéis (manifestos), clique no botão <span className="text-orange-600 font-bold border border-orange-600 px-2 py-0.5 rounded text-xs">Aprovar Saída do Galpão</span> na tela do Romaneio criado.</p>
                                            <p className="mt-2 text-sm text-gray-600">Nesse momento mágico, todos os pedidos incluídos nessa carga passam para o status "Em Trânsito", e os telefones e telas das Lojas disparam avisando que a moto acabou de sair do CD na placa informada!</p>
                                        </Step>

                                        <Step number="5" title="Confirmando as Coletas Externas">
                                            <p>Se o caminhão estiver fazendo <strong>Milk Run</strong> (coletando uma moto numa loja do interior para levar para outra loja):</p>
                                            <ul className="list-disc ml-6 mt-2 text-sm text-gray-600 space-y-2">
                                                <li>O motorista chega na loja remota (ex: Castanhal) para retirar uma Pop para levar à Belém. Ao subir na rampa do baú, ele entra em contato.</li>
                                                <li>Pelo sistema de expedição no CD, abra o respectivo Romaneio (já em trânsito).</li>
                                                <li>Acione o botão verde de <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 border border-emerald-300 rounded">Coletar Item</span> ao lado daquela moto específica.</li>
                                                <li>Isso atualiza o sistema e avisa a loja compradora que a moto dela finalmente virou <span className="text-emerald-700 font-bold">Coletada</span> e começará o percurso de chegada!</li>
                                            </ul>
                                        </Step>

                                        <Step number="6" title="Finalização Fica Por Conta das Lojas">
                                            <p>O caminhão chega no destino final. Quem encerra as motos no sistema e faz o upload da foto dos documentos assinados (Finalização) é o lojista.</p>
                                            <p className="text-sm text-gray-600 mt-2"><strong>Atenção:</strong> A loja só consegue finalizar o pedido quando 100% das motos forem despachadas pelo CD. Se o CD enviou parcialmente, o botão Finalizar ficará bloqueado até a entrega total.</p>
                                        </Step>
                                    </div>

                                    {/* CONTROLE DE ESTOQUE CD */}
                                    <div className="bg-green-50 p-6 rounded-2xl border border-green-100 mt-8 mb-8">
                                        <h3 className="text-xl font-black text-green-800 mb-4 flex items-center gap-2">
                                            <ArchiveBoxIcon className="w-6 h-6" /> Controle de Estoque (Visão CD)
                                        </h3>
                                        <p className="text-sm text-green-900 mb-4">Acesso direto pelo menu "Estoque" (Motos) no painel esquerdo.</p>

                                        <Step number="A" title="Visão Global do Chassi">
                                            <p>Ao contrário da loja, a equipe do CD enxerga <strong>todas as motos cadastradas</strong> no sistema, independentemente de estarem na loja A, B ou no galpão central.</p>
                                            <ul className="list-disc ml-6 mt-2 space-y-2 text-sm text-gray-700">
                                                <li>O objetivo central da aba de Estoque para o CD é rastreabilidade.</li>
                                                <li>Você pode usar as caixas de Filtro para buscar Chassis Específicos ou ver em qual loja física uma moto está alocada.</li>
                                            </ul>
                                        </Step>

                                        <Step number="B" title="Consulta Microwork (Estoque CD)">
                                            <p>Na visualização avançada do Estoque (quando ativa), o CD também tem acesso à aba de "Estoque Microwork", que espelha o sistema local de vendas.</p>
                                            <ul className="list-disc ml-6 mt-2 space-y-2 text-sm text-gray-700">
                                                <li>Motos que aparecem com tarja "Reservado" significam que alguma loja apertou o botão de Reserva local. Ela não está disponível para faturamento genérico.</li>
                                                <li>Para qualquer divergência entre o Sistema Sabel e o Microwork de chão de fábrica, a equipe de TI deve ser acionada para re-sincronizar os bancos (via botão de sincronização caso visível).</li>
                                            </ul>
                                        </Step>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'drive' && (
                                <div className="space-y-10 animate-fade-in">
                                    <HeaderSection 
                                        title="Manuseio de Arquivos & Uploads" 
                                        subtitle="O que pode dar errado ao enviar recibos de recebimento."
                                        color="green"
                                    />
                                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
                                        <p className="font-medium text-gray-700">Ao clicar em Conferir e Finalizar, os arquivos fotográficos são automaticamente convertidos e salvos na Nuvem.</p>
                                        
                                        <div className="mt-4 bg-gray-50 border border-gray-200 rounded p-4">
                                            <h4 className="font-bold text-gray-800 mb-2">Erros Comuns no Envio de Foto (Celular):</h4>
                                            <ul className="list-disc ml-5 space-y-2 text-sm text-gray-600">
                                                <li><strong>O sistema carrega e não acontece nada:</strong> O arquivo da foto do seu celular é pesado demais (câmeras de 100 Megapixels). O sistema tenta comprimir a foto antes pra enviar, mas alguns celulares antigos travam nisso. Solução: tire print da foto na galeria, o print é mais leve pra enviar!</li>
                                                <li><strong>Documento Ilegível:</strong> O Gestor não poderá auditar a carga caso você tire uma foto balançada, escura ou borrada da assinatura. Se precisar envie novamente no grupo do Whatsapp pedindo correção, caso contrário pode ter desconto na comissão.</li>
                                                <li><strong>Backup Ativo:</strong> Se o Google Drive Corporativo cair, o sistema continuará funcionando, salvará as fotos no próprio servidor do painel local sem paralizar as entregas.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'faq' && (
                                <div className="space-y-8 animate-fade-in">
                                    <HeaderSection 
                                        title="Suporte TI & Resolução de Problemas" 
                                        subtitle="Bugs, travas logísticas e contatos."
                                        color="gray"
                                    />

                                    <div className="grid gap-4">
                                        <FaqItem question="O sistema diz 'Chassi Inválido' ou não deixa salvar o pedido.">
                                            O chassi é <strong>obrigatório</strong> para todos os tipos de pedido (Reposição, Transferência e Devolução). Verifique se possui entre <strong>11 e 17 caracteres</strong>. Não use traços ou espaços. O campo aparecerá com borda vermelha se estiver vazio.
                                        </FaqItem>

                                        <FaqItem question="Estou bloqueado de fazer novos pedidos. O que aconteceu?">
                                            A gestão ativou um bloqueio automático: se a sua loja tiver <strong>qualquer pedido com status 'Em Trânsito'</strong> (motos que já saíram do CD mas ainda não foram finalizadas no sistema), você não poderá criar novos pedidos. <strong>Solução:</strong> Abra os pedidos Em Trânsito, tire a foto do comprovante assinado do motorista e finalize a entrega.
                                        </FaqItem>

                                        <FaqItem question="Não consigo finalizar um pedido mesmo com as motos na loja.">
                                            O sistema exige que <strong>100% das motos do pedido</strong> sejam despachadas pelo CD antes da finalização. Se o CD fez uma entrega parcial (enviou 2 de 4 motos), o botão ficará bloqueado até que as motos restantes também sejam colocadas num caminhão e despachadas.
                                        </FaqItem>

                                        <FaqItem question="A rota foi confirmada mas o caminhão não saiu. O que acontece?">
                                            O sistema possui uma <strong>limpeza automática de rotas vencidas</strong>. Se o dia programado passar sem o caminhão sair, o pedido volta automaticamente para "Aguardando Rota" ou "Separado" e uma anotação é registrada no histórico: "Rota Vencida 🕰️".
                                        </FaqItem>

                                        <FaqItem question="Errei a solicitação e o Gestor aprovou.">
                                            Entre em contato com o CD imediatamente. Eles podem rejeitar o pedido na fase de separação, devolvendo-o para correção.
                                        </FaqItem>

                                        <FaqItem question="Como desfaço uma carga errada?">
                                            No menu Expedição, entre no Romaneio e clique no botão vermelho <strong><TrashIcon className="w-4 h-4 inline" /> Desfazer</strong>. As motos voltarão para o status "Separado" nas lojas de origem. Se uma rota do Calendário for excluída, os pedidos vinculados também voltam para a fila automaticamente.
                                        </FaqItem>

                                        <FaqItem question="O que significam as cores do Calendário?">
                                            <strong className="text-yellow-600">🟡 Amarelo = Agendado (Pré-reserva)</strong> — O CD reservou a data, mas não confirmou. Pode mudar.<br/>
                                            <strong className="text-green-600">🟢 Verde = Confirmado</strong> — Viagem oficializada. Os pedidos mudam para "Rota Confirmada".<br/>
                                            <strong className="text-red-600">🔴 Vermelho = Cancelado/Expirado</strong> — A rota foi desfeita ou a data venceu.
                                        </FaqItem>
                                    </div>

                                    {/* CONTATOS E CRÉDITOS */}
                                    <div className="mt-10 pt-10 border-t border-gray-200">
                                        <div className="bg-gray-900 text-white p-8 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-8">
                                            
                                            <div className="text-center md:text-left">
                                                <h4 className="text-xl font-bold flex items-center gap-2 justify-center md:justify-start">
                                                    <WrenchScrewdriverIcon className="w-6 h-6" /> Suporte TI Sabel
                                                </h4>
                                                <p className="text-gray-400 mt-2 text-sm">Problemas técnicos, senhas ou erros.</p>
                                                
                                                <div className="mt-4 space-y-2">
                                                    <div className="flex items-center gap-3 justify-center md:justify-start bg-gray-800 px-4 py-2 rounded-lg">
                                                        <PhoneIcon className="w-6 h-6 text-green-400" />
                                                        <div className="text-left">
                                                            <p className="text-[10px] text-gray-400 uppercase">WhatsApp / Plantão</p>
                                                            <p className="font-mono text-lg font-bold text-green-400">(91) 98492-8535</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-3 justify-center md:justify-start bg-gray-800 px-4 py-2 rounded-lg">
                                                        <EnvelopeIcon className="w-6 h-6 text-blue-300" />
                                                        <div className="text-left">
                                                            <p className="text-[10px] text-gray-400 uppercase">E-mail Corporativo</p>
                                                            <p className="font-mono text-sm font-bold text-blue-300">ti@shineraybysabel.com.br</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

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
                    <span className="text-gray-500 bg-gray-100 p-1.5 rounded text-xs"><QuestionMarkCircleIcon className="w-4 h-4" /></span> 
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