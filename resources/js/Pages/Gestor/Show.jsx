import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import ChatBox from '@/Components/ChatBox';

export default function GestorShow({ auth, pedido, mensagemChat }) {
    
    // Identifica se é v2 (Transferência) ou v1 (CD)
    const isTransferencia = !!pedido.origem_user_id;
    const nomeOrigem = isTransferencia 
        ? (pedido.origem?.filial ? `${pedido.origem.filial} (${pedido.origem.name})` : 'Loja de Origem') 
        : 'CENTRO DE DISTRIBUIÇÃO (CD)';

    // Calcula destinos reais a partir do pivot
    const destinosReais = [...new Set((pedido.motos || []).map(m => m.pivot?.destino).filter(Boolean))];
    const destinoFinalLabel = destinosReais.length > 0 ? destinosReais.join(', ') : (pedido.user?.filial || 'Matriz');

    // Inicializa todos como aprovados (true)
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
        if (mensagemChat) {
            Swal.fire({
                title: `💬 Mensagem de ${pedido.user.name}`,
                text: `"${mensagemChat.content}"`,
                icon: 'info',
                confirmButtonText: 'Responder no Chat',
                confirmButtonColor: '#7e22ce',
                showCancelButton: true,
                cancelButtonText: 'Fechar'
            });
        } else if (pedido.observacao) {
            Swal.fire({
                title: '📢 Observação da Loja',
                text: pedido.observacao,
                icon: 'warning',
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#fbbf24',
                color: '#713f12'
            });
        }
    }, [mensagemChat, pedido.observacao]); 

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
        
        // Validação: Se rejeitou, TEM que ter motivo
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

    // Helper de Cor
    const getColorHex = (corNome) => {
        if (!corNome) return '#ccc';
        const map = {
            'vermelho': '#ef4444', 'vermelha': '#ef4444',
            'preto': '#1f2937', 'preta': '#1f2937',
            'branco': '#ffffff', 'branca': '#ffffff',
            'azul': '#3b82f6', 'prata': '#9ca3af', 'cinza': '#6b7280', 'amarelo': '#eab308',
        };
        return map[corNome.toLowerCase()] || '#eee';
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-xl text-purple-800">Análise de Pedido #{pedido.id}</h2>}>
            <Head title={`Análise #${pedido.id}`} />

            <div className="py-8 bg-gray-50 min-h-screen pb-40">
                <div className="max-w-4xl mx-auto px-4">
                    
                    {/* --- CABEÇALHO LOGÍSTICO (NOVIDADE V2) --- */}
                    <div className={`bg-white p-6 rounded-2xl shadow-sm mb-6 border-l-8 ${isTransferencia ? 'border-orange-500' : 'border-blue-600'}`}>
                        
                        {/* Badge de Tipo */}
                        <div className="mb-4">
                            {isTransferencia ? (
                                <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-bold border border-orange-200 uppercase tracking-wider flex w-fit items-center gap-2">
                                    🔁 Transferência entre Lojas
                                </span>
                            ) : (
                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold border border-blue-200 uppercase tracking-wider flex w-fit items-center gap-2">
                                    🏭 Reposição de Estoque
                                </span>
                            )}
                        </div>

                        {/* Fluxo Visual: Origem -> Destino */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            
                            {/* Origem */}
                            <div className="flex-1 text-center md:text-left w-full">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">DE (ORIGEM)</p>
                                <h3 className={`text-lg font-black ${isTransferencia ? 'text-orange-700' : 'text-blue-700'}`}>
                                    {nomeOrigem}
                                </h3>
                                {isTransferencia && <p className="text-xs text-orange-600 font-bold">⚠️ O estoque sairá desta loja</p>}
                            </div>

                            {/* Seta */}
                            <div className="text-2xl text-gray-300 transform rotate-90 md:rotate-0">
                                ➔
                            </div>

                            {/* Destino */}
                            <div className="flex-1 text-center md:text-right w-full">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">PARA (DESTINO)</p>
                                <h3 className="text-xl font-black text-gray-800">{destinoFinalLabel}</h3>
                                <p className="text-sm text-gray-600">Solicitado por: {pedido.user.name}</p>
                            </div>
                        </div>

                        {/* Dados Data */}
                        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                            <span>📅 Criado em: {new Date(pedido.created_at).toLocaleDateString()} às {new Date(pedido.created_at).toLocaleTimeString().slice(0,5)}</span>
                            <span>ID: #{pedido.id}</span>
                        </div>
                    </div>

                    {/* LISTA DE MOTOS */}
                    <div className="space-y-4 mb-8">
                        {pedido.motos.map((moto) => {
                            const isApproved = aprovacoes[moto.id];
                            return (
                                <div key={moto.id} className="transition-all duration-300">
                                    <div 
                                        onClick={() => toggleAprovacao(moto.id)}
                                        className={`relative p-5 rounded-xl border-2 cursor-pointer select-none flex flex-col md:flex-row justify-between md:items-center gap-4 transition-all duration-200 group ${isApproved ? 'bg-white border-gray-100 hover:border-green-200 shadow-sm' : 'bg-red-50 border-red-200 shadow-inner'}`}
                                    >
                                        <div className="flex items-start gap-4 w-full">
                                            {/* Checkbox */}
                                            <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-bold transition-transform duration-300 ${isApproved ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                {isApproved ? '✓' : '✕'}
                                            </div>
                                            
                                            {/* Detalhes */}
                                            <div className="flex-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h4 className={`font-mono text-lg font-bold tracking-wide ${isApproved ? 'text-gray-800' : 'text-red-800 line-through decoration-2 opacity-60'}`}>
                                                        {moto.chassi}
                                                    </h4>
                                                    {moto.ano_fabricacao && (
                                                        <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-bold">
                                                            {moto.ano_fabricacao}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4 text-sm mt-2">
                                                    <div>
                                                        <span className="text-xs text-gray-400 uppercase block">Modelo</span>
                                                        <span className="font-bold text-gray-700">{moto.modelo}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-400 uppercase block">Cor</span>
                                                        <div className="flex items-center gap-1">
                                                            <span className="w-2 h-2 rounded-full border border-gray-300" style={{ backgroundColor: getColorHex(moto.cor) }}></span>
                                                            <span className="font-medium text-gray-600 capitalize">{moto.cor}</span>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2 md:col-span-1">
                                                        <span className="text-xs text-gray-400 uppercase block">Motivo</span>
                                                        <span className="font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs inline-block mt-0.5">
                                                            {moto.pivot?.motivo || moto.motivo_solicitacao || 'Venda'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div className="flex flex-col items-end gap-2 md:min-w-[100px]">
                                            <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded border ${isApproved ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-100 border-red-200'}`}>
                                                {isApproved ? 'APROVADO' : 'CORTADO'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Painel Rejeição */}
                                    {!isApproved && (
                                        <div className="mt-2 mx-2 p-4 bg-white border border-red-100 rounded-lg shadow-sm border-l-4 border-l-red-400 animate-fade-in-down">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-red-700 uppercase">Motivo do Corte (Obrigatório)</label>
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
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* OBSERVAÇÕES GERAIS */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 mb-8">
                        <label className="block text-sm font-bold text-gray-700 mb-2">📝 Observações Gerais / Feedback para Loja</label>
                        <textarea 
                            className="w-full border-gray-300 rounded-lg text-sm h-20 focus:ring-purple-500 focus:border-purple-500" 
                            placeholder="Ex: Liberado, porém atente-se ao estoque..." 
                            value={justificativaGeral} 
                            onChange={(e) => setJustificativaGeral(e.target.value)}
                        ></textarea>
                    </div>
                </div>
            </div>

            {/* BARRA DE AÇÃO */}
            <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 p-4 shadow-lg z-40">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div className="hidden md:block text-sm text-gray-500">
                        {isTransferencia 
                            ? "Ao aprovar, a loja de origem será notificada para separar a carga." 
                            : "Ao aprovar, o pedido será enviado ao CD para separação."}
                    </div>
                    <button 
                        onClick={handleFinalizar} 
                        disabled={processing} 
                        className="w-full md:w-auto bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 text-white font-bold text-lg py-3 px-10 rounded-xl shadow-lg transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                    >
                        <span>🛡️</span> {processing ? 'Enviando...' : 'FINALIZAR ANÁLISE'}
                    </button>
                </div>
            </div>

            {/* CHAT */}
            <ChatBox pedidoId={pedido.id} />

        </AuthenticatedLayout>
    );
}