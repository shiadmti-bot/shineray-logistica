import ChatBox from '@/Components/ChatBox';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import imageCompression from 'browser-image-compression';

// Opções de compressão global
const COMPRESSION_OPTIONS = {
    maxSizeMB: 1,          // Máximo 1MB
    maxWidthOrHeight: 1920, // Redimensiona se for 4k/8k
    useWebWorker: true,
    fileType: 'image/jpeg'
};

export default function PedidoShow({ auth, pedido, url_romaneio }) {
    // 1. Configuração dos formulários e Estados
    const [compressing, setCompressing] = useState(false);
    const formAcoes = useForm({}); 
    
    // Referência para o áudio para evitar recriação desnecessária
    const audioRef = useRef(typeof window !== 'undefined' ? new Audio('/plim.mp3') : null);

    // --- 2. ATUALIZAÇÃO EM TEMPO REAL ---
    useEffect(() => {
        if (!auth.user?.id) return;

        const channel = window.Echo.private(`App.Models.User.${auth.user.id}`);

        channel.notification((notification) => {
            if (notification.link && notification.link.includes(`/pedidos/${pedido.id}`)) {
                // 1. Som de Alerta
                audioRef.current?.play().catch(() => console.log('Autoplay bloqueado pelo navegador'));

                // 2. Toast Flutuante
                Swal.mixin({
                    toast: true, 
                    position: 'top-end', 
                    showConfirmButton: false, 
                    timer: 5000, 
                    timerProgressBar: true
                }).fire({ 
                    icon: 'info', 
                    title: 'Atualização do Pedido', 
                    text: notification.mensagem 
                });

                // 3. Recarrega os dados preservando o scroll
                router.reload({ only: ['pedido'], preserveScroll: true });
            }
        });

        return () => channel.stopListening('Notification');
    }, [pedido.id, auth.user.id]);

    // --- 3. FUNÇÕES AUXILIARES ---

    /**
     * Função para comprimir um único arquivo
     */
    const compressImage = async (imageFile) => {
        if (!imageFile || !imageFile.type.startsWith('image/')) return imageFile; // Se for PDF ou não imagem, retorna original
        try {
            return await imageCompression(imageFile, COMPRESSION_OPTIONS);
        } catch (error) {
            console.error("Erro na compressão:", error);
            return imageFile; // Fallback para arquivo original
        }
    };

    // A. LÓGICA DE CONFERÊNCIA E UPLOAD
    const handleConferenciaEntrega = () => {
        Swal.fire({
            title: 'Conferência de Entrega 🚛',
            width: '800px',
            html: `
                <div class="text-left text-sm">
                    <p class="mb-4 text-gray-600 bg-blue-50 p-3 rounded border border-blue-100">
                        <strong>Instruções:</strong><br>
                        1. Anexe o Romaneio Assinado no final.<br>
                        2. Se houver avaria, descreva o defeito <strong>E</strong> anexe a foto da moto.
                    </p>
                    
                    <div class="max-h-[60vh] overflow-y-auto border border-gray-200 rounded p-3 bg-gray-50 mb-4">
                        ${pedido.motos.map(m => `
                            <div class="mb-4 border-b border-gray-300 pb-3 last:border-0 bg-white p-3 rounded shadow-sm">
                                <div class="font-bold text-gray-800 text-sm mb-2 flex justify-between items-center">
                                    <span>🏍️ ${m.modelo}</span>
                                    <span class="font-mono text-blue-600 bg-blue-50 px-2 rounded">${m.chassi}</span>
                                </div>
                                
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <input 
                                        type="text" 
                                        id="avaria-texto-${m.id}" 
                                        class="swal2-input w-full text-xs m-0 h-10 border-gray-300 focus:ring-red-500 rounded" 
                                        placeholder="Descreva o defeito (se houver)..."
                                    >
                                    
                                    <div class="flex items-center">
                                        <label class="w-full cursor-pointer group">
                                            <div class="flex items-center justify-center w-full h-10 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-blue-400 focus:outline-none" id="container-foto-${m.id}">
                                                <span class="flex items-center space-x-2 text-xs text-gray-600" id="label-foto-${m.id}">
                                                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                                    <span>Add Foto</span>
                                                </span>
                                            </div>
                                            <input type="file" id="avaria-foto-${m.id}" class="hidden" accept="image/*" onchange="
                                                const fileName = this.files[0]?.name; 
                                                const label = document.getElementById('label-foto-${m.id}');
                                                const container = document.getElementById('container-foto-${m.id}');
                                                if(fileName) {
                                                    label.innerText = '✅ Foto Selecionada';
                                                    container.classList.add('border-green-400', 'bg-green-50');
                                                }
                                            ">
                                        </label>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="mt-4 p-4 bg-green-50 rounded border border-green-200 shadow-sm">
                        <label class="block font-bold text-green-800 mb-2 text-sm uppercase flex items-center gap-2">
                            <span>📄 Foto do Romaneio Assinado (Obrigatório)</span>
                        </label>
                        <input type="file" id="upload-comprovante" class="block w-full text-sm text-slate-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-full file:border-0
                          file:text-xs file:font-semibold
                          file:bg-green-100 file:text-green-700
                          hover:file:bg-green-200" accept="image/*,application/pdf">
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Confirmar Recebimento',
            confirmButtonColor: '#16a34a',
            cancelButtonText: 'Cancelar',
            focusConfirm: false,
            preConfirm: () => {
                const fileInput = document.getElementById('upload-comprovante');
                
                // Validação Básica
                if (!fileInput.files[0]) {
                    Swal.showValidationMessage('⚠️ O comprovante assinado é obrigatório!');
                    return false;
                }

                // Coleta de Dados do DOM
                const avariasColetadas = {}; 
                const fotosColetadas = {};   

                pedido.motos.forEach(m => {
                    const inputTexto = document.getElementById(`avaria-texto-${m.id}`);
                    const inputFoto = document.getElementById(`avaria-foto-${m.id}`);

                    const texto = inputTexto?.value?.trim();
                    const foto = inputFoto?.files[0];

                    if (texto) {
                        avariasColetadas[m.id] = texto;
                        // Regra de Negócio: Se tem avaria, a foto é recomendada (mas não bloqueante aqui, a backend que decide)
                        if (foto) {
                            fotosColetadas[m.id] = foto;
                        }
                    }
                });

                return { 
                    file: fileInput.files[0], 
                    avarias: avariasColetadas,
                    fotos: fotosColetadas 
                };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const { file, avarias, fotos } = result.value;
                await processarEnvio(file, avarias, fotos);
            }
        });
    };

    /**
     * Processa a compressão e envio dos dados
     */
    const processarEnvio = async (romaneioFile, avarias, fotosAvarias) => {
        setCompressing(true);
        
        // Modal de Loading com Feedback
        Swal.fire({
            title: 'Processando...',
            html: 'Otimizando imagens e enviando arquivos.<br>Por favor, aguarde.',
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            // 1. Comprimir Romaneio (se for imagem)
            const compressedRomaneio = await compressImage(romaneioFile);

            // 2. Comprimir Fotos das Avarias (Promise.all para paralelo)
            const compressedFotos = {};
            const chassiIds = Object.keys(fotosAvarias);
            
            await Promise.all(chassiIds.map(async (id) => {
                compressedFotos[id] = await compressImage(fotosAvarias[id]);
            }));

            // 3. Montar FormData Manualmente (Para garantir estrutura correta)
            const formData = new FormData();
            formData.append('_method', 'post'); // Necessário para Inertia em alguns casos de upload
            formData.append('arquivo_romaneio', compressedRomaneio);

            // Anexar avarias (texto)
            Object.keys(avarias).forEach(id => {
                formData.append(`avarias[${id}]`, avarias[id]);
            });

            // Anexar fotos (arquivos)
            Object.keys(compressedFotos).forEach(id => {
                formData.append(`fotos_avarias[${id}]`, compressedFotos[id]);
            });

            // 4. Enviar via Inertia
            router.post(route('pedidos.finalizar', pedido.id), formData, {
                forceFormData: true,
                onSuccess: () => {
                    setCompressing(false);
                    Swal.fire('Sucesso! 🎉', 'Recebimento confirmado e arquivos enviados.', 'success');
                },
                onError: (errors) => {
                    setCompressing(false);
                    console.error(errors);
                    // Pega o primeiro erro disponível para exibir
                    const msgErro = Object.values(errors)[0] || 'Falha no envio.';
                    Swal.fire('Erro', msgErro, 'error');
                }
            });

        } catch (error) {
            setCompressing(false);
            console.error("Erro fatal:", error);
            Swal.fire('Erro Técnico', 'Falha ao processar imagens no navegador.', 'error');
        }
    };

    // B. OUTRAS OPERAÇÕES (CD)
    const handleConfirmAction = (titulo, texto, rota, corConfirm = '#2563eb') => {
        Swal.fire({
            title: titulo,
            text: texto,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sim, confirmar!',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: corConfirm
        }).then((res) => {
            if(res.isConfirmed) formAcoes.post(route(rota, pedido.id));
        });
    };

    const handleRejeitar = () => {
        Swal.fire({
            title: 'Rejeitar Pedido',
            input: 'textarea', // Mudado para textarea para caber mais texto
            inputLabel: 'Motivo da rejeição',
            inputPlaceholder: 'Explique o motivo da devolução...',
            showCancelButton: true,
            confirmButtonText: 'Rejeitar Pedido',
            confirmButtonColor: '#d33',
            inputValidator: (value) => { if (!value) return 'É obrigatório informar o motivo!'; }
        }).then((result) => {
            if (result.isConfirmed) {
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
                        <div className="text-right flex flex-col items-end">
                            <span className="text-xs font-bold text-gray-400 uppercase block mb-1">Status Atual</span>
                            <BadgeStatus status={pedido.status} />
                            
                            {url_romaneio && (
                                <a href={url_romaneio} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded shadow transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    Ver Romaneio
                                </a>
                            )}
                            {pedido.romaneio_id && (
                                <div className="mt-2 text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded border border-indigo-200">
                                    Carga #{String(pedido.romaneio_id).padStart(6, '0')}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ALERTAS DE STATUS */}
                    {pedido.status === 'cancelado' && (
                        <div className="bg-red-100 border-l-4 border-red-600 p-4 shadow-sm">
                            <h3 className="font-bold text-red-800">🚫 PEDIDO CANCELADO</h3>
                            <p className="text-red-700 mt-1">{pedido.motivo_rejeicao}</p>
                        </div>
                    )}

                    {/* TIMELINE */}
                    <div className="px-2 md:px-8">
                        <Timeline status={pedido.status} />
                    </div>
                    
                    {/* TABELA DE MOTOS */}
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
                                        <th className="px-4 py-2 text-left">Motivo</th>
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
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                    ${pedido.motivo === 'Venda' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {pedido.motivo || pedido.tipo || 'Padrão'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* PAINEL DE OPERAÇÕES (CD) */}
                    {auth.user.perfil === 'cd' && pedido.status !== 'cancelado' && (
                        <div className="bg-white p-6 shadow-sm sm:rounded-lg border-t-4 border-blue-600">
                            <h3 className="font-bold text-lg mb-4 text-gray-800">⚙️ Painel de Operações (CD)</h3>
                            
                            {pedido.status === 'solicitado' && (
                                <div className="flex gap-4">
                                    <button onClick={() => handleConfirmAction('Confirmar Separação?', 'As motos foram conferidas?', 'pedidos.separar')} className="bg-blue-600 text-white px-6 py-3 rounded font-bold hover:bg-blue-700 shadow flex-1">
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
                                        <p className="font-bold text-indigo-900">Motos separadas.</p>
                                        <p className="text-sm text-indigo-700">Gere a carga no menu Romaneios.</p>
                                    </div>
                                    <Link href={route('romaneios.create')} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-indigo-700">
                                        Nova Carga &rarr;
                                    </Link>
                                </div>
                            )}

                            {pedido.status === 'expedido' && (
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-indigo-700">Carga montada!</p>
                                        <p className="text-sm text-gray-500">Aguardando saída.</p>
                                    </div>
                                    <button onClick={() => handleConfirmAction('Liberar Saída?', 'O motorista já saiu?', 'pedidos.saida', '#f97316')} className="bg-orange-500 text-white px-6 py-3 rounded font-bold hover:bg-orange-600 shadow">
                                        🚛 Confirmar Saída
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SUCESSO / COMPROVANTE */}
                    {pedido.status === 'concluido' && (
                        <div className="text-center mt-6">
                            <div className="bg-green-50 p-6 rounded-lg border border-green-200 inline-block shadow-sm">
                                <h3 className="text-green-800 font-bold text-xl mb-2">Pedido Concluído! 🎉</h3>
                                <p className="text-green-700 text-sm">Estoque atualizado.</p>
                                {pedido.comprovante_url && (
                                    <a href={pedido.comprovante_url} target="_blank" className="mt-4 inline-block bg-white text-green-700 px-4 py-2 rounded border border-green-300 font-bold hover:bg-green-100">
                                        📄 Ver Comprovante
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* HISTÓRICO */}
                    <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg border-t border-gray-200 mt-6">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                            <h3 className="font-bold text-gray-700">📜 Histórico</h3>
                        </div>
                        <ul className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                            {pedido.logs?.map((log) => (
                                <li key={log.id} className="p-4 hover:bg-gray-50 flex gap-4 items-start">
                                    <div className="w-2 h-2 mt-1 bg-blue-400 rounded-full"></div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-800">{log.titulo}</p>
                                        <p className="text-xs text-gray-600 mt-1">{log.descricao}</p>
                                    </div>
                                    <div className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleString('pt-BR')}</div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* BOTÃO FLUTUANTE DE FINALIZAÇÃO */}
            {pedido.status === 'em_transito' && (auth.user.perfil === 'cd' || auth.user.id === pedido.user_id) && (
                <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40">
                    <div className="max-w-4xl mx-auto flex gap-4">
                        <button 
                            onClick={handleConferenciaEntrega}
                            disabled={compressing}
                            className={`flex-1 text-white font-bold text-lg py-3 px-8 rounded-xl shadow-lg transition flex items-center justify-center gap-2 
                                ${compressing ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                            {compressing ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>PROCESSANDO...</span>
                                </>
                            ) : (
                                <>
                                    <span>📝</span> CONFERIR E FINALIZAR ENTREGA
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {pedido.status !== 'cancelado' && <ChatBox pedidoId={pedido.id} />}
        </AuthenticatedLayout>
    );
}

// --- HELPERS VISUAIS (Mantidos Iguais) ---
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
        </div>
    );
}