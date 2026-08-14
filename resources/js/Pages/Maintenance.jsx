import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';

export default function Maintenance() {
    const [dots, setDots] = useState('');
    const [isChecking, setIsChecking] = useState(false);

    // Animação dos pontinhos "..."
    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 500);
        return () => clearInterval(interval);
    }, []);

    const handleReload = () => {
        setIsChecking(true);
        // Simula checagem rápida antes de dar reload real
        setTimeout(() => {
            window.location.reload();
        }, 800);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
            <Head title="Manutenção V3" />

            {/* Elementos Decorativos de Fundo */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-orange-500 to-red-600"></div>
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-red-50 rounded-full blur-3xl opacity-50"></div>
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50"></div>

            {/* Cartão Central */}
            <div className="bg-white/80 backdrop-blur-xl p-8 md:p-12 rounded-3xl shadow-2xl border border-white max-w-md w-full text-center relative z-10 animate-fade-in-up">
                
                {/* Ícone Animado */}
                <div className="relative w-24 h-24 mx-auto mb-8">
                    <div className="absolute inset-0 bg-red-50 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-4xl">
                        🚛
                    </div>
                    <div className="absolute -top-2 -right-2 bg-white p-1.5 rounded-full shadow-sm border border-gray-100">
                        <svg className="w-8 h-8 text-red-600 animate-spin-slow" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                    </div>
                </div>

                {/* Títulos */}
                <h1 className="text-3xl font-black text-gray-800 tracking-tight mb-2">
                    Evoluindo para <span className="text-red-600">V3.0</span>
                </h1>
                <p className="text-gray-500 font-medium text-sm mb-8 leading-relaxed">
                    Estamos atualizando a base de dados do <strong>By Sabel Logística</strong>. O sistema retornará mais rápido e seguro em instantes{dots}
                </p>

                {/* Caixa de Status */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</span>
                    </div>
                    <span className="text-xs font-black text-gray-700 uppercase">Migrando Dados...</span>
                </div>

                {/* Botão de Ação */}
                <button 
                    onClick={handleReload}
                    disabled={isChecking}
                    className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 ${isChecking ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-black hover:-translate-y-1'}`}
                >
                    {isChecking ? (
                        <>Verificando conexão...</>
                    ) : (
                        <>🔄 Verificar se já voltou</>
                    )}
                </button>

                {/* Rodapé Contato */}
                <div className="mt-8 pt-6 border-t border-gray-100">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Precisa de urgência?</p>
                    <div className="text-sm font-bold text-gray-700">
                        TI: (91) 98492-8535
                    </div>
                </div>
            </div>
            
            <style>{`
                .animate-spin-slow { animation: spin 8s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}