import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import Swal from 'sweetalert2';

export default function RomaneioShow({ auth, romaneio, cargasPorLoja }) {
    
    // Status visual para o Stepper
    const getStatusStep = () => {
        if (romaneio.status === 'finalizado') return 4;
        if (romaneio.status === 'em_transito') return 3;
        if (romaneio.motos && romaneio.motos.length > 0 && romaneio.status === 'aberto') return 2;
        return 1;
    };

    // Ações do Sistema
    const handleDelete = () => {
        Swal.fire({
            title: 'Desfazer Carga?',
            text: "O Romaneio será excluído e as motos voltarão para o pátio.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Sim, desfazer'
        }).then((result) => {
            if (result.isConfirmed) router.delete(route('romaneios.destroy', romaneio.id));
        });
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
                        <h2 className="font-bold text-xl text-gray-800 leading-tight">
                            Romaneio #{String(romaneio.id).padStart(6, '0')}
                        </h2>
                        <p className="text-sm text-gray-500 font-normal">Data: {new Date(romaneio.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>
            }
        >
            <Head title={`Romaneio #${romaneio.id}`} />

            {/* =================================================================================
                VISÃO DE TELA (SISTEMA INTERATIVO) - Oculto na Impressão (print:hidden)
               ================================================================================= */}
            <div className="py-12 bg-gray-100 min-h-screen print:hidden">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">

                    {/* Stepper Visual */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <RomaneioStepper currentStep={getStatusStep()} />
                    </div>

                    {/* Painel de Controle */}
                    <div className="bg-white shadow-sm sm:rounded-lg overflow-hidden border-l-4 border-indigo-500">
                        <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">🚛 Motorista: {romaneio.motorista}</h3>
                                <div className="flex gap-4 mt-1 text-gray-600">
                                    <span className="bg-gray-100 px-2 py-1 rounded text-sm border">Placa: <strong>{romaneio.placa}</strong></span>
                                    {romaneio.transportadora && <span className="bg-gray-100 px-2 py-1 rounded text-sm border">Transp: <strong>{romaneio.transportadora}</strong></span>}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-700 shadow-lg transition">
                                    <span>🖨️</span> IMPRIMIR MANIFESTO
                                </button>

                                {romaneio.status === 'aberto' && (
                                    <button onClick={handleSaida} className="bg-orange-500 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-orange-600 transition flex items-center gap-2">
                                        🚛 Liberar Saída
                                    </button>
                                )}

                                {romaneio.status !== 'finalizado' && (
                                    <button onClick={handleDelete} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-100 border border-red-200 transition">
                                        🗑️ Desfazer
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tabelas por Loja (Tela) */}
                    <div className="grid gap-6">
                        {Object.keys(cargasPorLoja).map((lojaNome, index) => (
                            <div key={index} className="bg-white shadow-sm sm:rounded-lg overflow-hidden">
                                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                                    <h3 className="font-bold text-gray-700">🏪 {lojaNome}</h3>
                                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">{cargasPorLoja[lojaNome].length} Motos</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-white">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modelo</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chassi</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cor</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pedido</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {cargasPorLoja[lojaNome].map((moto) => (
                                                <tr key={moto.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 text-sm font-bold text-gray-800">{moto.modelo}</td>
                                                    <td className="px-6 py-4 text-sm font-mono text-gray-600">{moto.chassi}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">{moto.cor || '-'}</td>
                                                    <td className="px-6 py-4 text-sm text-center text-indigo-600 font-bold">#{moto.pedido_id}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* =================================================================================
                VISÃO DE IMPRESSÃO (MANIFESTO) - Só aparece ao imprimir (hidden print:block)
                Usa 'fixed inset-0 z-[9999]' para cobrir todo o layout do sistema
               ================================================================================= */}
            <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999] print:p-8 print:overflow-auto text-black">
                
                {/* Cabeçalho do Documento */}
                <div className="flex justify-between items-end border-b-4 border-black pb-4 mb-6">
                    <div className="flex items-center gap-4">
                        {/* Logo da Shineray (Placeholder ou Imagem Real) */}
                        <div className="w-16 h-16 bg-black flex items-center justify-center text-white font-bold text-xs p-1 text-center">
                            SHINERAY LOG
                        </div>
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-tight leading-none">Manifesto de Carga</h1>
                            <p className="text-sm font-bold mt-1">SHINERAY BY SABEL - CENTRO DE DISTRIBUIÇÃO</p>
                            <p className="text-xs text-gray-600">BR-316, KM 12 - Benevides/PA - CNPJ: 34.249.103/0001-01</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="font-mono text-4xl font-bold">{String(romaneio.id).padStart(6, '0')}</div>
                        <p className="text-xs font-bold mt-1 uppercase">Emissão: {new Date().toLocaleString('pt-BR')}</p>
                        {/* Código de Barras CSS (Simulação Visual) */}
                        <div className="h-8 mt-2 flex justify-end gap-[2px]">
                            {Array.from({ length: 30 }).map((_, i) => (
                                <div key={i} className={`h-full bg-black ${Math.random() > 0.5 ? 'w-[1px]' : 'w-[3px]'}`}></div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Dados do Transporte */}
                <div className="border-2 border-black mb-6">
                    <div className="bg-gray-200 border-b-2 border-black p-1 px-3 font-black text-sm uppercase">DADOS DA EXPEDIÇÃO</div>
                    <div className="grid grid-cols-4 divide-x-2 divide-black text-xs">
                        <div className="p-2">
                            <span className="block text-[10px] text-gray-500 uppercase font-bold">Motorista Responsável</span>
                            <span className="font-bold text-sm uppercase">{romaneio.motorista}</span>
                        </div>
                        <div className="p-2">
                            <span className="block text-[10px] text-gray-500 uppercase font-bold">Placa do Veículo</span>
                            <span className="font-bold text-sm uppercase">{romaneio.placa}</span>
                        </div>
                        <div className="p-2">
                            <span className="block text-[10px] text-gray-500 uppercase font-bold">Transportadora</span>
                            <span className="font-bold text-sm uppercase">{romaneio.transportadora || 'PRÓPRIA'}</span>
                        </div>
                        <div className="p-2">
                            <span className="block text-[10px] text-gray-500 uppercase font-bold">Total de Volumes</span>
                            <span className="font-bold text-sm">{romaneio.motos.length} MOTOCICLETAS</span>
                        </div>
                    </div>
                </div>

                {/* Tabela de Itens (Loop por Loja) */}
                <div className="space-y-6">
                    {Object.keys(cargasPorLoja).map((lojaNome) => (
                        <div key={lojaNome} className="break-inside-avoid">
                            {/* Faixa da Loja */}
                            <div className="bg-black text-white p-2 text-sm font-bold uppercase flex justify-between items-center print:bg-black print:text-white mb-1">
                                <span>DESTINO: {lojaNome}</span>
                                <span className="bg-white text-black px-2 py-0.5 rounded text-xs">
                                    {cargasPorLoja[lojaNome].length} UNIDADES
                                </span>
                            </div>

                            <table className="w-full text-[11px] border-collapse border border-black">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="border border-black p-1 w-10 text-center">#</th>
                                        <th className="border border-black p-1 text-left">Modelo / Descrição</th>
                                        <th className="border border-black p-1 text-left w-32">Chassi (VIN)</th>
                                        <th className="border border-black p-1 text-left w-24">Cor</th>
                                        <th className="border border-black p-1 text-center w-16">Ref. Pedido</th>
                                        <th className="border border-black p-1 text-center w-24">Conferência</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cargasPorLoja[lojaNome].map((moto, i) => (
                                        <tr key={moto.id}>
                                            <td className="border border-black p-1 text-center">{i + 1}</td>
                                            <td className="border border-black p-1 font-bold">{moto.modelo}</td>
                                            <td className="border border-black p-1 font-mono text-xs">{moto.chassi}</td>
                                            <td className="border border-black p-1">{moto.cor}</td>
                                            <td className="border border-black p-1 text-center">#{moto.pedido_id}</td>
                                            <td className="border border-black p-1 text-center text-gray-300">___ / ___</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>

                {/* Termos e Assinaturas */}
                <div className="mt-12 pt-4 border-t-2 border-black break-inside-avoid">
                    <p className="text-[10px] text-justify font-serif italic text-gray-600 mb-8 leading-tight">
                        DECLARO ter recebido as mercadorias acima relacionadas em perfeito estado de conservação e embalagem. 
                        A conferência física dos chassis é de responsabilidade do recebedor no ato da descarga. 
                        Qualquer avaria ou divergência deve ser ressalvada no verso deste documento no ato da entrega.
                    </p>

                    <div className="grid grid-cols-3 gap-12 text-center">
                        <div>
                            <div className="border-b border-black mb-2"></div>
                            <p className="text-[10px] font-bold uppercase">Conferente CD</p>
                            <p className="text-[9px] text-gray-500">Expedição Shineray</p>
                        </div>
                        <div>
                            <div className="border-b border-black mb-2"></div>
                            <p className="text-[10px] font-bold uppercase">Motorista</p>
                            <p className="text-[9px] text-gray-500">CPF/RG:</p>
                        </div>
                        <div>
                            <div className="border-b border-black mb-2"></div>
                            <p className="text-[10px] font-bold uppercase">Recebedor Loja</p>
                            <p className="text-[9px] text-gray-500">Data e Hora: ___/___/___ __:__</p>
                        </div>
                    </div>
                </div>

                {/* Rodapé do Sistema */}
                <div className="fixed bottom-0 left-0 w-full text-center text-[8px] text-gray-400 py-2 bg-white">
                    Impresso pelo Sistema Shineray Logística em {new Date().toLocaleString()}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// Subcomponentes (Stepper e Badge)
function StatusBadge({ status }) {
    const config = {
        expedido:    { label: 'Aguardando Saída', bg: 'bg-blue-100 text-blue-800' },
        em_transito: { label: 'Em Trânsito',      bg: 'bg-orange-100 text-orange-800' },
        concluido:   { label: 'Entregue',         bg: 'bg-green-100 text-green-800' },
    }[status] || { label: status, bg: 'bg-gray-100 text-gray-600' };
    return <span className={`px-2 py-1 rounded-full text-xs font-bold ${config.bg}`}>{config.label}</span>;
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
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-lg md:text-xl border-4 transition-all duration-500 ${step.id <= currentStep ? 'border-green-500 text-green-600 shadow-md scale-110' : 'border-gray-200 text-gray-300'}`}>
                            {step.id < currentStep ? '✓' : step.icon}
                        </div>
                        <span className={`mt-2 text-xs md:text-sm font-bold transition-colors duration-500 ${step.id <= currentStep ? 'text-gray-800' : 'text-gray-400'}`}>{step.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}