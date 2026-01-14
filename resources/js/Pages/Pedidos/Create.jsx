import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';

export default function PedidoCreate({ auth, listaModelos }) {
    const { data, setData, post, processing, errors } = useForm({
        itens: [
            { modelo: '', chassi: '', cor: '', ano: '', motivo: '' } // Novo campo motivo
        ],
        observacao: ''
    });

    // LISTA DE MOTIVOS PADRONIZADA (Sugestão Enterprise)
    const motivosOpcoes = [
        "Estoque Regular (Giro)",
        "Venda Confirmada (Cliente)",
        "Test Drive / Frota",
        "Exposição / Showroom",
        "Reposição de Garantia",
        "Uso Interno",
        "Outros"
    ];

    const addItem = () => {
        setData('itens', [...data.itens, { modelo: '', chassi: '', cor: '', ano: '', motivo: '' }]);
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
                                        Verifique os campos obrigatórios (marcados em vermelho).
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
                                Informe o motivo de cada moto para agilizar a aprovação do Gestor.
                            </p>
                        </div>

                        <datalist id="opcoes-modelos">
                            {listaModelos.map((nome, index) => ( <option key={index} value={nome} /> ))}
                        </datalist>

                        {/* CABEÇALHO (Desktop) */}
                        <div className="hidden md:grid grid-cols-12 gap-3 mb-2 font-bold text-xs uppercase text-gray-500 px-2">
                            <div className="col-span-1 text-center">#</div>
                            <div className="col-span-3">Modelo *</div>
                            <div className="col-span-3">Chassi (11-17) *</div>
                            <div className="col-span-2">Cor *</div>
                            <div className="col-span-2">Motivo da Solicitação *</div> {/* ATUALIZADO */}
                            <div className="col-span-1 text-center">Ação</div>
                        </div>

                        {/* LINHAS */}
                        <div className="space-y-3">
                            {data.itens.map((item, index) => (
                                <div key={index} className={`grid grid-cols-1 md:grid-cols-12 gap-3 items-start bg-gray-50 p-4 rounded-lg border shadow-sm transition-all ${errors[`itens.${index}.motivo`] ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                                    
                                    <div className="col-span-1 text-center font-bold text-gray-400 pt-3">{index + 1}</div>

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
                                    <div className="col-span-3">
                                        <label className="md:hidden text-xs font-bold text-gray-500 uppercase mb-1 block">Chassi</label>
                                        <input 
                                            type="text" 
                                            placeholder="CHASSI..."
                                            value={item.chassi}
                                            minLength={11} maxLength={17} 
                                            onChange={(e) => updateItem(index, 'chassi', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                            className={`w-full rounded font-mono tracking-widest text-sm ${item.chassi.length >= 11 ? 'border-green-400 bg-green-50' : 'border-gray-300'}`}
                                            required
                                        />
                                        <div className="flex justify-end mt-1">
                                            <span className={`text-[10px] font-bold ${item.chassi.length >= 11 ? 'text-green-600' : 'text-gray-400'}`}>{item.chassi.length}/17</span>
                                        </div>
                                    </div>

                                    {/* Cor e Ano (Compactados) */}
                                    <div className="col-span-2 flex gap-2">
                                        <div className="flex-1">
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
                                        <div className="w-16">
                                            <label className="md:hidden text-xs font-bold text-gray-500 uppercase mb-1 block">Ano</label>
                                            <input type="text" placeholder="24" maxLength={4} value={item.ano} onChange={(e) => updateItem(index, 'ano', e.target.value)} className="w-full border-gray-300 rounded text-center text-sm" />
                                        </div>
                                    </div>

                                    {/* NOVO CAMPO: MOTIVO */}
                                    <div className="col-span-2">
                                        <label className="md:hidden text-xs font-bold text-gray-500 uppercase mb-1 block">Motivo</label>
                                        <select 
                                            value={item.motivo} 
                                            onChange={(e) => updateItem(index, 'motivo', e.target.value)}
                                            className={`w-full rounded text-sm focus:border-red-500 focus:ring-red-500 ${errors[`itens.${index}.motivo`] ? 'border-red-500' : 'border-gray-300'}`}
                                            required
                                        >
                                            <option value="" disabled>Selecione...</option>
                                            {motivosOpcoes.map((m, i) => <option key={i} value={m}>{m}</option>)}
                                        </select>
                                    </div>

                                    {/* Botão Remover */}
                                    <div className="col-span-1 text-center pt-1">
                                        {data.itens.length > 1 && (
                                            <button type="button" onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-600 font-bold text-xl p-2 transition" title="Remover item">
                                                🗑️
                                            </button>
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
                                <label className="block text-sm font-bold text-gray-700 mb-1">Observações Gerais</label>
                                <textarea value={data.observacao} onChange={e => setData('observacao', e.target.value)} className="w-full border-gray-300 rounded h-24 text-sm" placeholder="Alguma ressalva sobre o lote..."></textarea>
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