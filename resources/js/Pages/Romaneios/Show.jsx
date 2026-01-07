import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, router } from '@inertiajs/react'; // Importar router para o delete

export default function RomaneioShow({ auth, romaneio, cargasPorLoja }) {
    const { post, processing } = useForm();

    const handlePrint = () => window.print();

    // 1. Função de Confirmar Saída (Muda status para Em Trânsito)
    const confirmarSaida = () => {
        if (confirm(`ATENÇÃO: Confirmar saída de ${romaneio.motos.length} motos?`)) {
            post(route('romaneios.saida', romaneio.id));
        }
    };

    // 2. Função de Desfazer (Exclui Romaneio e devolve motos ao Pátio)
    const excluirRomaneio = () => {
        if (confirm('PERIGO: Tem certeza que deseja EXCLUIR este Romaneio?\n\n- O documento será apagado.\n- Todas as motos voltarão para o status "SEPARADO" (Pátio).\n- Você terá que montar a carga novamente.')) {
            router.delete(route('romaneios.destroy', romaneio.id));
        }
    };

    const jaSaiu = romaneio.motos.length > 0 && romaneio.motos[0].status === 'em_transito';
    const jaEntregue = romaneio.motos.length > 0 && romaneio.motos[0].status === 'concluido';

    // Simulação visual de código de barras
    const barcode = `||| | ||| | ${romaneio.id} | || |||`;

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-gray-800">Expedição #{String(romaneio.id).padStart(6, '0')}</h2>}>
            <Head title={`Manifesto ${romaneio.id}`} />

            {/* --- CSS DE IMPRESSÃO --- */}
            <style>{`
                @media print {
                    /* 1. Esconde a interface do sistema */
                    nav, footer, header, .no-print { 
                        display: none !important; 
                    }

                    /* 2. Reseta o fundo para branco */
                    body, html, #app { 
                        background-color: white !important; 
                        height: auto; 
                        overflow: visible;
                    }

                    /* 3. Posiciona o papel no topo absoluto, cobrindo tudo */
                    #documento-impresso {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        margin: 0;
                        padding: 0;
                        background-color: white;
                        z-index: 9999;
                        border: none;
                        box-shadow: none;
                    }

                    /* Configuração da folha A4 */
                    @page { size: A4; margin: 5mm; }
                    .page-break { page-break-inside: avoid; page-break-before: always; }
                }
            `}</style>

            <div className="py-8 bg-gray-100 min-h-screen">

                {/* ID alvo da impressão */}
                <div id="documento-impresso" className="max-w-[210mm] mx-auto bg-white p-8 shadow-2xl print:shadow-none print:p-2 min-h-[297mm]">

                    {/* --- PAINEL DE CONTROLE (Visível apenas na tela) --- */}
                    <div className="no-print mb-6 bg-gray-800 text-white p-4 rounded-lg flex flex-col md:flex-row justify-between items-center shadow-lg gap-4">
                        <div>
                            <h3 className="font-bold text-lg">Controle de Carga</h3>
                            <p className="text-sm text-gray-400">Total Volumes: {romaneio.motos.length}</p>
                            <div className="mt-1">
                                {jaSaiu ? (
                                    <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded font-bold">EM TRÂNSITO</span>
                                ) : jaEntregue ? (
                                    <span className="bg-green-500 text-white text-xs px-2 py-1 rounded font-bold">CONCLUÍDO</span>
                                ) : (
                                    <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded font-bold">NO PÁTIO</span>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 flex-wrap justify-end">
                            {/* Botão Imprimir */}
                            <button onClick={handlePrint} className="bg-white text-gray-900 px-4 py-2 rounded font-bold hover:bg-gray-100 flex items-center gap-2">
                                🖨 Imprimir
                            </button>

                            {/* Botão Desfazer (Se não foi entregue) */}
                            {!jaEntregue && (
                                <button
                                    onClick={excluirRomaneio}
                                    className="bg-red-600 text-white px-4 py-2 rounded font-bold hover:bg-red-700 border border-red-800 flex items-center gap-2"
                                    title="Excluir carga e devolver motos ao pátio"
                                >
                                    🗑️ Desfazer
                                </button>
                            )}

                            {/* Botão Liberar Saída (Se ainda está no pátio) */}
                            {!jaSaiu && !jaEntregue && (
                                <button onClick={confirmarSaida} disabled={processing} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 flex items-center gap-2">
                                    🚛 Liberar Saída
                                </button>
                            )}
                        </div>
                    </div>

                    {/* --- INÍCIO DO DOCUMENTO (LAYOUT DE MANIFESTO) --- */}

                    {/* Cabeçalho Corporativo */}
                    <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-4">
                        <div className="flex items-center gap-4">
                            <img src="/img/logo.png" className="h-16 object-contain grayscale print:filter-none" alt="Logo" />
                            <div>
                                <h1 className="text-xl font-bold uppercase tracking-tight">Manifesto de Carga</h1>
                                <p className="text-xs">Shineray By Sabel Logística e Distribuição</p>
                                <p className="text-[10px] text-gray-500">CNPJ: 00.000.000/0001-00 • IE: 00000000</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="font-mono text-3xl font-bold tracking-widest">{String(romaneio.id).padStart(8, '0')}</div>
                            <div className="text-[10px] font-mono mt-1 tracking-widest opacity-70">{barcode}</div>
                            <p className="text-xs mt-2">Emissão: {new Date(romaneio.created_at).toLocaleString('pt-BR')}</p>
                        </div>
                    </div>

                    {/* Dados do Transporte */}
                    <div className="border border-black mb-4">
                        <div className="bg-gray-200 border-b border-black p-1 px-2 font-bold text-xs uppercase print:bg-gray-300">Dados do Transporte</div>
                        <div className="grid grid-cols-4 divide-x divide-black text-xs">
                            <div className="p-2">
                                <span className="block text-[9px] text-gray-500 uppercase">Motorista</span>
                                <span className="font-bold uppercase">{romaneio.motorista}</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[9px] text-gray-500 uppercase">Placa Veículo</span>
                                <span className="font-bold uppercase">{romaneio.placa}</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[9px] text-gray-500 uppercase">Saída Prevista</span>
                                <span className="font-bold">{new Date().toLocaleDateString('pt-BR')}</span>
                            </div>
                            <div className="p-2">
                                <span className="block text-[9px] text-gray-500 uppercase">Qtd. Total</span>
                                <span className="font-bold">{romaneio.motos.length} Unidades</span>
                            </div>
                        </div>
                    </div>

                    {/* Conteúdo da Carga (Agrupado por Loja) */}
                    {Object.keys(cargasPorLoja).map((lojaNome) => (
                        <div key={lojaNome} className="mb-4 break-inside-avoid">
                            {/* Faixa da Loja */}
                            <div className="bg-black text-white p-1 px-2 text-xs font-bold uppercase flex justify-between print:bg-gray-800 print:text-white">
                                <span>DESTINATÁRIO: {lojaNome}</span>
                                <span>{cargasPorLoja[lojaNome].length} VOLUMES</span>
                            </div>

                            <table className="w-full text-[10px] border-collapse border-x border-b border-black">
                                <thead className="bg-gray-100 print:bg-gray-200">
                                    <tr>
                                        <th className="border-b border-r border-gray-400 p-1 w-8 text-center">Item</th>
                                        <th className="border-b border-r border-gray-400 p-1 text-left">Modelo</th>
                                        <th className="border-b border-r border-gray-400 p-1 text-left w-32">Chassi (VIN)</th>
                                        <th className="border-b border-r border-gray-400 p-1 text-left w-20">Cor</th>
                                        <th className="border-b border-r border-gray-400 p-1 text-center w-16">Pedido</th>
                                        <th className="border-b border-gray-400 p-1 text-center w-16">Confere</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cargasPorLoja[lojaNome].map((moto, i) => (
                                        <tr key={moto.id} className="even:bg-gray-50 print:even:bg-transparent">
                                            <td className="border-b border-r border-gray-300 p-1 text-center">{i + 1}</td>
                                            <td className="border-b border-r border-gray-300 p-1 font-bold">{moto.modelo}</td>
                                            <td className="border-b border-r border-gray-300 p-1 font-mono">{moto.chassi}</td>
                                            <td className="border-b border-r border-gray-300 p-1">{moto.cor}</td>
                                            <td className="border-b border-r border-gray-300 p-1 text-center">#{moto.pedidos[0]?.id}</td>
                                            <td className="border-b border-gray-300 p-1 text-center text-gray-300">___/___</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}

                    {/* Termos e Assinaturas */}
                    <div className="mt-8 border-t-2 border-black pt-2 break-inside-avoid">
                        <p className="text-[9px] text-justify text-gray-600 mb-6 leading-tight">
                            DECLARAÇÃO: O transportador declara ter recebido a carga acima discriminada em perfeitas condições externas. A conferência física dos chassis é de responsabilidade do recebedor no ato da descarga. Qualquer avaria ou divergência deve ser anotada no verso deste documento. A responsabilidade da transportadora cessa com a entrega e assinatura deste comprovante.
                        </p>

                        <div className="grid grid-cols-3 gap-8 mt-12">
                            <div className="text-center">
                                <div className="border-t border-black mb-1"></div>
                                <p className="text-[10px] font-bold uppercase">Expedição CD</p>
                            </div>
                            <div className="text-center">
                                <div className="border-t border-black mb-1"></div>
                                <p className="text-[10px] font-bold uppercase">Motorista</p>
                                <p className="text-[9px] uppercase">{romaneio.motorista}</p>
                            </div>
                            <div className="text-center">
                                <div className="border-t border-black mb-1"></div>
                                <p className="text-[10px] font-bold uppercase">Recebedor (Data/Hora)</p>
                            </div>
                        </div>
                    </div>

                    {/* Rodapé Sistema */}
                    <div className="mt-8 text-center text-[8px] text-gray-400 border-t pt-1">
                        Gerado via Sistema Integrado Shineray Sabel • {new Date().toLocaleString('pt-BR')} • ID: {romaneio.id}
                    </div>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}