import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';

export default function GestorDashboard({ auth, pedidos, estornos }) {

    // Estado para controlar a aba ativa
    const [activeTab, setActiveTab] = useState('pedidos'); // 'pedidos' ou 'estornos'

    // --- REALTIME: ESCUTA NOVOS EVENTOS ---
    useEffect(() => {
        const channel = window.Echo.private(`App.Models.User.${auth.user.id}`);

        channel.notification((notification) => {
            // Toca som
            const audio = new Audio('/plim.mp3');
            audio.play().catch(()=>{});

            // Determina se é estorno ou pedido para exibir o ícone correto
            const isEstorno = notification.type.includes('Estorno');
            
            const Toast = Swal.mixin({
                toast: true, position: 'top-end', showConfirmButton: false, timer: 5000, timerProgressBar: true
            });
            
            Toast.fire({ 
                icon: isEstorno ? 'warning' : 'info', 
                title: isEstorno ? '⚠️ Estorno Solicitado!' : '🆕 Nova Venda!', 
                text: notification.mensagem 
            });

            // Recarrega todos os dados
            router.reload({ only: ['pedidos', 'estornos'] });
        });

        return () => channel.stopListening('Notification');
    }, [auth.user.id]);

    // Função rápida para aprovar estorno direto do card (opcional)
    const handleAprovarEstorno = (motoId) => {
        Swal.fire({
            title: 'Aprovar Devolução?',
            text: "A moto sairá do pedido e voltará ao estoque disponível.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sim, Aprovar Corte'
        }).then((result) => {
            if (result.isConfirmed) {
                router.post(route('gestor.aprovarEstorno', motoId));
            }
        });
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-gray-800">Painel de Controle</h2>}>
            <Head title="Gestão Comercial" />

            <div className="py-8 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* CABEÇALHO DE BOAS VINDAS */}
                    <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-3xl font-black text-gray-800 tracking-tight">
                                Olá, {auth.user.name.split(' ')[0]} <span className="text-2xl">👋</span>
                            </h3>
                            <p className="text-gray-500 mt-1">
                                Resumo de pendências: <strong className="text-purple-600">{pedidos.length} Solicitações</strong> e <strong className="text-orange-600">{estornos.length} Estornos</strong>.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Link href={route('gestor.historico')} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-gray-50 transition flex items-center gap-2">
                                📜 Histórico de Decisões
                            </Link>
                            <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2 border border-green-200 h-fit self-center">
                                <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
                                Online
                            </span>
                        </div>
                    </div>

                    {/* NAVEGAÇÃO DE ABAS */}
                    <div className="flex space-x-1 rounded-xl bg-gray-200 p-1 mb-8 w-full md:w-fit">
                        <button
                            onClick={() => setActiveTab('pedidos')}
                            className={`w-full md:w-48 rounded-lg py-2.5 text-sm font-bold leading-5 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2 transition-all duration-200
                                ${activeTab === 'pedidos' 
                                    ? 'bg-white text-purple-700 shadow' 
                                    : 'text-gray-500 hover:bg-white/[0.12] hover:text-gray-700'}`}
                        >
                            🛍️ Solicitações ({pedidos.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('estornos')}
                            className={`w-full md:w-48 rounded-lg py-2.5 text-sm font-bold leading-5 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2 transition-all duration-200
                                ${activeTab === 'estornos' 
                                    ? 'bg-white text-orange-600 shadow' 
                                    : 'text-gray-500 hover:bg-white/[0.12] hover:text-gray-700'}`}
                        >
                            ↩️ Estornos ({estornos.length})
                        </button>
                    </div>

                    {/* CONTEÚDO DAS ABAS */}
                    
                    {/* === ABA 1: PEDIDOS DE VENDA === */}
                    {activeTab === 'pedidos' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                            {pedidos.map((pedido) => (
                                <Link key={pedido.id} href={route('gestor.show', pedido.id)} className="group block">
                                    <div className="bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-purple-500 hover:shadow-xl transition-all duration-300 p-6 relative overflow-hidden h-full">
                                        {/* Indicador Lateral */}
                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500"></div>
                                        
                                        <div className="absolute top-4 right-4 text-purple-100 group-hover:text-purple-600 transition-colors">
                                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                        </div>

                                        <div className="mb-4 pl-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide">Venda #{pedido.id}</span>
                                                <span className="text-xs text-gray-400">{new Date(pedido.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <h4 className="text-lg font-bold text-gray-800 truncate leading-tight">
                                                {pedido.user.filial || pedido.user.name}
                                            </h4>
                                            <p className="text-xs text-gray-500 truncate mt-1">{pedido.user.email}</p>
                                        </div>

                                        <div className="flex justify-between items-end border-t border-gray-100 pt-4 pl-3">
                                            <div>
                                                <p className="text-3xl font-black text-purple-700 leading-none">{pedido.motos.length}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Motos</p>
                                            </div>
                                            <span className="text-purple-600 text-xs font-bold group-hover:underline flex items-center gap-1">
                                                Auditar Pedido <span>→</span>
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                            
                            {pedidos.length === 0 && (
                                <EmptyState title="Nenhuma Venda Pendente" desc="As lojas ainda não enviaram novas solicitações." icon="🛍️" />
                            )}
                        </div>
                    )}

                    {/* === ABA 2: ESTORNOS E CORTES === */}
                    {activeTab === 'estornos' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                            {estornos.map((moto) => (
                                <div key={moto.id} className="bg-white rounded-2xl shadow-sm border border-orange-100 hover:shadow-lg transition-all duration-300 p-0 relative overflow-hidden">
                                    {/* Header do Card de Estorno */}
                                    <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-start">
                                        <div>
                                            <span className="bg-orange-200 text-orange-900 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide">
                                                {moto.motivo_estorno && moto.motivo_estorno.includes('CD Reportou') ? '🏭 Reportado pelo CD' : '🏪 Reportado pela Loja'}
                                            </span>
                                            <h4 className="text-md font-bold text-gray-800 mt-2">{moto.modelo}</h4>
                                            <p className="font-mono text-xs text-orange-700">{moto.chassi}</p>
                                        </div>
                                        <span className="text-2xl">⚠️</span>
                                    </div>

                                    {/* Corpo do Card */}
                                    <div className="p-4">
                                        <div className="mb-4">
                                            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Motivo da Devolução</p>
                                            <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-100 italic">
                                                "{moto.motivo_estorno || 'Sem motivo informado'}"
                                            </p>
                                        </div>

                                        <div className="mb-4">
                                            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Solicitante Original</p>
                                            <p className="text-sm text-gray-800 flex items-center gap-1">
                                                👤 {moto.pedidos && moto.pedidos[0] ? (moto.pedidos[0].user.filial || moto.pedidos[0].user.name) : 'N/D'}
                                            </p>
                                        </div>

                                        <button 
                                            onClick={() => handleAprovarEstorno(moto.id)}
                                            className="w-full bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white font-bold py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                                        >
                                            <span>✂️</span> Aprovar Corte/Estorno
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {estornos.length === 0 && (
                                <EmptyState title="Nenhum Estorno Pendente" desc="Tudo certo! Nenhuma moto com problemas reportados." icon="✅" />
                            )}
                        </div>
                    )}

                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// Componente de Estado Vazio
function EmptyState({ title, desc, icon }) {
    return (
        <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-white rounded-3xl border-2 border-dashed border-gray-200 opacity-70">
            <div className="bg-gray-50 p-4 rounded-full mb-3 text-4xl grayscale opacity-50">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-gray-700">{title}</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">{desc}</p>
        </div>
    );
}