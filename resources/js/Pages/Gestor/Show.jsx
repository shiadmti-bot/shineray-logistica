import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import Swal from 'sweetalert2';

export default function GestorShow({ auth, pedido }) {
    // Estado inicial: Todas as motos começam "Aprovadas" (true)
    // Se o gestor desmarcar, vira false
    const [aprovacoes, setAprovacoes] = useState(
        pedido.motos.reduce((acc, moto) => ({ ...acc, [moto.id]: true }), {})
    );

    const { post, processing } = useForm();

    const toggleAprovacao = (id) => {
        setAprovacoes(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleFinalizar = () => {
        const rejeitadas = Object.keys(aprovacoes).filter(id => !aprovacoes[id]);
        const qtdAprovada = pedido.motos.length - rejeitadas.length;

        if (qtdAprovada === 0) {
            Swal.fire('Atenção', 'Você rejeitou todas as motos. O pedido será cancelado.', 'warning');
        }

        Swal.fire({
            title: 'Autorizar Pedido?',
            html: `
                <div class="text-left text-sm">
                    <p><strong>Aprovadas:</strong> ${qtdAprovada} motos</p>
                    <p class="text-red-600"><strong>Rejeitadas:</strong> ${rejeitadas.length} motos</p>
                    <p class="mt-2 text-gray-500">As rejeitadas voltarão ao estoque imediatamente.</p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sim, Autorizar Envio ao CD',
            confirmButtonColor: '#7e22ce' // Roxo
        }).then((result) => {
            if (result.isConfirmed) {
                // Envia apenas os IDs das rejeitadas para o backend tratar
                post(route('gestor.aprovar', pedido.id), {
                    data: { rejeitadas }
                });
            }
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-xl text-purple-800">Análise de Pedido #{pedido.id}</h2>}>
            <Head title={`Análise #${pedido.id}`} />

            <div className="py-8 bg-gray-50 min-h-screen pb-32">
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

                    {/* Lista de Motos (Switch Toggle) */}
                    <div className="space-y-3">
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
                                        {/* Checkbox Visual Estilizado */}
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isApproved ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
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
                                            {isApproved ? 'Aprovado' : 'Rejeitar'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Barra Fixa Inferior (Tablet Experience) */}
            <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div className="hidden md:block text-sm text-gray-500">
                        Revise os itens acima antes de confirmar.
                    </div>
                    <button 
                        onClick={handleFinalizar}
                        disabled={processing}
                        className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg py-4 px-8 rounded-xl shadow-lg transition transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2"
                    >
                        <span>🛡️</span> {processing ? 'Processando...' : 'AUTORIZAR ENVIO AO CD'}
                    </button>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}