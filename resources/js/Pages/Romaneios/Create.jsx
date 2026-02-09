import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { useState, useMemo } from 'react';
import Swal from 'sweetalert2';

export default function RomaneioCreate({ auth, expedicao = [], coletas = [], cargasEmAberto = [] }) {
    
    // --- ESTADOS ---
    const [selectedIds, setSelectedIds] = useState([]); 
    const [activeTab, setActiveTab] = useState('expedicao'); 

    const { data, setData, post, processing, errors } = useForm({
        motorista: '',
        placa: '',
        rota_nome: '',
        romaneio_id: '',
        pedidos_ids: []
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

    // --- 2. LÓGICA DE SELEÇÃO ---
    const togglePedido = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const toggleGrupo = (pedidosDoGrupo) => {
        const idsDoGrupo = pedidosDoGrupo.map(p => p.id);
        const todosSelecionados = idsDoGrupo.every(id => selectedIds.includes(id));

        if (todosSelecionados) {
            setSelectedIds(selectedIds.filter(id => !idsDoGrupo.includes(id)));
        } else {
            const novos = idsDoGrupo.filter(id => !selectedIds.includes(id));
            setSelectedIds([...selectedIds, ...novos]);
        }
    };

    // --- 3. SUBMIT ---
    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (selectedIds.length === 0) {
            Swal.fire('Vazio', 'Selecione pelo menos um pedido para a carga.', 'warning');
            return;
        }

        data.pedidos_ids = selectedIds;
        
        post(route('romaneios.store'), {
            onSuccess: () => Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Carga gerada! Redirecionando...', timer: 2000, showConfirmButton: false }),
            onError: () => Swal.fire('Erro', 'Verifique os dados obrigatórios.', 'error')
        });
    };

    // --- CÁLCULO DE TOTAIS ---
    const totalMotosSelecionadas = [...expedicao, ...coletas]
        .filter(p => selectedIds.includes(p.id))
        .reduce((acc, p) => acc + (p.motos?.length || 0), 0);

    const countExp = expedicao.filter(p => selectedIds.includes(p.id)).length;
    const countCol = coletas.filter(p => selectedIds.includes(p.id)).length;

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
                                {/* Alternar Nova/Existente */}
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

                        {/* --- ABAS DE SELEÇÃO --- */}
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

                        {/* --- LISTA DE PEDIDOS --- */}
                        <div className="space-y-6">
                            {activeTab === 'expedicao' && Object.keys(agrupadosExpedicao).length === 0 && (
                                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                                    <p className="text-gray-400 font-medium">Nenhum pedido de expedição disponível.</p>
                                </div>
                            )}

                            {activeTab === 'coleta' && Object.keys(agrupadosColeta).length === 0 && (
                                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                                    <p className="text-gray-400 font-medium">Nenhuma coleta solicitada.</p>
                                </div>
                            )}

                            {Object.entries(activeTab === 'expedicao' ? agrupadosExpedicao : agrupadosColeta).map(([local, pedidos]) => (
                                <div key={local} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition hover:shadow-md">
                                    {/* Cabeçalho do Grupo */}
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
                                                pedidos.every(p => selectedIds.includes(p.id)) 
                                                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            {pedidos.every(p => selectedIds.includes(p.id)) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                        </button>
                                    </div>

                                    {/* Lista de Pedidos */}
                                    <div className="divide-y divide-gray-100">
                                        {pedidos.map(pedido => {
                                            const isSelected = selectedIds.includes(pedido.id);
                                            return (
                                                <div 
                                                    key={pedido.id} 
                                                    onClick={() => togglePedido(pedido.id)}
                                                    className={`p-4 flex items-center justify-between cursor-pointer transition group ${isSelected ? (activeTab === 'expedicao' ? 'bg-blue-50/30' : 'bg-orange-50/30') : 'hover:bg-gray-50'}`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-6 h-6 rounded border flex items-center justify-center transition shadow-sm ${isSelected ? 'bg-green-500 border-green-500 text-white scale-110' : 'bg-white border-gray-300 group-hover:border-gray-400'}`}>
                                                            {isSelected && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-gray-800 text-sm">Pedido #{pedido.id}</span>
                                                                {pedido.status === 'no_cd' && <span className="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 font-bold">TRANSBORDO</span>}
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-0.5 font-medium">
                                                                {activeTab === 'expedicao' 
                                                                    ? `Solicitante: ${pedido.user.name}` 
                                                                    : `Vai para: ${pedido.user.filial || 'Matriz'}`}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <span className="block text-2xl font-black text-gray-800 leading-none">{pedido.motos?.length || 0}</span>
                                                        <span className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Motos</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* --- BARRA FLUTUANTE DE RESUMO --- */}
                        <div className="fixed bottom-0 left-0 w-full bg-gray-900 text-white p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.4)] z-50 border-t border-gray-800 safe-area-bottom">
                            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-start">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] text-gray-400 uppercase font-bold tracking-widest mb-1">Total Carga</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-black text-yellow-400 leading-none">{totalMotosSelecionadas}</span>
                                            <span className="text-xs font-bold text-gray-500">VOLUMES</span>
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
                                    disabled={processing || selectedIds.length === 0}
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