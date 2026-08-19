import { useState, useEffect } from 'react';
import Modal from '@/Components/Modal';
import axios from 'axios';
import { ArrowPathIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function StockModal({ show, onClose, onSelect }) {
    const [loading, setLoading] = useState(false);
    const [estoque, setEstoque] = useState([]);
    const [error, setError] = useState(null);
    const [filtro, setFiltro] = useState('');

    useEffect(() => {
        if (show) {
            fetchEstoque();
        }
    }, [show]);

    const fetchEstoque = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(route('api.estoque.microwork'));
            // O retorno da API Microwork pode variar, vamos assumir que vem uma lista direta ou dentro de 'data'
            // Ajustaremos conforme o retorno real. Por enquanto, tratamos array direto.
            const dados = Array.isArray(response.data) ? response.data : (response.data.data || []);
            setEstoque(dados);
        } catch (err) {
            console.error(err);
            setError('Não foi possível carregar o estoque. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    // Filtra localmente por Modelo ou Chassi
    const estoqueFiltrado = estoque.filter(item => {
        const termo = filtro.toUpperCase();
        return (item.Modelo && item.Modelo.toUpperCase().includes(termo)) ||
               (item.Chassi && item.Chassi.toUpperCase().includes(termo)) ||
               (item.Cor && item.Cor.toUpperCase().includes(termo));
    });

    return (
        <Modal show={show} onClose={onClose} maxWidth="4xl">
            <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-content-primary flex items-center gap-2">
                        🏭 Estoque Fábrica (CD)
                        {loading && <ArrowPathIcon className="w-5 h-5 animate-spin text-content-muted" />}
                    </h2>
                    <button onClick={onClose} className="text-content-muted hover:text-content-secondary">✕</button>
                </div>

                <div className="mb-4">
                    <input 
                        type="text" 
                        placeholder="Filtrar por Modelo, Cor ou Chassi..." 
                        className="w-full border-line-strong rounded-lg shadow-sm focus:ring-status-info-solid focus:border-status-info-solid"
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                    />
                </div>

                {error && (
                    <div className="bg-status-danger-bg text-status-danger-fg p-3 rounded mb-4 flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-5 h-5" />
                        {error}
                    </div>
                )}

                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-surface-sunken text-content-secondary uppercase font-bold sticky top-0">
                            <tr>
                                <th className="p-3">Modelo</th>
                                <th className="p-3">Cor</th>
                                <th className="p-3">Chassi</th>
                                <th className="p-3">Status</th>
                                <th className="p-3 text-center">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-content-muted">
                                        Carregando dados do ERP...
                                    </td>
                                </tr>
                            ) : estoqueFiltrado.length > 0 ? (
                                estoqueFiltrado.map((moto, idx) => (
                                    <tr key={idx} className="hover:bg-surface-sunken">
                                        <td className="p-3 font-medium">{moto.Modelo || 'N/A'}</td>
                                        <td className="p-3">{moto.Cor || '-'}</td>
                                        <td className="p-3 font-mono text-xs">{moto.Chassi || '-'}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold 
                                                ${moto.SituacaoDescricao === 'Disponivel' ? 'bg-status-success-bg text-status-success-fg' : 'bg-surface-sunken text-content-primary'}`}>
                                                {moto.SituacaoDescricao || moto.Situacao || 'Desconhecido'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <button 
                                                onClick={() => onSelect(moto)}
                                                className="text-status-info-fg hover:text-status-info-fg font-bold text-xs border border-status-info-solid/30 hover:bg-status-info-bg px-3 py-1 rounded"
                                            >
                                                Solicitar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-content-muted">
                                        {estoque.length === 0 && !loading ? 'Nenhum veículo encontrado com os filtros atuais.' : 'Nenhum resultado.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 text-right text-xs text-content-muted">
                    Fonte: Microwork Cloud • Atualizado em tempo real
                </div>
            </div>
        </Modal>
    );
}
