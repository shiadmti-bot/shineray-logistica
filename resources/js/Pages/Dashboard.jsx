import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export default function Dashboard({ auth, stats, perfil }) {
    
    // Saudação baseada na hora
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    
    // Estados visuais
    const [animatePulse, setAnimatePulse] = useState(false);
    const [showSeparationModal, setShowSeparationModal] = useState(false);

    // --- LÓGICA: POP-UP DE SEPARAÇÃO PENDENTE (LOJA) ---
    useEffect(() => {
        if (perfil === 'loja' && stats.transferencias_saida > 0) {
            // Pequeno delay para garantir que a tela carregou antes de mostrar o modal
            setTimeout(() => setShowSeparationModal(true), 500);
        }
    }, [perfil, stats.transferencias_saida]);

    // --- LÓGICA: AUTO-REFRESH (CD/ADMIN) ---
    useEffect(() => {
        if (perfil === 'cd' || perfil === 'admin') {
            const timer = setInterval(() => {
                router.reload({ 
                    only: ['stats'], 
                    preserveScroll: true, 
                    preserveState: true,
                    onSuccess: () => {
                        setAnimatePulse(true);
                        setTimeout(() => setAnimatePulse(false), 1000);
                    }
                });
            }, 15000); 
            return () => clearInterval(timer);
        }
    }, [perfil]);

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <div className="flex justify-between items-center">
                    <h2 className="font-bold text-xl text-gray-800 leading-tight">Painel de Controle</h2>
                    {/* Indicador de Ao Vivo para o CD */}
                    {(perfil === 'cd' || perfil === 'admin') && (
                        <span className="text-xs font-mono text-gray-500 flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100 transition-all">
                            <span className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.6)] transition-colors duration-500 ${animatePulse ? 'bg-green-400 scale-125' : 'bg-green-600'}`}></span>
                            Tempo Real
                        </span>
                    )}
                </div>
            }
        >
            <Head title="Dashboard" />

            <div className="py-6 md:py-10 bg-gray-50 min-h-screen relative">
                
                {/* --- MODAL DE ALERTA DE SEPARAÇÃO (POP-UP) --- */}
                {showSeparationModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-sm transition-opacity duration-300">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transform transition-all scale-100 p-8 text-center border-t-8 border-orange-600 relative animate-fade-in-up">
                            
                            {/* Ícone Animado */}
                            <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-orange-100 mb-6 animate-bounce">
                                <span className="text-5xl">📦</span>
                            </div>

                            <h3 className="text-3xl font-black text-gray-900 mb-2 uppercase tracking-tight">
                                Atenção Necessária!
                            </h3>
                            
                            <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                                Você possui <strong className="text-orange-600 text-2xl border-b-2 border-orange-200">{stats.transferencias_saida} pedidos</strong> de transferência aguardando separação imediata.
                            </p>

                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-8 text-left">
                                <p className="text-sm text-orange-800 font-bold flex items-center gap-2">
                                    <span>🚛</span> O Caminhão vai passar!
                                </p>
                                <p className="text-xs text-orange-700 mt-1">
                                    Estas motos devem ser separadas fisicamente no pátio para que o motorista possa realizar a coleta.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <Link 
                                    href={route('pedidos.index')} 
                                    className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:-translate-y-1 transition text-lg flex items-center justify-center gap-2"
                                >
                                    IR PARA SEPARAÇÃO AGORA ➔
                                </Link>
                                <button 
                                    onClick={() => setShowSeparationModal(false)}
                                    className="text-gray-400 hover:text-gray-600 text-sm font-medium py-2 hover:underline"
                                >
                                    Ver dashboard primeiro (Não recomendado)
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* CABEÇALHO DE BOAS VINDAS */}
                    <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8 mb-8 border-l-8 border-red-600 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:shadow-md">
                        <div>
                            <h3 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight leading-tight">
                                {saudacao}, <span className="text-red-700">{auth.user.name.split(' ')[0]}</span>!
                            </h3>
                            <p className="text-gray-500 mt-2 font-medium text-sm md:text-base">
                                Sistema de Logística Integrada <span className="text-red-600 font-bold">Shineray By Sabel</span>.
                            </p>
                        </div>
                        <div className="w-full md:w-auto text-left md:text-right">
                            <span className={`inline-block px-4 py-2 rounded-full text-xs md:text-sm font-bold uppercase tracking-wider border shadow-sm ${
                                perfil === 'cd' ? 'bg-gray-900 text-white border-gray-900' : 
                                perfil === 'admin' ? 'bg-black text-white border-black' : 
                                'bg-red-50 text-red-700 border-red-200'
                            }`}>
                                {perfil === 'cd' ? '🏭 CD / Expedição' : 
                                 perfil === 'admin' ? '🕵️ Auditoria / Admin' : 
                                 '🏪 Loja / Revenda'}
                            </span>
                            <p className="text-xs text-gray-400 mt-2 font-mono">
                                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                    </div>

                    {/* --- VISÃO ADMIN / DIRETORIA --- */}
                    {perfil === 'admin' && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
                                <CardStat titulo="Total Histórico" valor={stats.total_pedidos} icon="📊" color="text-gray-600" bg="bg-white border-gray-200" desc="Pedidos processados" />
                                <CardStat titulo="Em Operação" valor={stats.em_andamento} icon="⚙️" color="text-blue-600" bg="bg-blue-50 border-blue-200" desc="Fluxo ativo agora" />
                                <CardStat titulo="Cargas na Rua" valor={stats.cargas_transito} icon="🚛" color="text-orange-600" bg="bg-orange-50 border-orange-200" desc="Romaneios em trânsito" />
                                <CardStat titulo="Cancelados" valor={stats.cancelados} icon="🚨" color="text-red-600" bg="bg-red-50 border-red-200" desc="Devoluções/Erros" link={route('pedidos.index')} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <ActionCard href={route('pedidos.index')} title="Auditoria de Pedidos" desc="Inspecionar solicitações e tempos." icon="🔍" color="red" btnText="Ver Pedidos" />
                                <ActionCard href={route('romaneios.index')} title="Monitoramento de Cargas" desc="Rastrear motoristas e entregas." icon="🗺️" color="black" btnText="Ver Cargas" />
                            </div>
                        </>
                    )}

                    {/* --- VISÃO CD --- */}
                    {perfil === 'cd' && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
                                <CardStat titulo="Novas Solicitações" valor={stats.pendentes} icon="📝" color="text-yellow-600" bg="bg-yellow-50 border-yellow-200" link={route('pedidos.index')} animate={true} desc="Aguardando Separação" />
                                <CardStat titulo="Pronto p/ Carga" valor={stats.no_patio} icon="🏍" color="text-indigo-600" bg="bg-indigo-50 border-indigo-200" desc="Pool de Expedição" link={route('romaneios.create')} animate={true} />
                                <CardStat titulo="Cargas Expedidas" valor={stats.cargas_total} icon="🚛" color="text-blue-600" bg="bg-blue-50 border-blue-200" link={route('romaneios.index')} desc="Total Geral" />
                                <CardStat titulo="Entregues Hoje" valor={stats.hoje} icon="✅" color="text-green-600" bg="bg-green-50 border-green-200" desc="Meta Diária" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-700 mb-4 px-1 flex items-center gap-2"><span>🏭</span> Mesa de Operações</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <ActionCard href={route('pedidos.index')} title="1. Separação" desc="Conferir estoque e separar motos." icon="📋" color="blue" btnText="Acessar Pedidos" />
                                <ActionCard href={route('romaneios.create')} title="2. Expedição" desc="Montar cargas e definir rotas." icon="🚛" color="gray" btnText="Nova Carga" />
                                <ActionCard href={route('romaneios.index')} title="3. Histórico" desc="Consultar cargas antigas." icon="🗂" color="white" btnText="Ver Histórico" />
                            </div>
                        </>
                    )}

                    {/* --- VISÃO LOJA (COM ALERTA NO DASH TAMBÉM) --- */}
                    {perfil === 'loja' && (
                        <>
                            {/* Bloco de Alerta Fixo (caso feche o modal) */}
                            {stats.transferencias_saida > 0 && (
                                <Link href={route('pedidos.index')} className="block mb-8 group transform transition hover:-translate-y-1">
                                    <div className="bg-orange-50 border-l-8 border-orange-500 rounded-2xl p-6 shadow-md hover:shadow-lg transition flex flex-col md:flex-row justify-between items-center relative overflow-hidden gap-4">
                                        <div className="relative z-10">
                                            <h3 className="text-xl font-black text-orange-900 flex items-center gap-2">
                                                <span className="text-2xl animate-bounce">🔔</span> PENDÊNCIA: Separação Necessária!
                                            </h3>
                                            <p className="text-orange-800 mt-1 font-medium">
                                                <span className="font-bold text-orange-900 text-lg border-b-2 border-orange-900">{stats.transferencias_saida} pedidos</span> aguardando separação na sua loja.
                                            </p>
                                        </div>
                                        <div className="bg-orange-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg group-hover:bg-orange-700 transition relative z-10 whitespace-nowrap">
                                            RESOLVER AGORA &rarr;
                                        </div>
                                        <div className="absolute right-0 top-0 opacity-10 text-9xl -mr-6 -mt-6 text-orange-600 rotate-12">📦</div>
                                    </div>
                                </Link>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                                <Link href={route('solicitar')} className="lg:col-span-2 group relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-700 to-red-600 p-6 md:p-8 text-white shadow-lg hover:shadow-2xl hover:to-red-800 transition transform hover:-translate-y-1">
                                    <div className="relative z-10 flex flex-col h-full justify-between">
                                        <div>
                                            <div className="text-xs font-bold uppercase tracking-wider text-red-200 mb-2">Estoque Baixo?</div>
                                            <h3 className="text-2xl md:text-3xl font-extrabold mb-2">Fazer Pedido / Reposição</h3>
                                            <p className="text-red-100 max-w-md text-sm md:text-base leading-relaxed">
                                                Solicite motos ao CD ou transferências. Toda solicitação passará pela aprovação do Gestor.
                                            </p>
                                        </div>
                                        <div className="mt-6 md:mt-8 inline-flex items-center bg-white text-red-700 px-6 py-3 rounded-full font-bold shadow-sm group-hover:bg-gray-100 transition w-max">
                                            <span className="mr-2 text-xl">➕</span> Nova Solicitação
                                        </div>
                                    </div>
                                    <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10 group-hover:translate-x-5 group-hover:translate-y-5 transition duration-500">
                                        <svg className="w-48 h-48 md:w-64 md:h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                                    </div>
                                </Link>

                                <div className="grid grid-cols-1 gap-4">
                                    <Link href={route('pedidos.index')} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition border-l-4 border-blue-500 flex items-center justify-between group h-full">
                                        <div>
                                            <p className="text-gray-500 text-xs font-bold uppercase mb-1 tracking-wide">A Chegar (Entradas)</p>
                                            <p className="text-4xl font-black text-gray-800 group-hover:text-blue-600 transition">{stats.receber}</p>
                                            <p className="text-xs text-blue-600 font-bold mt-1 bg-blue-50 px-2 py-0.5 rounded w-fit">Motos em trânsito</p>
                                        </div>
                                        <div className="text-4xl opacity-80 group-hover:scale-110 transition group-hover:-rotate-12">📥</div>
                                    </Link>

                                    <Link href={route('pedidos.index')} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition border-l-4 border-gray-500 flex items-center justify-between group h-full">
                                        <div>
                                            <p className="text-gray-500 text-xs font-bold uppercase mb-1 tracking-wide">Meus Pedidos</p>
                                            <p className="text-4xl font-black text-gray-800 group-hover:text-gray-600 transition">{stats.meus_pedidos}</p>
                                            <p className="text-xs text-gray-500 font-bold mt-1">Histórico completo</p>
                                        </div>
                                        <div className="text-4xl opacity-80 group-hover:scale-110 transition group-hover:rotate-12">📦</div>
                                    </Link>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// --- SUBCOMPONENTES ---
function CardStat({ titulo, valor, icon, color, bg, desc, link, animate = false }) {
    const Content = () => (
        <div className={`p-5 md:p-6 rounded-2xl shadow-sm border transition hover:shadow-md h-full flex flex-col justify-between ${bg} cursor-default hover:-translate-y-1 transform duration-200`}>
            <div className="flex justify-between items-start mb-2">
                <p className={`text-xs font-bold uppercase tracking-wide ${color}`}>{titulo}</p>
                <div className="text-2xl md:text-3xl opacity-80">{icon}</div>
            </div>
            <div>
                <h4 className={`text-3xl md:text-4xl font-black text-gray-800 tracking-tight ${animate ? 'animate-pulse' : ''}`}>{valor}</h4>
                {desc && <p className="text-xs text-gray-500 mt-1 font-medium">{desc}</p>}
            </div>
        </div>
    );
    return link ? <Link href={link} className="block h-full"><Content /></Link> : <Content />;
}

function ActionCard({ href, title, desc, icon, color, btnText }) {
    const colors = {
        red: 'hover:border-red-500 hover:shadow-red-100',
        blue: 'hover:border-blue-500 hover:shadow-blue-100',
        gray: 'hover:border-gray-600 hover:shadow-gray-200',
        black: 'hover:border-black hover:shadow-gray-300',
        white: 'hover:border-gray-400 hover:shadow-gray-100'
    };
    const bgIcon = color === 'gray' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600';

    return (
        <Link href={href} className={`group bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl transition border border-gray-100 relative overflow-hidden flex flex-col h-full ${colors[color] || ''}`}>
            <div className="flex justify-between items-start relative z-10 mb-4">
                <div>
                    <h4 className={`text-xl font-bold mb-2 group-hover:text-${color === 'gray' ? 'gray-900' : 'red-600'} transition text-gray-800`}>{title}</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
                <div className={`h-12 w-12 rounded-full flex items-center justify-center text-2xl transition transform group-hover:scale-110 ${bgIcon}`}>{icon}</div>
            </div>
            {btnText && (
                <div className="mt-auto pt-4">
                    <span className="text-sm font-bold text-gray-400 group-hover:text-gray-900 transition flex items-center gap-1">
                        {btnText} <span className="transform group-hover:translate-x-1 transition">&rarr;</span>
                    </span>
                </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-100 to-gray-200 group-hover:from-red-500 group-hover:to-red-700 transition-all duration-300"></div>
        </Link>
    );
}