import AppLayout from '@/Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

export default function PedidoSucesso({ auth }) {
    return (
        <AppLayout user={auth.user}>
            <Head title="Solicitação Enviada" />

            <div className="flex flex-col items-center py-12">
                <div className="w-full max-w-lg mt-6 px-6 py-8 bg-surface-card shadow-lg border border-line sm:rounded-2xl text-center">
                    
                    {/* Ícone Animado */}
                    <div className="mb-6 flex justify-center">
                        <div className="bg-status-success-bg rounded-full p-5">
                            <CheckCircleIcon className="w-16 h-16 text-status-success-fg" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-black text-content-primary mb-2">Solicitação em Análise!</h2>
                    
                    <p className="text-content-secondary text-lg mb-6 leading-relaxed">
                        Seu pedido foi registrado e enviado para a 
                        <strong className="text-brand-600"> Aprovação do Gestor Comercial</strong>.
                    </p>

                    <div className="bg-status-info-bg border border-status-info-solid/20 rounded-xl p-4 mb-8 text-left">
                        <h4 className="font-bold text-status-info-fg mb-2 flex items-center gap-2">
                            <span>ℹ️</span> Próximos Passos:
                        </h4>
                        <ul className="text-sm text-status-info-fg space-y-2">
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
                            className="block w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl shadow-md transition uppercase tracking-widest"
                        >
                            Acompanhar Meus Pedidos
                        </Link>

                        <Link
                            href={route('solicitar')}
                            className="block w-full py-3 bg-surface-sunken hover:bg-surface-card text-content-primary border border-line font-bold rounded-xl transition uppercase tracking-widest"
                        >
                            Nova Solicitação
                        </Link>
                    </div>

                </div>
                
                <p className="mt-8 text-content-muted text-sm">Shineray By Sabel Logística</p>
            </div>
        </AppLayout>
    );
}