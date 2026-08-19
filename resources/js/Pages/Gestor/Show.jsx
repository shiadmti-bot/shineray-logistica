import AppLayout from '@/Layouts/AppLayout';
import { PageHeader } from '@/Components/UI';
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
        if (!patioNome) return { label: 'Sem Pátio', bg: 'bg-surface-sunken', text: 'text-content-secondary', border: 'border-line' };
        const p = patioNome.toUpperCase();
        if (p.includes('MOTOS MONTADAS')) return { label: 'Motos Montadas', bg: 'bg-status-success-bg', text: 'text-status-success-fg', border: 'border-status-success-solid/30', icon: '✅' };
        if (p.includes('DESMONTADA CD')) return { label: 'Desmontada CD', bg: 'bg-status-warning-bg', text: 'text-status-warning-fg', border: 'border-status-warning-solid/30', icon: '🔧' };
        if (p.includes('CD EXPEDI')) return { label: 'CD Expedição', bg: 'bg-status-info-bg', text: 'text-status-info-fg', border: 'border-status-info-solid/30', icon: '📦' };
        if (p.includes('AVARIA')) return { label: 'Avaria CD', bg: 'bg-status-warning-bg', text: 'text-status-warning-fg', border: 'border-status-warning-solid/30', icon: '⚠️' };
        if (p.includes('INATIVADA')) return { label: 'Inativada', bg: 'bg-surface-sunken', text: 'text-content-secondary', border: 'border-line-strong', icon: '⛔' };
        return { label: patioNome, bg: 'bg-surface-sunken', text: 'text-content-secondary', border: 'border-line', icon: '📍' };
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
                    <ArrowPathIcon className="w-3.5 h-3.5 animate-spin text-content-muted" />
                    <span className="text-[10px] text-content-muted uppercase font-bold tracking-wider">Consultando pátio...</span>
                </div>
            );
        }

        const info = patioData[chassiKey];
        if (!info) return null; // Sem dados (ainda não consultou ou transferência)

        if (!info.encontrado) {
            return (
                <div className="flex items-center gap-1.5 mt-2">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-status-danger-bg border border-status-danger-solid/30">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5 text-status-danger-fg" />
                        <span className="text-[10px] text-status-danger-fg font-bold uppercase tracking-wider">Chassi não encontrado no Microwork</span>
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
                    <span className="text-[10px] bg-surface-sunken text-content-muted px-1.5 py-0.5 rounded font-bold border border-line">
                        {info.dias_estoque}d no pátio
                    </span>
                )}
                {info.situacao && (
                    <span className="text-[10px] bg-surface-sunken text-content-muted px-1.5 py-0.5 rounded font-medium">
                        ERP: {info.situacao}
                    </span>
                )}
            </div>
        );
    };

    return (
        <AppLayout user={auth.user}>
            <Head title={`Análise #${pedido.id}`} />

            {/* pb-40: a barra de decisao e fixa no rodape e cobriria o fim da pagina. */}
            <div className="pb-40">
                <div className="mx-auto max-w-4xl">
                    <PageHeader
                        title={`Análise do Pedido #${pedido.id}`}
                        description={
                            isTransferencia
                                ? 'Transferência entre lojas — o estoque sai da loja de origem.'
                                : 'Reposição de estoque a partir do CD.'
                        }
                        breadcrumbs={[
                            { label: 'Gestão' },
                            { label: 'Painel', href: route('gestor.index') },
                            { label: `#${pedido.id}` },
                        ]}
                    />
                    
                    {/* --- CABEÇALHO LOGÍSTICO (NOVIDADE V2) --- */}
                    <div className={`bg-surface-card p-6 rounded-2xl shadow-sm mb-6 border-l-8 ${isTransferencia ? 'border-status-warning-solid' : 'border-status-info-solid'}`}>
                        
                        {/* Badge de Tipo */}
                        <div className="mb-4">
                            {isTransferencia ? (
                                <span className="bg-status-warning-bg text-status-warning-fg px-3 py-1 rounded-full text-xs font-bold border border-status-warning-solid/30 uppercase tracking-wider flex w-fit items-center gap-2">
                                    🔁 Transferência entre Lojas
                                </span>
                            ) : (
                                <span className="bg-status-info-bg text-status-info-fg px-3 py-1 rounded-full text-xs font-bold border border-status-info-solid/30 uppercase tracking-wider flex w-fit items-center gap-2">
                                    🏭 Reposição de Estoque
                                </span>
                            )}
                        </div>

                        {/* Fluxo Visual: Origem -> Destino */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            
                            {/* Origem */}
                            <div className="flex-1 text-center md:text-left w-full">
                                <p className="text-[10px] font-bold text-content-muted uppercase tracking-widest mb-1">DE (ORIGEM)</p>
                                <h3 className={`text-lg font-black ${isTransferencia ? 'text-status-warning-fg' : 'text-status-info-fg'}`}>
                                    {nomeOrigem}
                                </h3>
                                {isTransferencia && <p className="text-xs text-status-warning-fg font-bold">⚠️ O estoque sairá desta loja</p>}
                            </div>

                            {/* Seta */}
                            <div className="text-2xl text-content-muted transform rotate-90 md:rotate-0">
                                ➔
                            </div>

                            {/* Destino */}
                            <div className="flex-1 text-center md:text-right w-full">
                                <p className="text-[10px] font-bold text-content-muted uppercase tracking-widest mb-1">PARA (DESTINO)</p>
                                <h3 className="text-xl font-black text-content-primary">{destinoFinalLabel}</h3>
                                <p className="text-sm text-content-secondary">Solicitado por: {pedido.user.name}</p>
                            </div>
                        </div>

                        {/* Dados Data */}
                        <div className="mt-4 pt-4 border-t border-line flex justify-between text-xs text-content-muted">
                            <span>📅 Criado em: {new Date(pedido.created_at).toLocaleDateString()} às {new Date(pedido.created_at).toLocaleTimeString().slice(0,5)}</span>
                            <span>ID: #{pedido.id}</span>
                        </div>
                    </div>

                    {/* --- BANNER DE PÁTIO MICROWORK --- */}
                    {!isTransferencia && (
                        <div className="mb-6 bg-status-info-bg border border-status-info-solid/30 rounded-xl px-4 py-3 flex items-center gap-3">
                            <MapPinIcon className="w-5 h-5 text-status-info-fg shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-status-info-fg">Localização Física (Microwork)</p>
                                <p className="text-xs text-status-info-fg">
                                    {patioLoading 
                                        ? 'Consultando pátio de cada chassi em tempo real...' 
                                        : 'O pátio abaixo reflete a posição real de cada moto no CD conforme a última sincronização com o Microwork.'
                                    }
                                </p>
                            </div>
                            {patioLoading && <ArrowPathIcon className="w-5 h-5 animate-spin text-status-info-fg shrink-0" />}
                        </div>
                    )}

                    {/* LISTA DE ITENS GENÉRICOS (v2.6 SEM CHASSI DEFINIDO) */}
                    {pedido.itens_pedido && pedido.itens_pedido.length > 0 && (
                        <div className="bg-surface-card p-6 rounded-2xl shadow-sm border border-line mb-8 space-y-4">
                            <div className="flex justify-between items-center border-b border-line pb-3">
                                <h4 className="font-black text-content-primary text-base uppercase tracking-wide flex items-center gap-2">
                                    <span>📦</span> Solicitação por Modelo e Cor ({pedido.itens_pedido.reduce((acc, i) => acc + (i.quantidade || 0), 0)} unidades)
                                </h4>
                                <span className="bg-brand-100 text-brand-800 text-xs font-bold px-3 py-1 rounded-full border border-brand-600/30 uppercase">
                                    Aguardando CD
                                </span>
                            </div>
                            <div className="divide-y divide-line">
                                {pedido.itens_pedido.map((item) => {
                                    const isApproved = itemAprovacoes[item.id] !== false;
                                    return (
                                        <div key={item.id} className="py-3.5 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <h5 className={`font-bold text-base ${isApproved ? 'text-content-primary' : 'text-status-danger-fg line-through opacity-60'}`}>{item.modelo}</h5>
                                                    <div className="flex items-center gap-3 text-xs text-content-muted mt-1">
                                                        <span className="flex items-center gap-1">
                                                            <span className="w-2.5 h-2.5 rounded-full border border-line-strong inline-block" style={{ backgroundColor: getColorHex(item.cor) }}></span>
                                                            <strong className="capitalize text-content-secondary">{item.cor}</strong>
                                                        </span>
                                                        <span>•</span>
                                                        <span className="bg-status-info-bg text-status-info-fg px-2 py-0.5 rounded font-medium">Motivo: {item.motivo || 'Giro'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`font-black text-xs px-3 py-1.5 rounded-xl shadow-sm ${isApproved ? 'bg-brand-600 text-white' : 'bg-status-danger-bg text-status-danger-fg'}`}>
                                                        {item.quantidade} un.
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleItemAprovacao(item.id)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 border ${isApproved ? 'bg-status-success-bg text-status-success-fg border-status-success-solid/30 hover:bg-status-success-bg' : 'bg-status-danger-bg text-status-danger-fg border-status-danger-solid/40 hover:bg-status-danger-bg'}`}
                                                    >
                                                        {isApproved ? '✓ Aprovado' : '✕ Cortado'}
                                                    </button>
                                                </div>
                                            </div>

                                            {!isApproved && (
                                                <div className="p-3 bg-status-danger-bg border border-status-danger-solid/30 rounded-lg text-xs space-y-1 animate-fade-in-down">
                                                    <label className="font-bold text-status-danger-fg uppercase block">Motivo do Corte deste Item (Obrigatório)</label>
                                                    <select
                                                        className="w-full border-line-strong rounded-md text-xs focus:border-brand-500 focus:ring-brand-500 bg-surface-card"
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
                            <div className="text-xs text-status-warning-fg bg-status-warning-bg p-3.5 rounded-xl border border-status-warning-solid/30 font-medium leading-relaxed">
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
                                        className={`relative p-5 rounded-xl border-2 cursor-pointer select-none flex flex-col md:flex-row justify-between md:items-center gap-4 transition-all duration-200 group ${isApproved ? 'bg-surface-card border-line hover:border-status-success-solid/30 shadow-sm' : 'bg-status-danger-bg border-status-danger-solid/30 shadow-inner'}`}
                                    >
                                        <div className="flex items-start gap-4 w-full">
                                            {/* Checkbox */}
                                            <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-bold transition-transform duration-300 ${isApproved ? 'bg-status-success-bg text-status-success-fg' : 'bg-status-danger-bg text-status-danger-fg'}`}>
                                                {isApproved ? '✓' : '✕'}
                                            </div>
                                            
                                            {/* Detalhes */}
                                            <div className="flex-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h4 className={`font-mono text-lg font-bold tracking-wide ${isApproved ? 'text-content-primary' : 'text-status-danger-fg line-through decoration-2 opacity-60'}`}>
                                                        {moto.chassi}
                                                    </h4>
                                                    {moto.ano_fabricacao && (
                                                        <span className="text-[10px] bg-surface-sunken text-content-secondary px-1.5 py-0.5 rounded font-bold">
                                                            {moto.ano_fabricacao}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4 text-sm mt-2">
                                                    <div>
                                                        <span className="text-xs text-content-muted uppercase block">Modelo</span>
                                                        <span className="font-bold text-content-secondary">{moto.modelo}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-content-muted uppercase block">Cor</span>
                                                        <div className="flex items-center gap-1">
                                                            <span className="w-2 h-2 rounded-full border border-line-strong" style={{ backgroundColor: getColorHex(moto.cor) }}></span>
                                                            <span className="font-medium text-content-secondary capitalize">{moto.cor}</span>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2 md:col-span-1">
                                                        <span className="text-xs text-content-muted uppercase block">Motivo</span>
                                                        <span className="font-medium text-status-info-fg bg-status-info-bg px-2 py-0.5 rounded text-xs inline-block mt-0.5">
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
                                            <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded border ${isApproved ? 'text-status-success-fg bg-status-success-bg border-status-success-solid/30' : 'text-status-danger-fg bg-status-danger-bg border-status-danger-solid/30'}`}>
                                                {isApproved ? 'APROVADO' : 'CORTADO'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Painel Rejeição */}
                                    {!isApproved && (
                                        <div className="mt-2 mx-2 p-4 bg-surface-card border border-status-danger-solid/20 rounded-lg shadow-sm border-l-4 border-l-red-400 animate-fade-in-down">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-status-danger-fg uppercase">Motivo do Corte (Obrigatório)</label>
                                                <select 
                                                    className="w-full border-line-strong rounded-md text-sm focus:border-brand-500 focus:ring-brand-500 bg-surface-sunken"
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
                    <div className="bg-surface-card p-5 rounded-xl shadow-sm border border-line mb-8">
                        <label className="block text-sm font-bold text-content-secondary mb-2">📝 Observações Gerais / Feedback para Loja</label>
                        <textarea 
                            className="w-full border-line-strong rounded-lg text-sm h-20 focus:ring-brand-500 focus:border-brand-500" 
                            placeholder="Ex: Liberado, porém atente-se ao estoque..." 
                            value={justificativaGeral} 
                            onChange={(e) => setJustificativaGeral(e.target.value)}
                        ></textarea>
                    </div>
                </div>
            </div>

            {/* BARRA DE AÇÃO */}
            <div className="fixed bottom-0 w-full bg-surface-card border-t border-line p-4 shadow-lg z-40">
                <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
                    <button 
                        type="button"
                        onClick={handleCancelarPedidoCompleto} 
                        disabled={processing} 
                        className="w-full sm:w-auto bg-status-danger-bg hover:bg-status-danger-bg text-status-danger-fg border border-status-danger-solid/30 font-bold text-sm py-3 px-6 rounded-xl transition flex items-center justify-center gap-2"
                    >
                        <span>❌</span> REJEITAR PEDIDO COMPLETO
                    </button>

                    <button 
                        type="button"
                        onClick={handleFinalizar} 
                        disabled={processing} 
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-8 py-3 text-base font-bold text-white shadow-lg transition hover:bg-brand-700 sm:w-auto"
                    >
                        <span>🛡️</span> {processing ? 'Enviando...' : 'FINALIZAR ANÁLISE'}
                    </button>
                </div>
            </div>

            {/* CHAT */}
            <ChatBox pedidoId={pedido.id} />

        </AppLayout>
    );
}