import { Link } from '@inertiajs/react';

export default function GuestLayout({ children }) {
    return (
        <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-gradient-to-br from-surface-sunken via-surface-card to-surface-sunken relative overflow-hidden">
            {/* Efeito de iluminação suave de fundo */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-600/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo & Marca */}
                <div className="text-center mb-6">
                    <Link href="/" className="inline-block transition-transform duration-300 hover:scale-105">
                        <div className="bg-surface-card px-6 py-3.5 rounded-2xl shadow-md border border-line flex items-center justify-center gap-3 mx-auto w-fit">
                            <img 
                                src="/img/logo.png" 
                                alt="Logo Shineray By Sabel" 
                                className="h-10 w-auto object-contain" 
                            />
                        </div>
                    </Link>
                </div>

                {/* Card de Conteúdo */}
                <div className="w-full bg-surface-card/95 backdrop-blur-md px-8 py-8 shadow-2xl rounded-3xl border border-line relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-700 via-brand-500 to-brand-700"></div>
                    {children}
                </div>

                {/* Rodapé */}
                <div className="mt-8 text-center text-xs text-content-muted">
                    <p>&copy; {new Date().getFullYear()} Shineray By Sabel • Logística Integrada V3.0</p>
                </div>
            </div>
        </div>
    );
}
