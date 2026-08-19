import AppLayout from '@/Layouts/AppLayout';
import { PageHeader } from '@/Components/UI';
import { Head, useForm } from '@inertiajs/react';

export default function MotoTimeline({ auth, moto, timeline, filtro }) {
    const { data, setData, get, processing } = useForm({
        chassi: filtro || ''
    });

    const handleSearch = (e) => {
        e.preventDefault();
        get(route('motos.timeline'));
    };

    return (
        <AppLayout user={auth.user}>
            <Head title="Rastreio de Moto" />

            <PageHeader
                title="Rastreio de Chassi"
                breadcrumbs={[
                    { label: 'Início', href: route('dashboard') },
                    { label: 'Estoque' },
                    { label: 'Rastreio' }
                ]}
            />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* BUSCA */}
                    <div className="bg-surface-card p-6 rounded-xl shadow-sm border border-line mb-8">
                        <form onSubmit={handleSearch} className="flex gap-4">
                            <input 
                                type="text" 
                                placeholder="Digite os últimos dígitos do Chassi..." 
                                className="w-full border-line-strong rounded-lg shadow-sm focus:ring-status-info-solid focus:border-status-info-solid"
                                value={data.chassi}
                                onChange={e => setData('chassi', e.target.value)}
                            />
                            <button 
                                type="submit" 
                                disabled={processing}
                                className="bg-status-info-solid text-white px-6 py-2 rounded-lg font-bold hover:bg-status-info-solid transition disabled:opacity-50"
                            >
                                {processing ? 'Buscando...' : 'Rastrear'}
                            </button>
                        </form>
                    </div>

                    {moto ? (
                        <div className="space-y-6">
                            {/* CABEÇALHO DA MOTO */}
                            <div className="bg-surface-card p-6 rounded-xl border-l-4 border-status-info-solid shadow-sm flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-black text-content-primary">{moto.modelo}</h3>
                                    <p className="text-sm text-content-muted font-mono mt-1">CHASSI: {moto.chassi}</p>
                                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                        moto.status === 'disponivel' ? 'bg-status-success-bg text-status-success-fg' : 
                                        moto.status === 'entregue' ? 'bg-surface-sunken text-content-primary' :
                                        'bg-status-warning-bg text-status-warning-fg'
                                    }`}>
                                        {moto.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] uppercase text-content-muted font-bold">Localização Atual</div>
                                    <div className="text-lg font-bold text-status-info-fg">{moto.localizacao_atual || 'Não Informado'}</div>
                                </div>
                            </div>

                            {/* TIMELINE */}
                            <div className="relative border-l-2 border-line-strong ml-6 space-y-8 pb-8">
                                {timeline.map((evento, idx) => (
                                    <div key={idx} className="relative pl-8">
                                        {/* Bolinha do Tempo */}
                                        <div className="absolute -left-[9px] top-0 bg-surface-card border-2 border-status-info-solid w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                                            {/* Opcional: Colocar ícone pequeno aqui */}
                                        </div>
                                        
                                        <div className="bg-surface-card p-4 rounded-lg shadow-sm border border-line hover:shadow-md transition">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">{evento.icon}</span>
                                                    <h4 className="font-bold text-content-primary">{evento.titulo}</h4>
                                                </div>
                                                <span className="text-xs text-content-muted font-mono">
                                                    {new Date(evento.data).toLocaleString('pt-BR')}
                                                </span>
                                            </div>
                                            
                                            <p className="text-sm text-content-secondary mb-3">{evento.descricao}</p>
                                            
                                            {evento.avaria && (
                                                <div className="mb-3 bg-status-danger-bg p-3 rounded border border-status-danger-solid/20">
                                                    <p className="text-xs font-bold text-status-danger-fg uppercase mb-1">⚠️ Detalhes da Avaria:</p>
                                                    <p className="text-sm text-status-danger-fg italic">"{evento.avaria.texto}"</p>
                                                    {evento.avaria.foto && (
                                                        <a href={evento.avaria.foto} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-status-info-fg hover:text-status-info-fg hover:underline">
                                                            📸 Ver Foto da Avaria
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                            
                                            {(evento.origem && evento.destino) && (
                                                <div className="flex items-center gap-2 text-xs bg-surface-sunken p-2 rounded border border-line w-fit">
                                                    <span className="font-bold text-content-muted">{evento.origem}</span>
                                                    <span className="text-content-muted">➔</span>
                                                    <span className="font-bold text-status-info-fg">{evento.destino}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        data.chassi && !processing && (
                            <div className="text-center py-12 text-content-muted bg-surface-card rounded-xl border border-dashed border-line-strong">
                                <p className="text-lg">🚫 Nenhuma moto encontrada com este chassi.</p>
                            </div>
                        )
                    )}
                </div>
        </AppLayout>
    );
}