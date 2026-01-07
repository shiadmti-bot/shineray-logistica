import { useState, useRef } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';

export default function RomaneioCreate({ auth, motosDisponiveis, romaneiosAbertos }) {
    const [modo, setModo] = useState('novo'); // 'novo' ou 'existente'
    
    // Variáveis para o Leitor de Código de Barras
    const [scanInput, setScanInput] = useState('');
    const scanRef = useRef(null);

    const { data, setData, post, processing } = useForm({
        tipo_acao: 'novo',
        romaneio_id: '',
        motorista: '',
        placa: '',
        motos_selecionadas: []
    });

    const alterarModo = (novoModo) => {
        setModo(novoModo);
        setData(d => ({ ...d, tipo_acao: novoModo }));
    };

    const toggleMoto = (id) => {
        if (data.motos_selecionadas.includes(id)) {
            setData('motos_selecionadas', data.motos_selecionadas.filter(mid => mid !== id));
        } else {
            setData('motos_selecionadas', [...data.motos_selecionadas, id]);
        }
    };

    const selecionarTudo = () => {
        if (data.motos_selecionadas.length === motosDisponiveis.length) {
            setData('motos_selecionadas', []);
        } else {
            setData('motos_selecionadas', motosDisponiveis.map(m => m.id));
        }
    };

    // --- FUNÇÃO DE LEITURA DE CÓDIGO DE BARRAS (VIN) ---
    const handleScan = (e) => {
        e.preventDefault();
        
        const termo = scanInput.trim().toUpperCase();
        if (!termo) return;

        // Procura se alguma moto tem esse chassi (contém o termo)
        const motoEncontrada = motosDisponiveis.find(m => m.chassi.includes(termo));

        if (motoEncontrada) {
            // Se já estava marcada, não faz nada (ou poderia desmarcar, dependendo da lógica)
            // Aqui vamos forçar a marcação (adicionar)
            if (!data.motos_selecionadas.includes(motoEncontrada.id)) {
                setData('motos_selecionadas', [...data.motos_selecionadas, motoEncontrada.id]);
                // Feedback sonoro opcional
                // new Audio('/beep.mp3').play().catch(() => {}); 
            }
            setScanInput(''); // Limpa para o próximo bip
        } else {
            alert('❌ Chassi não encontrado na lista de separação!');
            setScanInput('');
        }
    };

    // --- FUNÇÃO DE ENVIO MANUAL ---
    const submit = (e) => {
        if (e) e.preventDefault();

        // Validações Manuais
        if (data.motos_selecionadas.length === 0) {
            alert("⚠️ ERRO: Selecione pelo menos uma moto na lista abaixo.");
            return;
        }

        if (modo === 'novo') {
            if (!data.motorista) {
                alert("⚠️ ERRO: Preencha o nome do Motorista.");
                return;
            }
            if (!data.placa || data.placa.length < 7) {
                alert("⚠️ ERRO: Preencha a Placa corretamente.");
                return;
            }
        }

        if (modo === 'existente' && !data.romaneio_id) {
            alert("⚠️ ERRO: Selecione uma carga aberta na lista.");
            return;
        }

        const msg = modo === 'novo' 
            ? `Confirmar criação de romaneio com ${data.motos_selecionadas.length} motos?` 
            : `Adicionar ${data.motos_selecionadas.length} motos ao Romaneio #${data.romaneio_id}?`;

        if (confirm(msg)) {
            post(route('romaneios.store'), {
                onSuccess: () => console.log("Sucesso!"),
                onError: (err) => {
                    console.error("Erro no Backend:", err);
                    alert("Ocorreu um erro ao salvar. Verifique o console.");
                }
            });
        }
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-gray-800">Expedição e Cargas</h2>}>
            <Head title="Nova Carga" />

            <div className="py-8 bg-gray-100 min-h-screen pb-32">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
                    
                    {/* Painel Superior de Configuração */}
                    <div className="bg-white p-6 shadow-lg rounded-xl border-t-4 border-indigo-600 sticky top-4 z-20">
                        <div className="flex flex-col gap-6">
                            
                            {/* Abas de Modo */}
                            <div className="flex border-b border-gray-200">
                                <button type="button" onClick={() => alterarModo('novo')} className={`px-6 py-3 font-bold text-sm uppercase transition ${modo === 'novo' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                    ✨ Criar Nova Carga
                                </button>
                                <button type="button" onClick={() => alterarModo('existente')} className={`px-6 py-3 font-bold text-sm uppercase transition ${modo === 'existente' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
                                    ➕ Adicionar à Carga Aberta
                                </button>
                            </div>

                            <div className="flex flex-col md:flex-row gap-6 items-end justify-between">
                                {/* Formulário de Dados da Carga */}
                                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {modo === 'novo' ? (
                                        <>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Motorista *</label>
                                                <input 
                                                    type="text" 
                                                    value={data.motorista} 
                                                    onChange={e => setData('motorista', e.target.value)} 
                                                    className="w-full border-gray-300 rounded font-bold" 
                                                    placeholder="Nome Completo" 
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Placa *</label>
                                                <input 
                                                    type="text" 
                                                    value={data.placa} 
                                                    maxLength={7}
                                                    onChange={e => setData('placa', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} 
                                                    className="w-full border-gray-300 rounded uppercase font-bold tracking-widest" 
                                                    placeholder="ABC1234" 
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="col-span-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Selecione a Carga Aberta *</label>
                                            <select value={data.romaneio_id} onChange={e => setData('romaneio_id', e.target.value)} className="w-full border-gray-300 rounded font-bold text-gray-700">
                                                <option value="">-- Escolha um Romaneio --</option>
                                                {romaneiosAbertos && romaneiosAbertos.map(r => (
                                                    <option key={r.id} value={r.id}>#{String(r.id).padStart(6,'0')} - {r.motorista} ({r.placa})</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* Botão de Ação */}
                                <div className="w-full md:w-auto text-right">
                                    <p className="text-xs text-gray-500 mb-1">Selecionadas: <strong className="text-indigo-600 text-lg">{data.motos_selecionadas.length}</strong></p>
                                    <button 
                                        type="button" 
                                        onClick={submit} 
                                        disabled={processing}
                                        className={`px-8 py-3 rounded-lg font-bold shadow transition w-full md:w-auto text-white
                                            ${data.motos_selecionadas.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}
                                        `}
                                    >
                                        {processing ? 'Processando...' : (modo === 'novo' ? 'Gerar Romaneio' : 'Atualizar Carga')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- ÁREA DE LEITURA (SCANNER) --- */}
                    <div className="bg-gray-800 text-white p-6 rounded-lg shadow-lg mb-6 flex flex-col md:flex-row items-center gap-4 border border-gray-700">
                        <div className="bg-white/10 p-3 rounded-full">
                            <span className="text-3xl">🔫</span>
                        </div>
                        <div className="flex-1 w-full">
                            <h3 className="font-bold text-lg mb-1">Leitura de Código de Barras</h3>
                            <p className="text-sm text-gray-400 mb-3">Conecte o leitor USB ou digite o final do chassi e aperte Enter.</p>
                            
                            <form onSubmit={handleScan} className="flex gap-2">
                               <input 
                                    ref={scanRef}
                                    type="text" 
                                    value={scanInput}
                                    onChange={e => setScanInput(e.target.value)}
                                    placeholder="Bipe aqui..."
                                    // MUDANÇA 1: Evita o teclado virtual em coletores Android/iOS
                                    // Se o usuário precisar digitar, ele clica e o celular entende.
                                    // Mas o 'autoFocus' puro pode ser agressivo.
                                    inputMode="none" 
                                    
                                    className="w-full text-black font-mono font-bold text-lg p-3 rounded border-2 border-blue-500 focus:ring-4 focus:ring-blue-500/50 outline-none uppercase"
                                    
                                    // MUDANÇA 2: Mantemos o foco, mas usamos onBlur para garantir que
                                    // o coletor não perca o foco se o usuário clicar fora sem querer
                                    autoFocus
                                    onBlur={() => {
                                        // Opcional: Força o foco a voltar para cá após 200ms
                                        // setTimeout(() => scanRef.current?.focus(), 200);
                                    }}
                                />
                                <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-6 rounded font-bold transition">
                                    OK
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Lista de Motos */}
                    <div className="bg-white p-6 shadow rounded-lg">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-gray-700">Motos Separadas (Pool)</h3>
                            <button type="button" onClick={selecionarTudo} className="text-sm text-blue-600 font-bold hover:underline">
                                {data.motos_selecionadas.length === motosDisponiveis.length && motosDisponiveis.length > 0 ? 'Desmarcar Todas' : 'Selecionar Todas'}
                            </button>
                        </div>

                        {motosDisponiveis.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded border border-dashed border-gray-300">
                                <p className="text-gray-400 font-bold text-lg">Nenhuma moto disponível.</p>
                                <p className="text-sm text-gray-400">Realize a conferência nos pedidos primeiro.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {motosDisponiveis.map((moto) => (
                                    <div 
                                        key={moto.id} 
                                        onClick={() => toggleMoto(moto.id)}
                                        className={`cursor-pointer border-2 rounded-lg p-4 transition relative group ${
                                            data.motos_selecionadas.includes(moto.id) 
                                            ? 'border-green-500 bg-green-50 shadow-md ring-2 ring-green-500 scale-105 z-10' // Efeito de Seleção (Verde)
                                            : 'border-gray-200 hover:border-indigo-300 bg-white'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold text-gray-800">{moto.modelo}</h4>
                                                <p className="font-mono text-sm text-gray-600 tracking-wide">{moto.chassi}</p>
                                                <p className="text-xs text-gray-500 mt-1 uppercase">{moto.cor}</p>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                                                data.motos_selecionadas.includes(moto.id) ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 group-hover:border-indigo-300'
                                            }`}>
                                                {data.motos_selecionadas.includes(moto.id) && '✓'}
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-indigo-100 flex justify-between items-center">
                                            <span className="text-[10px] font-bold uppercase bg-white border border-gray-200 px-2 py-1 rounded text-gray-600 shadow-sm">
                                                {moto.loja ? moto.loja.split(' ')[0] : 'Loja'}
                                            </span>
                                            <span className="text-[10px] text-gray-400">#{moto.pedido_id}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}