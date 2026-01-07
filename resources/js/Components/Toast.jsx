import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export default function Toast() {
    const { flash } = usePage().props;
    const [visible, setVisible] = useState(false);
    const [msg, setMsg] = useState(null);
    const [type, setType] = useState('success');

    useEffect(() => {
        // Detecta qual mensagem veio do Backend
        if (flash.success) {
            setMsg(flash.success);
            setType('success');
            setVisible(true);
        } else if (flash.error) {
            setMsg(flash.error);
            setType('error');
            setVisible(true);
        } else if (flash.warning) {
            setMsg(flash.warning);
            setType('warning');
            setVisible(true);
        }

        // Esconde automaticamente após 4 segundos
        const timer = setTimeout(() => {
            setVisible(false);
            // Limpa a mensagem do flash para não repetir (opcional, depende do comportamento desejado)
        }, 4000);

        return () => clearTimeout(timer);
    }, [flash]);

    if (!visible || !msg) return null;

    // Configuração de cores
    const colors = {
        success: 'bg-green-600 border-green-700 text-white',
        error: 'bg-red-600 border-red-700 text-white',
        warning: 'bg-yellow-500 border-yellow-600 text-white',
    };

    const icons = {
        success: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
        ),
        error: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        ),
        warning: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        )
    };

    return (
        <div className={`fixed top-5 right-5 z-50 flex items-center w-full max-w-sm p-4 rounded-lg shadow-2xl border-l-4 transform transition-all duration-500 ease-in-out ${visible ? 'translate-x-0 opacity-100' : 'translate-x-10 opacity-0'} ${colors[type]}`}>
            <div className="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg bg-white bg-opacity-20">
                {icons[type]}
            </div>
            <div className="ml-3 text-sm font-bold">{msg}</div>
            <button type="button" onClick={() => setVisible(false)} className="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex h-8 w-8 hover:bg-white hover:bg-opacity-20 focus:ring-2 focus:ring-gray-300">
                <span className="sr-only">Fechar</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
            </button>
        </div>
    );
}