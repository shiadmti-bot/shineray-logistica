import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import Swal from 'sweetalert2';

export default function RomaneioShow({ auth, romaneio, cargasPorLoja }) {
    
    const getStatusStep = () => {
        if (romaneio.status === 'finalizado') return 4;
        if (romaneio.status === 'em_transito') return 3;
        if (romaneio.motos && romaneio.motos.length > 0 && romaneio.status === 'aberto') return 2;
        return 1;
    };

    const handleSaida = () => {
        Swal.fire({
            title: 'Liberar Saída?',
            text: "Confirma a saída física do caminhão?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#f97316',
            confirmButtonText: 'Sim, Liberar'
        }).then((result) => {
            if (result.isConfirmed) router.post(route('romaneios.saida', romaneio.id));
        });
    };

    const handleDelete = () => {
        Swal.fire({
            title: 'Desfazer Carga?',
            text: "O Romaneio será excluído.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Sim, desfazer'
        }).then((result) => {
            if (result.isConfirmed) router.delete(route('romaneios.destroy', romaneio.id));
        });
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <div className="flex items-center gap-4 print:hidden">
                    <Link href={route('romaneios.index')} className="p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                    </Link>
                    <div>
                        <h2 className="font-bold text-xl text-gray-800 leading-tight">Romaneio #{String(romaneio.id).padStart(6, '0')}</h2>
                        <p className="text-sm text-gray-500">Emissão: {new Date(romaneio.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>
            }
        >
            <Head title={`Romaneio #${romaneio.id}`} />

            {/* VISÃO DE TELA (Interativa) */}
            <div className="py-8 bg-gray-100 min-h-screen print:hidden">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <RomaneioStepper currentStep={getStatusStep()} />
                    </div>

                    <div className="bg-white shadow-sm sm:rounded-lg overflow-hidden border-l-4 border-indigo-500">
                        <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">🚛 Motorista: {romaneio.motorista}</h3>
                                <p className="text-gray-600">Placa: <strong>{romaneio.placa}</strong></p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-700 shadow-lg">
                                    🖨️ IMPRIMIR
                                </button>
                                {romaneio.status === 'aberto' && (
                                    <button onClick={handleSaida} className="bg-orange-500 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-orange-600">
                                        🚛 Liberar
                                    </button>
                                )}
                                {romaneio.status !== 'finalizado' && (
                                    <button onClick={handleDelete} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-100 border border-red-200">
                                        🗑️ Desfazer
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {Object.keys(cargasPorLoja).map((lojaNome, index) => (
                        <div key={index} className="bg-white shadow-sm sm:rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="font-bold text-gray-700">🏪 {lojaNome}</h3>
                                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">{cargasPorLoja[lojaNome].length} Motos</span>
                            </div>
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-white">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modelo</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chassi</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cor</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {cargasPorLoja[lojaNome].map((moto) => (
                                        <tr key={moto.id}><td className="px-6 py-4 text-sm font-bold">{moto.modelo}</td><td className="px-6 py-4 text-sm font-mono">{moto.chassi}</td><td className="px-6 py-4 text-sm">{moto.cor}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            </div>

            {/* =================================================================================
                LAYOUT DE IMPRESSÃO (NOTA FISCAL / MANIFESTO)
               ================================================================================= */}
            <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999] print:p-0 text-black font-sans">
                
                {/* CABEÇALHO */}
                <div className="border-b-2 border-black pb-2 mb-4 flex justify-between items-center px-8 pt-8">
                    <div className="flex items-center gap-6">
                        <img src="/img/logo.png" className="h-16 w-auto object-contain grayscale" alt="Shineray Logo" />
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight">Manifesto de Carga</h1>
                            <p className="text-sm font-bold">SHINERAY DO BRASIL - CD ANANINDEUA</p>
                            <p className="text-xs">Rodovia BR-316, KM 12 - Pará</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs uppercase font-bold text-gray-500">Número do Romaneio</div>
                        <div className="text-4xl font-mono font-bold leading-none">{String(romaneio.id).padStart(6, '0')}</div>
                        <div className="text-xs mt-1">Emissão: {new Date().toLocaleString('pt-BR')}</div>
                    </div>
                </div>

                {/* DADOS TRANSPORTE */}
                <div className="mx-8 border border-black mb-4">
                    <div className="bg-gray-200 border-b border-black p-1 px-2 text-xs font-bold uppercase">Dados do Transporte</div>
                    <div className="grid grid-cols-4 divide-x divide-black text-xs">
                        <div className="p-2">
                            <span className="block text-[9px] uppercase text-gray-500">Motorista</span>
                            <span className="font-bold uppercase">{romaneio.motorista}</span>
                        </div>
                        <div className="p-2">
                            <span className="block text-[9px] uppercase text-gray-500">Placa</span>
                            <span className="font-bold uppercase">{romaneio.placa}</span>
                        </div>
                        <div className="p-2">
                            <span className="block text-[9px] uppercase text-gray-500">Transportadora</span>
                            <span className="font-bold uppercase">{romaneio.transportadora || 'FROTA PRÓPRIA'}</span>
                        </div>
                        <div className="p-2">
                            <span className="block text-[9px] uppercase text-gray-500">Volumes</span>
                            <span className="font-bold">{romaneio.motos.length} UNIDADES</span>
                        </div>
                    </div>
                </div>

                {/* LISTAGEM DE ITENS */}
                <div className="mx-8">
                    {Object.keys(cargasPorLoja).map((lojaNome) => (
                        <div key={lojaNome} className="mb-4 break-inside-avoid">
                            <div className="bg-black text-white px-2 py-1 text-xs font-bold uppercase flex justify-between print:bg-black print:text-white">
                                <span>DESTINATÁRIO: {lojaNome}</span>
                                <span>{cargasPorLoja[lojaNome].length} VOLUMES</span>
                            </div>
                            <table className="w-full text-[10px] border-collapse border border-black">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="border border-black p-1 w-8 text-center">#</th>
                                        <th className="border border-black p-1 text-left">Modelo</th>
                                        <th className="border border-black p-1 text-left w-32">Chassi</th>
                                        <th className="border border-black p-1 text-left w-20">Cor</th>
                                        <th className="border border-black p-1 text-center w-24">Conferência</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cargasPorLoja[lojaNome].map((moto, i) => (
                                        <tr key={moto.id}>
                                            <td className="border border-black p-1 text-center">{i + 1}</td>
                                            <td className="border border-black p-1 font-bold">{moto.modelo}</td>
                                            <td className="border border-black p-1 font-mono">{moto.chassi}</td>
                                            <td className="border border-black p-1">{moto.cor}</td>
                                            <td className="border border-black p-1 text-center text-gray-300">___/___</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>

                {/* ASSINATURAS */}
                <div className="mx-8 mt-12 pt-4 border-t-2 border-black break-inside-avoid">
                    <p className="text-[9px] text-justify mb-8 italic">
                        DECLARO TER RECEBIDO OS ITENS ACIMA RELACIONADOS EM PERFEITO ESTADO. A CONFERÊNCIA FÍSICA DOS CHASSIS É DE RESPONSABILIDADE DO RECEBEDOR.
                    </p>
                    <div className="grid grid-cols-3 gap-8 text-center">
                        <div><div className="border-t border-black mb-1"></div><p className="text-[9px] font-bold uppercase">Expedição CD</p></div>
                        <div><div className="border-t border-black mb-1"></div><p className="text-[9px] font-bold uppercase">Motorista</p></div>
                        <div><div className="border-t border-black mb-1"></div><p className="text-[9px] font-bold uppercase">Recebedor Loja</p></div>
                    </div>
                </div>

                <div className="fixed bottom-0 w-full text-center text-[8px] py-2">
                    Impresso pelo Sistema Shineray Logística
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function RomaneioStepper({ currentStep }) {
    const steps = [
        { id: 1, label: 'Abertura', icon: '📝' },
        { id: 2, label: 'Carregamento', icon: '📦' },
        { id: 3, label: 'Em Trânsito', icon: '🚚' },
        { id: 4, label: 'Finalizado', icon: '🏁' },
    ];
    return (
        <div className="w-full">
            <div className="relative flex justify-between items-center w-full max-w-3xl mx-auto">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 rounded"></div>
                <div className="absolute top-1/2 left-0 h-1 bg-green-500 -z-10 rounded transition-all duration-700 ease-out" style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}></div>
                {steps.map((step) => (
                    <div key={step.id} className="flex flex-col items-center bg-white px-2">
                        <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm md:text-lg border-4 transition-all duration-500 ${step.id <= currentStep ? 'border-green-500 text-green-600 shadow-md scale-110' : 'border-gray-200 text-gray-300'}`}>
                            {step.id < currentStep ? '✓' : step.icon}
                        </div>
                        <span className={`mt-2 text-[10px] md:text-xs font-bold ${step.id <= currentStep ? 'text-gray-800' : 'text-gray-400'}`}>{step.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}