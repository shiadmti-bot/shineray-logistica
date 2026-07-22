import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { 
    HandRaisedIcon, 
    ClipboardDocumentListIcon, 
    ShoppingBagIcon, 
    ArrowUturnLeftIcon, 
    ArrowPathIcon, 
    ArchiveBoxIcon, 
    ArrowDownIcon, 
    ExclamationTriangleIcon, 
    UserIcon, 
    ScissorsIcon, 
    CheckCircleIcon, 
    HandThumbUpIcon, 
    BuildingStorefrontIcon,
    ArrowRightIcon
} from '@heroicons/react/24/outline';

export default function GestorDashboard({ auth, pedidos, estornos }) {

    const [activeTab, setActiveTab] = useState('pedidos'); // 'pedidos' ou 'estornos'

    // --- REALTIME ---
    useEffect(() => {
        if (!auth.user?.id) return;
        
        const channel = window.Echo.private(`App.Models.User.${auth.user.id}`);

        channel.notification((notification) => {
            const audio = new Audio('/plim.mp3');
            audio.play().catch(()=>{});

            const isEstorno = notification.type?.includes('Estorno');
            
            Swal.fire({
                toast: true, position: 'top-end', showConfirmButton: false, timer: 5000, timerProgressBar: true,
                icon: isEstorno ? 'warning' : 'info', 
                title: isEstorno ? 'Estorno Solicitado!' : 'Nova Solicitação!', 
                text: notification.mensagem 
            });

            router.reload({ only: ['pedidos', 'estornos'] });
        });

        return () => channel.stopListening('Notification');
    }, [auth.user?.id]);

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

    // Helper seguro para nome da loja
    const getLojaNome = (user) => user ? (user.filial || user.name) : 'Usuário Removido';

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-gray-800">Painel de Controle</h2>}>
            <Head title="Gestão Comercial" />

            <div className="py-8 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* CABEÇALHO */}
                    <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-3xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                                Olá, {auth.user.name.split(' ')[0]} <HandRaisedIcon className="w-8 h-8 text-yellow-500" />
                            </h3>
                            <p className="text-gray-500 mt-1">
                                Pendências: <strong className="text-purple-600">{pedidos.length} Solicitações</strong> e <strong className="text-orange-600">{estornos.length} Estornos</strong>.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Link href={route('gestor.historico')} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-gray-50 transition flex items-center gap-2">
                                <ClipboardDocumentListIcon className="w-5 h-5 text-gray-500" /> Histórico
                            </Link>
                            <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2 border border-green-200 h-fit self-center">
                                <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span> Online
                            </span>
                        </div>
                    </div>

                    {/* ABAS */}
                    <div className="flex space-x-1 rounded-xl bg-gray-200 p-1 mb-8 w-full md:w-fit">
                        <button onClick={() => setActiveTab('pedidos')} className={`w-full md:w-48 rounded-lg py-2.5 text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === 'pedidos' ? 'bg-white text-purple-700 shadow' : 'text-gray-500 hover:text-gray-700'}`}>
                            <ShoppingBagIcon className="w-5 h-5" /> Solicitações ({pedidos.length})
                        </button>
                        <button onClick={() => setActiveTab('estornos')} className={`w-full md:w-48 rounded-lg py-2.5 text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === 'estornos' ? 'bg-white text-orange-600 shadow' : 'text-gray-500 hover:text-gray-700'}`}>
                            <ArrowUturnLeftIcon className="w-5 h-5" /> Estornos ({estornos.length})
                        </button>
                    </div>

                    {/* ABA 1: PEDIDOS (Agora com suporte v2) */}
                    {activeTab === 'pedidos' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                            {pedidos.map((pedido) => (
                                <Link key={pedido.id} href={route('gestor.show', pedido.id)} className="group block">
                                    <div className={`bg-white rounded-2xl shadow-sm border-2 border-transparent hover:shadow-xl transition-all duration-300 p-6 relative overflow-hidden h-full ${pedido.tipo === 'transferencia' ? 'hover:border-orange-500' : 'hover:border-purple-500'}`}>
                                        
                                        {/* Barra Lateral (Laranja para Transf, Roxa para CD) */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${pedido.tipo === 'transferencia' ? 'bg-orange-500' : 'bg-purple-500'}`}></div>
                                        
                                        <div className="mb-4 pl-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                {pedido.tipo === 'transferencia' ? (
                                                    <span className="bg-orange-100 text-orange-800 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide border border-orange-200 flex items-center gap-1">
                                                        <ArrowPathIcon className="w-3 h-3" /> Transferência
                                                    </span>
                                                ) : (
                                                    <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide border border-purple-200 flex items-center gap-1">
                                                        <ArchiveBoxIcon className="w-3 h-3" /> Reposição
                                                    </span>
                                                )}
                                                <span className="text-xs text-gray-400">#{pedido.id} • {pedido.created_at}</span>
                                            </div>
                                            
                                            {/* Logística: Origem -> Destino */}
                                            <div className="mt-3 space-y-1">
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <span>De:</span>
                                                    <strong className={pedido.tipo === 'transferencia' ? 'text-orange-700' : 'text-gray-700'}>
                                                        {pedido.origem_nome}
                                                    </strong>
                                                </div>
                                                <div className="text-gray-300 text-xs ml-1 flex justify-center w-6">
                                                    <ArrowDownIcon className="w-3 h-3" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500">Para:</span>
                                                    <h4 className="text-lg font-bold text-gray-800 leading-none">
                                                        {pedido.solicitante}
                                                    </h4>
                                                </div>
                                                {pedido.resumo_itens && (
                                                    <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 font-medium">
                                                        📦 <strong>Solicitado:</strong> {pedido.resumo_itens}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-end border-t border-gray-100 pt-4 pl-3">
                                            <div>
                                                <p className={`text-3xl font-black leading-none ${pedido.tipo === 'transferencia' ? 'text-orange-600' : 'text-purple-700'}`}>{pedido.qtd_motos || 0}</p>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Motos</p>
                                            </div>
                                            <span className="text-gray-400 text-xs font-bold group-hover:underline flex items-center gap-1 group-hover:text-black">
                                                Analisar <ArrowRightIcon className="w-4 h-4" />
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                            
                            {pedidos.length === 0 && (
                                <EmptyState 
                                    title="Nenhuma Pendência" 
                                    desc="Tudo limpo! As lojas não enviaram novas solicitações." 
                                    icon={<CheckCircleIcon className="w-16 h-16 text-green-200" />} 
                                />
                            )}
                        </div>
                    )}

                    {/* ABA 2: ESTORNOS */}
                    {activeTab === 'estornos' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                            {estornos.map((moto) => (
                                <div key={moto.id} className="bg-white rounded-2xl shadow-sm border border-orange-100 hover:shadow-lg transition-all duration-300 p-0 relative overflow-hidden">
                                    <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-start">
                                        <div>
                                            <span className="bg-orange-200 text-orange-900 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide flex items-center gap-1 w-fit">
                                                {moto.motivo_estorno && moto.motivo_estorno.includes('CD Reportou') ? (
                                                    <><ArchiveBoxIcon className="w-3 h-3" /> CD Reportou</>
                                                ) : (
                                                    <><BuildingStorefrontIcon className="w-3 h-3" /> Loja Reportou</>
                                                )}
                                            </span>
                                            <h4 className="text-md font-bold text-gray-800 mt-2">{moto.modelo}</h4>
                                            <p className="font-mono text-xs text-orange-700">{moto.chassi}</p>
                                        </div>
                                        <ExclamationTriangleIcon className="w-6 h-6 text-orange-400" />
                                    </div>

                                    <div className="p-4">
                                        <div className="mb-4">
                                            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Motivo</p>
                                            <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-100 italic">
                                                "{moto.motivo_estorno || 'Sem motivo'}"
                                            </p>
                                        </div>
                                        <div className="mb-4">
                                            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Origem do Pedido</p>
                                            <p className="text-sm text-gray-800 flex items-center gap-1">
                                                <UserIcon className="w-4 h-4 text-gray-400" /> {moto.solicitante_original}
                                            </p>
                                        </div>
                                        <button onClick={() => handleAprovarEstorno(moto.id)} className="w-full bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white font-bold py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                            <ScissorsIcon className="w-5 h-5" /> Aprovar Corte
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {estornos.length === 0 && (
                                <EmptyState 
                                    title="Nenhum Estorno" 
                                    desc="Nenhum problema reportado." 
                                    icon={<HandThumbUpIcon className="w-16 h-16 text-blue-200" />} 
                                />
                            )}
                        </div>
                    )}

                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function EmptyState({ title, desc, icon }) {
    return (
        <div className="col-span-full py-16 flex flex-col items-center justify-center text-center bg-white rounded-3xl border-2 border-dashed border-gray-200 opacity-70">
            <div className="bg-gray-50 p-4 rounded-full mb-3 grayscale opacity-50">{icon}</div>
            <h3 className="text-lg font-bold text-gray-700">{title}</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">{desc}</p>
        </div>
    );
}