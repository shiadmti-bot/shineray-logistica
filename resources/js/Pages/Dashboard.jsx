import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect } from 'react';

export default function Dashboard({ auth, stats, perfil }) {
    
    // Saudação baseada na hora
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

    // --- LÓGICA DO AUTO-REFRESH (O CORAÇÃO DA MUDANÇA) ---
    useEffect(() => {
        // Só ativa se for o perfil CD (quem precisa monitorar em tempo real)
        if (perfil === 'cd') {
            const timer = setInterval(() => {
                // Recarrega APENAS os dados de 'stats' do servidor
                // preserveScroll: true -> Não mexe na barra de rolagem
                // preserveState: true -> Mantém o que estiver digitado ou aberto
                router.reload({ 
                    only: ['stats'], 
                    preserveScroll: true, 
                    preserveState: true 
                });
            }, 10000); // 10000 ms = 10 segundos

            // Limpa o relógio quando sair da página para não travar o navegador
            return () => clearInterval(timer);
        }
    }, [perfil]); // Roda sempre que o perfil mudar (ou no carregamento inicial)

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <div className="flex justify-between items-center">
                    <h2 className="font-bold text-xl text-gray-800 leading-tight">Painel de Controle</h2>
                    {perfil === 'cd' && (
                        <span className="text-xs font-mono text-gray-400 flex items-center gap-1 animate-pulse">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            Ao Vivo
                        </span>
                    )}
                </div>
            }
        >
            <Head title="Dashboard" />

            <div className="py-10 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    
                    {/* CABEÇALHO DE BOAS VINDAS */}
                    <div className="bg-white rounded-2xl shadow-sm p-8 mb-8 border-l-8 border-red-600 flex flex-col md:flex-row justify-between items-center transition-all duration-500">
                        <div>
                            <h3 className="text-3xl font-black text-gray-800 tracking-tight">
                                {saudacao}, {auth.user.name.split(' ')[0]}!
                            </h3>
                            <p className="text-gray-500 mt-2 font-medium">
                                Sistema de Logística Integrada <span className="text-red-600 font-bold">Shineray By Sabel</span>.
                            </p>
                        </div>
                        <div className="mt-4 md:mt-0 text-right">
                            <span className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider border ${
                                perfil === 'cd' ? 'bg-gray-800 text-white border-gray-800' : 
                                perfil === 'admin' ? 'bg-black text-white border-black' : 
                                'bg-red-100 text-red-700 border-red-200'
                            }`}>
                                {perfil === 'cd' ? '🏭 Perfil: CD / Expedição' : 
                                 perfil === 'admin' ? '🕵️ Perfil: Auditoria / Admin' : 
                                 '🏪 Perfil: Loja / Revenda'}
                            </span>
                            <p className="text-xs text-gray-400 mt-2">
                                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                    </div>

                    {/* --- VISÃO ADMIN / DIRETORIA (PRETO & VERMELHO) --- */}
                    {perfil === 'admin' && (
                        <>
                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-gray-800 border-l-4 border-black pl-3">
                                    Visão Geral da Operação
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                                <CardStat titulo="Total Histórico" valor={stats.total_pedidos} icon="📊" color="text-gray-600" bg="bg-white border-gray-200" desc="Pedidos processados" />
                                <CardStat titulo="Em Operação" valor={stats.em_andamento} icon="⚙️" color="text-blue-600" bg="bg-blue-50 border-blue-200" desc="Fluxo ativo agora" />
                                <CardStat titulo="Cargas na Estrada" valor={stats.cargas_transito} icon="🚛" color="text-orange-600" bg="bg-orange-50 border-orange-200" desc="Romaneios em trânsito" />
                                <CardStat titulo="Devoluções / Erros" valor={stats.cancelados} icon="🚨" color="text-red-600" bg="bg-red-50 border-red-200" desc="Atenção requerida" link={route('pedidos.index')} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <Link href={route('pedidos.index')} className="group bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition border border-gray-200 relative overflow-hidden">
                                    <div className="flex justify-between items-center relative z-10">
                                        <div>
                                            <h4 className="text-2xl font-black text-gray-800 mb-2">Auditoria de Pedidos</h4>
                                            <p className="text-gray-500">Inspecionar solicitações, conferir tempos de separação e analisar motivos de cancelamento.</p>
                                        </div>
                                        <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center text-3xl group-hover:bg-red-600 group-hover:text-white transition">🔍</div>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-gray-200 to-gray-400 group-hover:from-red-600 group-hover:to-black transition-all"></div>
                                </Link>

                                <Link href={route('romaneios.index')} className="group bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition border border-gray-200 relative overflow-hidden">
                                    <div className="flex justify-between items-center relative z-10">
                                        <div>
                                            <h4 className="text-2xl font-black text-gray-800 mb-2">Monitoramento de Cargas</h4>
                                            <p className="text-gray-500">Visualizar manifestos, conferir motoristas e rastrear status de entrega das lojas.</p>
                                        </div>
                                        <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center text-3xl group-hover:bg-black group-hover:text-white transition">🗺️</div>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-gray-200 to-gray-400 group-hover:from-black group-hover:to-gray-600 transition-all"></div>
                                </Link>
                            </div>
                        </>
                    )}

                    {/* --- VISÃO DO CD (FÁBRICA) - COM AUTO REFRESH --- */}
                    {perfil === 'cd' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                                {/* Adicionei uma animaçãozinha no número para mostrar que atualizou */}
                                <CardStat 
                                    titulo="Novas Solicitações" 
                                    valor={stats.pendentes} 
                                    icon="📝" 
                                    color="text-yellow-600" 
                                    bg="bg-yellow-50 border-yellow-200" 
                                    link={route('pedidos.index')} 
                                    animate={true} // Nova prop
                                />
                                <CardStat titulo="Motos no Pátio (Pool)" valor={stats.no_patio} icon="🏍" color="text-indigo-600" bg="bg-indigo-50 border-indigo-200" desc="Prontas p/ Carga" link={route('romaneios.create')} animate={true} />
                                <CardStat titulo="Cargas Expedidas" valor={stats.cargas_total} icon="🚛" color="text-blue-600" bg="bg-blue-50 border-blue-200" link={route('romaneios.index')} />
                                <CardStat titulo="Entregues Hoje" valor={stats.hoje} icon="✅" color="text-green-600" bg="bg-green-50 border-green-200" />
                            </div>

                            <h3 className="text-lg font-bold text-gray-700 mb-4 px-1">Operações Logísticas</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Link href={route('pedidos.index')} className="group bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl transition border border-gray-100 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition text-6xl">📋</div>
                                    <h4 className="text-xl font-bold text-gray-800 mb-2">1. Conferência</h4>
                                    <p className="text-sm text-gray-500 mb-4">Verificar novos pedidos das lojas e separar motos.</p>
                                    <span className="text-blue-600 font-bold text-sm group-hover:translate-x-2 transition inline-block">Acessar Pedidos &rarr;</span>
                                </Link>

                                <Link href={route('romaneios.create')} className="group bg-gray-800 p-6 rounded-2xl shadow-md hover:shadow-2xl hover:bg-gray-900 transition border border-gray-700 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition text-6xl text-white">🚛</div>
                                    <h4 className="text-xl font-bold text-white mb-2">2. Expedição (Cargas)</h4>
                                    <p className="text-sm text-gray-300 mb-4">Agrupar motos separadas e gerar romaneio de transporte.</p>
                                    <span className="text-red-400 font-bold text-sm group-hover:translate-x-2 transition inline-block">Nova Carga &rarr;</span>
                                </Link>

                                <Link href={route('romaneios.index')} className="group bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl transition border border-gray-100 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition text-6xl">🗂</div>
                                    <h4 className="text-xl font-bold text-gray-800 mb-2">3. Histórico de Cargas</h4>
                                    <p className="text-sm text-gray-500 mb-4">Consultar romaneios antigos e reimprimir documentos.</p>
                                    <span className="text-gray-600 font-bold text-sm group-hover:translate-x-2 transition inline-block">Ver Histórico &rarr;</span>
                                </Link>
                            </div>
                        </>
                    )}

                    {/* --- VISÃO DA LOJA --- */}
                    {perfil === 'loja' && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <Link href={route('solicitar')} className="md:col-span-2 group relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-700 to-red-600 p-8 text-white shadow-lg hover:shadow-2xl hover:to-red-800 transition transform hover:-translate-y-1">
                                    <div className="relative z-10">
                                        <div className="text-sm font-bold uppercase tracking-wider text-red-100 mb-1">Ação Rápida</div>
                                        <h3 className="text-3xl font-extrabold mb-2">Nova Solicitação</h3>
                                        <p className="text-red-100 max-w-md">Cadastre manualmente os chassis e modelos que deseja solicitar ao CD.</p>
                                        <div className="mt-8 inline-flex items-center bg-white text-red-700 px-6 py-3 rounded-full font-bold shadow-sm group-hover:bg-gray-100 transition"><span className="mr-2 text-xl">➕</span> Criar Pedido Agora</div>
                                    </div>
                                    <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10"><svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg></div>
                                </Link>

                                <div className="grid grid-rows-2 gap-6">
                                    <Link href={route('pedidos.index')} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition border-l-4 border-blue-500 flex items-center justify-between">
                                        <div>
                                            <p className="text-gray-500 text-xs font-bold uppercase">A Chegar</p>
                                            <p className="text-3xl font-bold text-gray-800">{stats.receber}</p>
                                            <p className="text-xs text-blue-600 font-bold mt-1">Motos em trânsito</p>
                                        </div>
                                        <div className="text-4xl">🚛</div>
                                    </Link>

                                    <Link href={route('pedidos.index')} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition border-l-4 border-gray-500 flex items-center justify-between">
                                        <div>
                                            <p className="text-gray-500 text-xs font-bold uppercase">Total Pedidos</p>
                                            <p className="text-3xl font-bold text-gray-800">{stats.meus_pedidos}</p>
                                            <p className="text-xs text-gray-600 font-bold mt-1">Histórico completo</p>
                                        </div>
                                        <div className="text-4xl">📦</div>
                                    </Link>
                                </div>
                            </div>

                            <div className="mt-10">
                                <h3 className="text-lg font-bold text-gray-700 mb-4 px-1">Últimas Atualizações</h3>
                                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 text-center text-gray-500">
                                    <p>Acesse "Meus Pedidos" para ver o rastreamento detalhado.</p>
                                    <Link href={route('pedidos.index')} className="mt-4 inline-block text-red-600 font-bold hover:underline">Ir para Rastreamento &rarr;</Link>
                                </div>
                            </div>
                        </>
                    )}

                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// Componente Card com Animação Opcional
function CardStat({ titulo, valor, icon, color, bg, desc, link, animate = false }) {
    const CardContent = () => (
        <div className={`p-6 rounded-2xl shadow-sm border transition hover:shadow-md ${bg}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className={`text-xs font-bold uppercase tracking-wide ${color}`}>{titulo}</p>
                    {/* A key={valor} força o React a refazer a animação quando o número mudar */}
                    <h4 key={valor} className={`text-3xl font-extrabold text-gray-800 mt-2 ${animate ? 'animate-pulse-once' : ''}`}>
                        {valor}
                    </h4>
                    {desc && <p className="text-xs text-gray-400 mt-1">{desc}</p>}
                </div>
                <div className="text-3xl opacity-80">{icon}</div>
            </div>
        </div>
    );

    return link ? <Link href={link}><CardContent /></Link> : <CardContent />;
}