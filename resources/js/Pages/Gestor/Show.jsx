import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { useState } from 'react';
import Swal from 'sweetalert2';

export default function GestorShow({ auth, pedido }) {
    // Estado das aprovações (True = Aprovado, False = Rejeitado)
    const [aprovacoes, setAprovacoes] = useState(
        pedido.motos.reduce((acc, moto) => ({ ...acc, [moto.id]: true }), {})
    );
    
    // Estado da justificativa
    const [justificativa, setJustificativa] = useState('');
    const { processing } = useForm();

    const toggleAprovacao = (id) => {
        setAprovacoes(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleFinalizar = () => {
        // Filtra quais IDs estão marcados como FALSE (Rejeitados)
        const rejeitadasIds = Object.keys(aprovacoes)
            .filter(id => !aprovacoes[id])
            .map(id => parseInt(id)); // Garante que sejam números inteiros

        const qtdTotal = pedido.motos.length;
        const qtdRejeitada = rejeitadasIds.length;
        const qtdAprovada = qtdTotal - qtdRejeitada;

        if (qtdAprovada === 0) {
            Swal.fire('Atenção', 'Você rejeitou todas as motos. O pedido será cancelado.', 'warning');
        }

        Swal.fire({
            title: 'Confirmar Decisão?',
            html: `
                <div class="text-left text-sm space-y-2">
                    <p>✅ <strong>Aprovadas:</strong> ${qtdAprovada} motos</p>
                    <p class="text-red-600">❌ <strong>Cortadas:</strong> ${qtdRejeitada} motos</p>
                    ${justificativa ? `<p class="text-gray-500 italic">📝 <strong>Obs:</strong> "${justificativa}"</p>` : ''}
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, Processar',
            confirmButtonColor: '#7e22ce'
        }).then((result) => {
            if (result.isConfirmed) {
                // Envia para o backend usando router.post para garantir o formato correto
                router.post(route('gestor.aprovar', pedido.id), {
                    rejeitadas: rejeitadasIds,
                    justificativa: justificativa
                });
            }
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-xl text-purple-800">Análise de Pedido #{pedido.id}</h2>}>
            <Head title={`Análise #${pedido.id}`} />

            <div className="py-8 bg-gray-50 min-h-screen pb-40"> {/* pb-40 para dar espaço à barra fixa */}
                <div className="max-w-4xl mx-auto px-4">
                    
                    {/* Resumo do Pedido */}
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

                    {/* Lista de Motos (Toggle) */}
                    <div className="space-y-3 mb-8">
                        {pedido.motos.map((moto) => {
                            const isApproved = aprovacoes[moto.id];
                            return (
                                <div 
                                    key={moto.id} 
                                    onClick={() => toggleAprovacao(moto.id)}
                                    className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer select-none flex justify-between items-center
                                        ${isApproved 
                                            ? 'bg-white border-green-200 shadow-sm' 
                                            : 'bg-red-50 border-red-200 opacity-75'
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
                                            {isApproved ? 'Aprovado' : 'Cortar Item'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ÁREA DE JUSTIFICATIVA (NOVO) */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            📝 Justificativa ou Observação (Opcional)
                        </label>
                        <textarea
                            className="w-full border-gray-300 rounded-lg focus:border-purple-500 focus:ring-purple-500 text-sm"
                            rows="3"
                            placeholder="Ex: Item cortado por falta de crédito; Aprovado com restrição..."
                            value={justificativa}
                            onChange={(e) => setJustificativa(e.target.value)}
                        ></textarea>
                    </div>

                </div>
            </div>

            {/* Barra Fixa Inferior */}
            <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
                <div className="max-w-4xl mx-auto flex justify-between items-center gap-4">
                    <div className="hidden md:block text-sm text-gray-500">
                        Revise os itens cortados (vermelho) antes de confirmar.
                    </div>
                    <button 
                        onClick={handleFinalizar}
                        disabled={processing}
                        className="flex-1 md:flex-none md:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg py-3 px-8 rounded-xl shadow-lg transition transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2"
                    >
                        <span>🛡️</span> {processing ? 'Processando...' : 'FINALIZAR ANÁLISE'}
                    </button>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}