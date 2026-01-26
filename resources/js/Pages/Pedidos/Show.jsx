import ChatBox from '@/Components/ChatBox';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import imageCompression from 'browser-image-compression';

// Opções de compressão (Otimização invisível)
const COMPRESSION_OPTIONS = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true
};

export default function PedidoShow({ auth, pedido, url_romaneio }) {
    // 1. Configuração dos formulários e Estados
    const [compressing, setCompressing] = useState(false);
    const formAcoes = useForm({}); 
    
    // Referência para o áudio (Melhoria de performance)
    const audioRef = useRef(typeof window !== 'undefined' ? new Audio('/plim.mp3') : null);

    // --- 2. ATUALIZAÇÃO EM TEMPO REAL ---
    useEffect(() => {
        if (!auth.user?.id) return;
        const channel = window.Echo.private(`App.Models.User.${auth.user.id}`);

        channel.notification((notification) => {
            if (notification.link && notification.link.includes(`/pedidos/${pedido.id}`)) {
                audioRef.current?.play().catch(() => {});
                Swal.mixin({
                    toast: true, position: 'top-end', showConfirmButton: false, timer: 5000, timerProgressBar: true
                }).fire({ 
                    icon: 'info', title: 'Atualização do Pedido', text: notification.mensagem 
                });
                router.reload({ only: ['pedido'], preserveScroll: true });
            }
        });

        return () => channel.stopListening('Notification');
    }, [pedido.id, auth.user.id]);

    // --- 3. OTIMIZAÇÃO: LÓGICA DE UPLOAD ROBUSTA ---
    
    // Função auxiliar de compressão
    const compressImage = async (imageFile) => {
        if (!imageFile || !imageFile.type.startsWith('image/')) return imageFile;
        try { return await imageCompression(imageFile, COMPRESSION_OPTIONS); } 
        catch (error) { return imageFile; }
    };

    const handleConferenciaEntrega = () => {
        // Otimização: HTML limpo e IDs únicos para evitar conflito
        Swal.fire({
            title: 'Conferência de Entrega 🚛',
            width: '700px',
            html: `
                <div class="text-left text-sm">
                    <p class="mb-4 text-gray-600 bg-blue-50 p-2 rounded border border-blue-100">
                        <strong>Instruções:</strong><br>
                        1. Anexe o Romaneio Assinado no final.<br>
                        2. Se houver avaria, descreva o defeito E anexe a foto.
                    </p>
                    <div class="max-h-80 overflow-y-auto border border-gray-200 rounded p-3 bg-gray-50 mb-4">
                        ${pedido.motos.map(m => `
                            <div class="mb-4 border-b border-gray-300 pb-3 last:border-0 bg-white p-2 rounded shadow-sm">
                                <div class="font-bold text-gray-800 text-sm mb-1">
                                    🏍️ ${m.modelo} <span class="font-mono text-blue-600">(${m.chassi})</span>
                                </div>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <input type="text" id="avaria-texto-${m.id}" class="swal2-input w-full text-xs m-0 h-10 border-gray-300 focus:ring-red-500" placeholder="Descreva o defeito...">
                                    <div class="flex items-center">
                                        <label class="block w-full text-xs text-gray-500 border border-dashed border-gray-400 rounded cursor-pointer hover:bg-gray-100 p-2 text-center relative">
                                            <span id="label-foto-${m.id}">📸 Add Foto</span>
                                            <input type="file" id="avaria-foto-${m.id}" class="hidden" accept="image/*" onchange="document.getElementById('label-foto-${m.id}').innerText = '✅ Foto OK'">
                                        </label>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="mt-4 p-3 bg-green-50 rounded border border-green-200">
                        <label class="block font-bold text-green-800 mb-1 text-sm uppercase">📄 Foto do Romaneio Assinado *</label>
                        <input type="file" id="upload-comprovante" class="w-full text-sm border rounded p-2 bg-white" accept="image/*,application/pdf">
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Confirmar Recebimento',
            confirmButtonColor: '#16a34a',
            focusConfirm: false,
            preConfirm: () => {
                const fileInput = document.getElementById('upload-comprovante');
                if (!fileInput.files[0]) {
                    Swal.showValidationMessage('O comprovante assinado é obrigatório!');
                    return false;
                }

                // Coleta manual robusta
                const avarias = {};
                const fotos = {};
                
                pedido.motos.forEach(m => {
                    const texto = document.getElementById(`avaria-texto-${m.id}`)?.value;
                    const foto = document.getElementById(`avaria-foto-${m.id}`)?.files[0];
                    
                    if (texto) {
                        avarias[m.id] = texto;
                        if (foto) fotos[m.id] = foto;
                    }
                });

                return { file: fileInput.files[0], avarias, fotos };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const { file, avarias, fotos } = result.value;
                await processarEnvio(file, avarias, fotos);
            }
        });
    };

    const processarEnvio = async (romaneioFile, avarias, fotosAvarias) => {
        setCompressing(true);
        Swal.fire({ title: 'Enviando...', html: 'Otimizando imagens...', didOpen: () => Swal.showLoading() });

        try {
            // 1. Compressão Real (Otimização)
            const compressedRomaneio = await compressImage(romaneioFile);
            const compressedFotos = {};
            
            await Promise.all(Object.keys(fotosAvarias).map(async (id) => {
                compressedFotos[id] = await compressImage(fotosAvarias[id]);
            }));

            // 2. Montagem do FormData Manual (Correção para Inertia enviar arquivos corretamente)
            const formData = new FormData();
            formData.append('_method', 'post');
            formData.append('arquivo_romaneio', compressedRomaneio);
            
            Object.keys(avarias).forEach(id => formData.append(`avarias[${id}]`, avarias[id]));
            Object.keys(compressedFotos).forEach(id => formData.append(`fotos_avarias[${id}]`, compressedFotos[id]));

            router.post(route('pedidos.finalizar', pedido.id), formData, {
                forceFormData: true,
                onSuccess: () => {
                    setCompressing(false);
                    Swal.fire('Sucesso!', 'Recebimento confirmado.', 'success');
                },
                onError: (errors) => {
                    setCompressing(false);
                    Swal.fire('Erro', Object.values(errors)[0] || 'Falha no envio.', 'error');
                }
            });
        } catch (e) {
            setCompressing(false);
            Swal.fire('Erro', 'Falha ao processar arquivos.', 'error');
        }
    };

    // --- MANUTENÇÃO DAS AÇÕES ORIGINAIS ---
    const confirmAction = (title, text, routeName, color = '#2563eb') => {
        Swal.fire({
            title, text, icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim, confirmar!', confirmButtonColor: color
        }).then((res) => { if(res.isConfirmed) formAcoes.post(route(routeName, pedido.id)); });
    };

    const handleRejeitar = () => {
        Swal.fire({
            title: 'Rejeitar Pedido', input: 'text', inputLabel: 'Motivo', showCancelButton: true, confirmButtonText: 'Rejeitar', confirmButtonColor: '#d33',
            inputValidator: (v) => !v && 'Escreva o motivo!'
        }).then((r) => { if (r.isConfirmed) router.post(route('pedidos.rejeitar', pedido.id), { motivo: r.value }); });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-red-700">Acompanhamento #{pedido.id}</h2>}>
            <Head title={`Pedido #${pedido.id}`} />

            <div className="py-12 bg-gray-100 min-h-screen pb-32">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
                    
                    {/* CABEÇALHO (Layout Preservado) */}
                    <div className="bg-white p-6 shadow-sm sm:rounded-lg border-l-4 border-gray-800 flex justify-between flex-wrap gap-4">
                        <div>
                            <h3 className="font-bold text-gray-700 text-lg">{pedido.user.name}</h3>
                            <p className="text-gray-500 text-sm">Filial: {pedido.user.filial || 'Matriz'}</p>
                            <p className="text-gray-400 text-xs mt-1">Data: {new Date(pedido.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                            <span className="text-xs font-bold text-gray-400 uppercase block mb-1">Status Atual</span>
                            <BadgeStatus status={pedido.status} />
                            
                            {url_romaneio && (
                                <a href={url_romaneio} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded shadow transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    Ver Romaneio
                                </a>
                            )}
                            {pedido.romaneio_id && (
                                <div className="mt-2 text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded border border-indigo-200 animate-pulse">
                                    Carga/Romaneio #{String(pedido.romaneio_id).padStart(6, '0')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ALERTAS */}
                    {pedido.status === 'cancelado' && (
                        <div className="bg-red-100 border-l-4 border-red-600 p-4 shadow-sm animate-pulse">
                            <h3 className="font-bold text-red-800">🚫 PEDIDO CANCELADO</h3>
                            <p className="text-red-700 mt-1">{pedido.motivo_rejeicao}</p>
                        </div>
                    )}

                    {pedido.status === 'em_analise' && auth.user.perfil === 'loja' && (
                        <div className="bg-purple-50 border-l-4 border-purple-500 p-4 shadow-sm flex items-center gap-3">
                            <div className="text-2xl">🛡️</div>
                            <div>
                                <h3 className="font-bold text-purple-800">Em Análise Comercial</h3>
                                <p className="text-purple-700 text-sm">Aguardando aprovação do Gestor.</p>
                            </div>
                        </div>
                    )}

                    {/* TIMELINE */}
                    <div className="px-2 md:px-8">
                        <Timeline status={pedido.status} />
                    </div>
                    
                    {/* LISTA DE MOTOS (Layout Original) */}
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
                                        <th className="px-4 py-2 text-left">Motivo da Solicitação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pedido.motos.map((moto) => (
                                        <tr key={moto.id} className="border-b hover:bg-gray-50">
                                            <td className="px-4 py-3 font-bold text-sm text-gray-700">{moto.modelo}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-gray-600 tracking-wide">{moto.chassi}</span>
                                                    {moto.status === 'avariado' && (
                                                        <span className="mt-1 w-fit bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-200">⚠️ Avariado</span>
                                                    )}
                                                    {moto.detalhes_avaria && <div className="text-[10px] text-red-600 mt-1 italic">Obs: {moto.detalhes_avaria}</div>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                    ${pedido.motivo === 'Venda' ? 'bg-green-100 text-green-800' : 
                                                      pedido.motivo === 'Transferência' ? 'bg-blue-100 text-blue-800' : 
                                                      'bg-gray-100 text-gray-800'}`}>
                                                    {pedido.motivo || pedido.tipo || 'Solicitação Padrão'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* PAINEL CD */}
                    {auth.user.perfil === 'cd' && pedido.status !== 'cancelado' && (
                        <div className="bg-white p-6 shadow-sm sm:rounded-lg border-t-4 border-blue-600">
                            <h3 className="font-bold text-lg mb-4 text-gray-800">⚙️ Painel de Operações (CD)</h3>
                            
                            {pedido.status === 'solicitado' && (
                                <div className="flex gap-4">
                                    <button onClick={() => confirmAction('Confirmar Separação?', 'Motos conferidas?', 'pedidos.separar')} className="bg-blue-600 text-white px-6 py-3 rounded font-bold hover:bg-blue-700 shadow flex-1">
                                        ✅ Confirmar Separação
                                    </button>
                                    <button onClick={handleRejeitar} className="border border-red-500 text-red-600 px-6 py-3 rounded font-bold hover:bg-red-50">Rejeitar</button>
                                </div>
                            )}

                            {pedido.status === 'separado' && (
                                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg flex justify-between items-center gap-4">
                                    <div><p className="font-bold text-indigo-900">Motos separadas.</p><p className="text-sm text-indigo-700">Vá para "Nova Carga".</p></div>
                                    <Link href={route('romaneios.create')} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-indigo-700">Ir para Montagem de Carga &rarr;</Link>
                                </div>
                            )}

                            {pedido.status === 'expedido' && (
                                <div className="flex items-center justify-between">
                                    <div><p className="font-bold text-indigo-700">Carga montada!</p><p className="text-sm text-gray-500">Aguardando saída.</p></div>
                                    <button onClick={() => confirmAction('Liberar Saída?', 'Motorista saiu?', 'pedidos.saida', '#f97316')} className="bg-orange-500 text-white px-6 py-3 rounded font-bold hover:bg-orange-600 shadow">🚛 Confirmar Saída</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SUCESSO */}
                    {pedido.status === 'concluido' && (
                        <div className="text-center mt-6">
                            <div className="bg-green-100 p-6 rounded-lg border border-green-200 inline-block shadow-sm">
                                <h3 className="text-green-800 font-bold text-xl mb-2">Pedido Concluído! 🎉</h3>
                                <p className="text-green-700 text-sm">Estoque atualizado.</p>
                                {pedido.comprovante_url && (
                                    <div className="mt-4"><a href={pedido.comprovante_url} target="_blank" className="bg-white text-green-700 px-4 py-2 rounded border border-green-300 font-bold hover:bg-green-50">📄 Ver Comprovante</a></div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* LOGS / HISTÓRICO (MANTIDO ESTRITAMENTE IGUAL AO SEU) */}
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

            {/* BOTÃO FLUTUANTE */}
            {pedido.status === 'em_transito' && (auth.user.perfil === 'cd' || auth.user.id === pedido.user_id) && (
                <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40">
                    <div className="max-w-4xl mx-auto flex gap-4">
                        <button onClick={handleConferenciaEntrega} disabled={compressing} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-lg py-3 px-8 rounded-xl shadow-lg transition flex items-center justify-center gap-2">
                            {compressing ? 'Processando...' : <span>📝 CONFERIR E FINALIZAR ENTREGA</span>}
                        </button>
                    </div>
                </div>
            )}

            {pedido.status !== 'cancelado' && <ChatBox pedidoId={pedido.id} />}
        </AuthenticatedLayout>
    );
}

// HELPERS VISUAIS (MANTIDOS)
function BadgeStatus({ status }) {
    const config = {
        'em_analise': { label: 'Em Análise', bg: 'bg-purple-100 text-purple-800 border-purple-200' },
        'solicitado': { label: 'Aguardando CD', bg: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
        'separado': { label: 'Separado', bg: 'bg-blue-100 text-blue-800 border-blue-200' },
        'expedido': { label: 'Em Carga', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
        'em_transito': { label: 'Em Trânsito', bg: 'bg-orange-100 text-orange-800 border-orange-200' },
        'concluido': { label: 'Concluído', bg: 'bg-green-100 text-green-800 border-green-200' },
        'cancelado': { label: 'Cancelado', bg: 'bg-red-100 text-red-800 border-red-200' },
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