import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import axios from 'axios';
import ChatBox from '@/Components/ChatBox';
import { ArrowPathIcon, ExclamationTriangleIcon, MapPinIcon } from '@heroicons/react/24/outline';

export default function GestorShow({ auth, pedido, mensagemChat }) {
    
    // Identifica se é v2 (Transferência) ou v1 (CD)
    const isTransferencia = !!pedido.origem_user_id;
    const nomeOrigem = isTransferencia 
        ? (pedido.origem?.filial ? `${pedido.origem.filial} (${pedido.origem.name})` : 'Loja de Origem') 
        : 'CENTRO DE DISTRIBUIÇÃO (CD)';

    // Calcula destinos reais a partir do pivot
    const destinosReais = [...new Set((pedido.motos || []).map(m => m.pivot?.destino).filter(Boolean))];
    const destinoFinalLabel = destinosReais.length > 0 ? destinosReais.join(', ') : (pedido.user?.filial || 'Matriz');

    // Inicializa todos como aprovados (true)
    const [aprovacoes, setAprovacoes] = useState(
        (pedido.motos || []).reduce((acc, moto) => ({ ...acc, [moto.id]: true }), {})
    );
    const [itemAprovacoes, setItemAprovacoes] = useState(
        (pedido.itens_pedido || []).reduce((acc, item) => ({ ...acc, [item.id]: true }), {})
    );
    const [motivosEspecificos, setMotivosEspecificos] = useState({});
    const [justificativaGeral, setJustificativaGeral] = useState('');
    const { processing } = useForm();

    // --- PÁTIO MICROWORK (TEMPO REAL) ---
    const [patioData, setPatioData] = useState({}); // { CHASSI: { encontrado, patio, ... } }
    const [patioLoading, setPatioLoading] = useState(false);

    useEffect(() => {
        // Só busca pátio para pedidos de reposição CD (não transferência)
        if (!isTransferencia && pedido.motos?.length > 0) {
            fetchPatioData();
        }
    }, []);

    const fetchPatioData = async () => {
        setPatioLoading(true);
        try {
            const chassis = pedido.motos
                .map(m => m.chassi)
                .filter(Boolean);
            
            if (chassis.length === 0) return;

            const response = await axios.post(route('api.estoque.buscarChassis'), { chassis });
            setPatioData(response.data || {});
        } catch (err) {
            console.error('Erro ao consultar pátio Microwork:', err);
        } finally {
            setPatioLoading(false);
        }
    };

    // Helper: Retorna info visual do pátio
    const getPatioVisual = (patioNome) => {
        if (!patioNome) return { label: 'Sem Pátio', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
        const p = patioNome.toUpperCase();
        if (p.includes('MOTOS MONTADAS')) return { label: 'Motos Montadas', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: '✅' };
        if (p.includes('DESMONTADA CD')) return { label: 'Desmontada CD', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: '🔧' };
        if (p.includes('CD EXPEDI')) return { label: 'CD Expedição', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: '📦' };
        if (p.includes('AVARIA')) return { label: 'Avaria CD', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: '⚠️' };
        if (p.includes('INATIVADA')) return { label: 'Inativada', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300', icon: '⛔' };
        return { label: patioNome, bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', icon: '📍' };
    };

    const opcoesRejeicao = [
        "Sem Estoque no CD",
        "Chassi Incorreto / Erro Digitação",
        "Moto Não Liberada / Bloqueada",
        "Excedente de Estoque",
        "Venda Cancelada",
        "Outros"
    ];

    // --- POPUP INTELIGENTE ---
    useEffect(() => {
        if (mensagemChat) {
            Swal.fire({
                title: `💬 Mensagem de ${pedido.user.name}`,
                text: `"${mensagemChat.content}"`,
                icon: 'info',
                confirmButtonText: 'Responder no Chat',
                confirmButtonColor: '#7e22ce',
                showCancelButton: true,
                cancelButtonText: 'Fechar'
            });
        } else if (pedido.observacao) {
            Swal.fire({
                title: '📢 Observação da Loja',
                text: pedido.observacao,
                icon: 'warning',
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#fbbf24',
                color: '#713f12'
            });
        }
    }, [mensagemChat, pedido.observacao]); 

    const toggleAprovacao = (id) => {
        setAprovacoes(prev => ({ ...prev, [id]: !prev[id] }));
        if (aprovacoes[id] === true) {
            const novosMotivos = { ...motivosEspecificos };
            delete novosMotivos[id];
            setMotivosEspecificos(novosMotivos);
        }
    };

    const toggleItemAprovacao = (itemId) => {
        setItemAprovacoes(prev => ({ ...prev, [itemId]: !prev[itemId] }));
        if (itemAprovacoes[itemId] === true) {
            const novosMotivos = { ...motivosEspecificos };
            delete novosMotivos['item_' + itemId];
            setMotivosEspecificos(novosMotivos);
        }
    };

    const handleMotivoChange = (key, motivo) => {
        setMotivosEspecificos(prev => ({ ...prev, [key]: motivo }));
    };

    const handleCancelarPedidoCompleto = () => {
        Swal.fire({
            title: 'Rejeitar Pedido Completo?',
            text: 'Este pedido será cancelado e a loja solicitante será notificada.',
            icon: 'warning',
            input: 'textarea',
            inputPlaceholder: 'Escreva a justificativa do cancelamento (Obrigatório)...',
            showCancelButton: true,
            confirmButtonText: 'Sim, Cancelar Pedido',
            confirmButtonColor: '#dc2626',
            cancelButtonText: 'Voltar',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'É necessário informar o motivo da rejeição!';
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                router.post(route('gestor.rejeitar', pedido.id), {
                    justificativa: result.value
                });
            }
        });
    };

    const handleFinalizar = () => {
        const rejeitadasIds = Object.keys(aprovacoes).filter(id => !aprovacoes[id]).map(Number);
        const itensRejeitadosIds = Object.keys(itemAprovacoes).filter(id => !itemAprovacoes[id]).map(Number);
        
        // Validação: Se rejeitou motos ou itens, TEM que ter motivo
        const motivosMotosFaltantes = rejeitadasIds.some(id => !motivosEspecificos[id]);
        const motivosItensFaltantes = itensRejeitadosIds.some(id => !motivosEspecificos['item_' + id]);

        if (motivosMotosFaltantes || motivosItensFaltantes) {
            Swal.fire('Obrigatório', 'Selecione o motivo da rejeição para todos os itens ou motos cortados.', 'warning');
            return;
        }

        const totalMotos = pedido.motos?.length || 0;
        const totalItens = pedido.itens_pedido?.length || 0;
        const totalVolume = totalMotos + totalItens;
        const totalCortados = rejeitadasIds.length + itensRejeitadosIds.length;

        Swal.fire({
            title: totalCortados === totalVolume && totalVolume > 0 ? 'Cancelar Pedido Completo?' : 'Confirmar Análise?',
            text: totalCortados === totalVolume && totalVolume > 0
                ? 'Todos os itens foram cortados. O pedido será cancelado integralmente.'
                : `Aprovadas/Mantidas: ${totalVolume - totalCortados} | Cortados: ${totalCortados}`,
            icon: totalCortados === totalVolume && totalVolume > 0 ? 'warning' : 'question',
            showCancelButton: true,
            confirmButtonText: totalCortados === totalVolume && totalVolume > 0 ? 'Sim, Cancelar Pedido' : 'Sim, Processar Análise',
            confirmButtonColor: totalCortados === totalVolume && totalVolume > 0 ? '#dc2626' : '#7e22ce'
        }).then((result) => {
            if (result.isConfirmed) {
                router.post(route('gestor.aprovar', pedido.id), {
                    rejeitadas: rejeitadasIds,
                    itens_rejeitados: itensRejeitadosIds,
                    motivos: motivosEspecificos,
                    justificativa: justificativaGeral
                });
            }
        });
    };

    // Helper de Cor
    const getColorHex = (corNome) => {
        if (!corNome) return '#ccc';
        const map = {
            'vermelho': '#ef4444', 'vermelha': '#ef4444',
            'preto': '#1f2937', 'preta': '#1f2937',
            'branco': '#ffffff', 'branca': '#ffffff',
            'azul': '#3b82f6', 'prata': '#9ca3af', 'cinza': '#6b7280', 'amarelo': '#eab308',
        };
        return map[corNome.toLowerCase()] || '#eee';
    };

    // Renderiza badge de pátio para uma moto
    const renderPatioBadge = (moto) => {
        const chassiKey = (moto.chassi || '').toUpperCase();
        
        if (patioLoading) {
            return (
                <div className="flex items-center gap-1.5 mt-2">
                    <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-gray-400" />
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Consultando pátio...</span>
                </div>
            );
        }

        const info = patioData[chassiKey];
        if (!info) return null; // Sem dados (ainda não consultou ou transferência)

        if (!info.encontrado) {
            return (
                <div className="flex items-center gap-1.5 mt-2">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Chassi não encontrado no Microwork</span>
                    </div>
                </div>
            );
        }

        const visual = getPatioVisual(info.patio);
        return (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${visual.bg} border ${visual.border}`}>
                    <MapPinIcon className={`w-3.5 h-3.5 ${visual.text}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${visual.text}`}>
                        {visual.icon} {visual.label}
                    </span>
                </div>
                {info.dias_estoque != null && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold border border-gray-200">
                        {info.dias_estoque}d no pátio
                    </span>
                )}
                {info.situacao && (
                    <span className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                        ERP: {info.situacao}
                    </span>
                )}
            </div>
        );
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-xl text-purple-800">Análise de Pedido #{pedido.id}</h2>}>
            <Head title={`Análise #${pedido.id}`} />

            <div className="py-8 bg-gray-50 min-h-screen pb-40">
                <div className="max-w-4xl mx-auto px-4">
                    
                    {/* --- CABEÇALHO LOGÍSTICO (NOVIDADE V2) --- */}
                    <div className={`bg-white p-6 rounded-2xl shadow-sm mb-6 border-l-8 ${isTransferencia ? 'border-orange-500' : 'border-blue-600'}`}>
                        
                        {/* Badge de Tipo */}
                        <div className="mb-4">
                            {isTransferencia ? (
                                <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold border border-orange-200 uppercase tracking-wider flex w-fit items-center gap-2">
                                    🔁 Transferência entre Lojas
                                </span>
                            ) : (
                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold border border-blue-200 uppercase tracking-wider flex w-fit items-center gap-2">
                                    🏭 Reposição de Estoque
                                </span>
                            )}
                        </div>

                        {/* Fluxo Visual: Origem -> Destino */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            
                            {/* Origem */}
                            <div className="flex-1 text-center md:text-left w-full">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">DE (ORIGEM)</p>
                                <h3 className={`text-lg font-black ${isTransferencia ? 'text-orange-700' : 'text-blue-700'}`}>
                                    {nomeOrigem}
                                </h3>
                                {isTransferencia && <p className="text-xs text-orange-600 font-bold">⚠️ O estoque sairá desta loja</p>}
                            </div>

                            {/* Seta */}
                            <div className="text-2xl text-gray-300 transform rotate-90 md:rotate-0">
                                ➔
                            </div>

                            {/* Destino */}
                            <div className="flex-1 text-center md:text-right w-full">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">PARA (DESTINO)</p>
                                <h3 className="text-xl font-black text-gray-800">{destinoFinalLabel}</h3>
                                <p className="text-sm text-gray-600">Solicitado por: {pedido.user.name}</p>
                            </div>
                        </div>

                        {/* Dados Data */}
                        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                            <span>📅 Criado em: {new Date(pedido.created_at).toLocaleDateString()} às {new Date(pedido.created_at).toLocaleTimeString().slice(0,5)}</span>
                            <span>ID: #{pedido.id}</span>
                        </div>
                    </div>

                    {/* --- BANNER DE PÁTIO MICROWORK --- */}
                    {!isTransferencia && (
                        <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center gap-3">
                            <MapPinIcon className="w-5 h-5 text-indigo-600 shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-indigo-800">Localização Física (Microwork)</p>
                                <p className="text-xs text-indigo-600">
                                    {patioLoading 
                                        ? 'Consultando pátio de cada chassi em tempo real...' 
                                        : 'O pátio abaixo reflete a posição real de cada moto no CD conforme a última sincronização com o Microwork.'
                                    }
                                </p>
                            </div>
                            {patioLoading && <ArrowPathIcon className="w-5 h-5 animate-spin text-indigo-400 shrink-0" />}
                        </div>
                    )}

                    {/* LISTA DE ITENS GENÉRICOS (v2.6 SEM CHASSI DEFINIDO) */}
                    {pedido.itens_pedido && pedido.itens_pedido.length > 0 && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8 space-y-4">
                            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                                <h4 className="font-black text-gray-800 text-base uppercase tracking-wide flex items-center gap-2">
                                    <span>📦</span> Solicitação por Modelo e Cor ({pedido.itens_pedido.reduce((acc, i) => acc + (i.quantidade || 0), 0)} unidades)
                                </h4>
                                <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full border border-purple-200 uppercase">
                                    Aguardando CD
                                </span>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {pedido.itens_pedido.map((item) => {
                                    const isApproved = itemAprovacoes[item.id] !== false;
                                    return (
                                        <div key={item.id} className="py-3.5 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h5 className={`font-bold text-base ${isApproved ? 'text-gray-800' : 'text-red-700 line-through opacity-60'}`}>{item.modelo}</h5>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                                        <span className="flex items-center gap-1">
                                                            <span className="w-2.5 h-2.5 rounded-full border border-gray-300 inline-block" style={{ backgroundColor: getColorHex(item.cor) }}></span>
                                                            <strong className="capitalize text-gray-700">{item.cor}</strong>
                                                        </span>
                                                        <span>•</span>
                                                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">Motivo: {item.motivo || 'Giro'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`font-black text-xs px-3 py-1.5 rounded-xl shadow-sm ${isApproved ? 'bg-purple-600 text-white' : 'bg-red-100 text-red-700'}`}>
                                                        {item.quantidade} un.
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleItemAprovacao(item.id)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 border ${isApproved ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'}`}
                                                    >
                                                        {isApproved ? '✓ Aprovado' : '✕ Cortado'}
                                                    </button>
                                                </div>
                                            </div>

                                            {!isApproved && (
                                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs space-y-1 animate-fade-in-down">
                                                    <label className="font-bold text-red-800 uppercase block">Motivo do Corte deste Item (Obrigatório)</label>
                                                    <select
                                                        className="w-full border-gray-300 rounded-md text-xs focus:border-red-500 focus:ring-red-500 bg-white"
                                                        value={motivosEspecificos['item_' + item.id] || ''}
                                                        onChange={(e) => handleMotivoChange('item_' + item.id, e.target.value)}
                                                    >
                                                        <option value="" disabled>Selecione o motivo...</option>
                                                        {opcoesRejeicao.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="text-xs text-amber-800 bg-amber-50 p-3.5 rounded-xl border border-amber-200 font-medium leading-relaxed">
                                💡 <strong>Aviso ao Gestor:</strong> Você pode aprovar ou cortar itens individualmente acima. Clique em <strong>"Rejeitar Pedido Completo"</strong> no rodapé se desejar recusar a solicitação inteira.
                            </div>
                        </div>
                    )}

                    {/* LISTA DE MOTOS */}
                    <div className="space-y-4 mb-8">
                        {pedido.motos.map((moto) => {
                            const isApproved = aprovacoes[moto.id];
                            return (
                                <div key={moto.id} className="transition-all duration-300">
                                    <div 
                                        onClick={() => toggleAprovacao(moto.id)}
                                        className={`relative p-5 rounded-xl border-2 cursor-pointer select-none flex flex-col md:flex-row justify-between md:items-center gap-4 transition-all duration-200 group ${isApproved ? 'bg-white border-gray-100 hover:border-green-200 shadow-sm' : 'bg-red-50 border-red-200 shadow-inner'}`}
                                    >
                                        <div className="flex items-start gap-4 w-full">
                                            {/* Checkbox */}
                                            <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-bold transition-transform duration-300 ${isApproved ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                {isApproved ? '✓' : '✕'}
                                            </div>
                                            
                                            {/* Detalhes */}
                                            <div className="flex-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h4 className={`font-mono text-lg font-bold tracking-wide ${isApproved ? 'text-gray-800' : 'text-red-800 line-through decoration-2 opacity-60'}`}>
                                                        {moto.chassi}
                                                    </h4>
                                                    {moto.ano_fabricacao && (
                                                        <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-bold">
                                                            {moto.ano_fabricacao}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4 text-sm mt-2">
                                                    <div>
                                                        <span className="text-xs text-gray-400 uppercase block">Modelo</span>
                                                        <span className="font-bold text-gray-700">{moto.modelo}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-400 uppercase block">Cor</span>
                                                        <div className="flex items-center gap-1">
                                                            <span className="w-2 h-2 rounded-full border border-gray-300" style={{ backgroundColor: getColorHex(moto.cor) }}></span>
                                                            <span className="font-medium text-gray-600 capitalize">{moto.cor}</span>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2 md:col-span-1">
                                                        <span className="text-xs text-gray-400 uppercase block">Motivo</span>
                                                        <span className="font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs inline-block mt-0.5">
                                                            {moto.pivot?.motivo || moto.motivo_solicitacao || 'Venda'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* BADGE DE PÁTIO MICROWORK */}
                                                {!isTransferencia && renderPatioBadge(moto)}
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div className="flex flex-col items-end gap-2 md:min-w-[100px]">
                                            <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded border ${isApproved ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-100 border-red-200'}`}>
                                                {isApproved ? 'APROVADO' : 'CORTADO'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Painel Rejeição */}
                                    {!isApproved && (
                                        <div className="mt-2 mx-2 p-4 bg-white border border-red-100 rounded-lg shadow-sm border-l-4 border-l-red-400 animate-fade-in-down">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-red-700 uppercase">Motivo do Corte (Obrigatório)</label>
                                                <select 
                                                    className="w-full border-gray-300 rounded-md text-sm focus:border-red-500 focus:ring-red-500 bg-gray-50"
                                                    value={motivosEspecificos[moto.id] || ''}
                                                    onChange={(e) => handleMotivoChange(moto.id, e.target.value)}
                                                >
                                                    <option value="" disabled>Selecione...</option>
                                                    {opcoesRejeicao.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* OBSERVAÇÕES GERAIS */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-8">
                        <label className="block text-sm font-bold text-gray-700 mb-2">📝 Observações Gerais / Feedback para Loja</label>
                        <textarea 
                            className="w-full border-gray-300 rounded-lg text-sm h-20 focus:ring-purple-500 focus:border-purple-500" 
                            placeholder="Ex: Liberado, porém atente-se ao estoque..." 
                            value={justificativaGeral} 
                            onChange={(e) => setJustificativaGeral(e.target.value)}
                        ></textarea>
                    </div>
                </div>
            </div>

            {/* BARRA DE AÇÃO */}
            <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 p-4 shadow-lg z-40">
                <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
                    <button 
                        type="button"
                        onClick={handleCancelarPedidoCompleto} 
                        disabled={processing} 
                        className="w-full sm:w-auto bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-sm py-3 px-6 rounded-xl transition flex items-center justify-center gap-2"
                    >
                        <span>❌</span> REJEITAR PEDIDO COMPLETO
                    </button>

                    <button 
                        type="button"
                        onClick={handleFinalizar} 
                        disabled={processing} 
                        className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white font-bold text-base py-3 px-8 rounded-xl shadow-lg transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                    >
                        <span>🛡️</span> {processing ? 'Enviando...' : 'FINALIZAR ANÁLISE'}
                    </button>
                </div>
            </div>

            {/* CHAT */}
            <ChatBox pedidoId={pedido.id} />

        </AuthenticatedLayout>
    );
}