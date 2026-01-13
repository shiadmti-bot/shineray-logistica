import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react'; // Adicionado router
import { useEffect } from 'react'; // Adicionado useEffect
import Swal from 'sweetalert2'; // Adicionado Swal

export default function GestorDashboard({ auth, pedidos }) {

    // --- REALTIME: ESCUTA NOVOS PEDIDOS ---
    useEffect(() => {
        const channel = window.Echo.private(`App.Models.User.${auth.user.id}`);

        channel.notification((notification) => {
            // Toca som e avisa
            const audio = new Audio('/plim.mp3');
            audio.play().catch(()=>{});

            const Toast = Swal.mixin({
                toast: true, position: 'top-end', showConfirmButton: false, timer: 5000, timerProgressBar: true
            });
            Toast.fire({ icon: 'info', title: 'Nova Solicitação!', text: notification.mensagem });

            // Recarrega a lista de pedidos
            router.reload({ only: ['pedidos'] });
        });

        return () => channel.stopListening('Notification');
    }, [auth.user.id]);

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-purple-800">Painel de Aprovação</h2>}>
            <Head title="Gestão Comercial" />

            <div className="py-8 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-3xl font-black text-gray-800">Olá, {auth.user.name.split(' ')[0]}!</h3>
                            <p className="text-gray-500">Você tem <strong className="text-purple-600">{pedidos.length} pedidos</strong> aguardando análise.</p>
                        </div>
                        <div className="flex gap-3">
                            <Link href={route('gestor.historico')} className="bg-white border border-purple-200 text-purple-700 px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-purple-50 transition flex items-center gap-2">
                                📜 Ver Histórico de Auditoria
                            </Link>
                            
                            {/* Indicador ao Vivo (Já existente) */}
                            <span className="bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2 border border-purple-200 h-fit self-center">
                                <span className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></span>
                                Ao Vivo
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pedidos.map((pedido) => (
                            <Link key={pedido.id} href={route('gestor.show', pedido.id)} className="group block">
                                <div className="bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-purple-500 hover:shadow-xl transition-all duration-300 p-6 relative overflow-hidden">
                                    {/* Faixa Status */}
                                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-purple-500"></div>
                                    
                                    <div className="absolute top-4 right-4 text-purple-200 group-hover:text-purple-600 transition-colors">
                                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                    </div>

                                    <div className="mb-4 pl-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-purple-100 text-purple-800 text-xs font-black px-2 py-0.5 rounded">#{pedido.id}</span>
                                            <span className="text-xs text-gray-400">{new Date(pedido.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <h4 className="text-xl font-bold text-gray-800 truncate" title={pedido.user.filial}>
                                            {pedido.user.filial || pedido.user.name}
                                        </h4>
                                        <p className="text-sm text-gray-500 truncate">{pedido.user.email}</p>
                                    </div>

                                    <div className="flex justify-between items-end border-t pt-4 pl-2">
                                        <div>
                                            <p className="text-3xl font-black text-purple-700 leading-none">{pedido.motos.length}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Unidades</p>
                                        </div>
                                        <span className="bg-purple-600 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-md group-hover:bg-purple-800 transition flex items-center gap-2">
                                            Analisar <span className="text-purple-200">➜</span>
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}

                        {pedidos.length === 0 && (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-white rounded-3xl border-2 border-dashed border-gray-200">
                                <div className="bg-gray-50 p-4 rounded-full mb-4">
                                    <span className="text-4xl">🎉</span>
                                </div>
                                <h3 className="text-xl font-bold text-gray-800">Tudo limpo por aqui!</h3>
                                <p className="text-gray-500 mt-2">Nenhuma solicitação pendente de análise no momento.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}