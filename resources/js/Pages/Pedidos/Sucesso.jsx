import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

export default function Sucesso({ auth }) {
    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Pedido Enviado" />
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                
                <div className="max-w-md w-full bg-white shadow-2xl rounded-3xl p-8 text-center border-t-8 border-green-500">
                    
                    {/* Ícone Animado */}
                    <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-green-100 mb-6 animate-bounce">
                        <svg className="h-12 w-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>

                    <h2 className="text-3xl font-extrabold text-gray-900 mb-2">
                        Sucesso!
                    </h2>
                    <p className="text-gray-500 mb-8">
                        Sua solicitação foi enviada para o CD e já aparece como <strong>"Solicitado"</strong> no painel.
                    </p>

                    <div className="space-y-3">
                        <Link 
                            href={route('pedidos.index')} 
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-sm text-sm font-bold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition"
                        >
                            📦 Acompanhar Meus Pedidos
                        </Link>
                        
                        <Link 
                            href={route('solicitar')} 
                            className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-full shadow-sm text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition"
                        >
                            + Fazer Outra Solicitação
                        </Link>
                    </div>
                    
                    <div className="mt-8 border-t pt-4">
                        <Link href={route('dashboard')} className="text-sm text-gray-400 hover:text-gray-600">
                            Voltar ao Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}