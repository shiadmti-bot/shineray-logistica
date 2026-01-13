import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

export default function GestorDashboard({ auth, pedidos }) {
    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-purple-800">Painel de Aprovação</h2>}>
            <Head title="Gestão Comercial" />

            <div className="py-8 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* Cabeçalho */}
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h3 className="text-3xl font-black text-gray-800">Olá, {auth.user.name.split(' ')[0]}!</h3>
                            <p className="text-gray-500">Você tem <strong className="text-purple-600">{pedidos.length} pedidos</strong> aguardando análise.</p>
                        </div>
                    </div>

                    {/* Grid de Cards (Ótimo para Tablet) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pedidos.map((pedido) => (
                            <Link key={pedido.id} href={route('gestor.show', pedido.id)} className="group block">
                                <div className="bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-purple-500 hover:shadow-xl transition-all duration-300 p-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 bg-purple-100 text-purple-800 px-3 py-1 rounded-bl-xl font-bold text-xs">
                                        #{pedido.id}
                                    </div>
                                    
                                    <div className="mb-4">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Solicitante</p>
                                        <h4 className="text-xl font-bold text-gray-800 truncate">{pedido.user.filial || pedido.user.name}</h4>
                                        <p className="text-sm text-gray-500">{new Date(pedido.created_at).toLocaleString()}</p>
                                    </div>

                                    <div className="flex justify-between items-end border-t pt-4">
                                        <div>
                                            <p className="text-3xl font-black text-purple-700">{pedido.motos.length}</p>
                                            <p className="text-xs text-gray-400 font-bold uppercase">Motos</p>
                                        </div>
                                        <span className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow group-hover:bg-purple-800 transition">
                                            Analisar ➜
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}

                        {pedidos.length === 0 && (
                            <div className="col-span-full text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                                <p className="text-2xl text-gray-300 font-bold">Tudo limpo por aqui! 🎉</p>
                                <p className="text-gray-400">Nenhuma solicitação pendente.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}