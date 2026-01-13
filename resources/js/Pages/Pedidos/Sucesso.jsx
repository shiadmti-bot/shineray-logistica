import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

export default function PedidoSucesso({ auth }) {
    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-bold text-xl text-gray-800 leading-tight">Solicitação Realizada</h2>}
        >
            <Head title="Solicitação Enviada" />

            <div className="min-h-screen flex flex-col sm:justify-center items-center pt-6 sm:pt-0 bg-gray-100 px-4">
                
                <div className="w-full sm:max-w-lg mt-6 px-6 py-8 bg-white shadow-xl overflow-hidden sm:rounded-2xl text-center border-t-8 border-purple-600">
                    
                    {/* Ícone Animado */}
                    <div className="mb-6 flex justify-center">
                        <div className="rounded-full bg-purple-100 p-6 animate-bounce-slow">
                            <span className="text-6xl">🛡️</span>
                        </div>
                    </div>

                    <h2 className="text-3xl font-black text-gray-800 mb-2">Solicitação em Análise!</h2>
                    
                    <p className="text-gray-600 text-lg mb-6 leading-relaxed">
                        Seu pedido foi registrado e enviado para a 
                        <strong className="text-purple-700"> Aprovação do Gestor Comercial</strong>.
                    </p>

                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 mb-8 text-left">
                        <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
                            <span>ℹ️</span> Próximos Passos:
                        </h4>
                        <ul className="text-sm text-purple-800 space-y-2">
                            <li className="flex items-start gap-2">
                                <span className="mt-1">1.</span> 
                                <span>O Gestor irá conferir os modelos e chassis solicitados.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="mt-1">2.</span> 
                                <span>Assim que autorizado, o pedido segue para o CD (Separação).</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="mt-1">3.</span> 
                                <span>Você receberá uma notificação quando o status mudar.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <Link
                            href={route('pedidos.index')}
                            className="block w-full py-4 bg-purple-600 border border-transparent rounded-xl font-bold text-white uppercase tracking-widest hover:bg-purple-700 focus:bg-purple-700 active:bg-purple-900 transition shadow-lg transform hover:-translate-y-1"
                        >
                            Acompanhar Meus Pedidos
                        </Link>

                        <Link
                            href={route('solicitar')}
                            className="block w-full py-3 bg-white border-2 border-gray-200 rounded-xl font-bold text-gray-600 uppercase tracking-widest hover:bg-gray-50 transition"
                        >
                            Nova Solicitação
                        </Link>
                    </div>

                </div>
                
                <p className="mt-8 text-gray-400 text-sm">Shineray By Sabel Logística</p>
            </div>
        </AuthenticatedLayout>
    );
}