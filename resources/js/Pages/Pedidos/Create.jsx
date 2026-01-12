import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';

// Recebemos 'listaModelos' do controller
export default function PedidoCreate({ auth, listaModelos }) {
    const { data, setData, post, processing, errors } = useForm({
        itens: [
            { modelo: '', chassi: '', cor: '', ano: '' }
        ],
        observacao: ''
    });

    const addItem = () => {
        setData('itens', [...data.itens, { modelo: '', chassi: '', cor: '', ano: '' }]);
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

    const submit = (e) => {
        e.preventDefault();
        post(route('pedidos.store'));
    };

    return (
        <AuthenticatedLayout 
            user={auth.user} 
            header={<h2 className="font-bold text-2xl text-red-700">Nova Solicitação de Despacho</h2>}
        >
            <Head title="Nova Solicitação" />
            <div className="py-12 bg-gray-100 min-h-screen pb-32">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    
                    {/* Alerta de Erro Global */}
                    {Object.keys(errors).length > 0 && (
                        <div className="mb-6 bg-red-50 border-l-8 border-red-600 p-6 rounded shadow-lg animate-pulse">
                            <div className="flex items-start">
                                <div className="flex-shrink-0 text-red-600">⚠️</div>
                                <div className="ml-4">
                                    <h3 className="text-xl font-bold text-red-800">Atenção!</h3>
                                    <div className="mt-2 text-sm text-red-700 font-bold">
                                        {errors.itens || 'Verifique os erros nos campos abaixo.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <form 
                        onSubmit={submit} 
                        // --- TRAVA DE ENTER ACIDENTAL ---
                        onKeyDown={(e) => {
                            // Se a tecla for ENTER e o foco NÃO estiver no campo de texto grande (textarea)
                            if (e.key === 'Enter' && e.target.type !== 'textarea') {
                                e.preventDefault(); // Bloqueia o envio do formulário
                            }
                        }}
                        className="bg-white overflow-hidden shadow-sm sm:rounded-lg p-6 border-t-4 border-red-600"
                    >
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-gray-800">Preencha os dados das motos</h3>
                            <p className="text-sm text-gray-500">
                                Selecione um modelo da lista ou digite um novo caso não encontre.
                            </p>
                        </div>

                        {/* DATALIST: O Segredo do Autocomplete */}
                        <datalist id="opcoes-modelos">
                            {listaModelos.map((nome, index) => (
                                <option key={index} value={nome} />
                            ))}
                        </datalist>

                        {/* Cabeçalho Visual */}
                        <div className="hidden md:grid grid-cols-12 gap-4 mb-2 font-bold text-xs uppercase text-gray-500 px-2">
                            <div className="col-span-1 text-center">#</div>
                            <div className="col-span-4">Modelo (Sugestão/Livre) *</div>
                            <div className="col-span-3">Chassi (11 Dígitos) *</div>
                            <div className="col-span-2">Cor</div>
                            <div className="col-span-1">Ano</div>
                            <div className="col-span-1 text-center">Ação</div>
                        </div>

                        {/* Linhas */}
                        <div className="space-y-3">
                            {data.itens.map((item, index) => (
                                <div key={index} className={`grid grid-cols-1 md:grid-cols-12 gap-3 items-start bg-gray-50 p-4 rounded-lg border shadow-sm transition-all ${errors.itens ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                                    
                                    <div className="col-span-1 text-center font-bold text-gray-400 pt-2">{index + 1}</div>

                                    {/* Campo Modelo com Datalist */}
                                    <div className="col-span-4">
                                        <label className="md:hidden text-xs font-bold text-gray-500 uppercase mb-1 block">Modelo</label>
                                        <input 
                                            type="text" 
                                            list="opcoes-modelos" // Conecta com a lista criada acima
                                            placeholder="Digite ou Selecione..."
                                            value={item.modelo}
                                            onChange={(e) => updateItem(index, 'modelo', e.target.value.toUpperCase())}
                                            className="w-full border-gray-300 rounded focus:border-red-500 focus:ring-red-500 uppercase font-bold text-sm"
                                            required
                                        />
                                    </div>

                                    {/* Campo Chassi */}
                                    <div className="col-span-3">
                                        <label className="md:hidden text-xs font-bold text-gray-500 uppercase mb-1 block">Chassi</label>
                                        <input 
                                            type="text" 
                                            placeholder="17 DÍGITOS"
                                            value={item.chassi}
                                            minLength={11}
                                            maxLength={17} 
                                            onChange={(e) => {
                                                const valorLimpo = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                                                updateItem(index, 'chassi', valorLimpo);
                                            }}
                                            className={`w-full rounded font-mono tracking-widest text-sm ${item.chassi.length === 11 ? 'border-green-400 bg-green-50' : 'border-gray-300'}`}
                                            required
                                        />
                                        <div className="flex justify-between mt-1">
                                            <span className={`text-[10px] ml-auto ${item.chassi.length === 11 ? 'text-green-600 font-bold' : 'text-gray-400'}`}>{item.chassi.length}/11</span>
                                        </div>
                                    </div>

                                    {/* Campo Cor (Agora Obrigatório) */}
                                    <div className="col-span-2">
                                        <label className="md:hidden text-xs font-bold text-gray-500 uppercase mb-1 block">Cor</label>
                                        <input 
                                            type="text" 
                                            placeholder="Cor *" // Dica visual
                                            value={item.cor}
                                            onChange={(e) => updateItem(index, 'cor', e.target.value.toUpperCase())}
                                            className={`w-full border-gray-300 rounded focus:border-red-500 focus:ring-red-500 uppercase text-sm ${
                                                // Se houver erro específico nesta linha, pinta de vermelho
                                                errors[`itens.${index}.cor`] ? 'border-red-500 bg-red-50' : ''
                                            }`}
                                            required // Trava do navegador
                                        />
                                        {/* Mensagem de erro específica para a cor */}
                                        {errors[`itens.${index}.cor`] && (
                                            <p className="text-[10px] text-red-500 mt-1">Obrigatório</p>
                                        )}
                                    </div>
                                    {/* Ano */}
                                    <div className="col-span-1">
                                        <label className="md:hidden text-xs font-bold text-gray-500 uppercase mb-1 block">Ano</label>
                                        <input type="text" placeholder="Ex: 24" maxLength={4} value={item.ano} onChange={(e) => updateItem(index, 'ano', e.target.value)} className="w-full border-gray-300 rounded focus:border-red-500 text-center text-sm" />
                                    </div>

                                    {/* Remover */}
                                    <div className="col-span-1 text-center pt-1">
                                        {data.itens.length > 1 && (
                                            <button type="button" onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-600 font-bold text-2xl transition">&times;</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 flex flex-col md:flex-row justify-between items-start gap-6 border-t pt-6">
                            <button type="button" onClick={addItem} className="w-full md:w-auto flex items-center justify-center gap-2 text-blue-600 font-bold border-2 border-dashed border-blue-300 rounded-lg px-6 py-4 hover:bg-blue-50 transition">
                                <span>➕</span> Adicionar Outra Moto
                            </button>
                            <div className="w-full md:w-1/2">
                                <label className="block text-sm font-bold text-gray-700 mb-1">Observações</label>
                                <textarea value={data.observacao} onChange={e => setData('observacao', e.target.value)} className="w-full border-gray-300 rounded h-24 text-sm" placeholder="Alguma ressalva..."></textarea>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 shadow-lg p-4 z-50">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div>
                        <span className="text-gray-600 hidden md:inline font-medium">Total:</span>
                        <span className="ml-2 text-2xl font-bold text-red-600">{data.itens.length} motos</span>
                    </div>
                    <button onClick={submit} disabled={processing} className="bg-red-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-red-700 shadow-md transition w-full md:w-auto uppercase tracking-wide">
                        {processing ? 'Enviando...' : 'Enviar Solicitação'}
                    </button>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}