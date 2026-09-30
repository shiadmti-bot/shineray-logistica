import { Link, Head } from '@inertiajs/react';

export default function ErrorPage({ status }) {
    const title = {
        503: '503: Serviço Indisponível',
        500: '500: Erro no Servidor',
        404: '404: Página Não Encontrada',
        403: '403: Acesso Negado',
    }[status];

    const description = {
        503: 'Estamos em manutenção. Por favor, volte logo.',
        500: 'Opa, algo deu errado nos nossos servidores.',
        404: 'Desculpe, a página que você procura não existe ou foi movida.',
        403: 'Desculpe, você não tem permissão para acessar esta área.',
    }[status];

    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-surface-sunken text-content-primary p-6">
            <Head title={title} />
            
            <div className="text-center max-w-md">
                {/* Logo Shineray */}
                <div className="flex justify-center mb-8">
                    <div className="bg-status-danger-solid p-4 rounded-full shadow-lg">
                        <img src="/img/logo.png" alt="Shineray" className="h-12 w-auto invert brightness-0 text-white" />
                    </div>
                </div>

                <h1 className="text-6xl font-black text-status-danger-fg mb-4">{status}</h1>
                <h2 className="text-2xl font-bold mb-4">{title}</h2>
                <p className="text-content-secondary mb-8">{description}</p>

                <div className="space-x-4">
                    <Link href="/" className="bg-black text-white px-6 py-3 rounded-lg font-bold hover:bg-surface-inverted transition">
                        Voltar ao Início
                    </Link>
                    <button onClick={() => window.history.back()} className="text-content-muted hover:text-content-primary font-bold underline">
                        Voltar Página Anterior
                    </button>
                </div>
            </div>
        </div>
    );
}