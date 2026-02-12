import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import axios from 'axios';

export default function PedidoCreate({ auth, listaModelos, lojasDisponiveis = [] }) {
    
    const [modo, setModo] = useState('cd'); 
    const [logisticaInfo, setLogisticaInfo] = useState(null);
    const [motosDisponiveis, setMotosDisponiveis] = useState([]); 

    const locaisEntrega = [
        "Acará/PA", "Ananindeua/PA", "Barcarena/PA", "Belém/PA", 
        "Bragança/PA", "Breves/PA", "Cametá/PA", "Capanema/PA", "Capitão Poço/PA", 
        "Castanhal/PA", "Concórdia/PA", "Curuçá/PA", "Icoaraci/PA", "Igarapé Miri/PA", 
        "Moju/PA", "São Miguel/PA", "Tailândia/PA", "Tomé-Açu/PA",
        "Aldeota/CE", "Demócrito Rocha/CE", "Parangaba/CE",
        "Matriz / CD", "PDV Paar/PA", "PDV Barcarena/PA"
    ].sort();

    const motivosOpcoes = [
        "Estoque Regular (Giro)", "Venda Confirmada (Cliente)", "Test Drive / Frota",
        "Exposição / Showroom", "Reposição de Garantia", "Uso Interno"
    ];

    const { data, setData, post, processing, errors, reset } = useForm({
        origem_id: '',
        itens: [
            { 
                modelo: '', chassi: '', cor: '', ano: '', motivo: '', 
                local: locaisEntrega.includes(auth.user.filial) ? auth.user.filial : '' 
            }
        ],
        observacao: ''
    });

    const verificarLogistica = async (fornecedorId) => {
        if (!fornecedorId) {
            setLogisticaInfo(null);
            return;
        }
        try {
            const response = await axios.post(route('pedidos.logistica'), { fornecedor_id: fornecedorId });
            setLogisticaInfo(response.data);
        } catch (error) {
            console.error("Erro validação rota:", error);
        }
    };

    const handleFornecedorChange = async (e) => {
        const id = e.target.value;
        setData('origem_id', id);
        
        verificarLogistica(id);

        if (modo === 'transferencia' && id) {
            try {
                const response = await axios.get('/api/estoque-loja', { params: { loja_id: id } });
                setMotosDisponiveis(response.data);
            } catch (error) {
                setMotosDisponiveis([]);
                Swal.fire('Erro', 'Falha ao carregar estoque da loja.', 'error');
            }
        } else {
            setMotosDisponiveis([]);
        }
    };

    const addItem = () => {
        setData('itens', [
            ...data.itens, 
            { 
                modelo: '', chassi: '', cor: '', ano: '', motivo: '', 
                local: data.itens[data.itens.length - 1]?.local || '' 
            }
        ]);
    };

    const removeItem = (index) => {
        const novosItens = [...data.itens];
        novosItens.splice(index, 1);
        setData('itens', novosItens);
    };

    const updateItem = (index, field, value) => {
        const novosItens = [...data.itens];
        novosItens[index][field] = value;

        if (field === 'chassi' && modo === 'transferencia') {
            const motoSelecionada = motosDisponiveis.find(m => m.chassi === value);
            if (motoSelecionada) {
                novosItens[index]['modelo'] = motoSelecionada.modelo;
                novosItens[index]['cor'] = motoSelecionada.cor;
            }
        }
        setData('itens', novosItens);
    };

    const replicarDestino = () => {
        const primeiroLocal = data.itens[0].local;
        if (!primeiroLocal) return Swal.fire('Atenção', 'Selecione um destino na primeira linha.', 'warning');
        
        const novosItens = data.itens.map(item => ({ ...item, local: primeiroLocal }));
        setData('itens', novosItens);
        
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
        Toast.fire({ icon: 'success', title: `Destino "${primeiroLocal}" copiado!` });
    };

    const submit = (e) => {
        e.preventDefault();

        if (modo === 'transferencia' && !data.origem_id) {
            return Swal.fire('Falta a Origem', 'Selecione de qual loja essas motos virão.', 'warning');
        }

        post(route('pedidos.store'), {
            onSuccess: () => {
                Swal.fire('Sucesso!', 'Solicitação enviada.', 'success');
                reset(); 
                setModo('cd'); 
                setLogisticaInfo(null);
                setMotosDisponiveis([]);
            },
            onError: (errors) => {
                Swal.fire({
                    icon: 'error',
                    title: 'Atenção',
                    text: Object.values(errors)[0] || 'Verifique os campos obrigatórios.',
                    confirmButtonColor: '#d33'
                });
            }
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-red-700">Nova Solicitação de Despacho</h2>}>
            <Head title="Nova Solicitação" />
            <div className="py-8 bg-gray-100 min-h-screen pb-32">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {Object.keys(errors).length > 0 && (
                        <div className="mb-6 bg-red-50 border-l-4 border-red-600 p-4 rounded shadow flex items-center">
                            <span className="text-2xl mr-3">⚠️</span>
                            <div>
                                <h3 className="font-bold text-red-800">Atenção Necessária</h3>
                                <p className="text-sm text-red-700">Preencha todos os campos obrigatórios.</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.type !== 'textarea') e.preventDefault(); }} className="space-y-6">
                        
                        <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg p-6 border-l-4 border-blue-600">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><span>📦</span> Origem da Carga</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div 
                                    onClick={() => { setModo('cd'); setData('origem_id', ''); setLogisticaInfo(null); setMotosDisponiveis([]); }}
                                    className={`cursor-pointer border-2 rounded-lg p-4 flex items-center gap-4 transition ${modo === 'cd' ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-gray-200 hover:border-blue-300'}`}
                                >
                                    <div className="text-3xl">🏭</div>
                                    <div>
                                        <div className="font-bold text-gray-800">Reposição CD</div>
                                        <div className="text-xs text-gray-500">Solicitar estoque direto da Fábrica/CD.</div>
                                    </div>
                                    {modo === 'cd' && <div className="ml-auto text-blue-600 font-bold">✓</div>}
                                </div>

                                <div 
                                    onClick={() => setModo('transferencia')}
                                    className={`cursor-pointer border-2 rounded-lg p-4 flex items-center gap-4 transition ${modo === 'transferencia' ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-gray-200 hover:border-orange-300'}`}
                                >
                                    <div className="text-3xl">🔁</div>
                                    <div>
                                        <div className="font-bold text-gray-800">Transferência entre Lojas</div>
                                        <div className="text-xs text-gray-500">Solicitar moto do estoque de outra filial.</div>
                                    </div>
                                    {modo === 'transferencia' && <div className="ml-auto text-orange-600 font-bold">✓</div>}
                                </div>
                            </div>

                            {modo === 'transferencia' && (
                                <div className="animate-fadeIn bg-orange-50 p-4 rounded-lg border border-orange-100">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Selecione a Loja Fornecedora *</label>
                                    <select
                                        required
                                        value={data.origem_id}
                                        onChange={handleFornecedorChange}
                                        className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-orange-500 focus:border-orange-500 font-bold text-gray-700"
                                    >
                                        <option value="">-- Escolha a loja que tem a moto --</option>
                                        {lojasDisponiveis.map(loja => (
                                            <option key={loja.id} value={loja.id}>{loja.filial ? `${loja.filial} (${loja.name})` : loja.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-orange-600 mt-1">* A lista de motos disponíveis será carregada após a seleção.</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg p-6 border-t-4 border-red-600">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-gray-800">Itens do Pedido</h3>
                                <p className="text-sm text-gray-500">Adicione as motos que deseja solicitar.</p>
                            </div>

                            <datalist id="opcoes-modelos">
                                {listaModelos.map((nome, index) => ( <option key={index} value={nome} /> ))}
                            </datalist>

                            <div className="hidden md:grid grid-cols-12 gap-3 mb-2 font-bold text-xs uppercase text-gray-500 px-2 items-end">
                                <div className="col-span-1 text-center">#</div>
                                <div className="col-span-3">Modelo *</div>
                                <div className="col-span-2">Chassi {modo === 'transferencia' && '*'}</div>
                                <div className="col-span-2">Destino Final *</div>
                                <div className="col-span-1">Cor *</div>
                                <div className="col-span-2">Motivo *</div>
                                <div className="col-span-1"></div>
                            </div>

                            <div className="space-y-3">
                                {data.itens.map((item, index) => (
                                    <div key={index} className={`grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-gray-50 p-4 rounded-lg border shadow-sm transition-all relative ${errors[`itens.${index}`] ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                                        
                                        <div className="col-span-1 text-center font-bold text-gray-400 hidden md:block">{index + 1}</div>
                                        <div className="md:hidden absolute top-2 right-2 text-xs font-bold text-gray-300">#{index + 1}</div>

                                        <div className="col-span-3">
                                            <label className="md:hidden text-xs font-bold text-gray-500 uppercase">Modelo *</label>
                                            <input 
                                                required
                                                type="text" list="opcoes-modelos" placeholder="MODELO..."
                                                value={item.modelo}
                                                readOnly={modo === 'transferencia'}
                                                onChange={(e) => updateItem(index, 'modelo', e.target.value.toUpperCase())}
                                                className={`w-full border-gray-300 rounded uppercase font-bold text-sm focus:ring-red-500 focus:border-red-500 ${modo === 'transferencia' ? 'bg-gray-100 text-gray-500' : ''}`}
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className="md:hidden text-xs font-bold text-gray-500 uppercase">Chassi {modo === 'transferencia' && '*'}</label>
                                            {modo === 'transferencia' ? (
                                                <select 
                                                    required
                                                    value={item.chassi} 
                                                    onChange={(e) => updateItem(index, 'chassi', e.target.value)}
                                                    className="w-full rounded text-sm font-mono border-orange-300 bg-orange-50 focus:ring-orange-500 focus:border-orange-500"
                                                    disabled={!data.origem_id || motosDisponiveis.length === 0}
                                                >
                                                    <option value="">
                                                        {!data.origem_id ? 'Selecione a loja...' : 
                                                         motosDisponiveis.length === 0 ? 'Sem estoque disponível' : '-- Selecione --'}
                                                    </option>
                                                    {motosDisponiveis.map(moto => (
                                                        <option key={moto.id} value={moto.chassi}>{moto.modelo} ({moto.chassi})</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input 
                                                    required
                                                    type="text" placeholder="CHASSI" maxLength={17}
                                                    value={item.chassi}
                                                    onChange={(e) => updateItem(index, 'chassi', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                                    className={`w-full rounded font-mono tracking-widest text-sm ${item.chassi.length >= 11 ? 'border-green-400 bg-green-50' : 'border-gray-300'}`}
                                                />
                                            )}
                                        </div>

                                        <div className="col-span-2 relative">
                                            <label className="md:hidden text-xs font-bold text-gray-500 uppercase">Destino *</label>
                                            <select 
                                                required
                                                value={item.local}
                                                onChange={(e) => updateItem(index, 'local', e.target.value)}
                                                className="w-full rounded text-sm bg-yellow-50 focus:bg-white border-gray-300"
                                            >
                                                <option value="" disabled>Selecione...</option>
                                                {locaisEntrega.map(local => <option key={local} value={local}>{local}</option>)}
                                            </select>
                                            {index === 0 && data.itens.length > 1 && (
                                                <button type="button" onClick={replicarDestino} className="absolute -top-5 right-0 text-[10px] text-blue-600 hover:underline font-bold hidden md:block">Copiar p/ todos ⬇️</button>
                                            )}
                                        </div>

                                        <div className="col-span-1">
                                            <label className="md:hidden text-xs font-bold text-gray-500 uppercase">Cor *</label>
                                            <input 
                                                required
                                                type="text" placeholder="COR"
                                                value={item.cor}
                                                readOnly={modo === 'transferencia'}
                                                onChange={(e) => updateItem(index, 'cor', e.target.value.toUpperCase())}
                                                className={`w-full border-gray-300 rounded uppercase text-sm ${modo === 'transferencia' ? 'bg-gray-100 text-gray-500' : ''}`}
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className="md:hidden text-xs font-bold text-gray-500 uppercase">Motivo *</label>
                                            <select 
                                                required
                                                value={item.motivo} onChange={(e) => updateItem(index, 'motivo', e.target.value)}
                                                className="w-full rounded text-sm border-gray-300"
                                            >
                                                <option value="" disabled>Selecione...</option>
                                                {motivosOpcoes.map((m, i) => <option key={i} value={m}>{m}</option>)}
                                            </select>
                                        </div>

                                        <div className="col-span-1 text-center">
                                            {data.itens.length > 1 && (
                                                <button type="button" onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-600 text-xl p-2 transition rounded-full hover:bg-red-50">🗑️</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 flex flex-col md:flex-row justify-between items-start gap-6 border-t pt-6">
                                <button type="button" onClick={addItem} className="w-full md:w-auto flex items-center justify-center gap-2 text-blue-600 font-bold border-2 border-dashed border-blue-300 rounded-lg px-6 py-4 hover:bg-blue-50 transition">
                                    <span>➕</span> Adicionar Moto
                                </button>
                                <div className="w-full md:w-1/2">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Observações</label>
                                    <textarea 
                                        value={data.observacao} onChange={e => setData('observacao', e.target.value)} 
                                        className="w-full border-gray-300 rounded h-20 text-sm focus:ring-red-500 focus:border-red-500" 
                                        placeholder="Alguma ressalva importante..."
                                    ></textarea>
                                </div>
                            </div>
                        </div>

                        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 z-50">
                            <div className="max-w-7xl mx-auto flex justify-between items-center px-4">
                                <div>
                                    <span className="text-gray-600 hidden md:inline font-medium">Total:</span>
                                    <span className="ml-2 text-2xl font-bold text-red-600">{data.itens.length} motos</span>
                                </div>
                                <button 
                                    onClick={submit} 
                                    disabled={processing || (modo === 'transferencia' && (!logisticaInfo || logisticaInfo.erro))}
                                    className="bg-gradient-to-r from-red-600 to-red-700 text-white px-8 py-3 rounded-lg font-bold hover:from-red-700 hover:to-red-800 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                                >
                                    {processing ? 'Processando...' : (modo === 'transferencia' ? 'Solicitar Transferência 🔁' : 'Solicitar Reposição 🚀')}
                                </button>
                            </div>
                        </div>

                    </form>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}