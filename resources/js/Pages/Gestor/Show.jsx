import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import Swal from 'sweetalert2';

export default function GestorShow({ auth, pedido }) {
    // Estado das aprovações (True = Aprovado, False = Rejeitado)
    const [aprovacoes, setAprovacoes] = useState(
        pedido.motos.reduce((acc, moto) => ({ ...acc, [moto.id]: true }), {})
    );
    
    // Estado para armazenar o motivo de cada moto rejeitada
    const [motivosEspecificos, setMotivosEspecificos] = useState({});
    
    // Estado da justificativa geral (Opcional)
    const [justificativaGeral, setJustificativaGeral] = useState('');
    
    const { processing } = useForm();

    const opcoesRejeicao = [
        "Chassi Incorreto / Erro Digitação",
        "Moto Não Liberada / Bloqueada",
        "Sem Limite de Crédito",
        "Venda Cancelada",
        "Preço Incorreto",
        "Outros"
    ];

    const toggleAprovacao = (id) => {
        setAprovacoes(prev => ({ ...prev, [id]: !prev[id] }));
        // Limpa o motivo se for aprovado novamente
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
        // Filtra quais IDs estão rejeitados
        const rejeitadasIds = Object.keys(aprovacoes)
            .filter(id => !aprovacoes[id])
            .map(id => parseInt(id));

        // Validação: Se rejeitou, TEM que escolher o motivo
        const motivosFaltantes = rejeitadasIds.some(id => !motivosEspecificos[id]);
        
        if (rejeitadasIds.length > 0 && motivosFaltantes) {
            Swal.fire('Obrigatório', 'Por favor, selecione o motivo da rejeição para todas as motos cortadas.', 'warning');
            return;
        }

        const qtdTotal = pedido.motos.length;
        const qtdRejeitada = rejeitadasIds.length;
        const qtdAprovada = qtdTotal - qtdRejeitada;

        Swal.fire({
            title: 'Confirmar Análise?',
            html: `
                <div class="text-left text-sm space-y-2">
                    <p>✅ <strong>Aprovadas:</strong> ${qtdAprovada}</p>
                    <p class="text-red-600">❌ <strong>Cortadas:</strong> ${qtdRejeitada}</p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, Processar',
            confirmButtonColor: '#7e22ce'
        }).then((result) => {
            if (result.isConfirmed) {
                router.post(route('gestor.aprovar', pedido.id), {
                    rejeitadas: rejeitadasIds,
                    motivos: motivosEspecificos, // Envia o mapa de motivos
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
                        {pedido.observacao && (
                            <div className="mt-4 bg-yellow-50 p-3 rounded border border-yellow-100 text-sm text-yellow-800">
                                <strong>Obs da Loja:</strong> {pedido.observacao}
                            </div>
                        )}
                    </div>

                    <h3 className="font-bold text-gray-700 mb-4 px-2">Itens da Solicitação</h3>

                    {/* Lista de Motos */}
                    <div className="space-y-4 mb-8">
                        {pedido.motos.map((moto) => {
                            const isApproved = aprovacoes[moto.id];
                            return (
                                <div key={moto.id} className={`transition-all duration-300 ${!isApproved ? 'scale-100' : 'scale-100'}`}>
                                    <div 
                                        onClick={() => toggleAprovacao(moto.id)}
                                        className={`relative p-4 rounded-xl border-2 cursor-pointer select-none flex justify-between items-center transition-colors
                                            ${isApproved 
                                                ? 'bg-white border-green-200 shadow-sm' 
                                                : 'bg-red-50 border-red-300 shadow-md'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isApproved ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                                {isApproved ? '✓' : '✕'}
                                            </div>
                                            <div>
                                                <h4 className={`font-bold ${isApproved ? 'text-gray-800' : 'text-red-800 line-through'}`}>{moto.modelo}</h4>
                                                <p className="text-xs font-mono text-gray-500">{moto.chassi}</p>
                                                <p className="text-xs text-gray-400">{moto.cor}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="text-right">
                                            <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${isApproved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {isApproved ? 'Aprovado' : 'Rejeitado'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* DROPDOWN DE MOTIVO (Só aparece se rejeitado) */}
                                    {!isApproved && (
                                        <div className="mt-2 ml-4 mr-1 animate-fade-in-down">
                                            <label className="text-xs font-bold text-red-700 uppercase mb-1 block">Motivo da Rejeição:</label>
                                            <select 
                                                className="w-full border-red-300 rounded-lg text-sm focus:border-red-500 focus:ring-red-500 bg-white"
                                                value={motivosEspecificos[moto.id] || ''}
                                                onChange={(e) => handleMotivoChange(moto.id, e.target.value)}
                                            >
                                                <option value="" disabled>Selecione o motivo...</option>
                                                {opcoesRejeicao.map((opt, i) => (
                                                    <option key={i} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* OBS GERAL */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            📝 Observações Gerais (Opcional)
                        </label>
                        <textarea
                            className="w-full border-gray-300 rounded-lg focus:border-purple-500 focus:ring-purple-500 text-sm"
                            rows="2"
                            placeholder="Algum recado extra para a loja..."
                            value={justificativaGeral}
                            onChange={(e) => setJustificativaGeral(e.target.value)}
                        ></textarea>
                    </div>

                </div>
            </div>

            <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
                <div className="max-w-4xl mx-auto">
                    <button 
                        onClick={handleFinalizar}
                        disabled={processing}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg py-3 px-8 rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                    >
                        <span>🛡️</span> {processing ? 'Processando...' : 'FINALIZAR ANÁLISE'}
                    </button>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}