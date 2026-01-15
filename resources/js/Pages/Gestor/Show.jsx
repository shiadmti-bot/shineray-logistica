import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import ChatBox from '@/Components/ChatBox'; // <--- IMPORTANTE: Importar o Chat

// Recebe 'mensagemChat' do controller
export default function GestorShow({ auth, pedido, mensagemChat }) {
    
    const [aprovacoes, setAprovacoes] = useState(
        pedido.motos.reduce((acc, moto) => ({ ...acc, [moto.id]: true }), {})
    );
    const [motivosEspecificos, setMotivosEspecificos] = useState({});
    const [justificativaGeral, setJustificativaGeral] = useState('');
    const { processing } = useForm();

    const opcoesRejeicao = [
        "Chassi Incorreto / Erro Digitação",
        "Moto Não Liberada / Bloqueada",
        "Excedente de Estoque",
        "Venda Cancelada",
        "Outros"
    ];

    // --- POPUP INTELIGENTE ---
    useEffect(() => {
        // Prioridade 1: Mensagem do Chat (Mais urgente)
        if (mensagemChat) {
            Swal.fire({
                title: `💬 Mensagem de ${pedido.user.name}`,
                text: `"${mensagemChat.content}"`, // Mostra o conteúdo da mensagem
                icon: 'info',
                confirmButtonText: 'Responder no Chat',
                confirmButtonColor: '#7e22ce',
                showCancelButton: true,
                cancelButtonText: 'Fechar',
                backdrop: `rgba(126, 34, 206, 0.4)` // Fundo roxo suave
            }).then((result) => {
                if (result.isConfirmed) {
                    // O usuário clicou em responder, o chat está no canto da tela
                    const chatBtn = document.querySelector('button[aria-label="Abrir Chat"]'); // Opcional: focar no botão
                }
            });
        } 
        // Prioridade 2: Observação do Pedido (Se não tiver chat)
        else if (pedido.observacao) {
            Swal.fire({
                title: '📢 Observação da Loja',
                text: pedido.observacao,
                icon: 'warning',
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#fbbf24', // Amarelo
                color: '#713f12'
            });
        }
    }, []); 

    // ... (Lógica de toggle e submit continua igual) ...
    const toggleAprovacao = (id) => {
        setAprovacoes(prev => ({ ...prev, [id]: !prev[id] }));
        if (!aprovacoes[id] === true) {
            const novosMotivos = { ...motivosEspecificos };
            delete novosMotivos[id];
            setMotivosEspecificos(novosMotivos);
        }
    };

    const handleMotivoChange = (id, motivo) => {
        setMotivosEspecificos(prev => ({ ...prev, [id]: motivo }));
    };

    const handleFinalizar = () => {
        const rejeitadasIds = Object.keys(aprovacoes).filter(id => !aprovacoes[id]).map(Number);
        const motivosFaltantes = rejeitadasIds.some(id => !motivosEspecificos[id]);
        
        if (rejeitadasIds.length > 0 && motivosFaltantes) {
            Swal.fire('Obrigatório', 'Selecione o motivo da rejeição para todas as motos cortadas.', 'warning');
            return;
        }

        Swal.fire({
            title: 'Confirmar Análise?',
            text: `Aprovadas: ${pedido.motos.length - rejeitadasIds.length} | Cortadas: ${rejeitadasIds.length}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, Processar',
            confirmButtonColor: '#7e22ce'
        }).then((result) => {
            if (result.isConfirmed) {
                router.post(route('gestor.aprovar', pedido.id), {
                    rejeitadas: rejeitadasIds,
                    motivos: motivosEspecificos,
                    justificativa: justificativaGeral
                });
            }
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-xl text-purple-800">Análise de Pedido #{pedido.id}</h2>}>
            <Head title={`Análise #${pedido.id}`} />

            <div className="py-8 bg-gray-50 min-h-screen pb-40">
                <div className="max-w-4xl mx-auto px-4">
                    
                    {/* Resumo */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm mb-6 border-l-8 border-purple-600">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase">Solicitante</p>
                                <h3 className="text-2xl font-black text-gray-800">{pedido.user.filial}</h3>
                                <p className="text-gray-600">{pedido.user.name}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-gray-400 uppercase">Data</p>
                                <p className="font-mono text-gray-700">{new Date(pedido.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* LISTA DE MOTOS (Mantenha o código visual Enterprise que fizemos) */}
                    <div className="space-y-4 mb-8">
                        {pedido.motos.map((moto) => {
                            const isApproved = aprovacoes[moto.id];
                            return (
                                <div key={moto.id} className="transition-all duration-300">
                                    <div 
                                        onClick={() => toggleAprovacao(moto.id)}
                                        className={`relative p-5 rounded-xl border-2 cursor-pointer select-none flex flex-col md:flex-row justify-between md:items-center gap-4 transition-all duration-200 group ${isApproved ? 'bg-white border-gray-100 hover:border-green-200 shadow-sm' : 'bg-red-50 border-red-200 shadow-inner'}`}
                                    >
                                        {/* (Conteúdo do Card igual ao anterior) */}
                                        <div className="flex items-start gap-4">
                                            <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-bold transition-transform duration-300 ${isApproved ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                {isApproved ? '✓' : '✕'}
                                            </div>
                                            <div>
                                                <h4 className={`font-mono text-lg font-bold tracking-wide ${isApproved ? 'text-gray-800' : 'text-red-800 line-through decoration-2 opacity-60'}`}>{moto.chassi}</h4>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className="text-sm font-bold text-gray-600">{moto.modelo}</span>
                                                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 uppercase">{moto.cor}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            {moto.motivo_solicitacao && <span className="text-[10px] font-bold tracking-wider text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded uppercase">{moto.motivo_solicitacao}</span>}
                                            <span className={`text-xs font-bold uppercase tracking-widest ${isApproved ? 'text-green-600' : 'text-red-600'}`}>{isApproved ? 'APROVADO' : 'REJEITAR'}</span>
                                        </div>
                                    </div>
                                    {!isApproved && (
                                        <div className="mt-2 mx-2 p-4 bg-white border border-red-100 rounded-lg shadow-sm border-l-4 border-l-red-400 animate-fade-in-down">
                                            <div className="flex flex-col md:flex-row md:items-center gap-3">
                                                <div className="flex-1">
                                                    <label className="text-xs font-bold text-red-700 uppercase mb-1 block">Motivo da Rejeição</label>
                                                    <select 
                                                        className="w-full border-gray-300 rounded-md text-sm focus:border-red-500 focus:ring-red-500 bg-gray-50"
                                                        value={motivosEspecificos[moto.id] || ''}
                                                        onChange={(e) => handleMotivoChange(moto.id, e.target.value)}
                                                    >
                                                        <option value="" disabled>Selecione...</option>
                                                        {opcoesRejeicao.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* OBS GERAL */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <label className="block text-sm font-bold text-gray-700 mb-2">📝 Observações Gerais</label>
                        <textarea className="w-full border-gray-300 rounded-lg text-sm" rows="2" placeholder="Recado para a loja..." value={justificativaGeral} onChange={(e) => setJustificativaGeral(e.target.value)}></textarea>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
                <div className="max-w-4xl mx-auto">
                    <button onClick={handleFinalizar} disabled={processing} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg py-3 px-8 rounded-xl shadow-lg transition flex items-center justify-center gap-2">
                        <span>🛡️</span> {processing ? 'Processando...' : 'FINALIZAR ANÁLISE'}
                    </button>
                </div>
            </div>

            {/* --- AQUI ESTAVA FALTANDO O CHAT PARA O GESTOR --- */}
            <ChatBox pedidoId={pedido.id} />
            {/* ------------------------------------------------ */}

        </AuthenticatedLayout>
    );
}