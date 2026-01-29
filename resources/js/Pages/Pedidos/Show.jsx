import ChatBox from '@/Components/ChatBox';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

export default function PedidoShow({ auth, pedido }) {
    // 1. CONFIGURAÇÃO DE ESTADO E FORMULÁRIOS
    const formUpload = useForm({ arquivo_romaneio: null, avarias: {} });
    const [compressing, setCompressing] = useState(false);
    const formRejeicao = useForm({ motivo: '' });
    const formAcoes = useForm({}); 

    // --- 2. ATUALIZAÇÃO EM TEMPO REAL (ECHO) ---
    useEffect(() => {
        if (!auth.user?.id || !window.Echo) return;

        const channel = window.Echo.private(`App.Models.User.${auth.user.id}`);

        channel.notification((notification) => {
            if (notification.link && notification.link.includes(`/pedidos/${pedido.id}`)) {
                // Audio
                try {
                    const audio = new Audio('/plim.mp3');
                    audio.play().catch(() => {});
                } catch(e) {}

                // Toast
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

                // Reload Silencioso
                router.reload({ only: ['pedido'] });
            }
        });

        return () => channel.stopListening('Notification');
    }, [pedido.id, auth.user.id]);

    // --- 3. LÓGICA DE CONFERÊNCIA (AVARIAS E UPLOAD) ---
    const handleConferenciaEntrega = () => {
        Swal.fire({
            title: 'Conferência de Entrega 🚛',
            width: '700px',
            html: `
                <div class="text-left text-sm">
                    <p class="mb-4 text-gray-600 bg-blue-50 p-3 rounded border border-blue-100">
                        <strong>Instruções:</strong><br>
                        1. Anexe o <b>Romaneio Assinado</b> no final.<br>
                        2. Se houver avaria, descreva o defeito E anexe a foto da moto.
                    </p>
                    
                    <div class="max-h-80 overflow-y-auto border border-gray-200 rounded p-3 bg-gray-50 mb-4">
                        ${pedido.motos.map(m => `
                            <div class="mb-4 border-b border-gray-300 pb-3 last:border-0 bg-white p-3 rounded shadow-sm">
                                <div class="font-bold text-gray-800 text-sm mb-1 flex justify-between">
                                    <span>🏍️ ${m.modelo}</span>
                                    <span class="font-mono text-blue-600">${m.chassi}</span>
                                </div>
                                
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <input 
                                        type="text" 
                                        id="avaria-texto-${m.id}" 
                                        class="swal2-input w-full text-xs m-0 h-10 border-gray-300 focus:ring-red-500 rounded" 
                                        placeholder="Descreva o defeito (se houver)..."
                                    >
                                    <div class="flex items-center">
                                        <label class="block w-full text-xs text-gray-500 border border-dashed border-gray-400 rounded cursor-pointer hover:bg-gray-100 p-2 text-center relative transition">
                                            <span id="label-foto-${m.id}">📸 Add Foto (Opcional)</span>
                                            <input type="file" id="avaria-foto-${m.id}" class="hidden" accept="image/*" onchange="document.getElementById('label-foto-${m.id}').innerText = '✅ Foto Selecionada'">
                                        </label>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="mt-4 p-4 bg-green-50 rounded border border-green-200">
                        <label class="block font-bold text-green-800 mb-2 text-sm uppercase">📄 Foto do Romaneio Assinado (Obrigatório)</label>
                        <input type="file" id="upload-comprovante" class="w-full text-sm border rounded p-2 bg-white" accept="image/*,application/pdf">
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
                if (!fileInput.files[0]) {
                    Swal.showValidationMessage('O comprovante assinado é obrigatório!');
                    return false;
                }

                // Coleta Dados
                const avariasColetadas = {};
                const fotosColetadas = {};

                pedido.motos.forEach(m => {
                    const inputTexto = document.getElementById(`avaria-texto-${m.id}`);
                    const inputFoto = document.getElementById(`avaria-foto-${m.id}`);

                    if (inputTexto && inputTexto.value.trim()) {
                        avariasColetadas[m.id] = inputTexto.value.trim();
                        if (inputFoto.files[0]) {
                            fotosColetadas[m.id] = inputFoto.files[0];
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

    const processarEnvio = async (romaneioFile, avarias, fotosAvarias) => {
        setCompressing(true);
        Swal.fire({
            title: 'Enviando...',
            html: 'Processando arquivos e organizando pastas no Drive.<br>Isso pode levar alguns segundos.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        // Monta objeto para o router do Inertia
        const dataToSend = {
            _method: 'post',
            arquivo_romaneio: romaneioFile,
            avarias: avarias,
            fotos_avarias: fotosAvarias
        };

        router.post(route('pedidos.finalizar', pedido.id), dataToSend, {
            forceFormData: true,
            onSuccess: () => {
                setCompressing(false);
                Swal.fire('Sucesso!', 'Recebimento confirmado. Arquivos organizados na pasta da filial.', 'success');
            },
            onError: (errors) => {
                setCompressing(false);
                Swal.fire('Erro', errors.erro_upload || 'Falha no envio.', 'error');
            }
        });
    };

    // --- 4. FUNÇÕES DO CD (SEPARAÇÃO/SAÍDA) ---
    const avancarSeparacao = () => { 
        Swal.fire({
            title: 'Confirmar Separação?',
            text: "As motos foram conferidas fisicamente no pátio?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, confirmar',
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
            confirmButtonText: 'Sim, liberar',
            confirmButtonColor: '#f97316'
        }).then((res) => {
            if(res.isConfirmed) formAcoes.post(route('pedidos.saida', pedido.id));
        });
    };

    const handleRejeitar = () => {
        Swal.fire({
            title: 'Rejeitar Pedido',
            input: 'textarea',
            inputLabel: 'Motivo da rejeição',
            inputPlaceholder: 'Explique o motivo...',
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

    // --- RENDERIZAÇÃO ---
    return (
        <AuthenticatedLayout 
            user={auth.user} 
            header={
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <h2 className="font-bold text-xl text-gray-800 leading-tight flex items-center gap-2">
                        📦 Pedido <span className="text-red-600">#{pedido.id}</span>
                    </h2>
                    <div className="flex items-center gap-2">
                        <BadgeStatus status={pedido.status} />
                    </div>
                </div>
            }
        >
            <Head title={`Pedido #${pedido.id}`} />

            <div className="py-8 bg-gray-50 min-h-screen pb-32">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6 px-4">
                    
                    {/* --- CARD 1: INFORMAÇÕES GERAIS --- */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Loja Solicitante</h3>
                            <div className="text-lg font-bold text-gray-800">{pedido.user.filial || 'Matriz'}</div>
                            <div className="text-sm text-gray-600">{pedido.user.name}</div>
                            <div className="text-xs text-gray-400 mt-1">{pedido.user.email}</div>
                        </div>
                        <div className="md:text-right">
                            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Data da Solicitação</h3>
                            <div className="text-lg font-bold text-gray-800">
                                {new Date(pedido.created_at).toLocaleDateString()}
                            </div>
                            <div className="text-sm text-gray-500">
                                às {new Date(pedido.created_at).toLocaleTimeString().slice(0, 5)}
                            </div>
                        </div>
                    </div>

                    {/* --- ALERTA: PEDIDO CANCELADO --- */}
                    {pedido.status === 'cancelado' && (
                        <div className="bg-red-50 p-5 rounded-xl border border-red-200 shadow-sm flex gap-3 animate-pulse">
                            <div className="text-red-500 text-xl">🛑</div>
                            <div>
                                <h4 className="font-bold text-red-800 text-sm uppercase mb-1">Pedido Cancelado / Rejeitado</h4>
                                <p className="text-red-900 text-sm leading-relaxed">
                                    {pedido.motivo_rejeicao || 'Sem motivo especificado.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* --- ALERTA: OBSERVAÇÕES --- */}
                    {pedido.observacao && (
                        <div className="bg-amber-50 p-5 rounded-xl border border-amber-200 shadow-sm flex gap-3">
                            <div className="text-amber-500 text-xl">📝</div>
                            <div>
                                <h4 className="font-bold text-amber-800 text-sm uppercase mb-1">Observações da Solicitação</h4>
                                <p className="text-amber-900 text-sm leading-relaxed whitespace-pre-line">
                                    {pedido.observacao}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* --- TIMELINE DE PROGRESSO --- */}
                    <div className="px-2">
                        <Timeline status={pedido.status} />
                    </div>

                    {/* --- TABELA DE ITENS (ATUALIZADA) --- */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                🏍️ Itens Solicitados
                                <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">{pedido.motos.length}</span>
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                                    <tr>
                                        <th className="px-6 py-3 text-left font-extrabold tracking-wider">Modelo</th>
                                        <th className="px-6 py-3 text-left font-extrabold tracking-wider">Cor</th>
                                        <th className="px-6 py-3 text-left font-extrabold tracking-wider">Chassi</th>
                                        <th className="px-6 py-3 text-left font-extrabold tracking-wider">Destino</th>
                                        <th className="px-6 py-3 text-left font-extrabold tracking-wider">Motivo</th>
                                        <th className="px-6 py-3 text-center font-extrabold tracking-wider">Carga / Status</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {pedido.motos.map((moto) => (
                                        <tr key={moto.id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900">{moto.modelo}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="h-3 w-3 rounded-full border border-gray-300 shadow-sm" 
                                                        style={{ backgroundColor: getColorHex(moto.cor) }}></span>
                                                    <span className="text-sm text-gray-700 font-medium capitalize">{moto.cor}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-sm text-gray-600 tracking-wide">{moto.chassi}</td>
                                            
                                            {/* EXIBIÇÃO DO DESTINO (Pivô ou Padrão) */}
                                            <td className="px-6 py-4 text-sm text-gray-700">
                                                <span className="flex items-center gap-1 font-medium bg-yellow-50 px-2 py-1 rounded text-yellow-800 border border-yellow-100 text-xs">
                                                    📍 {moto.pivot?.destino || pedido.user.filial || 'Matriz'}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                                                    {moto.motivo_solicitacao || 'Venda'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {moto.status === 'avariado' ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded border border-red-200">⚠️ Avariado</span>
                                                        <span className="text-[10px] text-red-500 mt-1 max-w-[150px] truncate">{moto.detalhes_avaria}</span>
                                                    </div>
                                                ) : (
                                                    moto.romaneio_id ? (
                                                        <Link href={route('romaneios.show', moto.romaneio_id)} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold hover:bg-indigo-100 transition">
                                                            🚛 Carga #{moto.romaneio_id}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 font-medium italic">Aguardando Carga</span>
                                                    )
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
                        <div className="bg-white p-6 shadow-sm rounded-xl border-l-4 border-blue-600 mt-6">
                            <h3 className="font-bold text-lg mb-4 text-gray-800">⚙️ Painel de Operações (CD)</h3>
                            
                            {pedido.status === 'em_analise' && (
                                <div className="text-center p-4 bg-gray-50 rounded text-gray-500 italic border border-gray-200">
                                    Aguardando aprovação do Gestor Comercial.
                                </div>
                            )}

                            {pedido.status === 'solicitado' && (
                                <div className="flex gap-4">
                                    <button onClick={avancarSeparacao} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 shadow flex-1 transition transform hover:-translate-y-0.5">
                                        ✅ Confirmar Separação
                                    </button>
                                    <button onClick={handleRejeitar} className="border border-red-500 text-red-600 px-6 py-3 rounded-lg font-bold hover:bg-red-50 transition">
                                        Rejeitar
                                    </button>
                                </div>
                            )}

                            {pedido.status === 'separado' && (
                                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div>
                                        <p className="font-bold text-indigo-900">Motos separadas no pátio.</p>
                                        <p className="text-sm text-indigo-700">Vá para "Nova Carga" para gerar o transporte.</p>
                                    </div>
                                    <Link href={route('romaneios.create')} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-indigo-700 transition">
                                        Ir para Montagem de Carga &rarr;
                                    </Link>
                                </div>
                            )}

                            {pedido.status === 'expedido' && (
                                <div className="flex items-center justify-between bg-orange-50 p-4 rounded-lg border border-orange-200">
                                    <div>
                                        <p className="font-bold text-orange-800">Carga montada!</p>
                                        <p className="text-sm text-orange-600">Veículo aguardando liberação na portaria.</p>
                                    </div>
                                    <button onClick={avancarSaida} className="bg-orange-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-600 shadow transition">
                                        🚛 Confirmar Saída
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- MENSAGEM DE SUCESSO --- */}
                    {pedido.status === 'concluido' && (
                        <div className="text-center mt-6">
                            <div className="bg-green-50 p-6 rounded-xl border border-green-200 inline-block shadow-sm">
                                <h3 className="text-green-800 font-bold text-xl mb-2">Pedido Concluído! 🎉</h3>
                                <p className="text-green-700 text-sm">A entrega foi registrada e o estoque atualizado.</p>
                                {pedido.comprovante_url && (
                                    <div className="mt-4">
                                        <a href={pedido.comprovante_url} target="_blank" className="bg-white text-green-700 px-4 py-2 rounded-lg border border-green-300 font-bold hover:bg-green-50 transition shadow-sm">
                                            📄 Ver Comprovante Assinado
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- LOGS DE HISTÓRICO --- */}
                    <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-200 mt-6">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                            <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">📜 Histórico de Eventos</h3>
                        </div>
                        <ul className="divide-y divide-gray-100">
                            {pedido.logs?.map((log) => (
                                <li key={log.id} className="p-4 hover:bg-gray-50 flex gap-4 items-start transition">
                                    <div className="w-2 h-2 mt-1.5 bg-blue-400 rounded-full ring-4 ring-blue-50"></div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-800">{log.titulo}</p>
                                        <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap leading-relaxed">
                                            {log.descricao}
                                        </p>
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-mono whitespace-nowrap">
                                        {new Date(log.created_at).toLocaleString('pt-BR')}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* --- BOTÃO FLUTUANTE DE FINALIZAÇÃO --- */}
            {pedido.status === 'em_transito' && (auth.user.perfil === 'cd' || auth.user.id === pedido.user_id) && (
                <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40">
                    <div className="max-w-4xl mx-auto flex gap-4">
                        <button 
                            onClick={handleConferenciaEntrega}
                            disabled={compressing}
                            className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold text-lg py-3 px-8 rounded-xl shadow-lg transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                        >
                            {compressing ? 'Enviando...' : (
                                <>
                                    <span>📝</span> CONFERIR E FINALIZAR ENTREGA
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* --- CHAT --- */}
            {pedido.status !== 'cancelado' && <ChatBox pedidoId={pedido.id} />}
            
        </AuthenticatedLayout>
    );
}

// --- HELPERS AUXILIARES ---

function getColorHex(corNome) {
    if (!corNome) return '#ccc';
    const map = {
        'vermelho': '#ef4444', 'vermelha': '#ef4444',
        'preto': '#1f2937', 'preta': '#1f2937',
        'branco': '#ffffff', 'branca': '#ffffff',
        'azul': '#3b82f6',
        'prata': '#9ca3af',
        'cinza': '#6b7280',
        'amarelo': '#eab308',
    };
    return map[corNome.toLowerCase()] || '#eee';
}

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

    return <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${config.bg} border`}>{config.label}</span>;
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
        <div className="w-full py-6 mb-2 overflow-x-auto">
            <div className="flex items-center justify-between relative min-w-[300px]">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 -z-10 rounded"></div>
                {status !== 'cancelado' && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-green-500 -z-10 rounded transition-all duration-700 ease-out" style={{ width: `${(current / (steps.length - 1)) * 100}%` }}></div>
                )}
                {steps.map((step, index) => {
                    const done = status !== 'cancelado' && index <= current;
                    return (
                        <div key={step.id} className="flex flex-col items-center relative bg-gray-50 px-1">
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