import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useMemo } from 'react';
import Swal from 'sweetalert2';

export default function RomaneioShow({ auth, romaneio }) { 
    
    // --- 1. LÓGICA DE AGRUPAMENTO AVANÇADA ---
    const cargasAgrupadas = useMemo(() => {
        const grupos = {};
        
        // Garante que existe array de motos
        const listaMotos = romaneio.motos || [];

        listaMotos.forEach(moto => {
            let destino = 'DESTINO NÃO INFORMADO';

            // A CORREÇÃO MÁGICA:
            // O destino está salvo no PEDIDO, não diretamente na moto dentro do romaneio.
            // Precisamos olhar para 'moto.pedidos' que vem do controller.
            const pedidoAtivo = moto.pedidos && moto.pedidos.length > 0 ? moto.pedidos[0] : null;

            if (pedidoAtivo) {
                // 1. Tenta pegar o destino escrito explicitamente no item (Tabela Pivô do Pedido)
                if (pedidoAtivo.pivot && pedidoAtivo.pivot.destino) {
                    destino = pedidoAtivo.pivot.destino;
                }
                // 2. Se não tiver, tenta a Filial do usuário que pediu
                else if (pedidoAtivo.user && pedidoAtivo.user.filial) {
                    destino = pedidoAtivo.user.filial;
                }
                // 3. Última tentativa: Nome do usuário
                else if (pedidoAtivo.user && pedidoAtivo.user.name) {
                    destino = pedidoAtivo.user.name;
                }
            }

            // Normaliza (Maiúsculas e remove espaços extras)
            destino = destino.toUpperCase().trim();

            // Adiciona propriedade temporária na moto para facilitar a exibição na tabela
            moto._pedido_info = pedidoAtivo;

            if (!grupos[destino]) {
                grupos[destino] = [];
            }
            grupos[destino].push(moto);
        });

        // Ordena os grupos alfabeticamente (Acará, Belém, Castanhal...)
        return Object.keys(grupos).sort().reduce((obj, key) => { 
            obj[key] = grupos[key]; 
            return obj;
        }, {});
    }, [romaneio]);

    // Total de motos (conta direta da lista)
    const totalMotos = romaneio.motos ? romaneio.motos.length : 0;

    const getStatusStep = () => {
        if (romaneio.status === 'concluido') return 4;
        if (romaneio.status === 'em_transito') return 3;
        if (romaneio.motos && romaneio.motos.length > 0 && romaneio.status === 'aberto') return 2;
        return 1;
    };

    const handleSaida = () => {
        Swal.fire({
            title: 'Liberar Saída?',
            text: `Confirma a saída física do caminhão com ${totalMotos} motos?`,
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
            text: "O Romaneio será excluído e as motos voltarão para 'Separado'.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Sim, desfazer'
        }).then((result) => {
            if (result.isConfirmed) router.delete(route('romaneios.destroy', romaneio.id));
        });
    };

    // Helper para cores das bolinhas (evita erro se moto.cor for null)
    const getColorHex = (cor) => {
        if (!cor) return '#cccccc';
        const map = {
            'VERMELHO': '#ef4444', 'AZUL': '#3b82f6', 'PRETO': '#1f2937', 
            'BRANCO': '#ffffff', 'PRATA': '#9ca3af', 'CINZA': '#6b7280'
        };
        return map[cor.toUpperCase()] || '#e5e7eb';
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
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>Emissão: {new Date(romaneio.created_at).toLocaleDateString('pt-BR')}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                            <span className="font-bold text-gray-700">{totalMotos} Volumes</span>
                        </div>
                    </div>
                </div>
            }
        >
            <Head title={`Romaneio #${romaneio.id}`} />

            {/* --- VISÃO DE TELA (WEB) --- */}
            <div className="py-8 bg-gray-100 min-h-screen print:hidden">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
                    
                    {/* STEPPER */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <RomaneioStepper currentStep={getStatusStep()} />
                    </div>

                    {/* CARD DO MOTORISTA E AÇÕES */}
                    <div className="bg-white shadow-sm sm:rounded-lg overflow-hidden border-l-4 border-indigo-500">
                        <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">🚛 Motorista: {romaneio.motorista}</h3>
                                <p className="text-gray-600">Placa: <strong className="uppercase">{romaneio.placa}</strong></p>
                                {romaneio.transportadora && <p className="text-gray-500 text-sm">Transp: {romaneio.transportadora}</p>}
                                
                                <div className="mt-2">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase border
                                        ${romaneio.status === 'concluido' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                                        ${romaneio.status === 'em_transito' ? 'bg-orange-100 text-orange-800 border-orange-200' : ''}
                                        ${romaneio.status === 'aberto' ? 'bg-blue-100 text-blue-800 border-blue-200' : ''}
                                        ${romaneio.status === 'cancelado' ? 'bg-red-100 text-red-800 border-red-200' : ''}
                                    `}>
                                        Status: {romaneio.status.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-3 flex-wrap justify-end">
                                <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-700 shadow-lg transition-transform hover:-translate-y-0.5">
                                    🖨️ IMPRIMIR MANIFESTO
                                </button>
                                
                                {romaneio.status === 'aberto' && (
                                    <button onClick={handleSaida} className="bg-orange-500 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-orange-600 transition-transform hover:-translate-y-0.5">
                                        🚛 Liberar Saída
                                    </button>
                                )}
                                
                                {romaneio.status !== 'em_transito' && romaneio.status !== 'concluido' && (
                                    <button onClick={handleDelete} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-100 border border-red-200 transition-colors">
                                        🗑️ Desfazer
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* LISTA DE CARGAS AGRUPADAS POR DESTINO REAL */}
                    <h3 className="font-bold text-gray-700 text-lg mt-4">📦 Detalhamento da Carga (Por Destino)</h3>
                    {Object.keys(cargasAgrupadas).map((destinoNome, index) => (
                        <div key={index} className="bg-white shadow-sm sm:rounded-lg overflow-hidden border border-gray-200">
                            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">📍</span>
                                    <div>
                                        <p className="text-xs text-gray-500 font-bold uppercase">Local de Entrega</p>
                                        <h3 className="font-bold text-gray-800 text-lg leading-none">{destinoNome}</h3>
                                    </div>
                                </div>
                                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full border border-blue-200">
                                    {cargasAgrupadas[destinoNome].length} Volumes
                                </span>
                            </div>
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-white">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Modelo</th>
                                        <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Cor</th>
                                        <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-500 uppercase tracking-wider">Chassi</th>
                                        <th className="px-6 py-3 text-right text-xs font-extrabold text-gray-500 uppercase tracking-wider">Solicitante</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {cargasAgrupadas[destinoNome].map((moto) => (
                                        <tr key={moto.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-3 text-sm font-bold text-gray-700">{moto.modelo}</td>
                                            <td className="px-6 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="h-2 w-2 rounded-full border border-gray-300" style={{ backgroundColor: getColorHex(moto.cor) }}></span>
                                                    <span className="text-xs uppercase text-gray-500 font-bold">{moto.cor}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-sm font-mono text-gray-600 tracking-wide">{moto.chassi}</td>
                                            <td className="px-6 py-3 text-right">
                                                <div className="flex flex-col items-end">
                                                    {/* Usamos o _pedido_info que injetamos no useMemo */}
                                                    <span className="text-xs font-bold text-gray-700">
                                                        {moto._pedido_info?.user?.filial || 'Matriz'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">
                                                        Pedido #{moto._pedido_info?.id || 'N/D'}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            </div>

            {/* =================================================================================
                LAYOUT DE IMPRESSÃO (MANIFESTO DE CARGA)
               ================================================================================= */}
            <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999] print:p-0 text-black font-sans">
                
                {/* CABEÇALHO */}
                <div className="border-b-2 border-black pb-4 mb-4 flex justify-between items-center px-8 pt-8">
                    <div className="flex items-center gap-6">
                        <img src="/img/logo.png" className="h-12 w-auto object-contain grayscale" alt="Logo" />
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight leading-none">Manifesto de Carga</h1>
                            <p className="text-sm font-bold mt-1">SHINERAY DO BRASIL - CD ANANINDEUA</p>
                            <p className="text-[10px]">Rodovia BR-316, KM 12 - Centro de Distribuição</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-gray-500">Romaneio N°</div>
                        <div className="text-3xl font-mono font-bold leading-none">{String(romaneio.id).padStart(6, '0')}</div>
                        <div className="text-[10px] mt-1">Emissão: {new Date().toLocaleString('pt-BR')}</div>
                    </div>
                </div>

                {/* DADOS TRANSPORTE */}
                <div className="mx-8 border border-black mb-6">
                    <div className="bg-gray-200 border-b border-black p-1 px-2 text-[10px] font-bold uppercase">Dados do Transporte</div>
                    <div className="grid grid-cols-4 divide-x divide-black text-xs">
                        <div className="p-2">
                            <span className="block text-[8px] uppercase text-gray-500">Motorista</span>
                            <span className="font-bold uppercase">{romaneio.motorista}</span>
                        </div>
                        <div className="p-2">
                            <span className="block text-[8px] uppercase text-gray-500">Placa Veículo</span>
                            <span className="font-bold uppercase">{romaneio.placa}</span>
                        </div>
                        <div className="p-2">
                            <span className="block text-[8px] uppercase text-gray-500">Transportadora</span>
                            <span className="font-bold uppercase">{romaneio.transportadora || 'FROTA PRÓPRIA'}</span>
                        </div>
                        <div className="p-2 bg-gray-100">
                            <span className="block text-[8px] uppercase text-gray-500">Total Volumes</span>
                            <span className="font-bold text-sm">{totalMotos} UNIDADES</span>
                        </div>
                    </div>
                </div>

                {/* LISTAGEM DE ITENS (AGRUPADA POR DESTINO REAL) */}
                <div className="mx-8">
                    {Object.keys(cargasAgrupadas).map((destinoNome) => (
                        <div key={destinoNome} className="mb-6 break-inside-avoid">
                            {/* Cabeçalho do Grupo de Destino */}
                            <div className="bg-black text-white px-3 py-1 text-xs font-bold uppercase flex justify-between print:bg-black print:text-white">
                                <span>DESTINO: {destinoNome}</span>
                                <span>{cargasAgrupadas[destinoNome].length} VOLUMES</span>
                            </div>
                            
                            {/* Tabela de Itens */}
                            <table className="w-full text-[10px] border-collapse border-l border-r border-b border-black">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="border-b border-r border-black p-1 w-8 text-center">#</th>
                                        <th className="border-b border-r border-black p-1 text-left">Modelo</th>
                                        <th className="border-b border-r border-black p-1 text-left w-32">Chassi</th>
                                        <th className="border-b border-r border-black p-1 text-left w-24">Cor</th>
                                        <th className="border-b border-black p-1 text-center w-24">Conferência</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cargasAgrupadas[destinoNome].map((moto, i) => (
                                        <tr key={moto.id}>
                                            <td className="border-b border-r border-gray-300 p-1 text-center">{i + 1}</td>
                                            <td className="border-b border-r border-gray-300 p-1 font-bold">{moto.modelo}</td>
                                            <td className="border-b border-r border-gray-300 p-1 font-mono">{moto.chassi}</td>
                                            <td className="border-b border-r border-gray-300 p-1 uppercase">{moto.cor}</td>
                                            <td className="border-b border-gray-300 p-1 text-center text-gray-300">___/___</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>

                {/* ASSINATURAS */}
                <div className="mx-8 mt-10 pt-4 border-t-2 border-black break-inside-avoid">
                    <p className="text-[8px] text-justify mb-8 italic text-gray-600">
                        DECLARO TER RECEBIDO OS ITENS ACIMA RELACIONADOS EM PERFEITO ESTADO DE CONSERVAÇÃO E FUNCIONAMENTO. 
                        A CONFERÊNCIA FÍSICA DOS CHASSIS NO ATO DA ENTREGA É DE RESPONSABILIDADE DO RECEBEDOR.
                    </p>
                    <div className="grid grid-cols-3 gap-12 text-center mt-8">
                        <div>
                            <div className="border-t border-black mb-1"></div>
                            <p className="text-[9px] font-bold uppercase">Expedição CD</p>
                            <p className="text-[8px]">Assinatura e Carimbo</p>
                        </div>
                        <div>
                            <div className="border-t border-black mb-1"></div>
                            <p className="text-[9px] font-bold uppercase">Motorista Responsável</p>
                            <p className="text-[8px]">CPF: .......................................</p>
                        </div>
                        <div>
                            <div className="border-t border-black mb-1"></div>
                            <p className="text-[9px] font-bold uppercase">Recebedor</p>
                            <p className="text-[8px]">Data: ____/____/_______</p>
                        </div>
                    </div>
                </div>

                <div className="fixed bottom-0 w-full text-center text-[8px] py-2 border-t border-gray-200">
                    Sistema Shineray Logística - Impresso em {new Date().toLocaleString()} - Página 1/1
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// Subcomponente Stepper
function RomaneioStepper({ currentStep }) {
    const steps = [
        { id: 1, label: 'Abertura', icon: '📝' },
        { id: 2, label: 'Carregamento', icon: '📦' },
        { id: 3, label: 'Em Trânsito', icon: '🚚' },
        { id: 4, label: 'Concluído', icon: '🏁' },
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
                        <span className={`mt-2 text-[10px] md:text-xs font-bold uppercase ${step.id <= currentStep ? 'text-gray-800' : 'text-gray-400'}`}>{step.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}