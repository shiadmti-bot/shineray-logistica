import ChatBox from '@/Components/ChatBox';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

export default function PedidoShow({ auth, pedido }) {
    
    // --- 1. CONFIGURAÇÕES E PERMISSÕES ---
    const [compressing, setCompressing] = useState(false);
    const formRejeicao = useForm({ motivo: '' });
    const formAcoes = useForm({}); 

    // Identifica o Papel do Usuário neste Pedido
    const souOrigem = auth.user.id === pedido.origem_user_id; 
    const souDestino = auth.user.id === pedido.user_id;       
    const souCD = auth.user.perfil === 'cd';
    const souAdmin = auth.user.perfil === 'admin' || auth.user.perfil === 'gestor';
    const isTransferencia = !!pedido.origem_user_id;          

    // --- 2. ATUALIZAÇÃO EM TEMPO REAL (ECHO) ---
    useEffect(() => {
        if (!auth.user?.id || !window.Echo) return;
        const channel = window.Echo.private(`App.Models.User.${auth.user.id}`);

        channel.notification((notification) => {
            if (notification.link && notification.link.includes(`/pedidos/${pedido.id}`)) {
                try { const audio = new Audio('/plim.mp3'); audio.play().catch(() => {}); } catch(e) {}

                Swal.fire({
                    toast: true, position: 'top-end', icon: 'info', title: 'Atualização',
                    text: notification.mensagem, timer: 5000, timerProgressBar: true, showConfirmButton: false
                });
                router.reload({ only: ['pedido'] });
            }
        });
        return () => channel.stopListening('Notification');
    }, [pedido.id, auth.user.id]);

    // --- 3. AÇÕES DE SOLICITAÇÃO ---
    const handleSolicitarRetirada = (motoId, pergunta) => {
        Swal.fire({
            title: 'Solicitar Retirada',
            text: pergunta,
            input: 'text',
            inputPlaceholder: 'Motivo (Ex: Avaria, Erro)',
            showCancelButton: true, confirmButtonText: 'Enviar', confirmButtonColor: '#d33'
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                router.post(route('motos.solicitarRetirada', motoId), { motivo: result.value }, {
                    onSuccess: () => Swal.fire('Enviado!', 'Em análise.', 'success')
                });
            }
        });
    };

    // --- 4. CONFERÊNCIA DE ENTREGA ---
    const handleConferenciaEntrega = () => {
        Swal.fire({
            title: 'Conferência de Entrega 📋',
            width: '700px',
            html: `
                <div class="text-left text-sm">
                    <p class="mb-4 text-blue-800 bg-blue-50 p-3 rounded border border-blue-200">
                        <strong>Instruções:</strong> Anexe o <b>Romaneio Assinado</b> e reporte avarias.
                    </p>
                    <div class="bg-gray-50 rounded-lg border border-gray-200 mb-4 max-h-[300px] overflow-y-auto p-2">
                        ${pedido.motos.map(m => `
                            <div class="mb-3 bg-white p-3 rounded shadow-sm border border-gray-100">
                                <div class="font-bold text-gray-800 text-sm flex justify-between">
                                    <span>🏍️ ${m.modelo}</span>
                                    <span class="font-mono text-gray-500">${m.chassi}</span>
                                </div>
                                ${!m.estorno_pendente ? `
                                    <div class="mt-2 grid grid-cols-1 gap-2">
                                        <input type="text" id="avaria-texto-${m.id}" class="swal2-input w-full text-xs h-8 m-0" placeholder="Descreva avaria (opcional)...">
                                        <label class="block w-full text-xs text-gray-500 border border-dashed p-1 text-center cursor-pointer hover:bg-gray-50">
                                            <span id="label-foto-${m.id}">📸 Foto Avaria</span>
                                            <input type="file" id="avaria-foto-${m.id}" class="hidden" accept="image/*" onchange="document.getElementById('label-foto-${m.id}').innerText = '✅ Foto OK'">
                                        </label>
                                    </div>
                                ` : '<span class="text-xs text-orange-600 font-bold">🚫 Em análise de estorno</span>'}
                            </div>
                        `).join('')}
                    </div>
                    <div class="p-3 bg-green-50 rounded border border-green-200">
                        <label class="block font-bold text-green-800 mb-1 text-xs uppercase">📄 Romaneio Assinado *</label>
                        <input type="file" id="upload-comprovante" class="w-full text-xs" accept="image/*,application/pdf">
                    </div>
                </div>
            `,
            showCancelButton: true, confirmButtonText: 'Finalizar', confirmButtonColor: '#16a34a',
            preConfirm: () => {
                const file = document.getElementById('upload-comprovante').files[0];
                if (!file) return Swal.showValidationMessage('O comprovante é obrigatório!');
                
                const avarias = {}, fotos = {};
                pedido.motos.forEach(m => {
                    if (m.estorno_pendente) return;
                    const txt = document.getElementById(`avaria-texto-${m.id}`)?.value;
                    const img = document.getElementById(`avaria-foto-${m.id}`)?.files[0];
                    if (txt) { avarias[m.id] = txt; if (img) fotos[m.id] = img; }
                });
                return { file, avarias, fotos };
            }
        }).then((result) => {
            if (result.isConfirmed) processarEnvio(result.value.file, result.value.avarias, result.value.fotos);
        });
    };

    const processarEnvio = (file, avarias, fotos) => {
        setCompressing(true);
        Swal.fire({ title: 'Enviando...', didOpen: () => Swal.showLoading() });
        
        router.post(route('pedidos.finalizar', pedido.id), {
            _method: 'post', arquivo_romaneio: file, avarias, fotos_avarias: fotos
        }, {
            forceFormData: true,
            onSuccess: () => { setCompressing(false); Swal.fire('Sucesso!', 'Recebimento confirmado.', 'success'); },
            onError: (err) => { setCompressing(false); Swal.fire('Erro', 'Falha no envio.', 'error'); }
        });
    };

    // --- 5. AÇÕES DE FLUXO ---
    const confirmarSeparacao = () => {
        const texto = isTransferencia 
            ? "Motos separadas e prontas para o caminhão coletar?"
            : "Confirma separação no CD?";
        Swal.fire({ title: 'Confirmar Separação?', text: texto, icon: 'question', showCancelButton: true, confirmButtonText: 'Sim' })
            .then((res) => { if(res.isConfirmed) formAcoes.post(route('pedidos.separar', pedido.id)); });
    };

    const confirmarSaida = () => { 
        Swal.fire({ title: 'Confirmar Saída?', text: 'Liberar para trânsito?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim' })
            .then((res) => { if(res.isConfirmed) formAcoes.post(route('pedidos.saida', pedido.id)); });
    };

    const handleRejeitar = () => {
        Swal.fire({ title: 'Rejeitar Pedido', input: 'textarea', inputPlaceholder: 'Motivo...', showCancelButton: true, confirmButtonText: 'Rejeitar', confirmButtonColor: '#d33' })
            .then((res) => { if (res.isConfirmed && res.value) router.post(route('pedidos.rejeitar', pedido.id), { motivo: res.value }); });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="font-bold text-xl text-gray-800">📦 Pedido <span className="text-red-600">#{pedido.id}</span></h2>
                    <TipoBadge isTransferencia={isTransferencia} />
                </div>
                <BadgeStatus status={pedido.status} />
            </div>
        }>
            <Head title={`Pedido #${pedido.id}`} />

            <div className="py-8 bg-gray-50 min-h-screen pb-32">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6 px-4">
                    
                    {/* --- CARD DETALHES V2 --- */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                        
                        {/* 1. ORIGEM */}
                        <div className="p-6 bg-gray-50/30">
                            <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-600 p-1 rounded">📤</span> Origem (Sai De)
                            </h3>
                            <div className="text-lg font-bold text-gray-800 leading-tight">
                                {pedido.origem ? pedido.origem.filial : 'Centro de Distribuição'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{pedido.origem?.name || 'Matriz Shineray'}</div>
                            {pedido.previsao_coleta && (
                                <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                    📅 Coleta: {new Date(pedido.previsao_coleta).toLocaleDateString()}
                                </div>
                            )}
                        </div>

                        {/* 2. DESTINO */}
                        <div className="p-6">
                            <h3 className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                                <span className="bg-green-100 text-green-600 p-1 rounded">📥</span> Destino (Vai Para)
                            </h3>
                            <div className="text-lg font-bold text-gray-800 leading-tight">{pedido.user.filial}</div>
                            <div className="text-xs text-gray-500 mt-1">{pedido.user.name}</div>
                        </div>

                        {/* 3. CONTEXTO & MOTIVO (Atualizado) */}
                        <div className="p-6 flex flex-col justify-center gap-4 bg-gray-50/30">
                            
                            {/* Motivo da Solicitação */}
                            <div>
                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">
                                    Motivo da Solicitação
                                </span>
                                <div className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-xs font-bold shadow-sm ${getMotivoStyle(pedido.motivo_solicitacao)}`}>
                                    {pedido.motivo_solicitacao || 'Estoque Regular (Giro)'}
                                </div>
                            </div>

                            {/* Info de Carga */}
                            <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                                <div>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Criação</span>
                                    <span className="text-xs font-medium text-gray-700">{new Date(pedido.created_at).toLocaleDateString()}</span>
                                </div>
                                
                                {pedido.romaneio_id ? (
                                    <Link href={route('romaneios.show', pedido.romaneio_id)} className="group flex flex-col items-end">
                                        <span className="text-[10px] text-blue-500 font-bold uppercase group-hover:underline">Ver Carga ↗</span>
                                        <span className="text-sm font-black text-gray-800 bg-blue-50 px-2 rounded border border-blue-100">#{pedido.romaneio_id}</span>
                                    </Link>
                                ) : (
                                    <div className="text-right">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Status Carga</span>
                                        <span className="text-xs text-gray-500 italic">Aguardando vínculo</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* --- ALERTAS DE STATUS (V2) --- */}
                    {pedido.status === 'aguardando_coleta' && (
                        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded shadow-sm animate-fade-in-down flex items-start gap-3">
                            <span className="text-2xl pt-1">🛑</span>
                            <div>
                                <h4 className="font-bold text-orange-900">Aguardando Coleta (Milk Run)</h4>
                                <p className="text-sm text-orange-800 leading-relaxed">
                                    {souOrigem 
                                        ? "Suas motos devem estar separadas no pátio. O motorista passará para coletar." 
                                        : "O pedido já foi separado na origem e está aguardando o caminhão passar."}
                                </p>
                            </div>
                        </div>
                    )}

                    {(pedido.status === 'no_cd' || pedido.status === 'em_transito_cd') && (
                        <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded shadow-sm flex items-start gap-3">
                            <span className="text-2xl pt-1">🏭</span>
                            <div>
                                <h4 className="font-bold text-purple-900">Em Transbordo (Hub & Spoke)</h4>
                                <p className="text-sm text-purple-800">
                                    Pedido em processamento logístico no Centro de Distribuição. Aguarde a rota final.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* TIMELINE VISUAL */}
                    <Timeline status={pedido.status} isTransferencia={isTransferencia} />

                    {/* --- TABELA DE ITENS --- */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide flex items-center gap-2">
                                <span>🏍️</span> Itens do Pedido
                            </h3>
                            <span className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                {pedido.motos?.length || 0} Unidades
                            </span>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {(pedido.motos.length > 0 ? pedido.motos : (pedido.itens || [])).map((item, idx) => (
                                <div key={item.id || idx} className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 hover:bg-gray-50 transition">
                                    <div className="flex items-center gap-4 flex-1 w-full">
                                        <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg shadow-inner">🏍️</div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-sm">{item.modelo}</h4>
                                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                                <div className="flex items-center gap-1">
                                                    <span className="h-2 w-2 rounded-full border border-gray-300" style={{ backgroundColor: getColorHex(item.cor) }}></span>
                                                    <span className="uppercase font-medium">{item.cor}</span>
                                                </div>
                                                {item.chassi && (
                                                    <span className="font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                        {item.chassi}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Ações por Item */}
                                    <div className="flex gap-2 w-full md:w-auto justify-end">
                                        {item.status === 'avariado' && (
                                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded border border-red-200 font-bold uppercase">
                                                ⚠️ Avariado
                                            </span>
                                        )}
                                        
                                        {(souCD || souOrigem) && ['solicitado', 'separado'].includes(item.status) && (
                                            <button 
                                                onClick={() => handleSolicitarRetirada(item.id, 'Motivo do corte (Furo/Avaria)?')} 
                                                className="text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 font-bold transition"
                                            >
                                                ✂️ Corte
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* --- PAINEL DE AÇÃO --- */}
                    {pedido.status !== 'cancelado' && pedido.status !== 'concluido' && (
                        <div className="bg-white p-6 shadow-sm rounded-xl border-l-4 border-blue-600 mt-6">
                            <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
                                <span>⚡</span> Ações Disponíveis
                            </h3>
                            
                            {pedido.status === 'solicitado' && (souOrigem || (souCD && !isTransferencia) || souAdmin) && (
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button onClick={confirmarSeparacao} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 shadow transition flex-1">
                                        ✅ Confirmar Separação
                                    </button>
                                    <button onClick={handleRejeitar} className="border border-red-500 text-red-600 px-6 py-3 rounded-lg font-bold hover:bg-red-50 transition">
                                        Rejeitar Pedido
                                    </button>
                                </div>
                            )}

                            {pedido.status === 'expedido' && (souCD || souAdmin) && (
                                <button onClick={confirmarSaida} className="bg-orange-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-600 shadow w-full sm:w-auto">
                                    🚛 Confirmar Saída Manual
                                </button>
                            )}

                            {/* Feedbacks de Estado */}
                            {pedido.status === 'em_analise' && <p className="text-gray-500 italic text-sm">Aguardando aprovação do Gestor Comercial.</p>}
                            {pedido.status === 'separado' && <p className="text-indigo-600 font-bold text-sm">Motos separadas. Aguardando alocação em Carga/Romaneio.</p>}
                            {pedido.status === 'aguardando_coleta' && <p className="text-orange-600 font-bold text-sm">Aguardando motorista realizar o Check-in de coleta.</p>}
                        </div>
                    )}

                    {/* HISTÓRICO COMPACTO */}
                    <div className="mt-8 border-t border-gray-200 pt-6">
                        <h3 className="font-bold text-gray-500 text-xs uppercase mb-4 tracking-wider">Histórico de Eventos</h3>
                        <ul className="space-y-4">
                            {pedido.logs?.map(log => (
                                <li key={log.id} className="flex gap-4 group">
                                    <div className="flex flex-col items-center">
                                        <div className="h-2 w-2 rounded-full bg-gray-300 group-hover:bg-blue-500 transition"></div>
                                        <div className="h-full w-px bg-gray-200 my-1 group-last:hidden"></div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-mono mb-0.5">{new Date(log.created_at).toLocaleString()}</p>
                                        <p className="text-sm font-bold text-gray-700">{log.titulo}</p>
                                        <p className="text-xs text-gray-500">{log.descricao}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* --- FAB: FINALIZAR (Destino) --- */}
            {['em_transito', 'expedido'].includes(pedido.status) && (souDestino || souCD) && (
                <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-50 pointer-events-none">
                    <button 
                        onClick={handleConferenciaEntrega} 
                        disabled={compressing} 
                        className="pointer-events-auto bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-bold py-3 px-8 rounded-full shadow-xl transition transform hover:-translate-y-1 hover:scale-105 flex items-center gap-2 border-2 border-white ring-2 ring-green-200"
                    >
                        {compressing ? <span className="animate-spin">⏳</span> : '📝'} 
                        <span>CONFERIR E FINALIZAR</span>
                    </button>
                </div>
            )}

            {/* CHAT FLUTUANTE */}
            {pedido.status !== 'cancelado' && <ChatBox pedidoId={pedido.id} />}
        </AuthenticatedLayout>
    );
}

// --- HELPERS VISUAIS (ESTILOS E BADGES) ---

function getMotivoStyle(motivo) {
    const m = (motivo || '').toLowerCase();
    if (m.includes('venda')) return 'bg-green-50 text-green-700 border-green-200';
    if (m.includes('garantia') || m.includes('frota')) return 'bg-red-50 text-red-700 border-red-200';
    if (m.includes('exposição')) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-blue-50 text-blue-700 border-blue-200'; // Estoque / Padrão
}

function TipoBadge({ isTransferencia }) {
    return isTransferencia 
        ? <span className="text-[10px] bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-200 font-bold uppercase tracking-wide">🔁 Transferência</span>
        : <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200 font-bold uppercase tracking-wide">🏭 Reposição</span>;
}

function BadgeStatus({ status }) {
    const map = {
        'em_analise': 'bg-purple-100 text-purple-800 border-purple-200',
        'solicitado': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'separado': 'bg-blue-100 text-blue-800 border-blue-200',
        'aguardando_coleta': 'bg-orange-100 text-orange-800 border-orange-300',
        'em_transito': 'bg-orange-500 text-white border-orange-600 shadow-sm',
        'em_transito_cd': 'bg-indigo-500 text-white border-indigo-600 shadow-sm',
        'no_cd': 'bg-purple-600 text-white border-purple-700 shadow-sm',
        'concluido': 'bg-green-100 text-green-800 border-green-200',
        'cancelado': 'bg-red-100 text-red-800 border-red-200'
    };
    return <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${map[status] || 'bg-gray-100'}`}>{status?.replace(/_/g, ' ')}</span>;
}

function Timeline({ status, isTransferencia }) {
    let steps = [];
    if (isTransferencia) {
        steps = [
            { id: 'solicitado', label: 'Aprovado', icon: '📝' },
            { id: 'separado', label: 'Separado', icon: '📦' },
            { id: 'aguardando_coleta', label: 'Aguard. Coleta', icon: '🛑' },
            { id: 'em_transito', label: 'Em Trânsito', icon: '🚚' },
            { id: 'concluido', label: 'Entregue', icon: '🏁' }
        ];
    } else {
        steps = [
            { id: 'solicitado', label: 'Solicitado', icon: '📝' },
            { id: 'separado', label: 'Separado', icon: '📦' },
            { id: 'expedido', label: 'Expedido', icon: '🏗️' },
            { id: 'em_transito', label: 'Em Trânsito', icon: '🚚' },
            { id: 'concluido', label: 'Entregue', icon: '🏁' }
        ];
    }
    
    const statusWeight = { em_analise: 0, solicitado: 1, separado: 2, aguardando_coleta: 3, expedido: 3, em_transito_cd: 3.5, no_cd: 3.8, em_transito: 4, concluido: 5, cancelado: -1 };
    const currentWeight = statusWeight[status] || 0;
    const maxWeight = 5;

    return (
        <div className="w-full py-6 overflow-x-auto">
            <div className="flex items-center justify-between relative min-w-[320px]">
                <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-200 -z-10 rounded"></div>
                {status !== 'cancelado' && (
                    <div className="absolute left-0 top-1/2 h-1 bg-green-500 -z-10 rounded transition-all duration-700" style={{ width: `${(currentWeight / maxWeight) * 100}%` }}></div>
                )}
                {steps.map((step, index) => {
                    const stepWeight = statusWeight[step.id];
                    const isActive = status !== 'cancelado' && currentWeight >= stepWeight;
                    return (
                        <div key={step.id} className="flex flex-col items-center bg-gray-50 px-1 relative">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs border-2 transition-all duration-300 ${isActive ? 'border-green-500 bg-white text-green-600 scale-110 shadow-sm' : 'border-gray-300 text-gray-300'}`}>
                                {isActive ? step.icon : (index + 1)}
                            </div>
                            <span className={`text-[9px] mt-2 font-bold uppercase transition-colors duration-300 ${isActive ? 'text-green-700' : 'text-gray-400'}`}>{step.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function getColorHex(cor) {
    const map = { vermelho: '#ef4444', azul: '#3b82f6', preto: '#1f2937', branco: '#ffffff', prata: '#9ca3af', cinza: '#6b7280', amarelo: '#eab308' };
    return map[cor?.toLowerCase()] || '#ccc';
}