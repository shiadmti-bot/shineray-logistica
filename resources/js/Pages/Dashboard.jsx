import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import NoticeBoard from '@/Components/NoticeBoard'; // Novo Componente
import axios from 'axios';
import { 
    ClockIcon, 
    TruckIcon, 
    ClipboardDocumentCheckIcon, 
    ArchiveBoxIcon, 
    ArrowPathIcon,
    ExclamationTriangleIcon,
    CurrencyDollarIcon,
    UserIcon,
    BuildingStorefrontIcon,
    ArrowRightIcon,
    ShoppingCartIcon,
    CubeIcon,
    WrenchScrewdriverIcon,
    PauseCircleIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline';

export default function Dashboard({ auth, stats, perfil, notices }) { // Recebe notices via prop
    
    // Saudação baseada na hora
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    
    // Estados visuais
    const [animatePulse, setAnimatePulse] = useState(false);
    const [showSeparationModal, setShowSeparationModal] = useState(false);
    
    // Estados do Estoque CD (Microwork)
    const [estoqueCD, setEstoqueCD] = useState(null);
    const [loadingEstoque, setLoadingEstoque] = useState(false);

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
                    only: ['stats', 'notices'], // Atualiza avisos também
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

    // --- LÓGICA: FETCH ESTOQUE CD (ADMIN E CD) ---
    useEffect(() => {
        if (perfil === 'admin' || perfil === 'gestor' || perfil === 'cd') {
            setLoadingEstoque(true);
            axios.get(route('api.estoque.microwork'))
                .then(res => {
                    const dados = Array.isArray(res.data.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
                    setEstoqueCD(dados);
                })
                .catch(err => console.error("Erro API Microwork (Dashboard)", err))
                .finally(() => setLoadingEstoque(false));
        }
    }, [perfil]);

    // --- CALCULOS KPI DO ESTOQUE ---
    const kpisEstoque = {
        disponivel: 0,
        separada: 0,
        conserto: 0,
        parada: 0
    };

    if (estoqueCD) {
        estoqueCD.forEach(moto => {
            const patioStr = (moto.patio || '').toUpperCase();
            if (patioStr.includes('MOTOS MONTADAS') || patioStr.includes('DESMONTADA CD')) {
                kpisEstoque.disponivel++;
            } else if (patioStr.includes('CD EXPEDI')) {
                kpisEstoque.separada++;
            } else if (patioStr.includes('AVARIA')) {
                kpisEstoque.conserto++;
            } else if (patioStr.includes('INATIVADA')) {
                kpisEstoque.parada++;
            }
        });
    }

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <div className="flex justify-between items-center">
                    <h2 className="font-bold text-xl text-gray-800 leading-tight flex items-center gap-2">
                        <BuildingStorefrontIcon className="w-6 h-6 text-gray-400" />
                        Painel de Controle
                    </h2>
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
                                <ArchiveBoxIcon className="w-12 h-12 text-orange-600" />
                            </div>

                            <h3 className="text-3xl font-black text-gray-900 mb-2 uppercase tracking-tight">
                                Atenção Necessária!
                            </h3>
                            
                            <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                                Você possui <strong className="text-orange-600 text-2xl border-b-2 border-orange-200">{stats.transferencias_saida} pedidos</strong> de transferência aguardando separação imediata.
                            </p>

                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-8 text-left">
                                <p className="text-sm text-orange-800 font-bold flex items-center gap-2">
                                    <TruckIcon className="w-5 h-5" /> O Caminhão vai passar!
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
                                    IR PARA SEPARAÇÃO AGORA <ArrowRightIcon className="w-5 h-5" />
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
                            <span className={`px-4 py-2 rounded-full text-xs md:text-sm font-bold uppercase tracking-wider border shadow-sm flex items-center gap-2 ${
                                perfil === 'cd' ? 'bg-gray-900 text-white border-gray-900' : 
                                perfil === 'admin' ? 'bg-black text-white border-black' : 
                                'bg-red-50 text-red-700 border-red-200'
                            }`}>
                                {perfil === 'cd' ? <><ArchiveBoxIcon className="w-4 h-4" /> CD / Expedição</> : 
                                 perfil === 'admin' ? <><ClipboardDocumentCheckIcon className="w-4 h-4" /> Auditoria / Admin</> : 
                                 <><BuildingStorefrontIcon className="w-4 h-4" /> Loja / Revenda</>}
                            </span>
                            <p className="text-xs text-gray-400 mt-2 font-mono flex items-center justify-end gap-1">
                                <ClockIcon className="w-3 h-3" />
                                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                    </div>

                    {/* --- MURAL DE AVISOS (NOVO) --- */}
                    <NoticeBoard notices={notices} auth={auth} />

                    {/* --- VISÃO ADMIN / DIRETORIA --- */}
                    {perfil === 'admin' && (
                        <>
                            <div className="flex justify-between items-center mb-4 mt-2">
                                <h3 className="text-lg uppercase tracking-wider font-black text-gray-500 flex items-center gap-2">
                                    <ClipboardDocumentCheckIcon className="w-5 h-5" /> Movimentação de Pedidos
                                </h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
                                <CardStat titulo="Total Histórico" valor={stats.total_pedidos} icon={<ArchiveBoxIcon className="w-8 h-8"/>} color="text-gray-600" bg="bg-white border-gray-200" desc="Pedidos processados" />
                                <CardStat titulo="Em Operação" valor={stats.em_andamento} icon={<ArrowPathIcon className="w-8 h-8"/>} color="text-blue-600" bg="bg-blue-50 border-blue-200" desc="Fluxo ativo agora" />
                                <CardStat titulo="Cargas na Rua" valor={stats.cargas_transito} icon={<TruckIcon className="w-8 h-8"/>} color="text-orange-600" bg="bg-orange-50 border-orange-200" desc="Romaneios em trânsito" />
                                <CardStat titulo="Cancelados" valor={stats.cancelados} icon={<ExclamationTriangleIcon className="w-8 h-8"/>} color="text-red-600" bg="bg-red-50 border-red-200" desc="Devoluções/Erros" link={route('pedidos.index')} />
                            </div>

                            <div className="flex justify-between items-center mb-4 mt-8">
                                <h3 className="text-lg uppercase tracking-wider font-black text-gray-500 flex items-center gap-2">
                                    <CubeIcon className="w-5 h-5" /> Estoque Físico CD (Real-time ERP)
                                </h3>
                                {loadingEstoque && <span className="text-sm font-bold text-gray-400 flex items-center gap-2"><ArrowPathIcon className="w-4 h-4 animate-spin"/> Atualizando ERP...</span>}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
                                <CardStat titulo="Disponível" valor={estoqueCD ? kpisEstoque.disponivel : '...'} icon={<CheckCircleIcon className="w-8 h-8"/>} color="text-green-700" bg="bg-green-50 border-green-200" desc="Motos prontas para faturar" />
                                <CardStat titulo="Separada" valor={estoqueCD ? kpisEstoque.separada : '...'} icon={<ArchiveBoxIcon className="w-8 h-8"/>} color="text-blue-700" bg="bg-blue-50 border-blue-200" desc="Aguardando carga/NF" />
                                <CardStat titulo="Em Conserto" valor={estoqueCD ? kpisEstoque.conserto : '...'} icon={<WrenchScrewdriverIcon className="w-8 h-8"/>} color="text-orange-700" bg="bg-orange-50 border-orange-200" desc="Avarias e retrabalho" />
                                <CardStat titulo="Parada" valor={estoqueCD ? kpisEstoque.parada : '...'} icon={<PauseCircleIcon className="w-8 h-8"/>} color="text-gray-700" bg="bg-gray-100 border-gray-300" desc="Inativadas / bloqueadas" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                <ActionCard href={route('pedidos.index')} title="Auditoria de Pedidos" desc="Inspecionar solicitações e tempos." icon={<ClipboardDocumentCheckIcon className="w-6 h-6"/>} color="red" btnText="Ver Pedidos" />
                                <ActionCard href={route('romaneios.index')} title="Monitoramento de Cargas" desc="Rastrear motoristas e entregas." icon={<TruckIcon className="w-6 h-6"/>} color="black" btnText="Ver Cargas" />
                            </div>
                        </>
                    )}

                    {/* --- VISÃO CD --- */}
                    {/* --- VISÃO CD --- */}
                    {perfil === 'cd' && (
                        <>
                            {/* ALERTA PRINCIPAL SE HOUVER PEDIDOS PENDENTES */}
                            {stats.pendentes > 0 && (
                                <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg flex items-center justify-between shadow-sm animate-pulse-slow">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-yellow-100 p-2 rounded-full">
                                            <ExclamationTriangleIcon className="w-8 h-8 text-yellow-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-yellow-800 font-bold text-lg">Ação Necessária: Separação de Pedidos!</h4>
                                            <p className="text-sm text-yellow-700">Existem <strong>{stats.pendentes} solicitações</strong> de chassi aguardando separação pelo CD.</p>
                                        </div>
                                    </div>
                                    <Link href={route('pedidos.index')} className="bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 whitespace-nowrap">
                                        Ir para Separação
                                    </Link>
                                </div>
                            )}

                            {/* MESA DE OPERAÇÕES PRINCIPAL (AÇÕES DIRETAS) */}
                            <h3 className="text-lg font-black text-gray-800 mb-4 px-1 flex items-center gap-2"><BuildingStorefrontIcon className="w-5 h-5 text-gray-500"/> Mesa de Operações Logísticas (O que deseja fazer?)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                <ActionCard 
                                    href={route('pedidos.index')} 
                                    title="1. Separar Pedidos" 
                                    desc={`${stats.pendentes} pedidos pendentes. Auditar e confirmar chassis no pátio físico.`} 
                                    icon={<ClipboardDocumentCheckIcon className="w-6 h-6"/>} 
                                    color="blue" 
                                    btnText="Acessar Solicitações" 
                                />
                                <ActionCard 
                                    href={route('romaneios.create')} 
                                    title="2. Montar Expedição" 
                                    desc={`${stats.no_patio} itens em Pool (Separados). Criar novo romaneio de carga para rota.`} 
                                    icon={<TruckIcon className="w-6 h-6"/>} 
                                    color="black" 
                                    btnText="Nova Carga" 
                                />
                                <ActionCard 
                                    href={route('romaneios.index')} 
                                    title="3. Romaneios / Rotas" 
                                    desc={`${stats.cargas_total} cargas já montadas. Monitorar trânsito, coletas remotas e histórico.`} 
                                    icon={<ArchiveBoxIcon className="w-6 h-6"/>} 
                                    color="gray" 
                                    btnText="Painel de Trânsito" 
                                />
                            </div>

                            {/* PAINEL COMPACTO DE ESTOQUE ERP (REAL-TIME) */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
                                <div className="flex justify-between items-center mb-6 border-b pb-4">
                                    <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                                        <CubeIcon className="w-6 h-6 text-gray-400" /> Resumo do Estoque Físico Microwork (Tempo Real)
                                    </h3>
                                    {loadingEstoque ? (
                                        <span className="text-xs font-bold text-gray-400 flex items-center gap-1"><ArrowPathIcon className="w-4 h-4 animate-spin"/> Atualizando ERP...</span>
                                    ) : (
                                        <Link href={route('motos.index')} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition">Ver Tabela Completa <ArrowRightIcon className="w-3 h-3"/></Link>
                                    )}
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                                    <div className="bg-green-50 rounded-2xl p-4 border border-green-100 flex flex-col justify-center items-center text-center shadow-sm hover:shadow-md transition cursor-default">
                                        <CheckCircleIcon className="w-6 h-6 text-green-600 mb-2 opacity-80" />
                                        <span className="text-3xl font-black text-green-800 tracking-tight">{estoqueCD ? kpisEstoque.disponivel : '...'}</span>
                                        <span className="text-xs font-bold text-green-700 uppercase tracking-widest mt-1 opacity-80">Prontas p/ Fatura</span>
                                    </div>
                                    <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex flex-col justify-center items-center text-center shadow-sm hover:shadow-md transition cursor-default">
                                        <ArchiveBoxIcon className="w-6 h-6 text-blue-600 mb-2 opacity-80" />
                                        <span className="text-3xl font-black text-blue-800 tracking-tight">{estoqueCD ? kpisEstoque.separada : '...'}</span>
                                        <span className="text-xs font-bold text-blue-700 uppercase tracking-widest mt-1 opacity-80">Separadas / Pool</span>
                                    </div>
                                    <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 flex flex-col justify-center items-center text-center shadow-sm hover:shadow-md transition cursor-default">
                                        <WrenchScrewdriverIcon className="w-6 h-6 text-orange-600 mb-2 opacity-80" />
                                        <span className="text-3xl font-black text-orange-800 tracking-tight">{estoqueCD ? kpisEstoque.conserto : '...'}</span>
                                        <span className="text-xs font-bold text-orange-700 uppercase tracking-widest mt-1 opacity-80">Em Conserto/Avaria</span>
                                    </div>
                                    <div className="bg-gray-100 rounded-2xl p-4 border border-gray-200 flex flex-col justify-center items-center text-center shadow-sm hover:shadow-md transition cursor-default">
                                        <PauseCircleIcon className="w-6 h-6 text-gray-500 mb-2 opacity-80" />
                                        <span className="text-3xl font-black text-gray-700 tracking-tight">{estoqueCD ? kpisEstoque.parada : '...'}</span>
                                        <span className="text-xs font-bold text-gray-600 uppercase tracking-widest mt-1 opacity-80">Bloqueadas/Inativas</span>
                                    </div>
                                </div>
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
                                                <ExclamationTriangleIcon className="w-8 h-8 animate-bounce" /> PENDÊNCIA: Separação Necessária!
                                            </h3>
                                            <p className="text-orange-800 mt-1 font-medium">
                                                <span className="font-bold text-orange-900 text-lg border-b-2 border-orange-900">{stats.transferencias_saida} pedidos</span> aguardando separação na sua loja.
                                            </p>
                                        </div>
                                        <div className="bg-orange-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg group-hover:bg-orange-700 transition relative z-10 whitespace-nowrap flex items-center gap-2">
                                            RESOLVER AGORA <ArrowRightIcon className="w-4 h-4" />
                                        </div>
                                        <div className="absolute right-0 top-0 opacity-10 -mr-6 -mt-6 text-orange-600 rotate-12">
                                            <ArchiveBoxIcon className="w-32 h-32" />
                                        </div>
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
                                            <span className="mr-2"><ShoppingCartIcon className="w-5 h-5"/></span> Nova Solicitação
                                        </div>
                                    </div>
                                    <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-10 translate-y-10 group-hover:translate-x-5 group-hover:translate-y-5 transition duration-500">
                                        <ShoppingCartIcon className="w-48 h-48 md:w-64 md:h-64" />
                                    </div>
                                </Link>

                                <div className="grid grid-cols-1 gap-4">
                                    <Link href={route('pedidos.index')} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition border-l-4 border-blue-500 flex items-center justify-between group h-full">
                                        <div>
                                            <p className="text-gray-500 text-xs font-bold uppercase mb-1 tracking-wide">A Chegar (Entradas)</p>
                                            <p className="text-4xl font-black text-gray-800 group-hover:text-blue-600 transition">{stats.receber}</p>
                                            <p className="text-xs text-blue-600 font-bold mt-1 bg-blue-50 px-2 py-0.5 rounded w-fit">Motos em trânsito</p>
                                        </div>
                                        <div className="opacity-80 group-hover:scale-110 transition group-hover:-rotate-12">
                                            <TruckIcon className="w-10 h-10 text-gray-400" />
                                        </div>
                                    </Link>

                                    <Link href={route('pedidos.index')} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition border-l-4 border-gray-500 flex items-center justify-between group h-full">
                                        <div>
                                            <p className="text-gray-500 text-xs font-bold uppercase mb-1 tracking-wide">Meus Pedidos</p>
                                            <p className="text-4xl font-black text-gray-800 group-hover:text-gray-600 transition">{stats.meus_pedidos}</p>
                                            <p className="text-xs text-gray-500 font-bold mt-1">Histórico completo</p>
                                        </div>
                                        <div className="opacity-80 group-hover:scale-110 transition group-hover:rotate-12">
                                            <ClipboardDocumentCheckIcon className="w-10 h-10 text-gray-400" />
                                        </div>
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
                <div className={`h-12 w-12 rounded-full flex items-center justify-center transition transform group-hover:scale-110 ${bgIcon}`}>{icon}</div>
            </div>
            {btnText && (
                <div className="mt-auto pt-4">
                    <span className="text-sm font-bold text-gray-400 group-hover:text-gray-900 transition flex items-center gap-1">
                        {btnText} <ArrowRightIcon className="w-4 h-4 transform group-hover:translate-x-1 transition" />
                    </span>
                </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-100 to-gray-200 group-hover:from-red-500 group-hover:to-red-700 transition-all duration-300"></div>
        </Link>
    );
}