import ChatBox from '@/Components/ChatBox';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import imageCompression from 'browser-image-compression';

export default function PedidoShow({ auth, pedido }) {
    // 1. Configuração dos formulários
    const formUpload = useForm({ arquivo_romaneio: null, avarias: {} }); // Adicionado 'avarias'
    const [compressing, setCompressing] = useState(false);
    const formRejeicao = useForm({ motivo: '' });
    const formAcoes = useForm({}); 

    // --- 2. ATUALIZAÇÃO EM TEMPO REAL (Ouvindo o CD/Gestor) ---
    useEffect(() => {
        // Ouve o canal privado do usuário logado
        const channel = window.Echo.private(`App.Models.User.${auth.user.id}`);

        channel.notification((notification) => {
            if (notification.link && notification.link.includes(`/pedidos/${pedido.id}`)) {
                // 1. Som de Alerta
                const audio = new Audio('/plim.mp3');
                audio.play().catch(() => {});

                // 2. Toast Flutuante
                const Toast = Swal.mixin({
                    toast: true, 
                    position: 'top-end', 
                    showConfirmButton: false, 
                    timer: 5000, 
                    timerProgressBar: true
                });
                
                Toast.fire({ 
                    icon: 'info', 
                    title: 'Atualização do Pedido', 
                    text: notification.mensagem 
                });

                // 3. Recarrega os dados silenciosamente
                router.reload({ only: ['pedido'] });
            }
        });

        return () => channel.stopListening('Notification');
    }, [pedido.id, auth.user.id]);

    // --- 3. FUNÇÕES DE AÇÃO ---

    // A. LÓGICA DE CONFERÊNCIA E UPLOAD (ATUALIZADA)
    const handleConferenciaEntrega = () => {
        Swal.fire({
            title: 'Conferência de Entrega 🚛',
            html: `
                <div class="text-left text-sm">
                    <p class="mb-2 text-gray-600">1. Verifique cada moto fisicamente.</p>
                    <p class="mb-4 text-gray-600">2. Se houver avaria, descreva abaixo. Se deixar em branco, será considerado <strong>Perfeito Estado</strong>.</p>
                    
                    <div class="max-h-60 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50 mb-4">
                        ${pedido.motos.map(m => `
                            <div class="mb-3 border-b border-gray-200 pb-2 last:border-0">
                                <div class="font-bold text-gray-800 text-xs">${m.modelo} <span class="font-mono text-gray-500">(${m.chassi})</span></div>
                                <input 
                                    type="text" 
                                    id="avaria-${m.id}" 
                                    class="swal2-input mt-1 w-full text-xs h-8" 
                                    style="margin: 5px 0;"
                                    placeholder="Digite aqui se houver defeito (risco, quebrado...)"
                                >
                            </div>
                        `).join('')}
                    </div>
                    
                    <div>
                        <label class="block font-bold text-gray-700 mb-1 text-xs uppercase">📸 Foto do Romaneio Assinado *</label>
                        <input type="file" id="upload-comprovante" class="w-full text-xs border rounded p-2 bg-white" accept="image/*,application/pdf">
                    </div>
                </div>
            `,
            width: '600px',
            showCancelButton: true,
            confirmButtonText: 'Confirmar Recebimento',
            confirmButtonColor: '#16a34a',
            focusConfirm: false,
            preConfirm: async () => {
                const fileInput = document.getElementById('upload-comprovante');
                if (!fileInput.files[0]) {
                    Swal.showValidationMessage('O comprovante assinado é obrigatório!');
                    return false;
                }

                // Coleta as avarias
                const avariasColetadas = {};
                pedido.motos.forEach(m => {
                    const input = document.getElementById(`avaria-${m.id}`);
                    if (input && input.value.trim()) {
                        avariasColetadas[m.id] = input.value.trim();
                    }
                });

                // Retorna os dados para processamento
                return { file: fileInput.files[0], avarias: avariasColetadas };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const { file, avarias } = result.value;
                await processarEnvio(file, avarias);
            }
        });
    };

    // B. PROCESSAMENTO DO ARQUIVO (COMPRESSÃO + ENVIO)
    const processarEnvio = async (file, avarias) => {
        setCompressing(true);
        
        // Feedback de carregamento
        Swal.fire({
            title: 'Processando...',
            text: 'Comprimindo imagem e enviando para o Drive.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        let fileToSend = file;

        // Compressão se for imagem
        if (file.type.startsWith('image/')) {
            try {
                const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true, fileType: 'image/jpeg' };
                const compressed = await imageCompression(file, options);
                fileToSend = new File([compressed], file.name, { type: compressed.type });
            } catch (e) {
                console.error("Erro compressão", e);
            }
        }

        // Prepara dados para o Inertia
        // Usamos o router.post manual aqui para ter controle total do FormData
        router.post(route('pedidos.finalizar', pedido.id), {
            _method: 'post',
            arquivo_romaneio: fileToSend,
            avarias: avarias
        }, {
            forceFormData: true,
            onSuccess: () => {
                setCompressing(false);
                Swal.fire('Sucesso!', 'Recebimento confirmado e estoque atualizado.', 'success');
            },
            onError: (errors) => {
                setCompressing(false);
                console.error(errors);
                Swal.fire('Erro', errors.erro_upload || 'Falha no envio.', 'error');
            }
        });
    };

    // C. OPERAÇÕES DO CD
    const avancarSeparacao = () => { 
        Swal.fire({
            title: 'Confirmar Separação?',
            text: "As motos foram conferidas fisicamente no pátio?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, confirmar!',
            confirmButtonColor: '#2563eb'
        }).then((res) => {
            if(res.isConfirmed) formAcoes.post(route('pedidos.separar', pedido.id));
        });
    };

    const avancarSaida = () => { 
        Swal.fire({
            title: 'Liberar para Trânsito?',
            text: "O motorista já está com a nota e o veículo carregado?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, liberar!',
            confirmButtonColor: '#f97316'
        }).then((res) => {
            if(res.isConfirmed) formAcoes.post(route('pedidos.saida', pedido.id));
        });
    };

    const handleRejeitar = () => {
        Swal.fire({
            title: 'Rejeitar Pedido',
            input: 'text',
            inputLabel: 'Motivo da rejeição',
            showCancelButton: true,
            confirmButtonText: 'Rejeitar',
            confirmButtonColor: '#d33',
            inputValidator: (value) => { if (!value) return 'Escreva o motivo!'; }
        }).then((result) => {
            if (result.isConfirmed) {
                formRejeicao.setData('motivo', result.value);
                router.post(route('pedidos.rejeitar', pedido.id), { motivo: result.value });
            }
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-red-700">Acompanhamento #{pedido.id}</h2>}>
            <Head title={`Pedido #${pedido.id}`} />

            <div className="py-12 bg-gray-100 min-h-screen pb-32">
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
                                <div className="mt-2 text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded border border-indigo-200 animate-pulse">
                                    Carga/Romaneio #{String(pedido.romaneio_id).padStart(6, '0')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ALERTA CANCELADO */}
                    {pedido.status === 'cancelado' && (
                        <div className="bg-red-100 border-l-4 border-red-600 p-4 shadow-sm animate-pulse">
                            <h3 className="font-bold text-red-800">🚫 PEDIDO CANCELADO</h3>
                            <p className="text-red-700 mt-1">{pedido.motivo_rejeicao}</p>
                        </div>
                    )}

                    {/* ALERTA EM ANÁLISE (LOJA) */}
                    {pedido.status === 'em_analise' && auth.user.perfil === 'loja' && (
                        <div className="bg-purple-50 border-l-4 border-purple-500 p-4 shadow-sm flex items-center gap-3">
                            <div className="text-2xl">🛡️</div>
                            <div>
                                <h3 className="font-bold text-purple-800">Em Análise Comercial</h3>
                                <p className="text-purple-700 text-sm">Seu pedido está sendo conferido pelo Gestor. Você será notificado assim que for aprovado.</p>
                            </div>
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
                                        <th className="px-4 py-2 text-left">Chassi</th>
                                        <th className="px-4 py-2 text-left">Status Item</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pedido.motos.map((moto) => (
                                        <tr key={moto.id} className="border-b hover:bg-gray-50">
                                            <td className="px-4 py-3 font-bold text-sm">{moto.modelo}</td>
                                            <td className="px-4 py-3 font-mono text-gray-600 text-sm tracking-wide">{moto.chassi}</td>
                                            <td className="px-4 py-3 text-sm">
                                                {/* Exibe se está avariado ou normal */}
                                                {moto.status === 'avariado' ? (
                                                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded border border-red-200">⚠️ Avariado</span>
                                                ) : (
                                                    moto.romaneio_id ? <span className="text-indigo-600 font-bold text-xs bg-indigo-50 px-2 py-1 rounded">Em Carga #{moto.romaneio_id}</span> : <span className="text-gray-400 text-xs">-</span>
                                                )}
                                                
                                                {/* Detalhe da avaria se houver */}
                                                {moto.detalhes_avaria && (
                                                    <div className="text-[10px] text-red-600 mt-1 italic">Obs: {moto.detalhes_avaria}</div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* --- PAINEL DE OPERAÇÕES DO CD --- */}
                    {auth.user.perfil === 'cd' && pedido.status !== 'cancelado' && (
                        <div className="bg-white p-6 shadow-sm sm:rounded-lg border-t-4 border-blue-600">
                            <h3 className="font-bold text-lg mb-4 text-gray-800">⚙️ Painel de Operações (CD)</h3>
                            
                            {pedido.status === 'em_analise' && (
                                <div className="text-center p-4 bg-gray-100 rounded text-gray-500 italic">
                                    Aguardando aprovação do Gestor Comercial.
                                </div>
                            )}

                            {pedido.status === 'solicitado' && (
                                <div className="flex gap-4">
                                    <button onClick={avancarSeparacao} className="bg-blue-600 text-white px-6 py-3 rounded font-bold hover:bg-blue-700 shadow flex-1">
                                        ✅ Confirmar Separação
                                    </button>
                                    <button onClick={handleRejeitar} className="border border-red-500 text-red-600 px-6 py-3 rounded font-bold hover:bg-red-50">
                                        Rejeitar
                                    </button>
                                </div>
                            )}

                            {pedido.status === 'separado' && (
                                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg flex justify-between items-center gap-4">
                                    <div>
                                        <p className="font-bold text-indigo-900">Motos separadas no pátio.</p>
                                        <p className="text-sm text-indigo-700">Vá para "Nova Carga" para gerar o transporte.</p>
                                    </div>
                                    <Link href={route('romaneios.create')} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-indigo-700">
                                        Ir para Montagem de Carga &rarr;
                                    </Link>
                                </div>
                            )}

                            {pedido.status === 'expedido' && (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-indigo-700">Carga montada!</p>
                                        <p className="text-sm text-gray-500">Veículo aguardando liberação na portaria.</p>
                                    </div>
                                    <button onClick={avancarSaida} className="bg-orange-500 text-white px-6 py-3 rounded font-bold hover:bg-orange-600 shadow">
                                        🚛 Confirmar Saída
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* MENSAGEM DE SUCESSO (FINALIZADO) */}
                    {pedido.status === 'concluido' && (
                        <div className="text-center mt-6">
                            <div className="bg-green-100 p-6 rounded-lg border border-green-200 inline-block shadow-sm">
                                <h3 className="text-green-800 font-bold text-xl mb-2">Pedido Concluído! 🎉</h3>
                                <p className="text-green-700 text-sm">A entrega foi registrada e o estoque atualizado.</p>
                                {pedido.comprovante_url && (
                                    <div className="mt-4">
                                        <a href={pedido.comprovante_url} target="_blank" className="bg-white text-green-700 px-4 py-2 rounded border border-green-300 font-bold hover:bg-green-50">
                                            📄 Ver Comprovante
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* LOGS */}
                    <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg border-t border-gray-200 mt-6">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                            <h3 className="font-bold text-gray-700">📜 Histórico de Eventos</h3>
                        </div>
                        <ul className="divide-y divide-gray-100">
                            {pedido.logs?.map((log) => (
                                <li key={log.id} className="p-4 hover:bg-gray-50 flex gap-4 items-start">
                                    <div className="w-2 h-2 mt-1 bg-blue-400 rounded-full ring-4 ring-blue-50"></div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-800">{log.titulo}</p>
                                        <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap leading-relaxed bg-gray-50 p-2 rounded border border-gray-100">
                                            {log.descricao}
                                        </p>
                                    </div>
                                    <div className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleString('pt-BR')}</div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* BOTÃO FLUTUANTE DE FINALIZAÇÃO (LOJA OU CD QUANDO EM TRÂNSITO) */}
            {pedido.status === 'em_transito' && (auth.user.perfil === 'cd' || auth.user.id === pedido.user_id) && (
                <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40">
                    <div className="max-w-4xl mx-auto flex gap-4">
                        <button 
                            onClick={handleConferenciaEntrega}
                            disabled={compressing}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-lg py-3 px-8 rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                        >
                            <span>📝</span> CONFERIR E FINALIZAR ENTREGA
                        </button>
                    </div>
                </div>
            )}

            {/* CHAT */}
            {pedido.status !== 'cancelado' && <ChatBox pedidoId={pedido.id} />}
            
        </AuthenticatedLayout>
    );
}

// --- HELPERS VISUAIS ---

function BadgeStatus({ status }) {
    const config = {
        'em_analise': { label: 'Em Análise', bg: 'bg-purple-100 text-purple-800 border-purple-200' },
        'solicitado': { label: 'Aguardando CD', bg: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
        'separado':   { label: 'Separado', bg: 'bg-blue-100 text-blue-800 border-blue-200' },
        'expedido':   { label: 'Em Carga', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
        'em_transito':{ label: 'Em Trânsito', bg: 'bg-orange-100 text-orange-800 border-orange-200' },
        'concluido':  { label: 'Concluído', bg: 'bg-green-100 text-green-800 border-green-200' },
        'cancelado':  { label: 'Cancelado', bg: 'bg-red-100 text-red-800 border-red-200' },
    }[status] || { label: status, bg: 'bg-gray-100 text-gray-600' };

    return <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.bg} border`}>{config.label}</span>;
}

function Timeline({ status }) {
    const steps = [
        { id: 'em_analise', label: 'Análise', icon: '🛡️' },
        { id: 'solicitado', label: 'Solicitado', icon: '📝' },
        { id: 'separado', label: 'Separado', icon: '📦' },
        { id: 'expedido', label: 'Expedido', icon: '📄' },
        { id: 'em_transito', label: 'Em Trânsito', icon: '🚚' },
        { id: 'concluido', label: 'Concluído', icon: '🏁' },
    ];
    
    const map = { em_analise: 0, solicitado: 1, separado: 2, expedido: 3, em_transito: 4, concluido: 5, cancelado: -1 };
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
                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm md:text-xl border-4 bg-white shadow-sm z-10 transition-all ${done ? 'border-green-500 text-green-600 scale-110' : 'border-gray-300 text-gray-300'}`}>
                                {done ? step.icon : index + 1}
                            </div>
                            <span className={`mt-2 text-[8px] md:text-xs font-bold uppercase ${done ? 'text-green-700' : 'text-gray-400'}`}>{step.label}</span>
                        </div>
                    );
                })}
            </div>
            {status === 'cancelado' && <div className="mt-4 text-center text-red-600 font-bold bg-red-50 p-2 rounded animate-pulse">PROCESSO CANCELADO</div>}
        </div>
    );
}