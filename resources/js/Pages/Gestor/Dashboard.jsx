import AppLayout from '@/Layouts/AppLayout';
import { Card, PageHeader, Button, Tabs, EmptyState } from '@/Components/UI';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { 
    HandRaisedIcon, 
    ClipboardDocumentListIcon, 
    ShoppingBagIcon, 
    ArrowUturnLeftIcon, 
    ArrowPathIcon, 
    ArchiveBoxIcon, 
    ArrowDownIcon, 
    ExclamationTriangleIcon, 
    UserIcon, 
    ScissorsIcon, 
    CheckCircleIcon, 
    HandThumbUpIcon, 
    BuildingStorefrontIcon,
    ArrowRightIcon
} from '@heroicons/react/24/outline';

export default function GestorDashboard({ auth, pedidos, estornos }) {

    const [activeTab, setActiveTab] = useState('pedidos'); // 'pedidos' ou 'estornos'

    // --- REALTIME ---
    useEffect(() => {
        if (!auth.user?.id) return;
        
        const channel = window.Echo.private(`App.Models.User.${auth.user.id}`);

        channel.notification((notification) => {
            const audio = new Audio('/plim.mp3');
            audio.play().catch(()=>{});

            const isEstorno = notification.type?.includes('Estorno');
            
            Swal.fire({
                toast: true, position: 'top-end', showConfirmButton: false, timer: 5000, timerProgressBar: true,
                icon: isEstorno ? 'warning' : 'info', 
                title: isEstorno ? 'Estorno Solicitado!' : 'Nova Solicitação!', 
                text: notification.mensagem 
            });

            router.reload({ only: ['pedidos', 'estornos'] });
        });

        return () => channel.stopListening('Notification');
    }, [auth.user?.id]);

    const handleAprovarEstorno = (motoId) => {
        Swal.fire({
            title: 'Aprovar Devolução?',
            text: "A moto sairá do pedido e voltará ao estoque disponível.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sim, Aprovar Corte'
        }).then((result) => {
            if (result.isConfirmed) {
                router.post(route('gestor.aprovarEstorno', motoId));
            }
        });
    };

    // Helper seguro para nome da loja
    const getLojaNome = (user) => user ? (user.filial || user.name) : 'Usuário Removido';

    return (
        <AppLayout user={auth.user}>
            <Head title="Gestão Comercial" />

            <PageHeader
                title={`Olá, ${auth.user.name.split(' ')[0]}`}
                description={`${pedidos.length} solicitação(ões) e ${estornos.length} estorno(s) aguardando sua decisão.`}
                breadcrumbs={[{ label: 'Gestão' }, { label: 'Painel' }]}
                actions={
                    <Button variant="secondary" icon={ClipboardDocumentListIcon} href={route('gestor.historico')}>
                        Histórico
                    </Button>
                }
            />

            <div>
                    <Tabs
                        className="mb-8"
                        active={activeTab}
                        onChange={setActiveTab}
                        tabs={[
                            { key: 'pedidos', label: 'Solicitações', count: pedidos.length, icon: ShoppingBagIcon },
                            { key: 'estornos', label: 'Estornos', count: estornos.length, icon: ArrowUturnLeftIcon },
                        ]}
                    />

                    {/* ABA 1: PEDIDOS (Agora com suporte v2) */}
                    {activeTab === 'pedidos' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                            {pedidos.map((pedido) => (
                                <Link key={pedido.id} href={route('gestor.show', pedido.id)} className="group block">
                                    <div className={`bg-surface-card rounded-2xl shadow-sm border-2 border-transparent hover:shadow-xl transition-all duration-300 p-6 relative overflow-hidden h-full ${pedido.tipo === 'transferencia' ? 'hover:border-status-warning-solid' : 'hover:border-brand-500'}`}>
                                        
                                        {/* Barra Lateral (Laranja para Transf, Roxa para CD) */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${pedido.tipo === 'transferencia' ? 'bg-status-warning-solid' : 'bg-brand-500'}`}></div>
                                        
                                        <div className="mb-4 pl-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                {pedido.tipo === 'transferencia' ? (
                                                    <span className="bg-status-warning-bg text-status-warning-fg text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide border border-status-warning-solid/30 flex items-center gap-1">
                                                        <ArrowPathIcon className="w-3 h-3" /> Transferência
                                                    </span>
                                                ) : (
                                                    <span className="bg-brand-100 text-brand-800 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide border border-brand-600/30 flex items-center gap-1">
                                                        <ArchiveBoxIcon className="w-3 h-3" /> Reposição
                                                    </span>
                                                )}
                                                <span className="text-xs text-content-muted">#{pedido.id} • {pedido.created_at}</span>
                                            </div>
                                            
                                            {/* Logística: Origem -> Destino */}
                                            <div className="mt-3 space-y-1">
                                                <div className="flex items-center gap-2 text-xs text-content-muted">
                                                    <span>De:</span>
                                                    <strong className={pedido.tipo === 'transferencia' ? 'text-status-warning-fg' : 'text-content-secondary'}>
                                                        {pedido.origem_nome}
                                                    </strong>
                                                </div>
                                                <div className="text-content-muted text-xs ml-1 flex justify-center w-6">
                                                    <ArrowDownIcon className="w-3 h-3" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-content-muted">Para:</span>
                                                    <h4 className="text-lg font-bold text-content-primary leading-none">
                                                        {pedido.solicitante}
                                                    </h4>
                                                </div>
                                                {/* Lista Organizada de Itens Solicitados */}
                                                {pedido.itens_summary && pedido.itens_summary.length > 0 && (
                                                    <div className="mt-3 space-y-1.5 bg-surface-sunken/80 p-2.5 rounded-xl border border-line">
                                                        <span className="text-[10px] font-bold text-content-muted uppercase tracking-wider block mb-1">
                                                            Itens Solicitados
                                                        </span>
                                                        {pedido.itens_summary.slice(0, 3).map((item, idx) => (
                                                            <div key={idx} className="flex items-center justify-between text-xs bg-surface-card px-2.5 py-1.5 rounded-md border border-line shadow-2xs">
                                                                <span className="font-bold text-content-secondary truncate mr-2" title={item.modelo}>
                                                                    {item.modelo}
                                                                </span>
                                                                <span className="flex items-center gap-1.5 shrink-0">
                                                                    <span className="text-[11px] text-content-muted font-medium capitalize">
                                                                        {item.cor}
                                                                    </span>
                                                                    <span className="bg-brand-100 text-brand-800 text-[10px] font-black px-1.5 py-0.5 rounded">
                                                                        {item.qtd}x
                                                                    </span>
                                                                </span>
                                                            </div>
                                                        ))}
                                                        {pedido.itens_summary.length > 3 && (
                                                            <p className="text-[10px] text-brand-700 font-bold text-center pt-0.5">
                                                                + {pedido.itens_summary.length - 3} outro(s) modelo(s) no pedido
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-end border-t border-line pt-4 pl-3">
                                            <div>
                                                <p className={`text-3xl font-black leading-none ${pedido.tipo === 'transferencia' ? 'text-status-warning-fg' : 'text-brand-700'}`}>{pedido.qtd_motos || 0}</p>
                                                <p className="text-[10px] text-content-muted font-bold uppercase mt-1">Motos</p>
                                            </div>
                                            <span className="text-content-muted text-xs font-bold group-hover:underline flex items-center gap-1 group-hover:text-black">
                                                Analisar <ArrowRightIcon className="w-4 h-4" />
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                            
                            {pedidos.length === 0 && (
                                <Card className="col-span-full">
                                    <EmptyState
                                        icon={CheckCircleIcon}
                                        title="Nenhuma pendência"
                                        description="Tudo limpo — as lojas não enviaram novas solicitações."
                                    />
                                </Card>
                            )}
                        </div>
                    )}

                    {/* ABA 2: ESTORNOS */}
                    {activeTab === 'estornos' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
                            {estornos.map((moto) => (
                                <div key={moto.id} className="bg-surface-card rounded-2xl shadow-sm border border-status-warning-solid/20 hover:shadow-lg transition-all duration-300 p-0 relative overflow-hidden">
                                    <div className="bg-status-warning-bg p-4 border-b border-status-warning-solid/20 flex justify-between items-start">
                                        <div>
                                            <span className="bg-status-warning-bg text-status-warning-fg text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide flex items-center gap-1 w-fit">
                                                {moto.motivo_estorno && moto.motivo_estorno.includes('CD Reportou') ? (
                                                    <><ArchiveBoxIcon className="w-3 h-3" /> CD Reportou</>
                                                ) : (
                                                    <><BuildingStorefrontIcon className="w-3 h-3" /> Loja Reportou</>
                                                )}
                                            </span>
                                            <h4 className="text-md font-bold text-content-primary mt-2">{moto.modelo}</h4>
                                            <p className="font-mono text-xs text-status-warning-fg">{moto.chassi}</p>
                                        </div>
                                        <ExclamationTriangleIcon className="w-6 h-6 text-status-warning-fg" />
                                    </div>

                                    <div className="p-4">
                                        <div className="mb-4">
                                            <p className="text-xs font-bold text-content-muted uppercase mb-1">Motivo</p>
                                            <p className="text-sm text-content-secondary bg-surface-sunken p-2 rounded border border-line italic">
                                                "{moto.motivo_estorno || 'Sem motivo'}"
                                            </p>
                                        </div>
                                        <div className="mb-4">
                                            <p className="text-xs font-bold text-content-muted uppercase mb-1">Origem do Pedido</p>
                                            <p className="text-sm text-content-primary flex items-center gap-1">
                                                <UserIcon className="w-4 h-4 text-content-muted" /> {moto.solicitante_original}
                                            </p>
                                        </div>
                                        <button onClick={() => handleAprovarEstorno(moto.id)} className="w-full bg-surface-card border-2 border-status-warning-solid text-status-warning-fg hover:bg-status-warning-solid hover:text-white font-bold py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                            <ScissorsIcon className="w-5 h-5" /> Aprovar Corte
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {estornos.length === 0 && (
                                <Card className="col-span-full">
                                    <EmptyState
                                        icon={HandThumbUpIcon}
                                        title="Nenhum estorno"
                                        description="Nenhum problema foi reportado pelas lojas."
                                    />
                                </Card>
                            )}
                        </div>
                    )}

            </div>
        </AppLayout>
    );
}
