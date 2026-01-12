import { Link } from '@inertiajs/react';

export default function Guest({ children }) {
    return (
        <div className="min-h-screen flex flex-col sm:justify-center items-center pt-6 sm:pt-0 bg-gradient-to-br from-red-900 to-red-600">
            {/* LOGO DA SHINERAY (Círculo Branco) */}
            <div className="mb-6">
                <Link href="/">
                    <div className="bg-white p-4 rounded-full shadow-2xl flex items-center justify-center w-24 h-24 transform hover:scale-105 transition-transform duration-300">
                        <img 
                            src="/img/logo.png" 
                            alt="Logo Shineray" 
                            className="w-16 h-auto object-contain" 
                        />
                    </div>
                </Link>
            </div>

            {/* CARD BRANCO DO FORMULÁRIO */}
            <div className="w-full sm:max-w-md mt-2 px-8 py-8 bg-white shadow-2xl overflow-hidden sm:rounded-xl border-b-4 border-red-800">
                
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">Acesso Restrito</h2>
                    <p className="text-sm text-gray-500">Shineray By Sabel Logística</p>
                </div>

                {children}
            </div>

            {/* RODAPÉ */}
            <div className="mt-8 text-red-200 text-xs text-center">
                &copy; {new Date().getFullYear()} Shineray Sabel. Sistema Interno.
            </div>
        </div>
    );
}