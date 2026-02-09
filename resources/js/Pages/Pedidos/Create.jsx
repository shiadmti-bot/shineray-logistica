import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import axios from 'axios';

export default function PedidoCreate({ auth, listaModelos, lojasDisponiveis = [] }) {
    
    // --- ESTADOS DA v2 (LOGÍSTICA) ---
    const [modo, setModo] = useState('cd'); // 'cd' ou 'transferencia'
    const [logisticaInfo, setLogisticaInfo] = useState(null);
    const [carregandoLogistica, setCarregandoLogistica] = useState(false);

    // --- LISTA PADRONIZADA DE DESTINOS ---
    const locaisEntrega = [
        "Acará/PA", "Ananindeua/PA", "Barcarena/PA", "Belém/PA", 
        "Bragança/PA", "Breves/PA", "Capanema/PA", "Capitão Poço/PA", 
        "Castanhal/PA", "Concórdia/PA", "Curuçá/PA", "Icoaraci/PA", 
        "Moju/PA", "São Miguel/PA", "Tailândia/PA", "Tomé-Açu/PA",
        "Aldeota/CE", "Demócrito Rocha/CE", "Parangaba/CE",
        "Matriz / CD", "PDV Paar/PA", "PDV Barcarena/PA"
    ].sort();

    const motivosOpcoes = [
        "Estoque Regular (Giro)", "Venda Confirmada (Cliente)", "Test Drive / Frota",
        "Exposição / Showroom", "Reposição de Garantia", "Uso Interno"
    ];

    // --- ESTADO DO FORMULÁRIO (Padronizado para 'motos') ---
    const { data, setData, post, processing, errors, reset } = useForm({
        origem_id: '', // ID da loja de origem (vazio = CD)
        motos: [       // A chave deve ser 'motos' para bater com a validação do Laravel
            { 
                modelo: '', chassi: '', cor: '', ano: '', motivo: '', 
                // Se 'locaisEntrega' e 'auth' estiverem disponíveis no escopo:
                local: (typeof locaisEntrega !== 'undefined' && locaisEntrega.includes(auth?.user?.filial)) ? auth.user.filial : '' 
            }
        ],
        observacao: ''
    });

    // --- LÓGICA LOGÍSTICA (v2) ---
    const verificarLogistica = async (fornecedorId) => {
        if (!fornecedorId) {
            if (typeof setLogisticaInfo === 'function') setLogisticaInfo(null);
            return;
        }

        if (typeof setCarregandoLogistica === 'function') setCarregandoLogistica(true);
        
        try {
            // Chama a API para calcular prazos e rotas
            const response = await axios.post(route('pedidos.logistica'), {
                origem_id: fornecedorId // Ajustado para bater com o Controller (geralmente usa origem_id)
            });
            if (typeof setLogisticaInfo === 'function') setLogisticaInfo(response.data);
        } catch (error) {
            console.error("Erro logística:", error);
            if (typeof setLogisticaInfo === 'function') {
                setLogisticaInfo({ erro: 'Não foi possível calcular a rota. Verifique se as lojas possuem rotas definidas.' });
            }
        } finally {
            if (typeof setCarregandoLogistica === 'function') setCarregandoLogistica(false);
        }
    };

    const handleFornecedorChange = (e) => {
        const id = e.target.value;
        setData('origem_id', id);
        // Só chama a logística se tiver ID selecionado
        if(id) verificarLogistica(id);
    };

    // --- MANIPULAÇÃO DE ITENS (CORRIGIDO: 'itens' -> 'motos') ---
    
    const addItem = () => {
        // Pega o local da última moto para facilitar a digitação
        const ultimoLocal = data.motos.length > 0 ? data.motos[data.motos.length - 1].local : '';
        
        setData('motos', [
            ...data.motos, 
            { 
                modelo: '', chassi: '', cor: '', ano: '', motivo: '', 
                local: ultimoLocal 
            }
        ]);
    };

    const removeItem = (index) => {
        // Impede remover se só tiver 1 item (opcional, mas recomendado)
        if (data.motos.length === 1) {
            Swal.fire('Aviso', 'O pedido deve ter pelo menos uma moto.', 'warning');
            return;
        }
        
        const novasMotos = [...data.motos];
        novasMotos.splice(index, 1);
        setData('motos', novasMotos);
    };

    const updateItem = (index, field, value) => {
        const novasMotos = [...data.motos];
        novasMotos[index][field] = value;
        setData('motos', novasMotos);
    };

    // Função auxiliar para replicar o destino da 1ª moto para todas (Facilitador)
    const replicarDestino = () => {
        if (data.motos.length === 0) return;

        const primeiroLocal = data.motos[0].local;
        if (!primeiroLocal) {
            Swal.fire('Atenção', 'Selecione um destino na primeira linha antes de copiar.', 'warning');
            return;
        }
        
        const novasMotos = data.motos.map(item => ({ ...item, local: primeiroLocal }));
        setData('motos', novasMotos);
        
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
        Toast.fire({ icon: 'success', title: `Destino "${primeiroLocal}" copiado para todos!` });
    };

    // --- SUBMIT COM VALIDAÇÃO v2 ---
    const submit = (e) => {
        e.preventDefault();

        // 1. Validação de Origem (Se for transferência)
        // Certifique-se que a variável 'modo' está disponível no escopo (ex: const [modo, setModo] = useState('cd'))
        if (typeof modo !== 'undefined' && modo === 'transferencia' && !data.origem_id) {
            Swal.fire('Falta a Origem', 'Selecione de qual loja essas motos virão.', 'warning');
            return;
        }

        // 2. Validação de Motos (Frontend)
        const temErroMotos = data.motos.some(m => !m.modelo || !m.cor); // Exemplo simples
        if (temErroMotos) {
             Swal.fire('Dados Incompletos', 'Verifique se Modelo e Cor estão preenchidos em todas as linhas.', 'warning');
             return;
        }

        post(route('pedidos.store'), {
            onSuccess: () => {
                Swal.fire({
                    icon: 'success',
                    title: 'Solicitação Enviada!',
                    text: 'O pedido foi registrado e aguarda aprovação.',
                    timer: 2000,
                    showConfirmButton: false
                });
                reset(); // Limpa o formulário
                if (typeof setModo === 'function') setModo('cd'); 
                if (typeof setLogisticaInfo === 'function') setLogisticaInfo(null);
            },
            onError: (errors) => {
                // Pega a primeira mensagem de erro para exibir no alerta
                const primeiraMensagem = Object.values(errors)[0];
                Swal.fire({
                    icon: 'error',
                    title: 'Erro ao Salvar',
                    text: primeiraMensagem || 'Verifique os campos destacados em vermelho.',
                    confirmButtonColor: '#d33'
                });
            }
        });
    };

    return (
        <AuthenticatedLayout 
            user={auth.user} 
            header={<h2 className="font-bold text-2xl text-red-700">Nova Solicitação de Despacho</h2>}
        >
            <Head title="Nova Solicitação" />
            <div className="py-8 bg-gray-100 min-h-screen pb-32">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* MENSAGEM DE ERRO GERAL */}
                    {Object.keys(errors).length > 0 && (
                        <div className="mb-6 bg-red-50 border-l-4 border-red-600 p-4 rounded shadow animate-pulse flex items-center">
                            <span className="text-2xl mr-3">⚠️</span>
                            <div>
                                <h3 className="font-bold text-red-800">Atenção Necessária</h3>
                                <p className="text-sm text-red-700">Verifique os campos destacados abaixo.</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.type !== 'textarea') e.preventDefault(); }} className="space-y-6">
                        
                        {/* === BLOCO 1: INTEGRAÇÃO LOGÍSTICA (v2) === */}
                        <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg p-6 border-l-4 border-blue-600">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <span>📦</span> Origem da Carga
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                {/* Opção CD */}
                                <div 
                                    onClick={() => { setModo('cd'); setData('origem_id', ''); setLogisticaInfo(null); }}
                                    className={`cursor-pointer border-2 rounded-lg p-4 flex items-center gap-4 transition ${modo === 'cd' ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-gray-200 hover:border-blue-300'}`}
                                >
                                    <div className="text-3xl">🏭</div>
                                    <div>
                                        <div className="font-bold text-gray-800">Reposição CD</div>
                                        <div className="text-xs text-gray-500">Solicitar estoque direto da Fábrica/CD.</div>
                                    </div>
                                    {modo === 'cd' && <div className="ml-auto text-blue-600 font-bold">✓</div>}
                                </div>

                                {/* Opção Transferência */}
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

                            {/* Seletor de Loja (Aparece na Transferência) */}
                            {modo === 'transferencia' && (
                                <div className="animate-fadeIn">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Selecione a Loja Fornecedora</label>
                                    <select
                                        value={data.origem_id}
                                        onChange={handleFornecedorChange}
                                        className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-orange-500 focus:border-orange-500 font-bold text-gray-700"
                                    >
                                        <option value="">-- Escolha a loja que tem a moto --</option>
                                        {lojasDisponiveis.map(loja => (
                                            <option key={loja.id} value={loja.id}>
                                                {loja.filial ? `${loja.filial} (${loja.name})` : loja.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Card de Informação Logística */}
                        {carregandoLogistica && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-3 animate-pulse">
                                <span className="text-xl">⏳</span>
                                <span className="text-sm text-gray-500 font-bold">Calculando malha logística com o CD...</span>
                            </div>
                        )}

                        {!carregandoLogistica && logisticaInfo && !logisticaInfo.erro && (
                            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 flex flex-col md:flex-row items-start gap-4 animate-fade-in-up">
                                {/* Ícone do Caminhão */}
                                <div className="text-3xl bg-white p-2 rounded-full shadow-sm border border-green-100 flex-shrink-0">
                                    🚚
                                </div>
                                
                                <div className="flex-1 w-full">
                                    <h4 className="font-black text-green-900 text-xs uppercase tracking-wider mb-2 border-b border-green-200 pb-1">
                                        Logística Definida
                                    </h4>
                                    
                                    {/* 1. DADOS DA COLETA (Sempre Visível - Capital/CD tem coleta garantida) */}
                                    <div className="text-sm text-gray-700 mb-3">
                                        Coleta em <strong className="uppercase text-gray-900">{logisticaInfo.origem}</strong> via Rota <strong className="uppercase text-gray-900">{logisticaInfo.rota_origem}</strong>:
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className="text-xs uppercase font-bold text-gray-500">🗓️ Previsão Coleta:</span>
                                            <span className="font-bold bg-white px-2 py-0.5 rounded border border-green-200 text-green-800">
                                                {logisticaInfo.data_coleta?.split('-').reverse().join('/')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 2. DADOS DA ENTREGA (Condicional: Só aparece se houver rota agendada) */}
                                    {logisticaInfo.data_entrega ? (
                                        // CENÁRIO A: Rota Encontrada (Data Prevista existe)
                                        <div className="pt-2 border-t border-green-200">
                                            <div className="flex items-center gap-2 text-xs font-bold text-green-800 bg-green-100 px-3 py-2 rounded-lg border border-green-200 w-full md:w-fit shadow-sm">
                                                <span>📍 Entrega Prevista na sua Loja:</span>
                                                <span className="text-sm bg-white px-1.5 rounded text-green-900">
                                                    {logisticaInfo.data_entrega.split('-').reverse().join('/')}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        // CENÁRIO B: Interior sem rota na semana (Hub & Spoke / Milk Run)
                                        <div className="pt-2 border-t border-green-200">
                                            <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-orange-700 bg-orange-50 px-3 py-2 rounded-lg border border-orange-200 w-full md:w-fit">
                                                <span>⚠️ Sem rota direta agendada:</span>
                                                <span className="font-normal text-orange-600">Aguardando definição logística via CD (Transbordo).</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                            {logisticaInfo && logisticaInfo.erro && (
                                <div className="mt-4 bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm flex items-center gap-2">
                                    <span>⚠️</span> {logisticaInfo.erro}
                                </div>
                            )}
                        </div>

                        {/* === BLOCO 2: DADOS DAS MOTOS (Mantido e Otimizado) === */}
                        <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg p-6 border-t-4 border-red-600">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-gray-800">Itens do Pedido</h3>
                                <p className="text-sm text-gray-500">Adicione as motos que deseja solicitar.</p>
                            </div>

                            <datalist id="opcoes-modelos">
                                {listaModelos.map((nome, index) => ( <option key={index} value={nome} /> ))}
                            </datalist>

                            {/* Cabeçalho */}
                            <div className="hidden md:grid grid-cols-12 gap-3 mb-2 font-bold text-xs uppercase text-gray-500 px-2 items-end">
                                <div className="col-span-1 text-center">#</div>
                                <div className="col-span-3">Modelo *</div>
                                <div className="col-span-2">Chassi (11-17)</div>
                                <div className="col-span-2">Destino Final *</div>
                                <div className="col-span-1">Cor *</div>
                                <div className="col-span-2">Motivo *</div>
                                <div className="col-span-1"></div>
                            </div>

                            <div className="space-y-3">
                                {data.itens.map((item, index) => (
                                    <div key={index} className={`grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-gray-50 p-4 rounded-lg border shadow-sm transition-all relative ${errors[`itens.${index}.motivo`] || errors[`itens.${index}.local`] ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                                        
                                        {/* Index */}
                                        <div className="col-span-1 text-center font-bold text-gray-400 hidden md:block">{index + 1}</div>
                                        <div className="md:hidden absolute top-2 right-2 text-xs font-bold text-gray-300">#{index + 1}</div>

                                        {/* Inputs */}
                                        <div className="col-span-3">
                                            <label className="md:hidden text-xs font-bold text-gray-500 uppercase">Modelo</label>
                                            <input 
                                                type="text" list="opcoes-modelos" placeholder="MODELO..."
                                                value={item.modelo}
                                                onChange={(e) => updateItem(index, 'modelo', e.target.value.toUpperCase())}
                                                className="w-full border-gray-300 rounded uppercase font-bold text-sm focus:ring-red-500 focus:border-red-500"
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className="md:hidden text-xs font-bold text-gray-500 uppercase">Chassi</label>
                                            <input 
                                                type="text" placeholder="CHASSI" maxLength={17}
                                                value={item.chassi}
                                                onChange={(e) => updateItem(index, 'chassi', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                                className={`w-full rounded font-mono tracking-widest text-sm ${item.chassi.length >= 11 ? 'border-green-400 bg-green-50' : 'border-gray-300'}`}
                                            />
                                        </div>

                                        <div className="col-span-2 relative">
                                            <label className="md:hidden text-xs font-bold text-gray-500 uppercase">Destino</label>
                                            <select 
                                                value={item.local}
                                                onChange={(e) => updateItem(index, 'local', e.target.value)}
                                                className={`w-full rounded text-sm bg-yellow-50 focus:bg-white ${errors[`itens.${index}.local`] ? 'border-red-500' : 'border-gray-300'}`}
                                            >
                                                <option value="" disabled>Selecione...</option>
                                                {locaisEntrega.map(local => <option key={local} value={local}>{local}</option>)}
                                            </select>
                                            {/* Botão Copiar (v2) */}
                                            {index === 0 && data.itens.length > 1 && (
                                                <button type="button" onClick={replicarDestino} className="absolute -top-5 right-0 text-[10px] text-blue-600 hover:underline font-bold hidden md:block">
                                                    Copiar p/ todos ⬇️
                                                </button>
                                            )}
                                        </div>

                                        <div className="col-span-1">
                                            <label className="md:hidden text-xs font-bold text-gray-500 uppercase">Cor</label>
                                            <input 
                                                type="text" placeholder="COR"
                                                value={item.cor}
                                                onChange={(e) => updateItem(index, 'cor', e.target.value.toUpperCase())}
                                                className="w-full border-gray-300 rounded uppercase text-sm"
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className="md:hidden text-xs font-bold text-gray-500 uppercase">Motivo</label>
                                            <select 
                                                value={item.motivo} onChange={(e) => updateItem(index, 'motivo', e.target.value)}
                                                className={`w-full rounded text-sm ${errors[`itens.${index}.motivo`] ? 'border-red-500' : 'border-gray-300'}`}
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

                        {/* --- BARRA FLUTUANTE --- */}
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