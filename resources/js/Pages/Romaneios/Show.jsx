import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useMemo } from 'react';
import Swal from 'sweetalert2';

export default function RomaneioShow({ auth, romaneio }) { 
    
    // --- 1. SEPARAÇÃO PARA MILK RUN (COLETA vs ENTREGA) ---
    const itensParaColetar = useMemo(() => {
        return (romaneio.motos || []).filter(m => m.status === 'aguardando_coleta');
    }, [romaneio]);

    // --- 2. LÓGICA DE AGRUPAMENTO (Por Destino Final) ---
    const cargasAgrupadas = useMemo(() => {
        const grupos = {};
        const listaMotos = romaneio.motos || [];

        listaMotos.forEach(moto => {
            let destino = '⚠️ DESTINO NÃO IDENTIFICADO';
            let pedidoAtivo = null;

            if (moto.pedidos && moto.pedidos.length > 0) {
                pedidoAtivo = moto.pedidos[0]; 
                // Prioridade: pivot.destino (destino real selecionado) > user.filial (loja solicitante)
                const pivotDestino = pedidoAtivo.pivot?.destino;
                if (pivotDestino && pivotDestino.trim() !== '') {
                    destino = pivotDestino;
                } else if (pedidoAtivo.user) {
                    destino = pedidoAtivo.user.filial || pedidoAtivo.user.name;
                }
            } 
            else if (moto.localizacao_atual) {
                destino = 'TRANSBORDO / INDEFINIDO';
            }

            destino = destino.toUpperCase().trim();
            moto._pedido_info = pedidoAtivo;

            if (!grupos[destino]) grupos[destino] = [];
            grupos[destino].push(moto);
        });

        return Object.keys(grupos).sort().reduce((obj, key) => { 
            obj[key] = grupos[key]; 
            return obj;
        }, {});
    }, [romaneio]);

    // --- 3. CÁLCULO DINÂMICO DA ROTA (CORREÇÃO) ---
    const rotaCalculada = useMemo(() => {
        // Se já tiver salvo no banco, usa. Se não, monta baseado nos destinos.
        if (romaneio.rota) return romaneio.rota;
        
        const destinos = Object.keys(cargasAgrupadas);
        return destinos.length > 0 ? destinos.join(' ➔ ') : 'AGUARDANDO ROTA';
    }, [romaneio.rota, cargasAgrupadas]);

    // Totais
    const totalMotos = romaneio.motos ? romaneio.motos.length : 0;
    const totalColetasPendentes = itensParaColetar.length;

    // Progresso Visual
    const getStatusStep = () => {
        if (romaneio.status === 'concluido') return 4;
        if (romaneio.status === 'em_transito' || romaneio.status === 'em_transito_cd') return 3;
        if (totalMotos > 0 && romaneio.status === 'aberto') return 2;
        return 1;
    };

    // --- AÇÕES ---
    const handleColeta = (motoId) => {
        router.post(route('romaneios.coletar_item', motoId), {}, {
            preserveScroll: true,
            onSuccess: () => {
                try { const audio = new Audio('/plim.mp3'); audio.play().catch(() => {}); } catch(e) {}
                Swal.fire({
                    title: 'Coletado!',
                    text: 'Item confirmado a bordo.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false,
                    toast: true, position: 'top-end'
                });
            }
        });
    };

    const handleSaida = () => {
        const msgAlerta = totalColetasPendentes > 0 
            ? `⚠️ Atenção: Existem ${totalColetasPendentes} itens pendentes de coleta (Milk Run). Confirma a saída?`
            : `Confirma a saída física do caminhão com ${totalMotos} volumes?`;

        Swal.fire({
            title: 'Liberar Saída?',
            text: msgAlerta,
            icon: totalColetasPendentes > 0 ? 'warning' : 'question',
            showCancelButton: true,
            confirmButtonColor: '#f97316',
            confirmButtonText: 'Sim, Liberar',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) router.post(route('romaneios.saida', romaneio.id));
        });
    };

    const handleDelete = () => {
        Swal.fire({
            title: 'Desfazer Carga?',
            text: "O Romaneio será excluído.",
            icon: 'error',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Sim, desfazer'
        }).then((result) => {
            if (result.isConfirmed) router.delete(route('romaneios.destroy', romaneio.id));
        });
    };

    const getColorHex = (cor) => {
        if (!cor) return '#cccccc';
        const map = { 'VERMELHO': '#ef4444', 'AZUL': '#3b82f6', 'PRETO': '#1f2937', 'BRANCO': '#ffffff', 'PRATA': '#9ca3af', 'CINZA': '#6b7280', 'AMARELO': '#eab308' };
        return map[cor.toUpperCase()] || '#e5e7eb';
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={
                <div className="flex items-center gap-4 print:hidden">
                    <Link href={route('romaneios.index')} className="p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                    </Link>
                    <div>
                        <h2 className="font-bold text-xl text-gray-800 leading-tight">Romaneio #{String(romaneio.id).padStart(6, '0')}</h2>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{new Date(romaneio.created_at).toLocaleDateString('pt-BR')}</span>
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

                    {/* CARD DO MOTORISTA */}
                    <div className="bg-white shadow-sm sm:rounded-lg overflow-hidden border-l-4 border-indigo-500 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">🚛 {romaneio.motorista}</h3>
                            <p className="text-gray-600">Placa: <strong className="uppercase bg-gray-100 px-2 py-0.5 rounded border border-gray-300 font-mono">{romaneio.placa}</strong></p>
                            <div className="mt-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border
                                    ${romaneio.status === 'concluido' ? 'bg-green-100 text-green-800 border-green-200' : ''}
                                    ${romaneio.status.includes('transito') ? 'bg-orange-100 text-orange-800 border-orange-200' : ''}
                                    ${romaneio.status === 'aberto' ? 'bg-blue-100 text-blue-800 border-blue-200' : ''}
                                `}>
                                    {romaneio.status.replace(/_/g, ' ')}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3 flex-wrap justify-end">
                            <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-700 shadow-lg">
                                🖨️ IMPRIMIR
                            </button>
                            
                            {romaneio.status === 'aberto' && (
                                <button onClick={handleSaida} className="bg-orange-500 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-orange-600">
                                    🚛 Liberar Saída
                                </button>
                            )}
                            
                            {!['concluido', 'em_transito', 'em_transito_cd'].includes(romaneio.status) && (
                                <button onClick={handleDelete} className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-50 border border-red-200">
                                    🗑️ Desfazer
                                </button>
                            )}
                        </div>
                    </div>

                    {/* MILK RUN */}
                    {itensParaColetar.length > 0 && (
                        <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-orange-100 p-3 rounded-full text-2xl shadow-sm">🛑</div>
                                <div>
                                    <h3 className="font-black text-orange-900 text-lg uppercase tracking-wide">Pendências de Coleta</h3>
                                    <p className="text-sm text-orange-700 font-medium">Bipar estes itens na loja de origem.</p>
                                </div>
                            </div>
                            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                                {itensParaColetar.map(moto => (
                                    <div key={moto.id} className="bg-white p-4 rounded-xl border border-orange-200 shadow-md flex flex-col justify-between">
                                        <div>
                                            <div className="font-bold text-gray-800 text-lg">{moto.modelo}</div>
                                            <div className="text-xs font-mono bg-gray-100 inline-block px-2 py-1 rounded my-2 border border-gray-200">{moto.chassi}</div>
                                            <div className="text-xs text-gray-500">
                                                Retirar: <span className="font-bold text-gray-700 uppercase">{moto._pedido_info?.origem?.filial || 'CD'}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => handleColeta(moto.id)} className="mt-4 w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-3 rounded-lg uppercase tracking-wider shadow">
                                            Confirmar Coleta
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* LISTA DE CARGA */}
                    <div className="space-y-6">
                        <h3 className="font-bold text-gray-700 text-lg px-2">📦 Carga a Bordo</h3>
                        {Object.keys(cargasAgrupadas).map((destinoNome, index) => {
                            const motosDesteDestino = cargasAgrupadas[destinoNome].filter(m => m.status !== 'aguardando_coleta');
                            if (motosDesteDestino.length === 0) return null;

                            return (
                                <div key={index} className="bg-white shadow-sm sm:rounded-lg overflow-hidden border border-gray-200">
                                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-white p-2 rounded-full border border-gray-200 text-green-600">📍</div>
                                            <div>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Destino Final</p>
                                                <h3 className="font-black text-gray-800 text-xl leading-none">{destinoNome}</h3>
                                            </div>
                                        </div>
                                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full border border-blue-200">
                                            {motosDesteDestino.length} Itens
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-white">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-400 uppercase">Modelo</th>
                                                    <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-400 uppercase">Cor</th>
                                                    <th className="px-6 py-3 text-left text-xs font-extrabold text-gray-400 uppercase">Chassi</th>
                                                    <th className="px-6 py-3 text-center text-xs font-extrabold text-gray-400 uppercase">Pedido</th>
                                                    <th className="px-6 py-3 text-right text-xs font-extrabold text-gray-400 uppercase">Origem</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-100">
                                                {motosDesteDestino.map((moto) => (
                                                    <tr key={moto.id}>
                                                        <td className="px-6 py-3 text-sm font-bold text-gray-700">{moto.modelo}</td>
                                                        <td className="px-6 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="h-3 w-3 rounded-full border border-gray-300" style={{ backgroundColor: getColorHex(moto.cor) }}></span>
                                                                <span className="text-xs uppercase text-gray-500 font-bold">{moto.cor}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3 text-sm font-mono text-gray-600 bg-gray-50/50">{moto.chassi}</td>
                                                        <td className="px-6 py-3 text-center">
                                                            {moto._pedido_info?.id ? (
                                                                <Link href={route('pedidos.show', moto._pedido_info.id)} className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-100 hover:text-blue-900 transition">
                                                                    #{moto._pedido_info.id}
                                                                </Link>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-400 italic">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-3 text-right">
                                                            {moto._pedido_info?.origem_user_id ? (
                                                                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">TRANSF.</span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">CD</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* --- MODO IMPRESSÃO (MANIFESTO OFICIAL) --- */}
            <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999] print:p-0 print:w-full print:h-full text-black font-sans bg-white">
                
                {/* CABEÇALHO */}
                <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end px-8 pt-8">
                    <div>
                        <h1 className="text-4xl font-black uppercase tracking-tighter leading-none">Manifesto de Carga</h1>
                        <p className="text-sm font-bold mt-1 tracking-widest text-gray-600 uppercase">Shineray Norte - Logística Integrada</p>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-gray-500">Romaneio Digital</div>
                        <div className="text-5xl font-mono font-bold leading-none tracking-tight">#{String(romaneio.id).padStart(6, '0')}</div>
                        <div className="text-[10px] mt-1 font-bold">{new Date().toLocaleString('pt-BR')}</div>
                    </div>
                </div>

                {/* INFO MOTORISTA */}
                <div className="mx-8 mb-8 border border-black grid grid-cols-4 divide-x divide-black text-xs">
                    <div className="p-3">
                        <span className="block text-[9px] uppercase font-bold text-gray-500 mb-1">Motorista Responsável</span>
                        <span className="font-bold uppercase text-sm block">{romaneio.motorista}</span>
                    </div>
                    <div className="p-3">
                        <span className="block text-[9px] uppercase font-bold text-gray-500 mb-1">Placa do Veículo</span>
                        <span className="font-bold uppercase text-sm block font-mono bg-gray-100 inline px-1 rounded">{romaneio.placa}</span>
                    </div>
                    <div className="p-3">
                        <span className="block text-[9px] uppercase font-bold text-gray-500 mb-1">Rota Prevista</span>
                        {/* AQUI ESTÁ A CORREÇÃO: Usamos a rotaCalculada */}
                        <span className="font-bold uppercase text-sm block">{rotaCalculada}</span>
                    </div>
                    <div className="p-3 bg-gray-100 flex flex-col justify-center items-center">
                        <span className="block text-[9px] uppercase font-bold text-gray-500">Total Volumes</span>
                        <span className="font-black text-xl block">{totalMotos}</span>
                    </div>
                </div>

                {/* CORPO DO MANIFESTO (ROTAS) */}
                <div className="mx-8">
                    {Object.keys(cargasAgrupadas).map((destinoNome) => (
                        <div key={destinoNome} className="mb-8 break-inside-avoid page-break-inside-avoid border border-black rounded-sm overflow-hidden">
                            
                            {/* Header do Destino */}
                            <div className="bg-black text-white px-4 py-2 text-sm font-bold uppercase flex justify-between items-center print:bg-black print:text-white">
                                <div className="flex items-center gap-2">
                                    <span>📍 DESTINO: {destinoNome}</span>
                                </div>
                                <span className="bg-white text-black px-2 py-0.5 rounded text-xs font-black">{cargasAgrupadas[destinoNome].length} VOLS</span>
                            </div>

                            {/* Tabela de Itens */}
                            <table className="w-full text-[10px] border-collapse">
                                <thead className="bg-gray-200 text-black border-b border-black font-bold">
                                    <tr>
                                        <th className="border-r border-black p-2 w-10 text-center">#</th>
                                        <th className="border-r border-black p-2 text-left">MODELO / DESCRIÇÃO</th>
                                        <th className="border-r border-black p-2 text-left w-32">CHASSI</th>
                                        <th className="border-r border-black p-2 text-center w-20">COR</th>
                                        <th className="border-r border-black p-2 text-center w-24">ORIGEM</th>
                                        <th className="p-2 text-center w-32">CONFERÊNCIA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cargasAgrupadas[destinoNome].map((moto, i) => (
                                        <tr key={moto.id} className="border-b border-gray-300 last:border-0">
                                            <td className="border-r border-black p-2 text-center font-bold">{i + 1}</td>
                                            <td className="border-r border-black p-2 font-bold">{moto.modelo}</td>
                                            <td className="border-r border-black p-2 font-mono text-xs">{moto.chassi}</td>
                                            <td className="border-r border-black p-2 text-center uppercase text-[9px]">{moto.cor}</td>
                                            <td className="border-r border-black p-2 text-center font-bold">
                                                {moto.status === 'aguardando_coleta' ? '⚠️ COLETAR' : (moto._pedido_info?.origem_user_id ? 'TRANSF.' : 'CD')}
                                            </td>
                                            <td className="p-2 text-center text-gray-300">________________</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Alerta de Coleta (Se houver) */}
                            {cargasAgrupadas[destinoNome].some(m => m.status === 'aguardando_coleta') && (
                                <div className="bg-gray-100 border-t border-black p-2 text-center text-[10px] font-bold uppercase">
                                    ⚠️ ATENÇÃO MOTORISTA: ESTE DESTINO POSSUI ITENS QUE DEVEM SER COLETADOS NO CAMINHO.
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* ASSINATURAS */}
                <div className="mx-8 mt-12 pt-4 border-t-2 border-black break-inside-avoid page-break-inside-avoid">
                      <p className="text-[10px] text-justify mb-16 italic text-gray-600 uppercase font-medium leading-relaxed">
                          Declaro ter recebido os volumes constantes neste manifesto em perfeito estado de conservação e funcionamento, conferindo chassis, cores e acessórios no ato da entrega. Avarias não reportadas no ato do recebimento não serão aceitas posteriormente.
                      </p>
                      <div className="grid grid-cols-3 gap-16 text-center">
                        <div>
                            <div className="border-t border-black mb-2"></div>
                            <p className="text-[10px] font-bold uppercase">Expedição CD</p>
                            <p className="text-[8px] text-gray-500">Conferente / Responsável</p>
                        </div>
                        <div>
                            <div className="border-t border-black mb-2"></div>
                            <p className="text-[10px] font-bold uppercase">Motorista</p>
                            <p className="text-[8px] text-gray-500">Transportadora</p>
                        </div>
                        <div>
                            <div className="border-t border-black mb-2"></div>
                            <p className="text-[10px] font-bold uppercase">Recebedor (Loja)</p>
                            <p className="text-[8px] text-gray-500">Carimbo e Assinatura</p>
                        </div>
                      </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

// Subcomponente Visual
function RomaneioStepper({ currentStep }) {
    const steps = [ { id: 1, label: 'Abertura', icon: '📝' }, { id: 2, label: 'Carregamento', icon: '📦' }, { id: 3, label: 'Trânsito', icon: '🚚' }, { id: 4, label: 'Concluído', icon: '🏁' } ];
    return (
        <div className="w-full">
            <div className="relative flex justify-between items-center w-full max-w-3xl mx-auto">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -z-10 rounded"></div>
                <div className="absolute top-1/2 left-0 h-1 bg-green-500 -z-10 rounded transition-all duration-700" style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}></div>
                {steps.map((step) => (
                    <div key={step.id} className="flex flex-col items-center bg-white px-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${step.id <= currentStep ? 'border-green-500 text-white bg-green-500 scale-110 shadow-lg' : 'border-gray-200 text-gray-300 bg-white'}`}>
                            {step.id < currentStep ? ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> ) : ( <span className="text-sm">{step.icon}</span> )}
                        </div>
                        <span className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${step.id <= currentStep ? 'text-green-700' : 'text-gray-400'}`}>{step.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}