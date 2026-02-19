import { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function StockTable() {
    const [loading, setLoading] = useState(false);
    const [estoque, setEstoque] = useState([]);
    const [error, setError] = useState(null);
    const [filtro, setFiltro] = useState('');

    useEffect(() => {
        fetchEstoque();
    }, []);

    const fetchEstoque = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(route('api.estoque.microwork'));
            const dados = Array.isArray(response.data) ? response.data : (response.data.data || []);
            setEstoque(dados);
        } catch (err) {
            console.error(err);
            setError('Não foi possível carregar o estoque. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const estoqueFiltrado = estoque.filter(item => {
        const termo = filtro.toUpperCase();
        return (item.Modelo && item.Modelo.toUpperCase().includes(termo)) ||
               (item.Chassi && item.Chassi.toUpperCase().includes(termo)) ||
               (item.Cor && item.Cor.toUpperCase().includes(termo));
    });

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    🏭 Estoque Fábrica (Microwork)
                    {loading && <ArrowPathIcon className="w-5 h-5 animate-spin text-gray-500" />}
                </h2>
                <div className="w-full md:w-1/3">
                    <input 
                        type="text" 
                        placeholder="Filtrar por Modelo, Cor ou Chassi..." 
                        className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                    />
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded mb-4 flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5" />
                    {error}
                </div>
            )}

            <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-600 uppercase font-bold">
                        <tr>
                            <th className="p-4">Modelo</th>
                            <th className="p-4">Cor</th>
                            <th className="p-4">Chassi</th>
                            <th className="p-4">Ano</th>
                            <th className="p-4">Disponibilidade</th>
                            <th className="p-4">Status no ERP</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-gray-500">
                                    <div className="flex justify-center items-center gap-2">
                                        <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                        Carregando dados do ERP em tempo real...
                                    </div>
                                </td>
                            </tr>
                        ) : estoqueFiltrado.length > 0 ? (
                            estoqueFiltrado.map((moto, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition">
                                    <td className="p-4 font-bold text-gray-700">{moto.Modelo || 'N/A'}</td>
                                    <td className="p-4">{moto.Cor || '-'}</td>
                                    <td className="p-4 font-mono text-xs">{moto.Chassi || '-'}</td>
                                    <td className="p-4">{moto.AnoFabricacao || '-'}</td>
                                    <td className="p-4">
                                        {/* Lógica simples de disponibilidade visual */}
                                        {moto.SituacaoDescricao === 'Disponivel' ? (
                                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                ✅ Disponível
                                             </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                ❌ {moto.SituacaoDescricao}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-xs text-gray-500">
                                        {moto.SituacaoDescricao || moto.Situacao}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-gray-500">
                                    {estoque.length === 0 && !loading ? 'Nenhum veículo encontrado no estoque do CD.' : 'Nenhum resultado para o filtro.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-4 flex justify-between items-center text-xs text-gray-500 border-t pt-4">
                <span>Total Visualizado: {estoqueFiltrado.length}</span>
                <span>Fonte: Microwork Cloud API</span>
            </div>
        </div>
    );
}
