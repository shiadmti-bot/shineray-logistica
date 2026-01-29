import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function PedidosIndex({ auth }) {
    // SEM useMemo, SEM tabelas, SEM dados. Apenas HTML puro.
    return (
        <AuthenticatedLayout user={auth.user} header={<h2>TESTE DE TELA BRANCA</h2>}>
            <Head title="Teste" />
            <div className="py-12 flex justify-center">
                <div className="bg-white p-10 shadow-xl rounded-xl text-center">
                    <h1 className="text-4xl font-bold text-green-600 mb-4">
                        A TELA FUNCIONOU!
                    </h1>
                    <p className="text-gray-600">
                        Se você está lendo isso, o erro "toString of null" sumiu.
                        <br />
                        Isso significa que o Vercel finalmente atualizou o arquivo.
                    </p>
                    <div className="mt-6 p-4 bg-gray-100 rounded text-sm font-mono text-left">
                        Status: Limpo<br/>
                        Cache: Renovado
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}