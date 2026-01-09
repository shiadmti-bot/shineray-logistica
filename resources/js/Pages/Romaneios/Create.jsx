import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function RomaneioCreate({ auth, motosDisponiveis, romaneiosAbertos = [] }) {
    const [selectedIds, setSelectedIds] = useState([]);
    const [leituraInput, setLeituraInput] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [modo, setModo] = useState('novo'); 
    
    const { data, setData, post, processing, errors, reset } = useForm({
        motorista: '',
        placa: '',
        transportadora: '',
        romaneio_id: '', 
        motos_ids: []
    });

    useEffect(() => {
        setData('motos_ids', selectedIds);
    }, [selectedIds]);

    // --- LÓGICA DA CÂMERA (CORRIGIDA: TRASEIRA + DELAY) ---
    useEffect(() => {
        let scanner = null;

        if (showScanner) {
            setTimeout(() => {
                const config = { 
                    fps: 10, 
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    // CORREÇÃO: Força a câmera traseira
                    videoConstraints: {
                        facingMode: "environment" 
                    }
                };
                
                scanner = new Html5QrcodeScanner("reader", config, false);
                
                scanner.render((decodedText) => {
                    const audio = new Audio('/plim.mp3'); 
                    audio.play().catch(() => {});
                    handleBip(decodedText);
                }, (error) => {});
            }, 300); // Aumentei um pouco o delay para dar tempo do elemento renderizar no celular
        }

        return () => {
            if (scanner) {
                scanner.clear().catch(e => console.error("Erro ao limpar scanner", e));
            }
        };
    }, [showScanner]);

    const handleBip = (codigo) => {
        const chassiLimpo = codigo.trim().toUpperCase();
        const motoEncontrada = motosDisponiveis.find(m => m.chassi.toUpperCase() === chassiLimpo);

        if (!motoEncontrada) {
            Swal.fire({
                title: 'Não Encontrado',
                text: `O chassi ${chassiLimpo} não está disponível para expedição.`,
                icon: 'error',
                timer: 2000,
                showConfirmButton: false
            });
            return;
        }

        if (selectedIds.includes(motoEncontrada.id)) {
            Swal.fire({
                title: 'Já Adicionado',
                text: `O chassi ${chassiLimpo} já está na lista.`,
                icon: 'warning',
                timer: 1000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });
            return;
        }

        setSelectedIds(prev => [...prev, motoEncontrada.id]);
        
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
        Toast.fire({
            icon: 'success',
            title: `${motoEncontrada.modelo} Adicionada!`
        });
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if(!leituraInput) return;
        handleBip(leituraInput);
        setLeituraInput('');
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
            Swal.fire('Atenção', 'Preencha Motorista e Placa para nova carga.', 'warning');
            return;
        }
        if (modo === 'existente' && !data.romaneio_id) {
            Swal.fire('Atenção', 'Selecione qual Romaneio você quer complementar.', 'warning');
            return;
        }

        const textoConfirmacao = modo === 'novo' 
            ? `Gerar nova carga com ${selectedIds.length} motos?`
            : `Adicionar ${selectedIds.length} motos ao Romaneio #${data.romaneio_id}?`;

        Swal.fire({
            title: 'Confirmar Expedição?',
            text: textoConfirmacao,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, Confirmar',
            confirmButtonColor: '#16a34a'
        }).then((res) => {
            if (res.isConfirmed) {
                post(route('romaneios.store'));
            }
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-gray-800">Expedição e Carga</h2>}>
            <Head title="Nova Carga" />

            <div className="py-12 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
                    
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        
                        <div className="flex border-b border-gray-200">
                            <button 
                                onClick={() => { setModo('novo'); reset(); }}
                                className={`flex-1 py-4 text-center font-bold text-sm uppercase tracking-wide transition-colors ${modo === 'novo' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                ✨ Criar Nova Carga
                            </button>
                            <button 
                                onClick={() => { setModo('existente'); reset(); }}
                                className={`flex-1 py-4 text-center font-bold text-sm uppercase tracking-wide transition-colors ${modo === 'existente' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                ➕ Adicionar a Carga Existente
                            </button>
                        </div>

                        <div className="p-6 flex flex-col md:flex-row gap-8">
                            
                            <div className="flex-1 border-r border-gray-100 pr-0 md:pr-8">
                                <h3 className="font-bold text-gray-700 mb-4 flex items-center justify-between">
                                    <span>🔍 Adicionar Motos</span>
                                    <button 
                                        type="button"
                                        onClick={() => setShowScanner(!showScanner)}
                                        className={`text-xs px-3 py-1 rounded-full border font-bold ${showScanner ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-800 text-white border-gray-800'}`}
                                    >
                                        {showScanner ? 'Parar Câmera' : '📷 Abrir Câmera'}
                                    </button>
                                </h3>

                                {showScanner && (
                                    <div className="mb-4 bg-black rounded overflow-hidden relative">
                                        <div id="reader" style={{ width: '100%', minHeight: '300px' }}></div>
                                        <p className="text-white text-center text-xs py-1">Aponte para o código de barras</p>
                                    </div>
                                )}

                                <form onSubmit={handleManualSubmit} className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={leituraInput}
                                        onChange={e => setLeituraInput(e.target.value)}
                                        placeholder="Bipe o chassi ou digite..."
                                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono text-sm uppercase"
                                        autoFocus
                                    />
                                    <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md font-bold hover:bg-indigo-700">
                                        OK
                                    </button>
                                </form>

                                <div className="mt-4 flex justify-between items-center bg-blue-50 p-3 rounded border border-blue-100 text-blue-800 text-sm">
                                    <span>Selecionadas:</span>
                                    <span className="font-bold text-xl">{selectedIds.length}</span>
                                </div>
                            </div>

                            <div className="flex-1 pl-0 md:pl-2">
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    
                                    {modo === 'novo' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Motorista</label>
                                                <input 
                                                    type="text" 
                                                    value={data.motorista}
                                                    onChange={e => setData('motorista', e.target.value)}
                                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                    placeholder="Nome do motorista"
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
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium text-gray-700">Transportadora</label>
                                                    <input 
                                                        type="text" 
                                                        value={data.transportadora}
                                                        onChange={e => setData('transportadora', e.target.value)}
                                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {modo === 'existente' && (
                                        <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
                                            <label className="block text-sm font-bold text-yellow-800 mb-2">Selecione o Romaneio Aberto:</label>
                                            
                                            {romaneiosAbertos.length > 0 ? (
                                                <select
                                                    value={data.romaneio_id}
                                                    onChange={e => setData('romaneio_id', e.target.value)}
                                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                >
                                                    <option value="">-- Selecione --</option>
                                                    {romaneiosAbertos.map(r => (
                                                        <option key={r.id} value={r.id}>
                                                            #{r.id} - {r.motorista} ({r.placa}) - {new Date(r.created_at).toLocaleDateString()}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <p className="text-sm text-red-600">Não há cargas abertas no momento.</p>
                                            )}
                                        </div>
                                    )}

                                    <button 
                                        disabled={processing}
                                        className={`w-full py-3 rounded-md font-bold text-lg text-white shadow-lg mt-2 transition-all disabled:opacity-50
                                            ${modo === 'novo' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                                    >
                                        {processing ? 'Processando...' : (modo === 'novo' ? 'Gerar Romaneio' : 'Atualizar Carga')}
                                    </button>
                                </form>
                            </div>

                        </div>
                    </div>

                    <div>
                        <h3 className="font-bold text-gray-700 mb-4 ml-1">Motos Disponíveis para Carga</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {motosDisponiveis.map((moto) => {
                                const isSelected = selectedIds.includes(moto.id);
                                return (
                                    <div 
                                        key={moto.id} 
                                        onClick={() => toggleSelection(moto.id)}
                                        className={`cursor-pointer p-4 rounded-lg border-2 transition-all shadow-sm flex flex-col justify-between relative overflow-hidden bg-white
                                            ${isSelected ? 'border-green-500 ring-1 ring-green-500 bg-green-50' : 'border-transparent hover:border-gray-300'}`}
                                    >
                                        {isSelected && (
                                            <div className="absolute top-0 right-0 bg-green-500 text-white px-2 py-1 text-xs font-bold rounded-bl">
                                                ✓
                                            </div>
                                        )}
                                        
                                        <div>
                                            <h4 className="font-bold text-gray-800">{moto.modelo}</h4>
                                            <p className="font-mono text-gray-600 text-sm mt-1">{moto.chassi}</p>
                                            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                                Pedido #{moto.pedido_id} • {moto.pedido?.user?.filial || 'Filial'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {motosDisponiveis.length === 0 && (
                                <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                                    <p className="text-xl">Nenhuma moto separada no pátio.</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}