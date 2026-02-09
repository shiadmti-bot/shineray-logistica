import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { useState, useMemo } from 'react';
import Swal from 'sweetalert2';

export default function RomaneioCreate({ auth, expedicao = [], coletas = [], cargasEmAberto = [] }) {
    
    // --- ESTADOS ---
    // Agora armazena IDs das MOTOS, não dos pedidos, para permitir seleção parcial
    const [selectedMotoIds, setSelectedMotoIds] = useState([]); 
    const [activeTab, setActiveTab] = useState('expedicao'); 
    
    // Estado para controlar quais pedidos estão expandidos (para ver as motos)
    const [expandedPedidoIds, setExpandedPedidoIds] = useState([]);

    const { data, setData, post, processing, errors } = useForm({
        motorista: '',
        placa: '',
        rota_nome: '',
        romaneio_id: '',
        motos_ids: [] // Mudança no nome para refletir que são motos
    });

    // --- 1. AGRUPAMENTO INTELIGENTE ---
    const agrupadosExpedicao = useMemo(() => {
        const grupos = {};
        expedicao.forEach(p => {
            const destino = p.user?.filial || p.user?.name || 'DESTINO NÃO INFORMADO';
            if (!grupos[destino]) grupos[destino] = [];
            grupos[destino].push(p);
        });
        return grupos;
    }, [expedicao]);

    const agrupadosColeta = useMemo(() => {
        const grupos = {};
        coletas.forEach(p => {
            const origem = p.origem?.filial || 'ORIGEM NÃO INFORMADA';
            if (!grupos[origem]) grupos[origem] = [];
            grupos[origem].push(p);
        });
        return grupos;
    }, [coletas]);

    // --- 2. LÓGICA DE SELEÇÃO (GRANULARIDADE: MOTO) ---
    
    // Selecionar/Deselecionar uma única moto
    const toggleMoto = (motoId) => {
        if (selectedMotoIds.includes(motoId)) {
            setSelectedMotoIds(selectedMotoIds.filter(i => i !== motoId));
        } else {
            setSelectedMotoIds([...selectedMotoIds, motoId]);
        }
    };

    // Selecionar/Deselecionar TODAS as motos de um Pedido
    const togglePedido = (pedido) => {
        const motosDoPedido = pedido.motos.map(m => m.id);
        const todasSelecionadas = motosDoPedido.every(id => selectedMotoIds.includes(id));

        if (todasSelecionadas) {
            // Remove todas
            setSelectedMotoIds(selectedMotoIds.filter(id => !motosDoPedido.includes(id)));
        } else {
            // Adiciona as que faltam
            const novas = motosDoPedido.filter(id => !selectedMotoIds.includes(id));
            setSelectedMotoIds([...selectedMotoIds, ...novas]);
        }
    };

    // Selecionar/Deselecionar TODO um Grupo (Destino/Origem)
    const toggleGrupo = (pedidosDoGrupo) => {
        // Pega todas as motos de todos os pedidos do grupo
        const todasMotosDoGrupo = pedidosDoGrupo.flatMap(p => p.motos.map(m => m.id));
        const todasSelecionadas = todasMotosDoGrupo.every(id => selectedMotoIds.includes(id));

        if (todasSelecionadas) {
            setSelectedMotoIds(selectedMotoIds.filter(id => !todasMotosDoGrupo.includes(id)));
        } else {
            const novas = todasMotosDoGrupo.filter(id => !selectedMotoIds.includes(id));
            setSelectedMotoIds([...selectedMotoIds, ...novas]);
        }
    };

    const toggleExpand = (pedidoId) => {
        if (expandedPedidoIds.includes(pedidoId)) {
            setExpandedPedidoIds(expandedPedidoIds.filter(id => id !== pedidoId));
        } else {
            setExpandedPedidoIds([...expandedPedidoIds, pedidoId]);
        }
    };

    // --- 3. SUBMIT ---
    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (selectedMotoIds.length === 0) {
            Swal.fire('Vazio', 'Selecione pelo menos uma moto para a carga.', 'warning');
            return;
        }

        data.motos_ids = selectedMotoIds;
        
        post(route('romaneios.store'), {
            onSuccess: () => Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Carga gerada! Redirecionando...', timer: 2000, showConfirmButton: false }),
            onError: () => Swal.fire('Erro', 'Verifique os dados obrigatórios.', 'error')
        });
    };

    // --- CÁLCULO DE TOTAIS ---
    const totalMotosSelecionadas = selectedMotoIds.length;

    // Conta quantos pedidos estão PARCIALMENTE ou TOTALMENTE selecionados
    const countExp = expedicao.filter(p => p.motos.some(m => selectedMotoIds.includes(m.id))).length;
    const countCol = coletas.filter(p => p.motos.some(m => selectedMotoIds.includes(m.id))).length;

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-black text-xl text-gray-800 uppercase tracking-tight">Montagem de Carga <span className="text-red-600">V2</span></h2>}>
            <Head title="Nova Carga" />

            <div className="py-6 bg-gray-100 min-h-screen pb-40 font-sans">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    <form onSubmit={handleSubmit}>
                        
                        {/* --- DADOS DA CARGA --- */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
                            <div className="flex justify-between items-center mb-4 border-b pb-2 border-gray-100">
                                <h3 className="font-bold text-gray-700 flex items-center gap-2 uppercase text-sm tracking-wider">
                                    🚚 Configuração da Viagem
                                </h3>
                                <div className="flex bg-gray-100 p-1 rounded-lg">
                                    <button 
                                        type="button"
                                        onClick={() => setData('romaneio_id', '')}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${!data.romaneio_id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        ✨ NOVA CARGA
                                    </button>
                                    <button 
                                        type="button"
                                        disabled={cargasEmAberto.length === 0}
                                        onClick={() => cargasEmAberto.length > 0 && setData('romaneio_id', cargasEmAberto[0].id)}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${data.romaneio_id ? 'bg-orange-100 text-orange-800' : 'text-gray-500'} ${cargasEmAberto.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:text-gray-700'}`}
                                    >
                                        ➕ ADICIONAR À EXISTENTE
                                    </button>
                                </div>
                            </div>

                            {!data.romaneio_id ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-down">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Rota / Região</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ex: Rota Bragança"
                                            className="w-full border-gray-300 rounded-lg text-sm focus:ring-gray-900 focus:border-gray-900"
                                            value={data.rota_nome}
                                            onChange={e => setData('rota_nome', e.target.value)}
                                        />
                                        {errors.rota_nome && <div className="text-red-500 text-[10px] mt-1 font-bold">{errors.rota_nome}</div>}
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Motorista</label>
                                        <input 
                                            type="text" 
                                            placeholder="Nome Completo"
                                            className="w-full border-gray-300 rounded-lg text-sm uppercase focus:ring-gray-900 focus:border-gray-900"
                                            value={data.motorista}
                                            onChange={e => setData('motorista', e.target.value)}
                                        />
                                        {errors.motorista && <div className="text-red-500 text-[10px] mt-1 font-bold">{errors.motorista}</div>}
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Placa</label>
                                        <input 
                                            type="text" 
                                            placeholder="ABC-1234"
                                            className="w-full border-gray-300 rounded-lg text-sm uppercase text-center font-mono font-bold focus:ring-gray-900 focus:border-gray-900"
                                            maxLength={8}
                                            value={data.placa}
                                            onChange={e => setData('placa', e.target.value.toUpperCase())}
                                        />
                                        {errors.placa && <div className="text-red-500 text-[10px] mt-1 font-bold">{errors.placa}</div>}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 animate-fade-in-down">
                                    <label className="block text-xs font-bold text-orange-800 mb-2 uppercase">Selecione a Carga Aberta:</label>
                                    <select 
                                        value={data.romaneio_id} 
                                        onChange={e => setData('romaneio_id', e.target.value)} 
                                        className="block w-full rounded-md border-orange-300 shadow-sm font-bold text-gray-700 focus:ring-orange-500 focus:border-orange-500 text-sm"
                                    >
                                        <option value="">-- Selecione --</option>
                                        {cargasEmAberto.map(r => (
                                            <option key={r.id} value={r.id}>
                                                #{String(r.id).padStart(6,'0')} - {r.rota} ({r.motorista}) - {r.motos_count} vols
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* --- ABAS --- */}
                        <div className="mb-6">
                            <div className="flex border-b border-gray-300 bg-white rounded-t-xl overflow-hidden shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('expedicao')}
                                    className={`flex-1 py-4 text-center font-black text-xs uppercase tracking-widest border-b-4 transition ${activeTab === 'expedicao' ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                                >
                                    🏭 Estoque CD (Saída)
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'expedicao' ? 'bg-blue-200 text-blue-900' : 'bg-gray-200 text-gray-500'}`}>{expedicao.length}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('coleta')}
                                    className={`flex-1 py-4 text-center font-black text-xs uppercase tracking-widest border-b-4 transition ${activeTab === 'coleta' ? 'border-orange-500 text-orange-700 bg-orange-50' : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                                >
                                    🚚 Coletas (Milk Run)
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'coleta' ? 'bg-orange-200 text-orange-900' : 'bg-gray-200 text-gray-500'}`}>{coletas.length}</span>
                                </button>
                            </div>
                        </div>

                        {/* --- LISTAGEM DETALHADA --- */}
                        <div className="space-y-6">
                            {Object.entries(activeTab === 'expedicao' ? agrupadosExpedicao : agrupadosColeta).map(([local, pedidos]) => {
                                // Verifica se TODAS as motos de TODOS os pedidos desse grupo estão selecionadas
                                const todasMotosGrupo = pedidos.flatMap(p => p.motos.map(m => m.id));
                                const grupoSelecionado = todasMotosGrupo.length > 0 && todasMotosGrupo.every(id => selectedMotoIds.includes(id));

                                return (
                                    <div key={local} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition hover:shadow-md">
                                        
                                        {/* HEADER DO GRUPO (LOCAL) */}
                                        <div className={`px-6 py-3 border-b flex justify-between items-center ${activeTab === 'expedicao' ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full text-lg shadow-sm bg-white ${activeTab === 'expedicao' ? 'text-blue-600' : 'text-orange-600'}`}>
                                                    {activeTab === 'expedicao' ? '📍' : '🏪'}
                                                </div>
                                                <div>
                                                    <h3 className={`font-black text-base ${activeTab === 'expedicao' ? 'text-blue-900' : 'text-orange-900'}`}>
                                                        {local}
                                                    </h3>
                                                    <p className={`text-[10px] font-bold uppercase tracking-wide ${activeTab === 'expedicao' ? 'text-blue-400' : 'text-orange-400'}`}>
                                                        {activeTab === 'expedicao' ? 'Destino Final' : 'Local de Coleta'}
                                                    </p>
                                                </div>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => toggleGrupo(pedidos)}
                                                className={`text-[10px] font-bold px-4 py-2 rounded uppercase border transition shadow-sm ${
                                                    grupoSelecionado
                                                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                                                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                                {grupoSelecionado ? 'Desmarcar Local' : 'Selecionar Local'}
                                            </button>
                                        </div>

                                        {/* LISTA DE PEDIDOS DO LOCAL */}
                                        <div className="divide-y divide-gray-100">
                                            {pedidos.map(pedido => {
                                                const motosDoPedido = pedido.motos.map(m => m.id);
                                                const selecionadasDoPedido = motosDoPedido.filter(id => selectedMotoIds.includes(id));
                                                const todasSelecionadas = motosDoPedido.length > 0 && motosDoPedido.length === selecionadasDoPedido.length;
                                                const algumaSelecionada = selecionadasDoPedido.length > 0;
                                                
                                                const isExpanded = expandedPedidoIds.includes(pedido.id);

                                                return (
                                                    <div key={pedido.id} className="bg-white">
                                                        {/* HEADER DO PEDIDO */}
                                                        <div className={`p-4 flex items-center justify-between transition ${algumaSelecionada ? (activeTab === 'expedicao' ? 'bg-blue-50/20' : 'bg-orange-50/20') : ''}`}>
                                                            
                                                            <div className="flex items-center gap-4 cursor-pointer" onClick={() => togglePedido(pedido)}>
                                                                {/* Checkbox "Tri-state" Visual */}
                                                                <div className={`w-6 h-6 rounded border flex items-center justify-center transition shadow-sm ${todasSelecionadas ? 'bg-green-500 border-green-500 text-white' : (algumaSelecionada ? 'bg-green-100 border-green-300 text-green-600' : 'bg-white border-gray-300')}`}>
                                                                    {todasSelecionadas && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                                                    {!todasSelecionadas && algumaSelecionada && <div className="w-3 h-3 bg-green-500 rounded-sm"></div>}
                                                                </div>
                                                                
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-gray-800 text-sm">Pedido #{pedido.id}</span>
                                                                        {pedido.status === 'no_cd' && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 font-bold">TRANSBORDO</span>}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 mt-0.5 font-medium">
                                                                        {activeTab === 'expedicao' ? `Solicitante: ${pedido.user.name}` : `Vai para: ${pedido.user.filial || 'Matriz'}`}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-4">
                                                                <div className="text-right">
                                                                    <span className="block text-lg font-black text-gray-800 leading-none">
                                                                        {selecionadasDoPedido.length} <span className="text-gray-400 text-sm font-normal">/ {pedido.motos.length}</span>
                                                                    </span>
                                                                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Motos</span>
                                                                </div>
                                                                
                                                                {/* Botão Expandir */}
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => toggleExpand(pedido.id)}
                                                                    className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition"
                                                                >
                                                                    <svg className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* LISTA DE MOTOS (EXPANDIDA) */}
                                                        {isExpanded && (
                                                            <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 space-y-1 animate-fade-in">
                                                                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2 pl-9">Selecione as motos individualmente:</div>
                                                                {pedido.motos.map(moto => {
                                                                    const isMotoSelected = selectedMotoIds.includes(moto.id);
                                                                    return (
                                                                        <div 
                                                                            key={moto.id} 
                                                                            onClick={() => toggleMoto(moto.id)}
                                                                            className={`flex items-center gap-3 p-2 rounded cursor-pointer transition ml-8 border ${isMotoSelected ? 'bg-white border-green-300 shadow-sm' : 'border-transparent hover:bg-white hover:border-gray-200'}`}
                                                                        >
                                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${isMotoSelected ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300'}`}>
                                                                                {isMotoSelected && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                                                            </div>
                                                                            <div className="flex gap-4 text-xs">
                                                                                <span className="font-mono font-bold text-gray-700">{moto.chassi}</span>
                                                                                <span className="text-gray-600 font-bold">{moto.modelo}</span>
                                                                                <span className="text-gray-500">{moto.cor}</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* --- BARRA FLUTUANTE DE RESUMO --- */}
                        <div className="fixed bottom-0 left-0 w-full bg-gray-900 text-white p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.4)] z-50 border-t border-gray-800 safe-area-bottom">
                            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-start">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-gray-400 uppercase font-bold tracking-widest mb-1">Total Carga</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-black text-yellow-400 leading-none">{totalMotosSelecionadas}</span>
                                            <span className="text-xs font-bold text-gray-500">MOTOS</span>
                                        </div>
                                    </div>
                                    <div className="h-8 w-px bg-gray-700 hidden md:block"></div>
                                    <div className="flex gap-6 text-sm">
                                        <div>
                                            <span className="text-gray-500 block text-[10px] font-bold uppercase">Expedição</span>
                                            <span className="font-bold text-blue-300">{countExp} peds</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 block text-[10px] font-bold uppercase">Coletas</span>
                                            <span className="font-bold text-orange-300">{countCol} peds</span>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={processing || selectedMotoIds.length === 0}
                                    className={`w-full md:w-auto bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-12 rounded-lg shadow-lg transition transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase tracking-wide text-sm ${processing ? 'animate-pulse' : ''}`}
                                >
                                    {processing ? 'Gerando Manifesto...' : (
                                        <>
                                            <span>🚀</span> Gerar Carga
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                    </form>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}