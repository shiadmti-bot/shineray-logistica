import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import axios from 'axios';
import { 
    ArchiveBoxIcon, 
    CheckCircleIcon, 
    ArrowPathIcon, 
    ArrowUturnLeftIcon, 
    InformationCircleIcon, 
    ArrowDownIcon, 
    TrashIcon,
    ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';

export default function PedidoCreate({ auth, listaModelos, lojasDisponiveis = [], cdUserId, locaisEntrega = [] }) { // Recebe cdUserId e locaisEntrega
    
    // Configura um "Anti-Dormida" para manter a sessão ativa enquanto o usuário demora digitando
    useEffect(() => {
        const interval = setInterval(() => {
            // Chamamos uma rota que possui middleware 'web' para renovar a sessão e o CSRF
            axios.get(route('api.estoque.loja')).catch(() => {});
        }, 14 * 60 * 1000); // Ping a cada 14 minutos
        return () => clearInterval(interval);
    }, []);

    // const [modo, setModo] = useState('cd'); // REMOVED: Using useForm data instead
    const [logisticaInfo, setLogisticaInfo] = useState(null);
    const [motosDisponiveis, setMotosDisponiveis] = useState([]); 

    const motivosOpcoes = [
        "Estoque Regular (Giro)",
        "Venda Confirmada (Cliente)",
        "Test Drive / Frota",
        "Exposição / Showroom",
        "Reposição de Garantia",
        "Uso Interno",
        "Avaria de Transporte",
        "Defeito de Fabricação",
        "Excesso de Estoque",
        "Troca de Modelo",
        "Manutenção / Reparo"
    ];

    const initPrefill = () => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const prefill = params.get('prefill_motos');
            if (prefill) {
                try {
                    const parsed = JSON.parse(decodeURIComponent(prefill));
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed.map(m => ({
                            modelo: m.modelo || '',
                            chassi: m.chassi || '',
                            cor: m.cor || '',
                            ano: m.ano || '',
                            motivo: '',
                            local: locaisEntrega.includes(auth.user.filial) ? auth.user.filial : ''
                        }));
                    }
                } catch(e) { console.error("Error parsing prefill motos", e); }
            }
        }
        return [
            { 
                modelo: '', chassi: '', cor: '', ano: '', motivo: '', 
                local: locaisEntrega.includes(auth.user.filial) ? auth.user.filial : '' 
            }
        ];
    };

    const { data, setData, post, processing, errors, reset } = useForm({
        origem_id: '',
        itens: initPrefill(),
        observacao: '',
        modo: 'cd', // Inicializa no useForm
        cd_user_id: cdUserId // Passa prop para o form
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
        setMotosDisponiveis([]);
    };

    const handleModeChange = (novoModo) => {
        // Atualiza modo e reseta campos dependentes via setData callback
        setLogisticaInfo(null);
        setMotosDisponiveis([]);

        setData(data => ({
            ...data,
            modo: novoModo,
            origem_id: novoModo === 'cd' ? '' : (novoModo === 'devolucao' ? auth.user.id : data.origem_id),
            itens: novoModo === 'devolucao' 
                ? data.itens.map(item => ({ ...item, local: 'Matriz / CD' })) 
                : data.itens
        }));
    };

    const addItem = () => {
        setData('itens', [
            ...data.itens, 
            { 
                modelo: '', chassi: '', cor: '', ano: '', motivo: '', 
                local: data.modo === 'devolucao' ? 'Matriz / CD' : (data.itens[data.itens.length - 1]?.local || '') 
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

        // Validação de campos obrigatórios no cliente
        const camposFaltando = [];
        data.itens.forEach((item, i) => {
            if (!item.chassi || item.chassi.trim().length < 11) {
                camposFaltando.push(`Moto #${i + 1}: Chassi inválido ou vazio (mínimo 11 caracteres)`);
            }
            if (!item.modelo) camposFaltando.push(`Moto #${i + 1}: Modelo não preenchido`);
            if (!item.cor) camposFaltando.push(`Moto #${i + 1}: Cor não preenchida`);
            if (!item.motivo) camposFaltando.push(`Moto #${i + 1}: Motivo não selecionado`);
            if (!item.local && data.modo !== 'devolucao') camposFaltando.push(`Moto #${i + 1}: Destino não selecionado`);
        });

        if (camposFaltando.length > 0) {
            return Swal.fire({
                icon: 'warning',
                title: 'Campos Obrigatórios',
                html: `<div style="text-align:left;font-size:13px;"><ul style="list-style:disc;padding-left:20px;">${camposFaltando.map(c => `<li>${c}</li>`).join('')}</ul></div>`,
                confirmButtonColor: '#d33'
            });
        }

        post(route('pedidos.store'), {
            onSuccess: (page) => {
                // VERIFICAÇÃO RÍGIDA: Garante que o backend DE FATO criou o pedido
                // Não confia apenas num status HTTP 200/302 que pode ser timeout ou logout
                const successMsg = page.props.flash?.success || page.props.flash?.message;
                const errorMsg = page.props.flash?.error; // CAPTURA O ERRO OCULTO

                if (successMsg) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Sucesso!',
                        text: typeof successMsg === 'string' ? successMsg : (data.modo === 'devolucao' ? 'Solicitação de Devolução enviada para o CD.' : 'Solicitação enviada.'),
                        confirmButtonColor: data.modo === 'devolucao' ? '#7e22ce' : '#3085d6'
                    }).then(() => {
                        router.visit(route('pedidos.index'));
                    });
                } else if (errorMsg) {
                    // SE LARAVEL REDIRECIONOU COM ERRO FLASH SESSÃO, CAI AQUI!
                    Swal.fire({
                        icon: 'error',
                        title: 'Falha no Servidor',
                        text: typeof errorMsg === 'string' ? errorMsg : 'Erro desconhecido retornado pelo servidor.'
                    });
                } else if (!page.props.auth?.user) {
                    Swal.fire('Sessão Expirada', 'Você ficou muito tempo inativo. Faça login novamente.', 'error');
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro de Comunicação',
                        text: 'A resposta do servidor foi incompleta (timeout ou erro severo). O seu pedido NÃO foi criado. Atualize a página e tente de novo subdividindo o pedido.'
                    });
                }
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
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-red-700">Nova Solicitação / Devolução</h2>}>
            <Head title="Nova Solicitação" />
            <div className="py-8 bg-gray-100 min-h-screen pb-32">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {Object.keys(errors).length > 0 && (
                        <div className="mb-6 bg-red-50 border-l-4 border-red-600 p-4 rounded shadow flex items-center">
                            <span className="mr-3"><ExclamationTriangleIcon className="w-8 h-8 text-red-600" /></span>
                            <div>
                                <h3 className="font-bold text-red-800">Atenção Necessária</h3>
                                <p className="text-sm text-red-700">Preencha todos os campos obrigatórios.</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.type !== 'textarea') e.preventDefault(); }} className="space-y-6">
                        
                        <div className={`bg-white overflow-hidden shadow-sm sm:rounded-lg p-6 border-l-4 ${data.modo === 'devolucao' ? 'border-purple-600' : 'border-blue-600'}`}>
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><ArchiveBoxIcon className="w-5 h-5" /> Tipo de Movimentação</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div 
                                    onClick={() => handleModeChange('cd')}
                                    className={`cursor-pointer border-2 rounded-lg p-4 flex items-center gap-4 transition ${data.modo === 'cd' ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-gray-200 hover:border-blue-300'}`}
                                >
                                    <ArchiveBoxIcon className={`w-10 h-10 ${data.modo === 'cd' ? 'text-blue-600' : 'text-gray-400'}`} />
                                    <div>
                                        <div className="font-bold text-gray-800">Reposição CD</div>
                                        <div className="text-xs text-gray-500">Solicitar estoque direto da Fábrica.</div>
                                    </div>
                                    {data.modo === 'cd' && <CheckCircleIcon className="w-6 h-6 ml-auto text-blue-600" />}
                                </div>

                                <div 
                                    onClick={() => handleModeChange('transferencia')}
                                    className={`cursor-pointer border-2 rounded-lg p-4 flex items-center gap-4 transition ${data.modo === 'transferencia' ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-gray-200 hover:border-orange-300'}`}
                                >
                                    <ArrowPathIcon className={`w-10 h-10 ${data.modo === 'transferencia' ? 'text-orange-600' : 'text-gray-400'}`} />
                                    <div>
                                        <div className="font-bold text-gray-800">Transferência</div>
                                        <div className="text-xs text-gray-500">Buscar moto em outra filial.</div>
                                    </div>
                                    {data.modo === 'transferencia' && <CheckCircleIcon className="w-6 h-6 ml-auto text-orange-600" />}
                                </div>

                                <div 
                                    onClick={() => handleModeChange('devolucao')} 
                                    className={`cursor-pointer border-2 rounded-lg p-4 flex items-center gap-4 transition ${data.modo === 'devolucao' ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-600' : 'border-gray-200 hover:border-purple-300'}`}
                                >
                                    <ArrowUturnLeftIcon className={`w-10 h-10 ${data.modo === 'devolucao' ? 'text-purple-600' : 'text-gray-400'}`} />
                                    <div>
                                        <div className="font-bold text-purple-800">Devolução CD</div>
                                        <div className="text-xs text-gray-500">Enviar moto de volta p/ Matriz.</div>
                                    </div>
                                    {data.modo === 'devolucao' && <CheckCircleIcon className="w-6 h-6 ml-auto text-purple-600" />}
                                </div>
                            </div>

                            {data.modo === 'transferencia' && (
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

                             {data.modo === 'devolucao' && (
                                <div className="animate-fadeIn bg-purple-50 p-4 rounded-lg border border-purple-100 flex items-center gap-3">
                                    <InformationCircleIcon className="w-8 h-8 text-purple-600" />
                                    <div>
                                        <h4 className="font-bold text-purple-800">Processo de Devolução</h4>
                                        <p className="text-xs text-purple-700">Essa solicitação será enviada para o CD aprovar o recebimento. Você deve informar o CHASSI das motos que estão saindo da sua loja.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={`bg-white overflow-hidden shadow-sm sm:rounded-lg p-6 border-t-4 ${data.modo === 'devolucao' ? 'border-purple-600' : 'border-red-600'}`}>
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-gray-800">Itens do Pedido</h3>
                                <p className="text-sm text-gray-500">Adicione as motos que deseja {data.modo === 'devolucao' ? 'devolver' : 'solicitar'}.</p>
                            </div>



                            {/* CABEÇALHO DESKTOP */}
                            <div className="hidden md:grid grid-cols-12 gap-3 mb-2 font-bold text-xs uppercase text-gray-500 px-2 items-end">
                                <div className="col-span-1 text-center">#</div>
                                <div className="col-span-3">Modelo *</div>
                                <div className="col-span-2">Chassi *</div>
                                <div className="col-span-2">{data.modo === 'devolucao' ? 'Destino Automático' : 'Destino Final *'}</div>
                                <div className="col-span-1">Cor *</div>
                                <div className="col-span-2">Motivo *</div>
                                <div className="col-span-1"></div>
                            </div>

                            <div className="space-y-3">
                                {data.itens.map((item, index) => (
                                    <div key={index} className={`rounded-xl border shadow-sm transition-all relative ${errors[`itens.${index}`] ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                                        
                                        {/* ===== LAYOUT DESKTOP (md+) ===== */}
                                        <div className="hidden md:grid grid-cols-12 gap-3 items-center p-4">
                                            <div className="col-span-1 text-center font-bold text-gray-400">{index + 1}</div>
                                            
                                            <div className="col-span-3">
                                                <select 
                                                    required
                                                    value={item.modelo}
                                                    onChange={(e) => updateItem(index, 'modelo', e.target.value)}
                                                    className="w-full border-gray-300 rounded uppercase font-bold text-sm focus:ring-red-500 focus:border-red-500 bg-white"
                                                >
                                                    <option value="" disabled>SELECIONE...</option>
                                                    {listaModelos.map((nome, i) => <option key={i} value={nome}>{nome}</option>)}
                                                </select>
                                            </div>

                                            <div className="col-span-2">
                                                <input 
                                                    required type="text" placeholder="CHASSI" minLength={11} maxLength={17}
                                                    value={item.chassi}
                                                    onChange={(e) => updateItem(index, 'chassi', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                                    className={`w-full rounded font-mono tracking-widest text-sm ${!item.chassi ? 'border-red-300 bg-red-50' : item.chassi.length >= 11 ? 'border-green-400 bg-green-50' : 'border-orange-300 bg-orange-50'}`}
                                                />
                                            </div>

                                            <div className="col-span-2 relative">
                                                {data.modo === 'devolucao' ? (
                                                    <input disabled value="Matriz / CD" className="w-full rounded text-sm bg-purple-100 text-purple-800 border-purple-200 font-bold text-center" />
                                                ) : (
                                                    <select required value={item.local} onChange={(e) => updateItem(index, 'local', e.target.value)} className="w-full rounded text-sm bg-yellow-50 focus:bg-white border-gray-300">
                                                        <option value="" disabled>Selecione...</option>
                                                        {locaisEntrega.map(local => <option key={local} value={local}>{local}</option>)}
                                                    </select>
                                                )}
                                                {index === 0 && data.itens.length > 1 && data.modo !== 'devolucao' && (
                                                    <button type="button" onClick={replicarDestino} className="absolute -top-5 right-0 text-[10px] text-blue-600 hover:underline font-bold flex items-center gap-1">
                                                        Copiar p/ todos <ArrowDownIcon className="w-3 h-3 inline" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="col-span-1">
                                                <input required type="text" placeholder="COR" value={item.cor} onChange={(e) => updateItem(index, 'cor', e.target.value.toUpperCase())} className="w-full border-gray-300 rounded uppercase text-sm" />
                                            </div>

                                            <div className="col-span-2">
                                                <select required value={item.motivo} onChange={(e) => updateItem(index, 'motivo', e.target.value)} className="w-full rounded text-sm border-gray-300">
                                                    <option value="" disabled>Selecione...</option>
                                                    {motivosOpcoes.map((m, i) => <option key={i} value={m}>{m}</option>)}
                                                </select>
                                            </div>

                                            <div className="col-span-1 text-center">
                                                {data.itens.length > 1 && (
                                                    <button type="button" onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-600 text-xl p-2 transition rounded-full hover:bg-red-50">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* ===== LAYOUT MOBILE ===== */}
                                        <div className="md:hidden p-4 space-y-3">
                                            {/* Header: Número + Botão remover */}
                                            <div className="flex justify-between items-center">
                                                <span className="bg-gray-200 text-gray-600 text-xs font-black px-2.5 py-1 rounded-full">
                                                    Moto #{index + 1}
                                                </span>
                                                {data.itens.length > 1 && (
                                                    <button type="button" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Modelo */}
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modelo *</label>
                                                <select 
                                                    required
                                                    value={item.modelo}
                                                    onChange={(e) => updateItem(index, 'modelo', e.target.value)}
                                                    className="w-full border-gray-300 rounded-lg uppercase font-bold text-base py-3 px-4 focus:ring-red-500 focus:border-red-500 bg-white"
                                                >
                                                    <option value="" disabled>SELECIONE...</option>
                                                    {listaModelos.map((nome, i) => <option key={i} value={nome}>{nome}</option>)}
                                                </select>
                                            </div>

                                            {/* Chassi */}
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Chassi * <span className="text-gray-400 normal-case font-normal">(mín. 11 caracteres)</span></label>
                                                <input 
                                                    required type="text" placeholder="99NWJ1125T5003297" minLength={11} maxLength={17}
                                                    value={item.chassi}
                                                    onChange={(e) => updateItem(index, 'chassi', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                                    className={`w-full rounded-lg font-mono tracking-wider text-base py-3 px-4 ${!item.chassi ? 'border-red-300 bg-red-50' : item.chassi.length >= 11 ? 'border-green-400 bg-green-50' : 'border-orange-300 bg-orange-50'}`}
                                                />
                                            </div>

                                            {/* Destino */}
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                    {data.modo === 'devolucao' ? 'Destino' : 'Destino Final *'}
                                                </label>
                                                {data.modo === 'devolucao' ? (
                                                    <input disabled value="Matriz / CD" className="w-full rounded-lg text-base py-3 px-4 bg-purple-100 text-purple-800 border-purple-200 font-bold text-center" />
                                                ) : (
                                                    <select 
                                                        required value={item.local}
                                                        onChange={(e) => updateItem(index, 'local', e.target.value)}
                                                        className="w-full rounded-lg text-base py-3 px-4 bg-yellow-50 focus:bg-white border-gray-300"
                                                    >
                                                        <option value="" disabled>Selecione o destino...</option>
                                                        {locaisEntrega.map(local => <option key={local} value={local}>{local}</option>)}
                                                    </select>
                                                )}
                                                {index === 0 && data.itens.length > 1 && data.modo !== 'devolucao' && (
                                                    <button type="button" onClick={replicarDestino} className="mt-1 text-xs text-blue-600 hover:underline font-bold flex items-center gap-1">
                                                        <ArrowDownIcon className="w-3 h-3" /> Copiar destino p/ todas as motos
                                                    </button>
                                                )}
                                            </div>

                                            {/* Cor + Motivo (lado a lado no mobile) */}
                                            <div className="grid grid-cols-5 gap-3">
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cor *</label>
                                                    <input 
                                                        required type="text" placeholder="COR"
                                                        value={item.cor}
                                                        onChange={(e) => updateItem(index, 'cor', e.target.value.toUpperCase())}
                                                        className="w-full border-gray-300 rounded-lg uppercase text-base py-3 px-4"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motivo *</label>
                                                    <select 
                                                        required value={item.motivo}
                                                        onChange={(e) => updateItem(index, 'motivo', e.target.value)}
                                                        className="w-full rounded-lg text-base py-3 px-4 border-gray-300"
                                                    >
                                                        <option value="" disabled>Selecione...</option>
                                                        {motivosOpcoes.map((m, i) => <option key={i} value={m}>{m}</option>)}
                                                    </select>
                                                </div>
                                            </div>
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

                        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-3 md:p-4 z-50">
                            <div className="max-w-7xl mx-auto flex justify-between items-center px-2 md:px-4 gap-2">
                                <div className="flex flex-col md:flex-row md:items-baseline">
                                    <span className="text-[10px] md:text-sm text-gray-500 font-bold uppercase md:hidden">Itens</span>
                                    <span className="text-gray-600 hidden md:inline font-medium">Total:</span>
                                    <span className="md:ml-2 text-xl md:text-2xl font-black text-red-600 leading-none">{data.itens.length} <span className="hidden md:inline">motos</span></span>
                                </div>
                                <button 
                                    type="submit"
                                    disabled={processing || (data.modo === 'transferencia' && (!logisticaInfo || logisticaInfo.erro))}
                                    className={`w-full md:w-auto px-4 md:px-8 py-3 md:py-3 rounded-lg font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 text-white text-xs md:text-base whitespace-nowrap
                                    ${data.modo === 'devolucao' ? 'bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900' : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'}`}
                                >
                                    {processing ? 'Processando...' : 
                                        data.modo === 'devolucao' ? 'Confirmar Devolução ↩️' :
                                        data.modo === 'transferencia' ? 'Solicitar Transferência 🔁' : 'Solicitar Reposição 🚀'
                                    }
                                </button>
                            </div>
                        </div>

                    </form>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}