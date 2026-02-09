import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-bold text-xl text-gray-800">🔍 Rastreio de Chassi (Timeline)</h2>}
        >
            <Head title="Rastreio de Moto" />

            <div className="py-8 bg-gray-100 min-h-screen">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* BUSCA */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
                        <form onSubmit={handleSearch} className="flex gap-4">
                            <input 
                                type="text" 
                                placeholder="Digite os últimos dígitos do Chassi..." 
                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                value={data.chassi}
                                onChange={e => setData('chassi', e.target.value)}
                            />
                            <button 
                                type="submit" 
                                disabled={processing}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
                            >
                                {processing ? 'Buscando...' : 'Rastrear'}
                            </button>
                        </form>
                    </div>

                    {moto ? (
                        <div className="space-y-6">
                            {/* CABEÇALHO DA MOTO */}
                            <div className="bg-white p-6 rounded-xl border-l-4 border-blue-500 shadow-sm flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-800">{moto.modelo}</h3>
                                    <p className="text-sm text-gray-500 font-mono mt-1">CHASSI: {moto.chassi}</p>
                                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                        moto.status === 'disponivel' ? 'bg-green-100 text-green-800' : 
                                        moto.status === 'entregue' ? 'bg-gray-100 text-gray-800' :
                                        'bg-orange-100 text-orange-800'
                                    }`}>
                                        {moto.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] uppercase text-gray-400 font-bold">Localização Atual</div>
                                    <div className="text-lg font-bold text-blue-900">{moto.localizacao_atual || 'Não Informado'}</div>
                                </div>
                            </div>

                            {/* TIMELINE */}
                            <div className="relative border-l-2 border-gray-300 ml-6 space-y-8 pb-8">
                                {timeline.map((evento, idx) => (
                                    <div key={idx} className="relative pl-8">
                                        {/* Bolinha do Tempo */}
                                        <div className="absolute -left-[9px] top-0 bg-white border-2 border-blue-500 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                                            {/* Opcional: Colocar ícone pequeno aqui */}
                                        </div>
                                        
                                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">{evento.icon}</span>
                                                    <h4 className="font-bold text-gray-800">{evento.titulo}</h4>
                                                </div>
                                                <span className="text-xs text-gray-400 font-mono">
                                                    {new Date(evento.data).toLocaleString('pt-BR')}
                                                </span>
                                            </div>
                                            
                                            <p className="text-sm text-gray-600 mb-3">{evento.descricao}</p>
                                            
                                            {(evento.origem && evento.destino) && (
                                                <div className="flex items-center gap-2 text-xs bg-gray-50 p-2 rounded border border-gray-200 w-fit">
                                                    <span className="font-bold text-gray-500">{evento.origem}</span>
                                                    <span className="text-gray-400">➔</span>
                                                    <span className="font-bold text-blue-600">{evento.destino}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        data.chassi && !processing && (
                            <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                                <p className="text-lg">🚫 Nenhuma moto encontrada com este chassi.</p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}