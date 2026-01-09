import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { Html5QrcodeScanner } from 'html5-qrcode'; // <--- IMPORTANTE

export default function RomaneioCreate({ auth, motosDisponiveis }) { // motosDisponiveis vem do Controller
    // Estado da seleção
    const [selectedIds, setSelectedIds] = useState([]);
    const [leituraInput, setLeituraInput] = useState('');
    const [showScanner, setShowScanner] = useState(false); // Controla a câmera
    
    // Formulário do Romaneio
    const { data, setData, post, processing, errors } = useForm({
        motorista: '',
        placa: '',
        transportadora: '',
        motos_ids: []
    });

    // Atualiza o form sempre que a seleção mudar
    useEffect(() => {
        setData('motos_ids', selectedIds);
    }, [selectedIds]);

    // --- LÓGICA DO LEITOR DE CÂMERA ---
    useEffect(() => {
        let scanner = null;

        if (showScanner) {
            // Configurações do Scanner
            scanner = new Html5QrcodeScanner(
                "reader", 
                { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
                /* verbose= */ false
            );
            
            scanner.render(onScanSuccess, onScanFailure);
        }

        // Função de Limpeza (Quando fecha a câmera)
        return () => {
            if (scanner) {
                scanner.clear().catch(error => console.error("Falha ao limpar scanner", error));
            }
        };
    }, [showScanner]);

    // Quando a câmera detecta um código
    const onScanSuccess = (decodedText, decodedResult) => {
        // Toca um som de "Bip"
        const audio = new Audio('/plim.mp3'); // Certifique-se de ter esse som ou remova
        audio.play().catch(() => {});

        handleBip(decodedText); // Reusa a mesma lógica do leitor USB
        
        // Opcional: Fechar a câmera após ler um? 
        // Eu prefiro NÃO fechar para permitir leitura em sequência (estilo caixa de mercado)
        // Se quiser fechar, descomente abaixo:
        // setShowScanner(false); 
    };

    const onScanFailure = (error) => {
        // Ignora erros de "não encontrou código neste frame" para não poluir o console
    };

    // --- LÓGICA DE PROCESSAMENTO DO CHASSI (USB OU CÂMERA) ---
    const handleBip = (codigo) => {
        const chassiLimpo = codigo.trim().toUpperCase();

        // 1. Procura na lista de disponíveis
        const motoEncontrada = motosDisponiveis.find(m => m.chassi.toUpperCase() === chassiLimpo);

        if (!motoEncontrada) {
            Swal.fire({
                title: 'Não Encontrado',
                text: `O chassi ${chassiLimpo} não está na lista de "Separados" para expedição.`,
                icon: 'error',
                timer: 2000,
                showConfirmButton: false
            });
            return;
        }

        // 2. Verifica se já foi bipado
        if (selectedIds.includes(motoEncontrada.id)) {
            Swal.fire({
                title: 'Já Adicionado',
                text: `O chassi ${chassiLimpo} já está na carga.`,
                icon: 'warning',
                timer: 1000,
                showConfirmButton: false,
                position: 'top-end'
            });
            return;
        }

        // 3. Sucesso: Adiciona na lista
        setSelectedIds(prev => [...prev, motoEncontrada.id]);
        
        // Feedback Visual (Toast)
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

    // Input Manual (USB ou Digitação)
    const handleManualSubmit = (e) => {
        e.preventDefault();
        if(!leituraInput) return;
        handleBip(leituraInput);
        setLeituraInput(''); // Limpa o campo para o próximo
    };

    // Alternar seleção manual (clique no card)
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
            Swal.fire('Atenção', 'Selecione pelo menos uma moto para a carga.', 'warning');
            return;
        }

        Swal.fire({
            title: 'Gerar Romaneio?',
            text: `Confirmar carga com ${selectedIds.length} motos?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, Gerar',
            confirmButtonColor: '#16a34a'
        }).then((res) => {
            if (res.isConfirmed) {
                post(route('romaneios.store'));
            }
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-gray-800">Nova Carga / Expedição</h2>}>
            <Head title="Nova Carga" />

            <div className="py-12 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
                    
                    {/* ÁREA DE LEITURA */}
                    <div className="bg-white p-6 shadow-sm sm:rounded-lg border-b-4 border-indigo-500">
                        <div className="flex flex-col md:flex-row gap-6 items-start">
                            
                            {/* Lado Esquerdo: Inputs */}
                            <div className="flex-1 w-full">
                                <h3 className="font-bold text-lg text-gray-700 mb-4 flex items-center gap-2">
                                    <span>🔍 Adicionar Motos</span>
                                    {/* Botão para ativar Câmera */}
                                    <button 
                                        type="button"
                                        onClick={() => setShowScanner(!showScanner)}
                                        className={`text-xs px-3 py-1 rounded-full border flex items-center gap-1 ${showScanner ? 'bg-red-100 text-red-700 border-red-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}
                                    >
                                        {showScanner ? '❌ Fechar Câmera' : '📷 Ler com Câmera'}
                                    </button>
                                </h3>

                                {/* ÁREA DA CÂMERA (Só aparece se ativo) */}
                                {showScanner && (
                                    <div className="mb-4 p-2 bg-black rounded-lg">
                                        <div id="reader" className="w-full"></div>
                                        <p className="text-center text-white text-xs mt-1">Aponte para o código de barras do Chassi</p>
                                    </div>
                                )}

                                {/* Input Manual / USB */}
                                <form onSubmit={handleManualSubmit} className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={leituraInput}
                                        onChange={e => setLeituraInput(e.target.value)}
                                        placeholder="Clique aqui e bipe o chassi (Leitor USB)..."
                                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 font-mono"
                                        autoFocus
                                    />
                                    <button type="submit" className="bg-gray-800 text-white px-4 py-2 rounded-md font-bold hover:bg-gray-700">
                                        Adicionar
                                    </button>
                                </form>

                                <div className="mt-4 p-3 bg-blue-50 text-blue-800 text-sm rounded border border-blue-100">
                                    <strong>Motos Selecionadas: {selectedIds.length}</strong>
                                    <p className="text-xs mt-1">Total disponível para carga: {motosDisponiveis.length}</p>
                                </div>
                            </div>

                            {/* Lado Direito: Dados da Carga */}
                            <div className="flex-1 w-full bg-gray-50 p-4 rounded border border-gray-200">
                                <h3 className="font-bold text-gray-700 mb-4">🚛 Dados do Transporte</h3>
                                <form id="form-romaneio" onSubmit={handleSubmit} className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Motorista</label>
                                        <input 
                                            type="text" 
                                            value={data.motorista}
                                            onChange={e => setData('motorista', e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                            required
                                        />
                                        {errors.motorista && <div className="text-red-500 text-xs">{errors.motorista}</div>}
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-700">Placa</label>
                                            <input 
                                                type="text" 
                                                value={data.placa}
                                                onChange={e => setData('placa', e.target.value.toUpperCase())}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm uppercase"
                                                required
                                            />
                                            {errors.placa && <div className="text-red-500 text-xs">{errors.placa}</div>}
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium text-gray-700">Transportadora</label>
                                            <input 
                                                type="text" 
                                                value={data.transportadora}
                                                onChange={e => setData('transportadora', e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                            />
                                        </div>
                                    </div>
                                    
                                    <button 
                                        disabled={processing}
                                        className="w-full bg-green-600 text-white py-3 rounded-md font-bold text-lg hover:bg-green-700 shadow-lg mt-4 disabled:opacity-50"
                                    >
                                        {processing ? 'Gerando...' : 'Gerar Romaneio'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* LISTA DE MOTOS DISPONÍVEIS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {motosDisponiveis.map((moto) => {
                            const isSelected = selectedIds.includes(moto.id);
                            return (
                                <div 
                                    key={moto.id} 
                                    onClick={() => toggleSelection(moto.id)}
                                    className={`cursor-pointer p-4 rounded-lg border-2 transition-all shadow-sm flex flex-col justify-between relative overflow-hidden
                                        ${isSelected 
                                            ? 'border-green-500 bg-green-50 scale-[1.02]' 
                                            : 'border-white bg-white hover:border-indigo-200'}`}
                                >
                                    {isSelected && (
                                        <div className="absolute top-0 right-0 bg-green-500 text-white px-2 py-1 text-xs font-bold rounded-bl">
                                            SELECIONADO
                                        </div>
                                    )}
                                    
                                    <div>
                                        <h4 className="font-bold text-gray-800">{moto.modelo}</h4>
                                        <p className="font-mono text-gray-600 text-sm mt-1">{moto.chassi}</p>
                                        <p className="text-xs text-gray-400 mt-2">
                                            Pedido #{moto.pedido_id} • {moto.pedido?.user?.filial || 'Filial'}
                                        </p>
                                    </div>
                                    
                                    <div className={`mt-3 h-1 w-full rounded ${isSelected ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                                </div>
                            );
                        })}
                        
                        {motosDisponiveis.length === 0 && (
                            <div className="col-span-full text-center py-12 text-gray-500">
                                <p className="text-xl">Nenhuma moto separada no pátio.</p>
                                <p className="text-sm">Vá em "Pedidos" e confirme a separação primeiro.</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}