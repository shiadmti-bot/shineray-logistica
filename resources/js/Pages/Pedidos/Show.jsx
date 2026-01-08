import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import Swal from 'sweetalert2'; // <--- IMPORTANTE

export default function PedidoShow({ auth, pedido }) {
    // Configuração dos formulários
    const formUpload = useForm({ arquivo: null });
    const formRejeicao = useForm({ motivo: '' });
    const formAcoes = useForm({}); 

    // --- FUNÇÕES DE AÇÃO COM SWEETALERT ---

    // 1. Finalizar (Upload do Romaneio)
    const submitUpload = (e) => { 
        e.preventDefault();
        
        // Verifica se selecionou o arquivo antes de perguntar
        if (!formUpload.data.arquivo) {
            Swal.fire('Atenção', 'Por favor, selecione o arquivo ou tire a foto do romaneio.', 'warning');
            return;
        }

        Swal.fire({
            title: 'Confirmar entrega?',
            text: "O pedido será finalizado e o arquivo enviado para o Google Drive.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#16a34a',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sim, finalizar!'
        }).then((result) => {
            if (result.isConfirmed) {
                // Mostra loading enquanto envia
                Swal.fire({ title: 'Enviando...', text: 'Aguarde o upload para o Drive', didOpen: () => Swal.showLoading() });

                formUpload.post(route('pedidos.finalizar', pedido.id), {
                    forceFormData: true, // <--- OBRIGATÓRIO PARA ARQUIVOS
                    onSuccess: () => {
                        Swal.fire('Sucesso!', 'Pedido finalizado com sucesso.', 'success');
                    },
                    onError: (errors) => {
                        console.error(errors);
                        // Fecha o loading
                        Swal.close();
                        
                        // Pega a mensagem de erro (do Laravel ou Genérica)
                        let msg = 'Ocorreu um erro desconhecido.';
                        if (errors.arquivo_romaneio) msg = errors.arquivo_romaneio;
                        if (errors.erro_upload) msg = errors.erro_upload; // Nossa mensagem customizada do Controller
                        
                        Swal.fire('Erro no Envio', msg, 'error');
                    },
                    onFinish: () => formUpload.reset('arquivo'),
                });
            }
        });
    };

    // 2. Avançar para Separação
    const avancarSeparacao = () => { 
        Swal.fire({
            title: 'Confirmar Separação?',
            text: "As motos foram conferidas fisicamente?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, confirmar!'
        }).then((res) => {
            if(res.isConfirmed) formAcoes.post(route('pedidos.separar', pedido.id));
        });
    };

    // 3. Confirmar Saída
    const avancarSaida = () => { 
        Swal.fire({
            title: 'Liberar para Trânsito?',
            text: "O motorista já está com a nota e carregado?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, liberar!'
        }).then((res) => {
            if(res.isConfirmed) formAcoes.post(route('pedidos.saida', pedido.id));
        });
    };

    // 4. Rejeitar Pedido
    const handleRejeitar = () => {
        Swal.fire({
            title: 'Rejeitar Pedido',
            input: 'text',
            inputLabel: 'Motivo da rejeição',
            inputPlaceholder: 'Ex: Falta de estoque...',
            showCancelButton: true,
            confirmButtonText: 'Rejeitar',
            confirmButtonColor: '#d33',
            inputValidator: (value) => {
                if (!value) return 'Você precisa escrever um motivo!'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                formRejeicao.setData('motivo', result.value);
                // Usa uma função auxiliar para garantir que o estado atualizou antes de enviar
                router.post(route('pedidos.rejeitar', pedido.id), { motivo: result.value });
            }
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-red-700">Acompanhamento #{pedido.id}</h2>}>
            <Head title={`Pedido #${pedido.id}`} />

            <div className="py-12 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
                    
                    {/* CABEÇALHO */}
                    <div className="bg-white p-6 shadow-sm sm:rounded-lg border-l-4 border-gray-800 flex justify-between flex-wrap gap-4">
                        <div>
                            <h3 className="font-bold text-gray-700 text-lg">{pedido.user.name}</h3>
                            <p className="text-gray-500 text-sm">Filial: {pedido.user.filial || 'Matriz'}</p>
                            <p className="text-gray-400 text-xs mt-1">Data: {new Date(pedido.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-bold text-gray-400 uppercase block mb-1">Status Atual</span>
                            <BadgeStatus status={pedido.status} />
                            
                            {pedido.romaneio_id && (
                                <div className="mt-2 text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded border border-indigo-200">
                                    Carga/Romaneio #{String(pedido.romaneio_id).padStart(6, '0')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ALERTA DE CANCELAMENTO */}
                    {pedido.status === 'cancelado' && (
                        <div className="bg-red-100 border-l-4 border-red-600 p-4 shadow-sm">
                            <h3 className="font-bold text-red-800">🚫 PEDIDO CANCELADO</h3>
                            <p className="text-red-700 mt-1">{pedido.motivo_rejeicao}</p>
                        </div>
                    )}

                    {/* BOTÃO CANCELAR SOLICITAÇÃO (LOJA) */}
                    {auth.user.perfil === 'loja' && pedido.status === 'solicitado' && (
                        <div className="mx-2 md:mx-0 mt-6 bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-yellow-100 rounded-full text-yellow-600">⚠️</div>
                                <div>
                                    <h4 className="font-bold text-yellow-800 text-sm">Precisa corrigir ou desistir?</h4>
                                    <p className="text-xs text-yellow-700">Enquanto o pedido não for separado pelo CD, você pode cancelá-lo aqui.</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    Swal.fire({
                                        title: 'Cancelar Solicitação?',
                                        text: "Isso liberará o chassi imediatamente.",
                                        icon: 'warning',
                                        showCancelButton: true,
                                        confirmButtonColor: '#d33',
                                        confirmButtonText: 'Sim, cancelar'
                                    }).then((res) => {
                                        if(res.isConfirmed) router.post(route('pedidos.cancelarProprio', pedido.id));
                                    })
                                }}
                                className="whitespace-nowrap text-red-700 font-bold border border-red-200 bg-white px-4 py-2 rounded hover:bg-red-50 hover:border-red-300 text-sm shadow-sm transition flex items-center gap-2"
                            >
                                🗑️ Cancelar Solicitação
                            </button>
                        </div>
                    )}

                    {/* TIMELINE */}
                    <div className="px-2 md:px-8">
                        <Timeline status={pedido.status} />
                    </div>
                    
                    {/* LISTA DE MOTOS */}
                    <div className="bg-white p-6 shadow-sm sm:rounded-lg">
                        <h3 className="font-bold mb-4 border-b pb-2 flex items-center gap-2">
                            <span>📦 Itens Solicitados</span>
                            <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full text-gray-600">{pedido.motos.length}</span>
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Modelo</th>
                                        <th className="px-4 py-2 text-left">Chassi (11 Dígitos)</th>
                                        <th className="px-4 py-2 text-left">Carga/Romaneio</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pedido.motos.map((moto) => (
                                        <tr key={moto.id} className="border-b hover:bg-gray-50">
                                            <td className="px-4 py-3 font-bold text-sm">{moto.modelo}</td>
                                            <td className="px-4 py-3 font-mono text-gray-600 text-sm">{moto.chassi}</td>
                                            <td className="px-4 py-3 text-sm">
                                                {moto.romaneio_id ? (
                                                    <span className="text-indigo-600 font-bold text-xs">Carga #{String(moto.romaneio_id).padStart(6,'0')}</span>
                                                ) : <span className="text-gray-400 text-xs">-</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* --- ZONA DE AÇÃO DO CD --- */}
                    {auth.user.perfil === 'cd' && pedido.status !== 'cancelado' && (
                        <div className="bg-white p-6 shadow-sm sm:rounded-lg border-t-4 border-blue-600">
                            <h3 className="font-bold text-lg mb-4 text-gray-800">⚙️ Painel de Operações</h3>
                            
                            {/* 1. SEPARAR */}
                            {pedido.status === 'solicitado' && (
                                <div className="flex flex-col md:flex-row gap-4">
                                    <button onClick={avancarSeparacao} className="bg-blue-600 text-white px-6 py-3 rounded font-bold hover:bg-blue-700 shadow flex-1">
                                        ✅ Confirmar Separação
                                    </button>
                                    <button onClick={handleRejeitar} className="border border-red-500 text-red-600 px-6 py-3 rounded font-bold hover:bg-red-50">
                                        Rejeitar
                                    </button>
                                </div>
                            )}

                            {/* 2. EXPEDIR */}
                            {pedido.status === 'separado' && (
                                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div>
                                        <p className="font-bold text-indigo-900">Motos separadas no pátio.</p>
                                        <p className="text-sm text-indigo-700">Vá para "Nova Carga" para gerar o transporte.</p>
                                    </div>
                                    <Link href={route('romaneios.create')} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-indigo-700">
                                        Ir para Montagem de Carga &rarr;
                                    </Link>
                                </div>
                            )}

                            {/* 3. SAÍDA */}
                            {pedido.status === 'expedido' && (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-indigo-700">Carga montada!</p>
                                        <p className="text-sm text-gray-500">Veículo aguardando liberação.</p>
                                    </div>
                                    <button onClick={avancarSaida} className="bg-orange-500 text-white px-6 py-3 rounded font-bold hover:bg-orange-600 shadow">
                                        🚛 Confirmar Saída
                                    </button>
                                </div>
                            )}

                            {/* 4. BAIXA / FINALIZAR */}
                            {pedido.status === 'em_transito' && (
                                <div>
                                    <p className="text-sm text-gray-500 mb-2 font-bold">Anexar Comprovante de Entrega:</p>
                                    <form onSubmit={submitUpload} className="flex flex-col md:flex-row gap-4 items-center bg-green-50 p-4 rounded border border-green-200">
                                        <input 
                                            type="file" 
                                            onChange={e => formUpload.setData('arquivo', e.target.files[0])} 
                                            className="text-sm w-full bg-white p-2 rounded border" 
                                            accept="image/*,application/pdf" 
                                            required 
                                        />
                                        <button disabled={formUpload.processing} className="w-full md:w-auto bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 shadow disabled:opacity-50">
                                            {formUpload.processing ? 'Enviando...' : 'Finalizar Entrega'}
                                        </button>
                                    </form>
                                    {formUpload.progress && (
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                                            <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${formUpload.progress.percentage}%` }}></div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {pedido.status === 'concluido' && (
                                <div className="text-center">
                                    <p className="text-green-600 font-bold bg-green-100 p-3 rounded inline-block">Processo Finalizado com Sucesso 🎉</p>
                                    {pedido.comprovante_url && (
                                        <div className="mt-2">
                                            <a href={pedido.comprovante_url} target="_blank" className="text-blue-600 underline text-sm">Ver Comprovante</a>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* LOGS */}
                    <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg border-t border-gray-200">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                            <h3 className="font-bold text-gray-700">📜 Histórico de Eventos</h3>
                        </div>
                        <ul className="divide-y divide-gray-100">
                            {pedido.logs?.map((log) => (
                                <li key={log.id} className="p-4 hover:bg-gray-50 flex gap-4 items-start">
                                    <div className="w-2 h-2 mt-1 bg-blue-400 rounded-full ring-4 ring-blue-50"></div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-800">{log.titulo}</p>
                                        <p className="text-xs text-gray-500">{log.descricao}</p>
                                    </div>
                                    <div className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleString('pt-BR')}</div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// Subcomponentes (mantidos)
function BadgeStatus({ status }) {
    const config = {
        solicitado:  { label: 'Solicitado',  bg: 'bg-yellow-100 text-yellow-800' },
        separado:    { label: 'Separado',    bg: 'bg-blue-100 text-blue-800' },
        expedido:    { label: 'Expedido',    bg: 'bg-indigo-100 text-indigo-800' },
        em_transito: { label: 'Em Trânsito', bg: 'bg-orange-100 text-orange-800' },
        concluido:   { label: 'Concluído',   bg: 'bg-green-100 text-green-800' },
        cancelado:   { label: 'Cancelado',   bg: 'bg-red-100 text-red-800' },
    }[status] || { label: status, bg: 'bg-gray-100' };
    return <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.bg}`}>{config.label}</span>;
}

function Timeline({ status }) {
    const steps = [
        { id: 'solicitado',  label: 'Solicitado',  icon: '📝' },
        { id: 'separado',    label: 'Separado',    icon: '📦' },
        { id: 'expedido',    label: 'Expedido',    icon: '📄' },
        { id: 'em_transito', label: 'Em Trânsito', icon: '🚚' },
        { id: 'concluido',   label: 'Concluído',   icon: '🏁' },
    ];
    const map = { solicitado: 0, separado: 1, expedido: 2, em_transito: 3, concluido: 4, cancelado: -1 };
    const current = map[status] ?? 0;

    return (
        <div className="w-full py-6 mb-2">
            <div className="flex items-center justify-between relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 -z-10 rounded"></div>
                {status !== 'cancelado' && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-green-500 -z-10 rounded transition-all duration-700 ease-out" style={{ width: `${(current / (steps.length - 1)) * 100}%` }}></div>
                )}
                {steps.map((step, index) => {
                    const done = status !== 'cancelado' && index <= current;
                    return (
                        <div key={step.id} className="flex flex-col items-center relative bg-white px-1">
                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-lg md:text-xl border-4 bg-white shadow-sm z-10 ${done ? 'border-green-500 text-green-600 scale-110' : 'border-gray-300 text-gray-300'}`}>
                                {done ? step.icon : index + 1}
                            </div>
                            <span className={`mt-3 text-[10px] md:text-xs font-bold uppercase ${done ? 'text-green-700' : 'text-gray-400'}`}>{step.label}</span>
                        </div>
                    );
                })}
            </div>
            {status === 'cancelado' && <div className="mt-4 text-center text-red-600 font-bold bg-red-50 p-2 rounded">PROCESSO CANCELADO</div>}
        </div>
    );
}