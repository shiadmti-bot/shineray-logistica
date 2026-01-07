import { Head } from '@inertiajs/react';
import { useEffect } from 'react';

export default function Romaneio({ pedido }) {
    
    useEffect(() => {
        // Aguarda um momento para carregar a logo e imagens antes de abrir a janela de impressão
        setTimeout(() => {
            window.print();
        }, 800);
    }, []);

    const numeroRomaneio = pedido.romaneio 
        ? String(pedido.romaneio.id).padStart(6, '0') 
        : '---';

    return (
        <div className="bg-white text-black font-sans">
            <Head title={`Romaneio ${numeroRomaneio}`} />

            {/* ESTILOS DE IMPRESSÃO (O segredo está aqui) */}
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 10mm; /* Margem pequena para caber tudo */
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        -webkit-print-color-adjust: exact; /* Mantém cores e bordas */
                    }
                    .no-print {
                        display: none !important; /* Esconde botões */
                    }
                    /* Esconde cabeçalho/rodapé padrão do navegador se possível */
                    header, footer { display: none; } 
                }
            `}</style>

            {/* Container A4 */}
            <div className="max-w-[210mm] mx-auto p-4 md:p-8 relative">
                
                {/* CABEÇALHO COMPACTO */}
                <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-4">
                    <div className="w-1/3">
                        <img src="/img/logo.png" alt="Shineray" className="h-12 object-contain" />
                    </div>
                    <div className="w-2/3 text-right">
                        <h1 className="text-2xl font-bold uppercase tracking-wider text-red-700 leading-none">
                            ROMANEIO Nº {numeroRomaneio}
                        </h1>
                        <h2 className="text-xs font-bold text-gray-600 mt-1">Shineray By Sabel - CD Matriz</h2>
                        <p className="text-[10px] text-gray-500 font-mono">
                            Ref. Pedido Interno: #{pedido.id}
                        </p>
                    </div>
                </div>

                {/* DADOS GERAIS (Grid compacta) */}
                <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                    <div className="border border-gray-400 p-2 rounded">
                        <h3 className="font-bold bg-gray-100 px-1 border-b border-gray-300 uppercase mb-1">Destinatário</h3>
                        <p><span className="font-bold">Loja:</span> {pedido.user.name}</p>
                        <p><span className="font-bold">Filial:</span> {pedido.user.filial || 'Matriz'}</p>
                        <p><span className="font-bold">Email:</span> {pedido.user.email}</p>
                    </div>
                    <div className="border border-gray-400 p-2 rounded">
                        <h3 className="font-bold bg-gray-100 px-1 border-b border-gray-300 uppercase mb-1">Transporte / Saída</h3>
                        <p><span className="font-bold">Motorista:</span> {pedido.romaneio ? pedido.romaneio.motorista : '___________________'}</p>
                        <p><span className="font-bold">Placa:</span> {pedido.romaneio ? pedido.romaneio.placa.toUpperCase() : '_______'}</p>
                        <p><span className="font-bold">Data Emissão:</span> {pedido.romaneio ? new Date(pedido.romaneio.created_at).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>

                {/* TABELA DE ITENS */}
                <div className="mb-4">
                    <h3 className="font-bold text-sm mb-1 uppercase border-b border-black">Relação de Mercadorias</h3>
                    <table className="w-full border-collapse border border-black text-[10px]">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black px-1 py-1 text-center w-8">#</th>
                                <th className="border border-black px-2 py-1 text-left">Modelo</th>
                                <th className="border border-black px-2 py-1 text-left">Chassi (VIN)</th>
                                <th className="border border-black px-2 py-1 text-left">Cor</th>
                                <th className="border border-black px-1 py-1 text-center w-16">Confere</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pedido.motos.map((moto, index) => (
                                <tr key={moto.id}>
                                    <td className="border border-black px-1 py-1 text-center">{index + 1}</td>
                                    <td className="border border-black px-2 py-1 font-bold">{moto.modelo}</td>
                                    <td className="border border-black px-2 py-1 font-mono">{moto.chassi}</td>
                                    <td className="border border-black px-2 py-1">{moto.cor}</td>
                                    <td className="border border-black px-1 py-1 text-center text-gray-300">OK</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* OBSERVAÇÕES */}
                <div className="border border-black p-2 mb-8 min-h-[60px]">
                    <p className="text-[10px] font-bold uppercase mb-1">Observações / Ressalvas:</p>
                    <p className="text-xs">{pedido.observacao}</p>
                </div>

                {/* ASSINATURAS (Fixo na parte inferior visualmente, mas flui com o conteúdo) */}
                <div className="mt-8 pt-4">
                    <div className="grid grid-cols-2 gap-12">
                        <div className="text-center">
                            <div className="border-t border-black pt-1"></div>
                            <p className="font-bold uppercase text-[10px]">Assinatura do Conferente (CD)</p>
                        </div>
                        <div className="text-center">
                            <div className="border-t border-black pt-1"></div>
                            <p className="font-bold uppercase text-[10px]">Recebi as mercadorias acima</p>
                            <p className="text-[9px] text-gray-500">Data: ____/____/_______</p>
                        </div>
                    </div>
                </div>

                {/* Rodapé do Sistema */}
                <div className="text-center mt-8 text-[8px] text-gray-400">
                    Emitido pelo Sistema Logístico Shineray By Sabel em {new Date().toLocaleString('pt-BR')}
                </div>

            </div>
            
            {/* BOTÕES FLUTUANTES (Classe no-print esconde na impressão) */}
            <div className="fixed top-4 right-4 no-print flex gap-2">
                <button 
                    onClick={() => window.print()} 
                    className="bg-blue-600 text-white px-4 py-2 rounded font-bold shadow-lg hover:bg-blue-700 flex items-center gap-2"
                >
                    🖨 Imprimir
                </button>
                <button 
                    onClick={() => window.history.back()} 
                    className="bg-gray-600 text-white px-4 py-2 rounded font-bold shadow-lg hover:bg-gray-700"
                >
                    Voltar
                </button>
            </div>
        </div>
    );
}