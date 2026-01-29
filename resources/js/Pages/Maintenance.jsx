import { Head } from '@inertiajs/react';

export default function Maintenance() {
    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 p-6 text-center">
            <Head title="Manutenção" />
            <div className="text-6xl mb-4">🚧</div>
            <h1 className="text-3xl font-black text-gray-800 mb-2">Sistema em Manutenção</h1>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Estamos realizando uma atualização crítica na base de dados para garantir a segurança dos pedidos.
                <br /><br />
                O sistema retornará em breve.
            </p>
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg text-sm font-bold">
                Dúvidas? Entre em contato com a TI:<br/>
                (91) 98492-8535
            </div>
        </div>
    );
}