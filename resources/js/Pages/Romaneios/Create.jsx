import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { useState, useEffect, useRef, useMemo } from 'react';
import Swal from 'sweetalert2';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function RomaneioCreate({ auth, motosDisponiveis, romaneiosAbertos = [] }) {
    const [selectedIds, setSelectedIds] = useState([]);
    const [leituraInput, setLeituraInput] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [modo, setModo] = useState('novo'); 
    
    const inputLeitorRef = useRef(null);
    
    const { data, setData, post, processing } = useForm({
        motorista: '',
        placa: '',
        transportadora: '',
        romaneio_id: '',
        motos_ids: []
    });

    // Sincroniza seleção com o form
    useEffect(() => {
        setData('motos_ids', selectedIds);
    }, [selectedIds]);

    // --- 1. LÓGICA DE AGRUPAMENTO INTELIGENTE ---
    // Agrupa estritamente pelo DESTINO FINAL gravado no pedido (pivot)
    const motosAgrupadas = useMemo(() => {
        const grupos = {};
        
        motosDisponiveis.forEach(moto => {
            // A mágica acontece aqui: O Controller injetou o 'pivot' diretamente na moto
            let destino = moto.pivot?.destino 
                       || moto.pedido?.user?.filial 
                       || moto.pedido?.user?.name 
                       || 'DESTINO NÃO INFORMADO';
            
            // Normaliza (Maiúsculas e sem espaços extras)
            destino = destino.toUpperCase().trim();

            if (!grupos[destino]) {
                grupos[destino] = [];
            }
            grupos[destino].push(moto);
        });

        // Ordena chaves alfabeticamente
        return Object.keys(grupos).sort().reduce((obj, key) => { 
            obj[key] = grupos[key]; 
            return obj;
        }, {});
    }, [motosDisponiveis]);

    // --- 2. SELEÇÃO EM LOTE POR DESTINO ---
    const toggleGrupo = (destino) => {
        const motosDoGrupo = motosAgrupadas[destino] || [];
        const idsDoGrupo = motosDoGrupo.map(m => m.id);
        
        const todosSelecionados = idsDoGrupo.every(id => selectedIds.includes(id));

        if (todosSelecionados) {
            setSelectedIds(prev => prev.filter(id => !idsDoGrupo.includes(id)));
        } else {
            const novosIds = idsDoGrupo.filter(id => !selectedIds.includes(id));
            setSelectedIds(prev => [...prev, ...novosIds]);
        }
    };

    // --- LÓGICA DA CÂMERA ---
    useEffect(() => {
        let scanner = null;
        if (showScanner) {
            setTimeout(() => {
                const config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0, videoConstraints: { facingMode: "environment" } };
                try {
                    scanner = new Html5QrcodeScanner("reader", config, false);
                    scanner.render((decodedText) => handleBip(decodedText), (error) => {});
                } catch (e) { console.error("Erro cam", e); }
            }, 300);
        }
        return () => { if (scanner) scanner.clear().catch(e => {}); };
    }, [showScanner]);

    const handleBip = (codigo) => {
        const chassiLimpo = codigo.trim().toUpperCase();
        const motoEncontrada = motosDisponiveis.find(m => m.chassi.toUpperCase() === chassiLimpo);

        if (!motoEncontrada) {
            Swal.fire({ title: 'Não Encontrado', text: `Chassi ${chassiLimpo} não disponível na separação.`, icon: 'error', timer: 2000, toast: true, position: 'top-end', showConfirmButton: false });
            return false;
        }
        if (selectedIds.includes(motoEncontrada.id)) {
            Swal.fire({ title: 'Já na lista', icon: 'warning', timer: 2000, toast: true, position: 'top-end', showConfirmButton: false });
            return false;
        }

        setSelectedIds(prev => [...prev, motoEncontrada.id]);
        
        try { const audio = new Audio('/plim.mp3'); audio.play().catch(() => {}); } catch(e){}
        
        Swal.fire({ title: `${motoEncontrada.modelo} Adicionada!`, icon: 'success', timer: 1500, toast: true, position: 'top-end', showConfirmButton: false });
        return true;
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if(!leituraInput) return;
        handleBip(leituraInput);
        setLeituraInput('');
        inputLeitorRef.current?.focus(); 
    };

    const toggleSelection = (id) => {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(itemId => itemId !== id));
        else setSelectedIds([...selectedIds, id]);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (selectedIds.length === 0) return Swal.fire('Atenção', 'Selecione pelo menos uma moto.', 'warning');
        if (modo === 'novo' && (!data.motorista || !data.placa)) return Swal.fire('Atenção', 'Preencha Motorista e Placa.', 'warning');
        if (modo === 'existente' && !data.romaneio_id) return Swal.fire('Atenção', 'Selecione a carga existente.', 'warning');

        const textoAcao = modo === 'novo' ? 'Gerar Nova Carga' : 'Adicionar à Carga';

        Swal.fire({
            title: 'Confirmar Expedição?',
            text: `Confirma ${textoAcao} com ${selectedIds.length} motos?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, Gerar',
            confirmButtonColor: '#16a34a'
        }).then((res) => {
            if (res.isConfirmed) post(route('romaneios.store'));
        });
    };

    // Helper de cores
    const getColorHex = (cor) => {
        if (!cor) return '#ccc';
        const map = { 'VERMELHO': '#ef4444', 'AZUL': '#3b82f6', 'PRETO': '#1f2937', 'BRANCO': '#ffffff', 'PRATA': '#9ca3af', 'CINZA': '#6b7280' };
        return map[cor.toUpperCase()] || '#eee';
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-gray-800">Expedição e Carga</h2>}>
            <Head title="Nova Carga" />

            <div className="py-6 md:py-12 bg-gray-100 min-h-screen pb-32">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6 px-2">
                    
                    {/* --- PAINEL DE CONTROLE --- */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        
                        {/* ABAS */}
                        <div className="flex border-b border-gray-200">
                            <button onClick={() => { setModo('novo'); setData('romaneio_id', ''); }} className={`flex-1 py-4 font-bold text-sm uppercase tracking-wide transition ${modo === 'novo' ? 'bg-indigo-50 text-indigo-700 border-b-4 border-indigo-500' : 'text-gray-500 hover:bg-gray-50'}`}>✨ Criar Nova Carga</button>
                            <button onClick={() => setModo('existente')} disabled={romaneiosAbertos.length === 0} className={`flex-1 py-4 font-bold text-sm uppercase tracking-wide transition ${modo === 'existente' ? 'bg-orange-50 text-orange-700 border-b-4 border-orange-500' : 'text-gray-500 hover:bg-gray-50 disabled:opacity-50'}`}>➕ Adicionar à Carga</button>
                        </div>

                        <div className="p-4 md:p-6 flex flex-col md:flex-row gap-8">
                            {/* LEITOR */}
                            <div className="flex-1 border-r-0 md:border-r border-gray-100 pr-0 md:pr-8">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-gray-700">🔍 Leitor de Código</h3>
                                    <button type="button" onClick={() => setShowScanner(!showScanner)} className={`text-xs px-3 py-1 rounded-full border font-bold flex items-center gap-2 ${showScanner ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'}`}>
                                        {showScanner ? 'FECHAR CAM' : '📷 CÂMERA'}
                                    </button>
                                </div>

                                {showScanner && <div className="mb-4 bg-black rounded-lg overflow-hidden border-4 border-indigo-500"><div id="reader"></div></div>}

                                <form onSubmit={handleManualSubmit} className="flex gap-2">
                                    <input ref={inputLeitorRef} type="text" value={leituraInput} onChange={e => setLeituraInput(e.target.value)} placeholder="Bipe o chassi..." className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 font-mono uppercase" autoFocus />
                                    <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md font-bold">OK</button>
                                </form>

                                <div className="mt-4 flex justify-between items-center bg-blue-50 p-3 rounded border border-blue-100 text-blue-800">
                                    <span className="text-sm">Selecionadas:</span>
                                    <span className="font-bold text-xl">{selectedIds.length}</span>
                                </div>
                            </div>

                            {/* DADOS DA CARGA */}
                            <div className="flex-1">
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {modo === 'novo' ? (
                                        <div className="animate-fade-in space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Motorista</label>
                                                <input type="text" value={data.motorista} onChange={e => setData('motorista', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm uppercase" placeholder="NOME DO MOTORISTA" />
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium text-gray-700">Placa</label>
                                                    <input type="text" value={data.placa} onChange={e => setData('placa', e.target.value.toUpperCase())} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm uppercase" placeholder="ABC-1234" />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium text-gray-700">Transportadora</label>
                                                    <input type="text" value={data.transportadora} onChange={e => setData('transportadora', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm uppercase" />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-orange-50 p-4 rounded border border-orange-200 animate-fade-in">
                                            <label className="block text-sm font-bold text-orange-800 mb-2">Selecione Carga Aberta:</label>
                                            <select value={data.romaneio_id} onChange={e => setData('romaneio_id', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm">
                                                <option value="">-- Selecione --</option>
                                                {romaneiosAbertos.map(r => <option key={r.id} value={r.id}>#{r.id} - {r.motorista} ({r.placa})</option>)}
                                            </select>
                                        </div>
                                    )}

                                    <button disabled={processing || selectedIds.length === 0} className={`w-full py-4 rounded-md font-bold text-lg text-white shadow-lg mt-6 transition disabled:opacity-50 hover:-translate-y-1 ${modo === 'novo' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                                        {processing ? 'Processando...' : (modo === 'novo' ? 'GERAR ROMANEIO 🚛' : 'ATUALIZAR CARGA 🔄')}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* --- LISTA AGRUPADA POR DESTINO (CORRIGIDO) --- */}
                    <div className="space-y-8 pb-10">
                        {Object.keys(motosAgrupadas).length > 0 ? (
                            Object.entries(motosAgrupadas).map(([destino, motos]) => (
                                <div key={destino} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    
                                    {/* CABEÇALHO DO DESTINO */}
                                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 z-10 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-indigo-100 p-2 rounded-full text-indigo-700 text-xl">📍</div>
                                            <div>
                                                <h3 className="font-black text-lg text-gray-800 tracking-tight">{destino}</h3>
                                                <span className="text-xs text-gray-500 font-medium">{motos.length} volumes neste destino</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => toggleGrupo(destino)}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-4 py-2 rounded transition border border-indigo-200 uppercase tracking-wider"
                                        >
                                            {motos.every(m => selectedIds.includes(m.id)) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                        </button>
                                    </div>

                                    {/* GRID DE CARDS */}
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {motos.map((moto) => {
                                            const isSelected = selectedIds.includes(moto.id);
                                            // Se o destino do grupo for diferente da filial do usuário, mostra quem pediu
                                            const isDestinoDiferente = moto.pedido?.user?.filial && moto.pedido.user.filial.toUpperCase() !== destino;

                                            return (
                                                <div 
                                                    key={moto.id} 
                                                    onClick={() => toggleSelection(moto.id)}
                                                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all shadow-sm flex flex-col justify-between relative bg-white group select-none
                                                        ${isSelected 
                                                            ? 'border-green-500 ring-1 ring-green-500 bg-green-50' 
                                                            : 'border-gray-100 hover:border-indigo-300'
                                                        }`}
                                                >
                                                    {/* Check Visual */}
                                                    <div className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isSelected ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400 group-hover:bg-indigo-100'}`}>
                                                        {isSelected ? '✓' : ''}
                                                    </div>

                                                    <div>
                                                        <h4 className="font-bold text-gray-800 text-sm pr-8">{moto.modelo}</h4>
                                                        <p className="font-mono text-gray-500 text-xs mt-1 tracking-wider">{moto.chassi}</p>
                                                        
                                                        <div className="mt-3 flex flex-wrap gap-2 items-center">
                                                            <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-medium border border-gray-200">
                                                                Pedido #{moto.pedido?.id}
                                                            </span>
                                                            <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                                                                <span className="w-2 h-2 rounded-full border border-gray-300" style={{ backgroundColor: getColorHex(moto.cor) }}></span>
                                                                <span className="text-[10px] font-bold text-gray-600 capitalize">{moto.cor}</span>
                                                            </div>
                                                            
                                                            {/* Mostra quem solicitou se for diferente do destino */}
                                                            {isDestinoDiferente && (
                                                                <span className="text-[9px] text-indigo-500 font-bold ml-auto">
                                                                    (Solic: {moto.pedido.user.filial})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-16 text-gray-400 bg-white rounded-lg border-2 border-dashed border-gray-200">
                                <div className="text-5xl mb-3 opacity-50">🚚</div>
                                <p className="font-medium">Nenhuma moto separada aguardando expedição.</p>
                                <p className="text-sm">Finalize a separação dos pedidos para que apareçam aqui.</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}