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
                                        title="Manual da Loja (V2)" 
                                        subtitle="Tudo o que você precisa saber para gerenciar seu estoque e transferências."
                                        color="red"
                                    />
                                    
                                    {/* PASSO A PASSO GERAL DA LOJA */}
                                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-8">
                                        <h3 className="text-xl font-black text-gray-800 border-b pb-4">🔄 Ciclo Completo de uma Moto (Como Pedir e Receber)</h3>
                                        
                                        <Step number="1" title="Criando o Pedido">
                                            <p>Acesse o menu lateral e clique em <strong>Nova Solicitação</strong>. Preencha os dados da moto que você precisa.</p>
                                            <ul className="list-disc ml-6 mt-3 space-y-2 text-sm text-gray-600">
                                                <li><strong>Pedindo de outra Loja:</strong> Selecione o nome da loja no campo "Origem", preencha o Modelo, Cor e digite o <strong>Chassi Exato</strong> da moto.</li>
                                                <li><strong>Pedindo da Fábrica (CD):</strong> Deixe o campo "Origem" vazio. Preencha apenas o Modelo e a Cor. O chassi será definido pelo CD na hora de enviar.</li>
                                                <li><strong>Qual o Lote?:</strong> O campo "Local" já vem preenchido com a sua loja. Não altere a menos que esteja pedindo para uma loja secundária.</li>
                                            </ul>
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

                                        <Step number="4" title="Em Trânsito">
                                            <p>Assim que o caminhão for carregado e o motorista iniciar a viagem, seu pedido aparecerá como <span className="text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded text-xs"><TruckIcon className="w-3 h-3 inline" /> Em Trânsito</span> no seu Painel.</p>
                                        </Step>

                                        <Step number="5" title="Recebimento Completo (Finalização e Foto)">
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
                                        </Step>
                                    </div>

                                    {/* COMO GERENCIAR O ESTOQUE DA LOJA */}
                                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mt-8 mb-8">
                                        <h3 className="text-xl font-black text-blue-800 mb-4 flex items-center gap-2">
                                            <ArchiveBoxIcon className="w-6 h-6" /> Como Funciona a Aba "Estoque" (Visão Loja)
                                        </h3>
                                        <p className="text-sm text-blue-900 mb-4">A tela de Estoque é dividida em duas abas principais na parte superior:</p>

                                        <Step number="A" title="Meu Estoque">
                                            <p>Mostra as motos que estão <strong>fisicamente na sua loja</strong>.</p>
                                            <ul className="list-disc ml-6 mt-2 space-y-2 text-sm text-gray-700">
                                                <li>Você vê apenas o que pertence à sua Filial.</li>
                                                <li>Serve para auditoria rápida. Se a moto foi vendida no Microwork, certifique-se de que o Gestor Comercial altere o status dela para "Vendida" no sistema (se ele ainda não o fez).</li>
                                                <li>Não é possível transferir a moto daqui (quem pede a transferência é a loja <em>destino</em>, usando o botão "Nova Solicitação").</li>
                                            </ul>
                                        </Step>

                                        <Step number="B" title="Estoque Fábrica (Microwork)">
                                            <p>Mostra as motos que estão <strong>disponíveis no galpão do CD</strong>, lendo os dados diretamente do sistema da Microwork em tempo real (espelho de 15 min).</p>
                                            <ul className="list-disc ml-6 mt-2 space-y-2 text-sm text-gray-700">
                                                <li><strong>Botão "Reservar":</strong> Ao clicar neste botão em um chassi, a moto fica invisível para as outras filiais. Imediatamente o sistema gera um "Pedido" no seu painel para que o CD separe a moto para você.</li>
                                                <li><strong>Bloqueio Automático:</strong> Se a loja de Capanema clicar em "Reservar" a última Pop Preta do CD, nos segundos seguintes aquela Pop vai sumir da tela da loja de Belém para evitar que duas lojas comprem o mesmo chassi.</li>
                                            </ul>
                                        </Step>
                                    </div>

                                    {/* COMO DEVOLVER MOTO */}
                                    <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                                        <h3 className="text-xl font-black text-red-800 mb-4 flex items-center gap-2">
                                            <ArrowUturnLeftIcon className="w-6 h-6" /> Como Devolver Motos (Para o CD)
                                        </h3>
                                        <p className="text-sm text-red-900 mb-4">Caso precise devolver uma moto por renegociação, troca ou sucata, o fluxo é uma Transferência ao contrário.</p>
                                        <ol className="list-decimal ml-6 space-y-2 text-sm text-gray-700">
                                            <li>Na tela de "Nova Solicitação", mude a chave principal de "Pedido" para <strong>Devolução ao CD</strong>.</li>
                                            <li>O destino será travado automaticamente em "Matriz / CD".</li>
                                            <li>Preencha o chassi (obrigatório) da moto que está na sua loja e será mandada embora.</li>
                                            <li>O Gestor precisará aprovar essa devolução antes do caminhão ir buscar.</li>
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
                                                <li><strong>Motos em Lojas (Transferência):</strong> A própria loja emitente precisa acessar o painel dela e clicar que já separou a moto no pátio físico de lá.</li>
                                            </ul>
                                        </Step>

                                        <Step number="2" title="Montando o Caminhão (Criando Romaneio)">
                                            <p>Quando o faturamento foi feito e o caminhão encostou na Doca para as rotas do dia, vá ao menu "Expedição" e clique em <strong>Novo Romaneio</strong>.</p>
                                            <p className="mt-2 text-sm text-gray-700">A tela mostrará a lista de tudo que está "Separado" no Pará inteiro naquele dia.</p>
                                            <ol className="list-decimal ml-6 mt-2 text-sm text-gray-600 space-y-2">
                                                <li>Preencha os dados do Motorista e a Placa do Caminhão.</li>
                                                <li><strong>Marque as caixinhas</strong> dos pedidos que cabem dentro deste caminhão e farão parte daquela Rota Específica.</li>
                                                <li>Você pode escolher motos do CD (Saídas) e também motos de outras Lojas (o Caminhão passará lá e fará a coleta milk-run).</li>
                                                <li>Clique em Salvar e Gerar Carga. O sistema criará as listas de entrega para o motorista imprimir e assinar!</li>
                                            </ol>
                                        </Step>

                                        <Step number="3" title="O Caminhão Caiu na Estrada">
                                            <p>Após imprimir os papéis (manifestos), clique no botão <span className="text-orange-600 font-bold border border-orange-600 px-2 py-0.5 rounded text-xs">Aprovar Saída do Galpão</span> na tela do Romaneio criado.</p>
                                            <p className="mt-2 text-sm text-gray-600">Nesse momento mágico, todos os pedidos incluídos nessa carga passam para o status "Em Trânsito", e os telefones e telas das Lojas disparam avisando que a moto acabou de sair do CD na placa informada!</p>
                                        </Step>

                                        <Step number="4" title="Confirmando as Coletas Externas">
                                            <p>Se o caminhão estiver fazendo <strong>Milk Run</strong> (coletando uma moto numa loja do interior para levar para outra loja):</p>
                                            <ul className="list-disc ml-6 mt-2 text-sm text-gray-600 space-y-2">
                                                <li>O motorista chega na loja remota (ex: Castanhal) para retirar uma Pop para levar à Belém.</li>
                                                <li>O motorista liga pro CD confirmando que colocou a Pop no baú.</li>
                                                <li>Pelo sistema de expedição, abra o Romaneio em trânsito e aperte no botão verde de <span className="font-bold text-green-700 bg-green-100 px-2 rounded">Coletar Item</span> ao lado daquela moto específica de Castanhal.</li>
                                                <li>Isso atualiza o sistema oficial dizendo que a loja entregou o produto.</li>
                                            </ul>
                                        </Step>

                                        <Step number="5" title="Finalização Fica Por Conta das Lojas">
                                            <p>O caminhão chega no destino final. Quem encerra as motos no sistema e faz o upload da foto dos documentos assinados (Finalização) é o lojista, acessando a aba dele e checando individualmente cada moto e eventuais arranhões. O CD apenas administra a Rota Física!</p>
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
                                        <FaqItem question="O sistema diz 'Chassi Inválido'.">
                                            Verifique se o chassi possui entre <strong>11 e 17 caracteres</strong>. Não use traços ou espaços. O sistema valida se o chassi já está em outro pedido ativo.
                                        </FaqItem>

                                        <FaqItem question="Errei a solicitação e o Gestor aprovou.">
                                            Entre em contato com o CD imediatamente. Eles podem rejeitar o pedido na fase de separação, devolvendo-o para correção.
                                        </FaqItem>

                                        <FaqItem question="Como desfaço uma carga errada?">
                                            No menu Expedição, entre no Romaneio e clique no botão vermelho <strong><TrashIcon className="w-4 h-4 inline" /> Desfazer</strong>. As motos voltarão para o status "Separado" nas lojas de origem.
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