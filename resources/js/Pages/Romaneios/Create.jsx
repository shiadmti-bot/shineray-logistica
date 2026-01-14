import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function RomaneioCreate({ auth, motosDisponiveis, romaneiosAbertos = [] }) {
    const [selectedIds, setSelectedIds] = useState([]);
    const [leituraInput, setLeituraInput] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    
    // --- NOVO: Estado do Modo (Novo ou Existente) ---
    const [modo, setModo] = useState('novo'); 
    
    const inputLeitorRef = useRef(null);
    
    const { data, setData, post, processing, reset } = useForm({
        motorista: '',
        placa: '',
        transportadora: '',
        romaneio_id: '', // ID da carga existente
        motos_ids: []
    });

    // Sincroniza seleção com o form
    useEffect(() => {
        setData('motos_ids', selectedIds);
    }, [selectedIds]);

    // --- LÓGICA DA CÂMERA (MANTIDA) ---
    useEffect(() => {
        let scanner = null;
        if (showScanner) {
            setTimeout(() => {
                const config = { 
                    fps: 10, 
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    videoConstraints: { facingMode: "environment" }
                };
                try {
                    scanner = new Html5QrcodeScanner("reader", config, false);
                    scanner.render((decodedText) => {
                        const sucesso = handleBip(decodedText);
                        if (sucesso) {
                            const audio = new Audio('/plim.mp3'); 
                            audio.play().catch(() => {});
                            // Não fecha o scanner para permitir bipar vários seguidos (Opcional)
                            // setShowScanner(false); 
                        }
                    }, (error) => {});
                } catch (e) {
                    console.error("Erro ao iniciar camera", e);
                }
            }, 300);
        }
        return () => {
            if (scanner) scanner.clear().catch(e => console.error(e));
        };
    }, [showScanner, motosDisponiveis, selectedIds]); // Dependências ajustadas

    const handleBip = (codigo) => {
        const chassiLimpo = codigo.trim().toUpperCase();
        const motoEncontrada = motosDisponiveis.find(m => m.chassi.toUpperCase() === chassiLimpo);

        if (!motoEncontrada) {
            Swal.fire({
                title: 'Não Encontrado',
                text: `O chassi ${chassiLimpo} não está disponível para carga.`,
                icon: 'error',
                timer: 2000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
            return false;
        }

        if (selectedIds.includes(motoEncontrada.id)) {
            Swal.fire({
                title: 'Já Adicionado',
                text: `O chassi ${chassiLimpo} já está na lista.`,
                icon: 'warning',
                timer: 2000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });
            return false;
        }

        setSelectedIds(prev => [...prev, motoEncontrada.id]);
        
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
        Toast.fire({ icon: 'success', title: `${motoEncontrada.modelo} Adicionada!` });

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
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(itemId => itemId !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (selectedIds.length === 0) {
            Swal.fire('Atenção', 'Selecione pelo menos uma moto.', 'warning');
            return;
        }

        if (modo === 'novo' && (!data.motorista || !data.placa)) {
            Swal.fire('Atenção', 'Preencha Motorista e Placa.', 'warning');
            return;
        }
        
        if (modo === 'existente' && !data.romaneio_id) {
            Swal.fire('Atenção', 'Selecione a carga que deseja atualizar.', 'warning');
            return;
        }

        const textoAcao = modo === 'novo' ? 'Gerar Nova Carga' : 'Adicionar à Carga';

        Swal.fire({
            title: 'Confirmar Expedição?',
            text: `Deseja ${textoAcao} com ${selectedIds.length} motos?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, Confirmar',
            confirmButtonColor: '#16a34a',
            heightAuto: false
        }).then((res) => {
            if (res.isConfirmed) {
                post(route('romaneios.store'));
            }
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-gray-800">Expedição e Carga</h2>}>
            <Head title="Nova Carga" />

            <div className="py-6 md:py-12 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6 px-2">
                    
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        
                        {/* --- ABAS DE MODO (NOVO / EXISTENTE) --- */}
                        <div className="flex border-b border-gray-200">
                            <button 
                                onClick={() => { setModo('novo'); setData('romaneio_id', ''); }}
                                className={`flex-1 py-4 text-center font-bold text-sm uppercase tracking-wide transition-colors 
                                    ${modo === 'novo' ? 'bg-indigo-50 text-indigo-700 border-b-4 border-indigo-500' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                ✨ Criar Nova Carga
                            </button>
                            <button 
                                onClick={() => setModo('existente')}
                                disabled={romaneiosAbertos.length === 0}
                                className={`flex-1 py-4 text-center font-bold text-sm uppercase tracking-wide transition-colors 
                                    ${modo === 'existente' ? 'bg-orange-50 text-orange-700 border-b-4 border-orange-500' : 'text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                            >
                                ➕ Adicionar à Carga Aberta
                                {romaneiosAbertos.length > 0 && <span className="ml-2 bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">{romaneiosAbertos.length}</span>}
                            </button>
                        </div>

                        <div className="p-4 md:p-6 flex flex-col md:flex-row gap-8">
                            
                            {/* LADO ESQUERDO: SCANNER */}
                            <div className="flex-1 border-r-0 md:border-r border-gray-100 pr-0 md:pr-8">
                                <h3 className="font-bold text-gray-700 mb-4 flex items-center justify-between">
                                    <span>🔍 Leitor</span>
                                    <button 
                                        type="button"
                                        onClick={() => setShowScanner(!showScanner)}
                                        className={`text-xs px-3 py-1 rounded-full border font-bold flex items-center gap-2 transition-all
                                            ${showScanner ? 'bg-red-600 text-white border-red-600' : 'bg-gray-800 text-white border-gray-800'}`}
                                    >
                                        {showScanner ? 'FECHAR CAM' : '📷 CÂMERA'}
                                    </button>
                                </h3>

                                {showScanner && (
                                    <div className="mb-4 bg-black rounded-lg overflow-hidden relative border-4 border-indigo-500">
                                        <div id="reader" style={{ width: '100%', minHeight: '300px' }}></div>
                                    </div>
                                )}

                                <form onSubmit={handleManualSubmit} className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={leituraInput}
                                        onChange={e => setLeituraInput(e.target.value)}
                                        placeholder="Bipe ou digite o chassi..."
                                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono text-sm uppercase"
                                        ref={inputLeitorRef}
                                        autoFocus 
                                    />
                                    <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md font-bold">OK</button>
                                </form>

                                <div className="mt-4 flex justify-between items-center bg-blue-50 p-3 rounded border border-blue-100 text-blue-800 text-sm">
                                    <span>Selecionadas:</span>
                                    <span className="font-bold text-xl">{selectedIds.length}</span>
                                </div>
                            </div>

                            {/* LADO DIREITO: FORMULÁRIO DINÂMICO */}
                            <div className="flex-1 pl-0 md:pl-2">
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    
                                    {/* MODO NOVO: CAMPOS DE MOTORISTA */}
                                    {modo === 'novo' && (
                                        <div className="animate-fade-in">
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-gray-700">Motorista</label>
                                                <input 
                                                    type="text" 
                                                    value={data.motorista}
                                                    onChange={e => setData('motorista', e.target.value)}
                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                    placeholder="Nome completo"
                                                />
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium text-gray-700">Placa</label>
                                                    <input 
                                                        type="text" 
                                                        value={data.placa}
                                                        onChange={e => setData('placa', e.target.value.toUpperCase())}
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 uppercase"
                                                        placeholder="ABC-1234"
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <label className="block text-sm font-medium text-gray-700">Transportadora</label>
                                                <input 
                                                    type="text" 
                                                    value={data.transportadora}
                                                    onChange={e => setData('transportadora', e.target.value)}
                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* MODO EXISTENTE: SELECT DE CARGAS */}
                                    {modo === 'existente' && (
                                        <div className="bg-orange-50 p-4 rounded border border-orange-200 animate-fade-in">
                                            <label className="block text-sm font-bold text-orange-800 mb-2">Selecione Carga Aberta:</label>
                                            <select
                                                value={data.romaneio_id}
                                                onChange={e => setData('romaneio_id', e.target.value)}
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                            >
                                                <option value="">-- Selecione --</option>
                                                {romaneiosAbertos.map(r => (
                                                    <option key={r.id} value={r.id}>
                                                        #{r.id} - {r.motorista} ({r.placa})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <button 
                                        disabled={processing || selectedIds.length === 0}
                                        className={`w-full py-4 rounded-md font-bold text-lg text-white shadow-lg mt-6 transition-all disabled:opacity-50 transform hover:-translate-y-1 active:scale-95
                                            ${modo === 'novo' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                                    >
                                        {processing ? 'Processando...' : (modo === 'novo' ? 'GERAR ROMANEIO 🚛' : 'ATUALIZAR CARGA 🔄')}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* --- LISTA DE MOTOS DISPONÍVEIS --- */}
                    <h3 className="font-bold text-gray-700 mt-8">Motos Separadas (Prontas para Carga)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-8">
                        {motosDisponiveis.map((moto) => {
                            const isSelected = selectedIds.includes(moto.id);
                            // Correção Visual do Destino
                            const destino = moto.pedido?.user?.filial 
                                         || moto.pedido?.user?.name 
                                         || 'Destino N/D';
                            
                            return (
                                <div 
                                    key={moto.id} 
                                    onClick={() => toggleSelection(moto.id)}
                                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all shadow-sm flex flex-col justify-between relative overflow-hidden bg-white
                                        ${isSelected ? 'border-green-500 ring-1 ring-green-500 bg-green-50' : 'border-transparent hover:border-gray-300'}`}
                                >
                                    {isSelected && (
                                        <div className="absolute top-0 right-0 bg-green-500 text-white px-2 py-1 text-xs font-bold rounded-bl">✓</div>
                                    )}
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-gray-800 text-sm">{moto.modelo}</h4>
                                            <span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded text-gray-600">
                                                Pedido #{moto.pedido?.id}
                                            </span>
                                        </div>
                                        <p className="font-mono text-gray-600 text-xs mt-1 tracking-wider">{moto.chassi}</p>
                                        
                                        {/* Exibição do Destino */}
                                        <div className="mt-3 flex items-center gap-1 text-xs text-blue-700 font-bold bg-blue-50 p-2 rounded border border-blue-100">
                                            <span>📍</span>
                                            <span className="truncate" title={destino}>{destino}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {motosDisponiveis.length === 0 && (
                            <p className="text-gray-500 col-span-full text-center py-8">Nenhuma moto separada no pátio aguardando carga.</p>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}