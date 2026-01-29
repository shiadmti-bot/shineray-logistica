import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import Swal from 'sweetalert2';

export default function PedidoCreate({ auth, listaModelos }) {
    const { data, setData, post, processing, errors } = useForm({
        // Adicionado campo 'local' padrão (filial do usuário)
        itens: [
            { modelo: '', chassi: '', cor: '', ano: '', motivo: '', local: auth.user.filial || 'Matriz' }
        ],
        observacao: ''
    });

    const motivosOpcoes = [
        "Estoque Regular (Giro)",
        "Venda Confirmada (Cliente)",
        "Test Drive / Frota",
        "Exposição / Showroom",
        "Reposição de Garantia",
        "Uso Interno",
    ];

    const addItem = () => {
        setData('itens', [
            ...data.itens, 
            // Novo item herda o local do primeiro item para facilitar
            { modelo: '', chassi: '', cor: '', ano: '', motivo: '', local: data.itens[0]?.local || auth.user.filial || 'Matriz' }
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
        setData('itens', novosItens);
    };

    // --- FUNÇÃO INTELIGENTE: REPLICAR DESTINO ---
    const replicarDestino = () => {
        const primeiroLocal = data.itens[0].local;
        if (!primeiroLocal) return;

        const novosItens = data.itens.map(item => ({ ...item, local: primeiroLocal }));
        setData('itens', novosItens);

        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
        Toast.fire({ icon: 'success', title: `Destino "${primeiroLocal}" copiado para todos!` });
    };

    const submit = (e) => {
        e.preventDefault();
        post(route('pedidos.store'), {
            onSuccess: () => Swal.fire('Sucesso!', 'Solicitação enviada.', 'success'),
            onError: () => Swal.fire('Erro!', 'Verifique os campos em vermelho.', 'error')
        });
    };

    return (
        <AuthenticatedLayout 
            user={auth.user} 
            header={<h2 className="font-bold text-2xl text-red-700">Nova Solicitação de Despacho</h2>}
        >
            <Head title="Nova Solicitação" />
            <div className="py-12 bg-gray-100 min-h-screen pb-32">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    
                    {Object.keys(errors).length > 0 && (
                        <div className="mb-6 bg-red-50 border-l-8 border-red-600 p-6 rounded shadow-lg animate-pulse">
                            <div className="flex items-start">
                                <div className="flex-shrink-0 text-red-600 text-2xl">⚠️</div>
                                <div className="ml-4">
                                    <h3 className="text-xl font-bold text-red-800">Atenção!</h3>
                                    <div className="mt-2 text-sm text-red-700 font-bold">
                                        Verifique os campos obrigatórios marcados em vermelho.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <form 
                        onSubmit={submit} 
                        onKeyDown={(e) => { if (e.key === 'Enter' && e.target.type !== 'textarea') e.preventDefault(); }}
                        className="bg-white overflow-hidden shadow-sm sm:rounded-lg p-6 border-t-4 border-red-600"
                    >
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-gray-800">Preencha os dados das motos</h3>
                            <p className="text-sm text-gray-500">
                                Informe o destino correto (Loja ou Cliente) para cada moto.
                            </p>
                        </div>

                        <datalist id="opcoes-modelos">
                            {listaModelos.map((nome, index) => ( <option key={index} value={nome} /> ))}
                        </datalist>

                        {/* --- CABEÇALHO DA TABELA (NOVO LAYOUT) --- */}
                        <div className="hidden md:grid grid-cols-12 gap-3 mb-2 font-bold text-xs uppercase text-gray-500 px-2 items-end">
                            <div className="col-span-1 text-center">#</div>
                            <div className="col-span-3">Modelo *</div>
                            <div className="col-span-2">Chassi (11-17)</div>
                            <div className="col-span-2">Destino / Local *</div>
                            <div className="col-span-1">Cor *</div>
                            <div className="col-span-2">Motivo *</div>
                            <div className="col-span-1 text-center"></div>
                        </div>

                        {/* --- LINHAS --- */}
                        <div className="space-y-3">
                            {data.itens.map((item, index) => (
                                <div key={index} className={`grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-gray-50 p-4 rounded-lg border shadow-sm transition-all relative ${errors[`itens.${index}.motivo`] || errors[`itens.${index}.local`] ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                                    
                                    {/* # */}
                                    <div className="col-span-1 text-center font-bold text-gray-400 hidden md:block">{index + 1}</div>
                                    
                                    {/* Contador Mobile */}
                                    <div className="md:hidden absolute top-2 right-2 text-xs font-bold text-gray-300">#{index + 1}</div>

                                    {/* Modelo */}
                                    <div className="col-span-3">
                                        <label className="md:hidden text-xs font-bold text-gray-500 uppercase mb-1 block">Modelo</label>
                                        <input 
                                            type="text" 
                                            list="opcoes-modelos"
                                            placeholder="MODELO..."
                                            value={item.modelo}
                                            onChange={(e) => updateItem(index, 'modelo', e.target.value.toUpperCase())}
                                            className="w-full border-gray-300 rounded focus:border-red-500 focus:ring-red-500 uppercase font-bold text-sm"
                                            required
                                        />
                                    </div>

                                    {/* Chassi */}
                                    <div className="col-span-2">
                                        <label className="md:hidden text-xs font-bold text-gray-500 uppercase mb-1 block">Chassi</label>
                                        <input 
                                            type="text" 
                                            placeholder="CHASSI (Opcional)"
                                            value={item.chassi}
                                            maxLength={17} 
                                            onChange={(e) => updateItem(index, 'chassi', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                            className={`w-full rounded font-mono tracking-widest text-sm ${item.chassi.length >= 11 ? 'border-green-400 bg-green-50' : 'border-gray-300'}`}
                                        />
                                    </div>

                                    {/* Destino / Local (NOVO CAMPO) */}
                                    <div className="col-span-2 relative">
                                        <label className="md:hidden text-xs font-bold text-gray-500 uppercase mb-1 block">Local de Entrega</label>
                                        
                                        <input 
                                            type="text" 
                                            placeholder="Ex: Cliente Castanhal"
                                            value={item.local}
                                            onChange={(e) => updateItem(index, 'local', e.target.value)}
                                            className={`w-full rounded text-sm focus:border-blue-500 bg-yellow-50 focus:bg-white ${errors[`itens.${index}.local`] ? 'border-red-500' : 'border-gray-300'}`}
                                            required
                                        />

                                        {/* Botão Copiar (Só no primeiro item) */}
                                        {index === 0 && data.itens.length > 1 && (
                                            <button 
                                                type="button" 
                                                onClick={replicarDestino} 
                                                className="absolute -top-5 right-0 text-[10px] text-blue-600 hover:underline font-bold hidden md:block"
                                                title="Copiar este destino para todas as linhas abaixo"
                                            >
                                                Copiar p/ todos ⬇️
                                            </button>
                                        )}
                                    </div>

                                    {/* Cor */}
                                    <div className="col-span-1">
                                        <label className="md:hidden text-xs font-bold text-gray-500 uppercase mb-1 block">Cor</label>
                                        <input 
                                            type="text" 
                                            placeholder="COR"
                                            value={item.cor}
                                            onChange={(e) => updateItem(index, 'cor', e.target.value.toUpperCase())}
                                            className="w-full border-gray-300 rounded focus:border-red-500 uppercase text-sm"
                                            required
                                        />
                                    </div>

                                    {/* Motivo */}
                                    <div className="col-span-2">
                                        <label className="md:hidden text-xs font-bold text-gray-500 uppercase mb-1 block">Motivo</label>
                                        <select 
                                            value={item.motivo} 
                                            onChange={(e) => updateItem(index, 'motivo', e.target.value)}
                                            className={`w-full rounded text-sm focus:border-red-500 ${errors[`itens.${index}.motivo`] ? 'border-red-500' : 'border-gray-300'}`}
                                            required
                                        >
                                            <option value="" disabled>Selecione...</option>
                                            {motivosOpcoes.map((m, i) => <option key={i} value={m}>{m}</option>)}
                                        </select>
                                    </div>

                                    {/* Botão Remover */}
                                    <div className="col-span-1 text-center">
                                        {data.itens.length > 1 && (
                                            <button type="button" onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-600 font-bold text-xl p-2 transition rounded-full hover:bg-red-50" title="Remover item">
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* --- FOOTER DO FORMULÁRIO --- */}
                        <div className="mt-8 flex flex-col md:flex-row justify-between items-start gap-6 border-t pt-6">
                            <button type="button" onClick={addItem} className="w-full md:w-auto flex items-center justify-center gap-2 text-blue-600 font-bold border-2 border-dashed border-blue-300 rounded-lg px-6 py-4 hover:bg-blue-50 transition">
                                <span>➕</span> Adicionar Outra Moto
                            </button>
                            
                            <div className="w-full md:w-1/2">
                                <label className="block text-sm font-bold text-gray-700 mb-1">Observações Gerais</label>
                                <textarea 
                                    value={data.observacao} 
                                    onChange={e => setData('observacao', e.target.value)} 
                                    className="w-full border-gray-300 rounded h-24 text-sm focus:ring-red-500 focus:border-red-500" 
                                    placeholder="Alguma ressalva importante para o CD..."
                                ></textarea>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {/* --- BOTÃO FLUTUANTE DE ENVIO --- */}
            <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 shadow-lg p-4 z-50">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div>
                        <span className="text-gray-600 hidden md:inline font-medium">Total:</span>
                        <span className="ml-2 text-2xl font-bold text-red-600">{data.itens.length} motos</span>
                    </div>
                    <button onClick={submit} disabled={processing} className="bg-gradient-to-r from-red-600 to-red-700 text-white px-8 py-3 rounded-lg font-bold hover:from-red-700 hover:to-red-800 shadow-md transition w-full md:w-auto uppercase tracking-wide transform hover:-translate-y-0.5">
                        {processing ? 'Enviando...' : 'Enviar Solicitação 🚀'}
                    </button>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}