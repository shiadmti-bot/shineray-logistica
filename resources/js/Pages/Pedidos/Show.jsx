import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import Swal from 'sweetalert2';

export default function PedidoShow({ auth, pedido }) {
    // 1. CORREÇÃO AQUI: Mudamos de 'arquivo' para 'arquivo_romaneio'
    const formUpload = useForm({ arquivo_romaneio: null });
    
    const formRejeicao = useForm({ motivo: '' });
    const formAcoes = useForm({}); 

    const submitUpload = (e) => { 
        e.preventDefault();
        
        // 2. CORREÇÃO AQUI: Verifica o campo com o nome certo
        if (!formUpload.data.arquivo_romaneio) {
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
                Swal.fire({ title: 'Enviando...', text: 'Aguarde o upload para o Drive', didOpen: () => Swal.showLoading() });

                formUpload.post(route('pedidos.finalizar', pedido.id), {
                    forceFormData: true,
                    onSuccess: () => {
                        Swal.fire('Sucesso!', 'Pedido finalizado com sucesso.', 'success');
                    },
                    onError: (errors) => {
                        console.error(errors);
                        Swal.close();
                        
                        let msg = 'Ocorreu um erro desconhecido.';
                        if (errors.arquivo_romaneio) msg = errors.arquivo_romaneio;
                        if (errors.erro_upload) msg = errors.erro_upload;
                        
                        Swal.fire('Erro no Envio', msg, 'error');
                    },
                    // 3. CORREÇÃO AQUI: Reseta o campo com o nome certo
                    onFinish: () => formUpload.reset('arquivo_romaneio'),
                });
            }
        });
    };

    // ... (Mantenha as funções avancarSeparacao, avancarSaida, handleRejeitar iguais) ...
    const avancarSeparacao = () => { /* ... */ };
    const avancarSaida = () => { /* ... */ };
    const handleRejeitar = () => { /* ... */ };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-red-700">Acompanhamento #{pedido.id}</h2>}>
            <Head title={`Pedido #${pedido.id}`} />

            <div className="py-12 bg-gray-100 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
                    
                    {/* ... (Todo o cabeçalho, timeline e tabela de motos continua IGUAL) ... */}

                    {/* --- ZONA DE AÇÃO DO CD (FINAL DO ARQUIVO) --- */}
                    {auth.user.perfil === 'cd' && pedido.status !== 'cancelado' && (
                        <div className="bg-white p-6 shadow-sm sm:rounded-lg border-t-4 border-blue-600">
                            
                            {/* ... (Botões de Separar, Expedir, Saída continuam IGUAIS) ... */}

                            {/* 4. BAIXA / FINALIZAR (AQUI ESTÁ A MUDANÇA NO INPUT) */}
                            {pedido.status === 'em_transito' && (
                                <div>
                                    <p className="text-sm text-gray-500 mb-2 font-bold">Anexar Comprovante de Entrega:</p>
                                    <form onSubmit={submitUpload} className="flex flex-col md:flex-row gap-4 items-center bg-green-50 p-4 rounded border border-green-200">
                                        
                                        {/* CORREÇÃO AQUI: Mudamos o setData para 'arquivo_romaneio' */}
                                        <input 
                                            type="file" 
                                            onChange={e => formUpload.setData('arquivo_romaneio', e.target.files[0])} 
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
                                </div>
                            )}
                        </div>
                    )}
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