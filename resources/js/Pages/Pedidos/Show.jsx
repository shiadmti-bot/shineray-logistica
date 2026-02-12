import ChatBox from '@/Components/ChatBox';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';

export default function PedidoShow({ auth, pedido }) {
    
    // --- 1. CONFIGURAÇÕES E PERMISSÕES ---
    const [compressing, setCompressing] = useState(false);
    const formAcoes = useForm({}); 

    // Identifica o Papel do Usuário
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
            title: 'Solicitar Retirada/Corte',
            text: pergunta,
            input: 'text',
            inputPlaceholder: 'Motivo (Ex: Avaria no estoque, Erro de sistema...)',
            showCancelButton: true, confirmButtonText: 'Enviar Solicitação', confirmButtonColor: '#d33',
            inputValidator: (value) => !value && 'Você precisa escrever o motivo!'
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                router.post(route('motos.solicitarRetirada', motoId), { motivo: result.value }, {
                    onSuccess: () => Swal.fire('Enviado!', 'Solicitação de corte enviada para análise.', 'success')
                });
            }
        });
    };

    // --- 4. CONFERÊNCIA DE ENTREGA ---
    const handleConferenciaEntrega = () => {
        Swal.fire({
            title: '<h3 class="font-bold text-gray-800">Conferência de Entrega 📋</h3>',
            width: '650px',
            html: `
                <div class="text-left text-sm">
                    <div class="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4 text-blue-800">
                        <strong>Instruções:</strong> Verifique fisicamente as motos. Se houver avaria, tire foto. Por fim, anexe o canhoto assinado.
                    </div>
                    <div class="bg-gray-50 rounded-lg border border-gray-200 mb-4 max-h-[250px] overflow-y-auto p-2 custom-scrollbar">
                        ${pedido.motos.map(m => `
                            <div class="mb-2 bg-white p-3 rounded shadow-sm border border-gray-100 flex flex-col gap-2">
                                <div class="flex justify-between items-center">
                                    <span class="font-bold text-gray-800">🏍️ ${m.modelo}</span>
                                    <span class="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">${m.chassi}</span>
                                </div>
                                ${!m.estorno_pendente ? `
                                    <div class="grid grid-cols-1 gap-2">
                                        <input type="text" id="avaria-texto-${m.id}" class="swal2-input w-full text-xs h-8 m-0 focus:ring-red-500" placeholder="Houve avaria? Descreva aqui...">
                                        <label class="flex items-center justify-center w-full text-xs text-gray-500 border border-dashed border-gray-300 p-2 rounded cursor-pointer hover:bg-gray-50 transition">
                                            <span id="label-foto-${m.id}" class="flex items-center gap-2">📸 Anexar Foto da Avaria</span>
                                            <input type="file" id="avaria-foto-${m.id}" class="hidden" accept="image/*" onchange="document.getElementById('label-foto-${m.id}').innerHTML = '✅ Foto Selecionada'; document.getElementById('label-foto-${m.id}').classList.add('text-green-600', 'font-bold');">
                                        </label>
                                    </div>
                                ` : '<span class="text-xs text-red-600 bg-red-50 px-2 py-1 rounded font-bold text-center">🚫 Em análise de corte/estorno</span>'}
                            </div>
                        `).join('')}
                    </div>
                    <div class="p-4 bg-green-50 rounded-lg border border-green-200">
                        <label class="block font-bold text-green-900 mb-2 text-xs uppercase tracking-wide">📄 Foto do Romaneio/Canhoto Assinado *</label>
                        <input type="file" id="upload-comprovante" class="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-100 file:text-green-700 hover:file:bg-green-200 cursor-pointer" accept="image/*,application/pdf">
                    </div>
                </div>
            `,
            showCancelButton: true, confirmButtonText: 'Confirmar Recebimento', confirmButtonColor: '#16a34a', cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const file = document.getElementById('upload-comprovante').files[0];
                if (!file) return Swal.showValidationMessage('O comprovante assinado é obrigatório!');
                
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
        Swal.fire({ title: 'Enviando...', html: 'Aguarde enquanto processamos as imagens.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        router.post(route('pedidos.finalizar', pedido.id), {
            _method: 'post', arquivo_romaneio: file, avarias, fotos_avarias: fotos
        }, {
            forceFormData: true,
            onSuccess: () => { setCompressing(false); Swal.fire('Sucesso!', 'Recebimento confirmado.', 'success'); },
            onError: (err) => { setCompressing(false); Swal.fire('Erro', 'Falha ao enviar.', 'error'); }
        });
    };

    // --- 5. AÇÕES DE FLUXO ---
    const confirmarSeparacao = () => {
        const texto = isTransferencia 
            ? "Confirma que as motos foram separadas e estão prontas para coleta?"
            : "Confirma a separação física destas motos no CD?";
        Swal.fire({ title: 'Confirmar Separação', text: texto, icon: 'question', showCancelButton: true, confirmButtonText: 'Sim', confirmButtonColor: '#2563eb' })
            .then((res) => { if(res.isConfirmed) formAcoes.post(route('pedidos.separar', pedido.id)); });
    };

    const confirmarSaida = () => { 
        Swal.fire({ title: 'Liberar Saída?', text: 'Mudar status para "Em Trânsito"?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim', confirmButtonColor: '#f97316' })
            .then((res) => { if(res.isConfirmed) formAcoes.post(route('pedidos.saida', pedido.id)); });
    };

    const handleRejeitar = () => {
        Swal.fire({ title: 'Rejeitar Pedido', input: 'textarea', inputPlaceholder: 'Motivo...', showCancelButton: true, confirmButtonText: 'Rejeitar', confirmButtonColor: '#ef4444' })
            .then((res) => { if (res.isConfirmed && res.value) router.post(route('pedidos.rejeitar', pedido.id), { motivo: res.value }); });
    };

    // --- RENDER ---
    return (
        <AuthenticatedLayout user={auth.user} header={
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h2 className="font-black text-2xl text-gray-800 tracking-tight">
                        PEDIDO <span className="text-red-600">#{pedido.id}</span>
                    </h2>
                    <TipoBadge isTransferencia={isTransferencia} />
                </div>
                <BadgeStatus status={pedido.status} />
            </div>
        }>
            <Head title={`Pedido #${pedido.id}`} />

            <div className="py-8 bg-gray-100 min-h-screen pb-32 font-sans">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6 px-4">
                    
                    {/* --- 1. CARD DE DETALHES --- */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                        {/* Origem */}
                        <div className="p-6 bg-slate-50/50">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Origem (Sai De)
                            </h3>
                            <div className="text-lg font-bold text-gray-800 leading-tight">
                                {pedido.origem ? pedido.origem.filial : 'Centro de Distribuição'}
                            </div>
                            <div className="text-sm text-gray-500 mt-1 font-medium">{pedido.origem?.name || 'Matriz Shineray Brasil'}</div>
                            
                            {pedido.previsao_coleta && (
                                <div className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-orange-700 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
                                    <span>📅</span> Previsão Coleta: {new Date(pedido.previsao_coleta).toLocaleDateString()}
                                </div>
                            )}
                        </div>

                        {/* Destino */}
                        <div className="p-6">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span> Destino (Vai Para)
                            </h3>
                            <div className="text-lg font-bold text-gray-800 leading-tight">{pedido.user.filial}</div>
                            <div className="text-sm text-gray-500 mt-1 font-medium">{pedido.user.name}</div>
                        </div>

                        {/* Info Logística */}
                        <div className="p-6 bg-slate-50/50 flex flex-col justify-center gap-1">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Data Criação</span>
                                <span className="text-sm font-bold text-gray-700">{new Date(pedido.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Carga</span>
                                {pedido.romaneio_id ? (
                                    <Link href={route('romaneios.show', pedido.romaneio_id)} className="flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-blue-700 transition">
                                        📄 #{pedido.romaneio_id}
                                    </Link>
                                ) : (
                                    <span className="text-xs italic text-gray-400">Aguardando...</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* --- 2. ALERTAS --- */}
                    {pedido.status === 'aguardando_coleta' && (
                        <div className="bg-orange-50 border-l-4 border-orange-500 p-5 rounded-r-lg shadow-sm flex items-start gap-4">
                            <div className="bg-orange-100 p-2 rounded-full text-orange-600">🛑</div>
                            <div>
                                <h4 className="font-bold text-orange-900 text-sm uppercase tracking-wide">Aguardando Coleta</h4>
                                <p className="text-sm text-orange-800 mt-1">As motos devem estar separadas para coleta.</p>
                            </div>
                        </div>
                    )}

                    {/* --- 3. TIMELINE --- */}
                    <Timeline status={pedido.status} isTransferencia={isTransferencia} />

                    {/* --- 4. LISTA DE ITENS (LÓGICA GESTOR APLICADA) --- */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 bg-gray-50/80 border-b border-gray-200 flex justify-between items-center backdrop-blur-sm">
                            <h3 className="font-black text-gray-800 text-sm uppercase tracking-wide flex items-center gap-2">
                                <span>🏍️</span> Motocicletas
                            </h3>
                            <span className="bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                                {pedido.motos?.length || 0} Unidades
                            </span>
                        </div>

                        <div className="divide-y divide-gray-100">
                            {(pedido.motos.length > 0 ? pedido.motos : (pedido.itens || [])).map((item, idx) => {
                                
                                // === APLICAÇÃO DA LÓGICA DO GESTOR ===
                                // GestorShow usa: {moto.motivo_solicitacao || 'Venda'}
                                // Aqui replicamos isso, com um fallback de segurança
                                const motivoReal = item.motivo_solicitacao || item.motivo || 'Venda';

                                return (
                                    <div key={item.id || idx} className="group p-5 flex flex-col md:flex-row items-center gap-6 hover:bg-slate-50 transition duration-150 ease-in-out">
                                        
                                        <div className="flex items-center gap-5 flex-1 w-full md:w-auto">
                                            <div className="h-14 w-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-2xl shadow-sm flex-shrink-0 group-hover:scale-105 transition">
                                                🏍️
                                            </div>
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="font-extrabold text-gray-900 text-base">{item.modelo}</h4>
                                                    {item.chassi && (
                                                        <span className="font-mono text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 tracking-wider">
                                                            {item.chassi}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-2 px-2 py-1 rounded-full border border-gray-200 bg-white shadow-sm w-fit">
                                                        <span className="h-3 w-3 rounded-full border border-gray-300 shadow-inner" style={{ backgroundColor: getColorHex(item.cor) }}></span>
                                                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">{item.cor || 'COR NÃO DEFINIDA'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-6 md:pl-6 md:border-l border-gray-100">
                                            
                                            {/* MOTIVO (USANDO LÓGICA GESTOR) */}
                                            <div className="flex flex-col items-start md:items-end min-w-[140px]">
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Motivo</span>
                                                <span className={`px-3 py-1.5 rounded-lg border text-[10px] uppercase font-black tracking-wide shadow-sm whitespace-nowrap ${getMotivoStyle(motivoReal)}`}>
                                                    {motivoReal}
                                                </span>
                                            </div>

                                            <div className="flex items-center">
                                                {item.status === 'avariado' ? (
                                                    <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-3 py-1.5 rounded-lg border border-red-200 font-bold uppercase">
                                                        ⚠️ Avariado
                                                    </span>
                                                ) : (
                                                    (souCD || souOrigem) && ['solicitado', 'separado'].includes(item.status) && (
                                                        <button 
                                                            onClick={() => handleSolicitarRetirada(item.id, 'Motivo do corte?')} 
                                                            className="group/btn flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition shadow-sm"
                                                            title="Cortar Item"
                                                        >
                                                            <span className="text-sm">✂️</span>
                                                            <span className="text-xs font-bold hidden md:inline">Cortar</span>
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* --- 5. AÇÕES GLOBAIS --- */}
                    {pedido.status !== 'cancelado' && pedido.status !== 'concluido' && (
                        <div className="bg-white p-6 shadow-lg rounded-2xl border-l-4 border-blue-600 mt-8">
                            <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
                                <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">⚡</span> Ações
                            </h3>
                            <div className="flex flex-wrap gap-4">
                                {pedido.status === 'solicitado' && (souOrigem || (souCD && !isTransferencia) || souAdmin) && (
                                    <>
                                        <button onClick={confirmarSeparacao} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 shadow-md transition">✅ Confirmar Separação</button>
                                        <button onClick={handleRejeitar} className="flex-1 bg-white border-2 border-red-100 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-50 hover:border-red-200 transition">🚫 Rejeitar</button>
                                    </>
                                )}
                                {pedido.status === 'expedido' && (souCD || souAdmin) && (
                                    <button onClick={confirmarSaida} className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 shadow-md transition">🚛 Confirmar Saída Manual</button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- 6. HISTÓRICO --- */}
                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <h3 className="font-bold text-gray-400 text-xs uppercase mb-6 tracking-widest">Linha do Tempo</h3>
                        <div className="space-y-6 pl-2">
                            {pedido.logs?.map((log, i) => (
                                <div key={log.id} className="flex gap-4 relative group">
                                    {i !== pedido.logs.length - 1 && (<div className="absolute left-[5px] top-6 w-0.5 h-full bg-gray-200 group-last:hidden"></div>)}
                                    <div className="relative z-10 flex-shrink-0 mt-1"><div className="h-3 w-3 rounded-full bg-gray-300 ring-4 ring-white group-hover:bg-blue-500 transition"></div></div>
                                    <div>
                                        <p className="text-xs text-gray-400 font-mono mb-0.5">{new Date(log.created_at).toLocaleString()}</p>
                                        <p className="text-sm font-bold text-gray-800">{log.titulo}</p>
                                        <p className="text-sm text-gray-500 leading-relaxed">{log.descricao}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* FAB */}
            {['em_transito', 'expedido'].includes(pedido.status) && (souDestino || souCD) && (
                <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-50 pointer-events-none">
                    <button onClick={handleConferenciaEntrega} disabled={compressing} className="pointer-events-auto bg-gray-900 hover:bg-black text-white font-bold py-4 px-8 rounded-full shadow-2xl transition transform hover:-translate-y-1 hover:scale-105 flex items-center gap-3 border-4 border-white/20 backdrop-blur-md">
                        {compressing ? <span className="animate-spin">⏳</span> : <span className="text-xl">📝</span>} <span className="uppercase tracking-wide text-sm">Conferir e Finalizar Entrega</span>
                    </button>
                </div>
            )}

            <ChatBox pedidoId={pedido.id} />
        </AuthenticatedLayout>
    );
}

// --- HELPERS ---
function getMotivoStyle(motivo) {
    const m = (motivo || '').toLowerCase();
    if (m.includes('venda')) return 'bg-green-50 text-green-700 border-green-200';
    if (m.includes('garantia') || m.includes('frota')) return 'bg-red-50 text-red-700 border-red-200';
    if (m.includes('exposição')) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
}

function getColorHex(cor) {
    if (!cor) return '#e5e7eb';
    const c = cor.toLowerCase().trim();
    const map = {
        'vermelho': '#ef4444', 'vermelha': '#ef4444',
        'azul': '#3b82f6', 'azul escuro': '#1e3a8a',
        'preto': '#111827', 'preta': '#111827',
        'branco': '#ffffff', 'branca': '#ffffff',
        'prata': '#9ca3af', 'cinza': '#6b7280',
        'amarelo': '#eab308', 'amarela': '#eab308',
        'bege': '#f5f5dc', 'verde': '#22c55e',
        'laranja': '#f97316', 'marrom': '#78350f'
    };
    return map[c] || '#e5e7eb';
}

function TipoBadge({ isTransferencia }) {
    return isTransferencia 
        ? <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-1 rounded border border-orange-200 font-bold uppercase tracking-wide flex items-center gap-1">🔁 Transferência</span>
        : <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-1 rounded border border-blue-200 font-bold uppercase tracking-wide flex items-center gap-1">🏭 Reposição CD</span>;
}

function BadgeStatus({ status }) {
    const map = {
        'em_analise': 'bg-purple-100 text-purple-800 border-purple-200',
        'solicitado': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'separado': 'bg-blue-100 text-blue-800 border-blue-200',
        'aguardando_coleta': 'bg-orange-100 text-orange-800 border-orange-300',
        'em_transito': 'bg-orange-600 text-white border-orange-700 shadow-md',
        'em_transito_cd': 'bg-indigo-600 text-white border-indigo-700 shadow-md',
        'no_cd': 'bg-purple-600 text-white border-purple-700 shadow-md',
        'concluido': 'bg-green-100 text-green-800 border-green-200',
        'cancelado': 'bg-red-100 text-red-800 border-red-200'
    };
    return <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase border ${map[status] || 'bg-gray-100'}`}>{status?.replace(/_/g, ' ')}</span>;
}

function Timeline({ status, isTransferencia }) {
    let steps = [];
    if (isTransferencia) {
        steps = [{ id: 'solicitado', label: 'Aprovado', icon: '📝' }, { id: 'separado', label: 'Separado', icon: '📦' }, { id: 'aguardando_coleta', label: 'Aguard. Coleta', icon: '🛑' }, { id: 'em_transito', label: 'Em Trânsito', icon: '🚚' }, { id: 'concluido', label: 'Entregue', icon: '🏁' }];
    } else {
        steps = [{ id: 'solicitado', label: 'Solicitado', icon: '📝' }, { id: 'separado', label: 'Separado', icon: '📦' }, { id: 'expedido', label: 'Expedido', icon: '🏗️' }, { id: 'em_transito', label: 'Em Trânsito', icon: '🚚' }, { id: 'concluido', label: 'Entregue', icon: '🏁' }];
    }
    const statusWeight = { em_analise: 0, solicitado: 1, separado: 2, aguardando_coleta: 3, expedido: 3, em_transito_cd: 3.5, no_cd: 3.8, em_transito: 4, concluido: 5, cancelado: -1 };
    const currentWeight = statusWeight[status] || 0;
    const maxWeight = 5;

    return (
        <div className="w-full py-8">
            <div className="flex items-center justify-between relative w-full px-2">
                <div className="absolute left-0 top-[15px] w-full h-1 bg-gray-200 -z-10 rounded-full"></div>
                {status !== 'cancelado' && <div className="absolute left-0 top-[15px] h-1 bg-green-500 -z-10 rounded-full transition-all duration-1000 ease-out" style={{ width: `${(currentWeight / maxWeight) * 100}%` }}></div>}
                {steps.map((step, index) => {
                    const stepWeight = statusWeight[step.id];
                    const isActive = status !== 'cancelado' && currentWeight >= stepWeight;
                    return (
                        <div key={step.id} className="flex flex-col items-center relative group cursor-default">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-4 transition-all duration-500 z-20 ${isActive ? 'border-green-500 bg-white text-green-600 scale-110 shadow-lg' : 'border-gray-200 bg-gray-100 text-gray-300'}`}>{isActive ? '✓' : (index + 1)}</div>
                            <span className={`absolute top-10 w-24 text-center text-[10px] font-bold uppercase transition-all duration-300 ${isActive ? 'text-green-700 translate-y-0 opacity-100' : 'text-gray-400 translate-y-1 opacity-80'}`}>{step.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}