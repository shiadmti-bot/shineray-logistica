import { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { ArrowPathIcon, ExclamationTriangleIcon, ChevronDownIcon, ChevronUpIcon, BuildingOffice2Icon, CheckCircleIcon, ArchiveBoxIcon, WrenchScrewdriverIcon, PauseCircleIcon, ClipboardDocumentListIcon, PrinterIcon, WrenchIcon } from '@heroicons/react/24/outline';

export default function StockTable({ user }) {
    const [loading, setLoading] = useState(false);
    const [estoque, setEstoque] = useState([]);
    const [reservas, setReservas] = useState([]);
    const [error, setError] = useState(null);
    const [filtro, setFiltro] = useState('');
    const [statusFiltro, setStatusFiltro] = useState('todas'); // 'todas', 'reservadas', 'livres'
    const [expandedStatus, setExpandedStatus] = useState({}); // Controla se o bloco "Situação" está aberto ou fechado
    const [expandedModel, setExpandedModel] = useState(null); // Controla qual Modelo está aberto dentro da Situação
    const [selectedMotos, setSelectedMotos] = useState([]); // Array com os objetos das motos selecionadas
    // Aba ativa: 'montadas' | 'desmontadas'
    const [abaAtiva, setAbaAtiva] = useState('montadas');

    const isLoja = user?.perfil === 'loja';
    const isAdminOrCD = user?.perfil === 'admin' || user?.perfil === 'gestor' || user?.perfil === 'cd';
    
    // FLAG DE CONTROLE: Ativa/Desativa botões de reserva/solicitação para lojas temporariamente
    const ALLOW_REQUESTS = false; 

    useEffect(() => {
        fetchEstoque();
    }, []);

    const fetchEstoque = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(route('api.estoque.microwork'));
            const dados = Array.isArray(response.data.data) ? response.data.data : (Array.isArray(response.data) ? response.data : []);
            const reservas_array = response.data.reservas_ativas || [];
            setEstoque(dados);
            setReservas(reservas_array);
        } catch (err) {
            console.error("Erro no Axios detalhado:", err);
            setError('Não foi possível carregar o estoque. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    // Helpers de classificação por pátio
    const isMontada = (item) => (item.patio || '').toUpperCase().includes('MOTOS MONTADAS');
    const isDesmontada = (item) => (item.patio || '').toUpperCase().includes('DESMONTADA CD');

    const estoqueFiltradoBase = estoque.filter(item => {
        const chassi = item.Chassi || item.chassi || '';
        const isReservado = reservas.includes(chassi);

        // Filtro de Status Reservada
        if (statusFiltro === 'reservadas' && !isReservado) return false;
        if (statusFiltro === 'livres' && isReservado) return false;

        // Lojas comerciais só podem ver motos MONTADAS e NÃO reservadas
        if (isLoja && (!isMontada(item) || isReservado)) {
            return false;
        }

        const termo = filtro.toUpperCase();
        const modelo = item.Modelo || item.modelo || '';
        const cor = item.Cor || item.cor || '';

        return modelo.toUpperCase().includes(termo) ||
               chassi.toUpperCase().includes(termo) ||
               cor.toUpperCase().includes(termo);
    });

    // Filtra pela aba ativa
    const estoqueFiltrado = estoqueFiltradoBase.filter(item => {
        if (abaAtiva === 'montadas') return isMontada(item) || (!isMontada(item) && !isDesmontada(item));
        if (abaAtiva === 'desmontadas') return isDesmontada(item);
        return true;
    });

    // Lista exclusiva de desmontadas (para o badge do menu)
    const totalDesmontadas = estoque.filter(item => isDesmontada(item)).length;
    const totalMontadas = estoque.filter(item => isMontada(item)).length;

    // Toggle checkbox na tabela
    const handleCheckboxChange = (moto) => {
        const chassi = moto.Chassi || moto.chassi;
        setSelectedMotos(prev => {
            const isSelected = prev.some(m => (m.Chassi || m.chassi) === chassi);
            if (isSelected) {
                return prev.filter(m => (m.Chassi || m.chassi) !== chassi);
            } else {
                return [...prev, moto];
            }
        });
    };

    const handleSolicitarSelecionadas = () => {
        if (selectedMotos.length === 0) return;
        
        // Mapear apenas os dados necessários
        const motosParaPrefill = selectedMotos.map(moto => ({
            chassi: moto.Chassi || moto.chassi || '',
            modelo: moto.Modelo || moto.modelo || '',
            cor: moto.Cor || moto.cor || '',
            ano: moto.AnoFabricacao || moto.anofabricacao || ''
        }));

        const jsonStr = encodeURIComponent(JSON.stringify(motosParaPrefill));
        window.location.href = route('solicitar') + '?prefill_motos=' + jsonStr;
    };

    // Agrupando os dados filtrados por Situação e então por Modelo
    const grupos = estoqueFiltrado.reduce((acc, moto) => {
        const patioStr = (moto.patio || '').toUpperCase();
        let situacao = 'Indisponível';
        
        if (patioStr.includes('MOTOS MONTADAS')) {
            situacao = 'Disponível (Montadas)';
        } else if (patioStr.includes('DESMONTADA CD')) {
            situacao = 'Desmontadas';
        } else if (patioStr.includes('CD EXPEDI')) {
            situacao = 'Separada / Solicitada';
        } else if (patioStr.includes('AVARIA')) {
            situacao = 'Em Conserto';
        } else if (patioStr.includes('INATIVADA')) {
            situacao = 'Parada';
        }

        if (!acc[situacao]) {
            acc[situacao] = {
                total: 0,
                modelos: {}
            };
        }

        const modelo = moto.Modelo || moto.modelo || 'Outros Modelos / N/A';
        if (!acc[situacao].modelos[modelo]) {
            acc[situacao].modelos[modelo] = {
                motos: [],
                total: 0
            };
        }

        acc[situacao].modelos[modelo].motos.push(moto);
        acc[situacao].modelos[modelo].total++;
        acc[situacao].total++;
        
        return acc;
    }, {});

    // Ordenação das Situações (Disponível no topo)
    const orderSituacoes = ['Disponível (Montadas)', 'Desmontadas', 'Separada / Solicitada', 'Em Conserto', 'Parada', 'Indisponível'];
    const situacoesAgrupadas = Object.entries(grupos).sort((a, b) => {
        return orderSituacoes.indexOf(a[0]) - orderSituacoes.indexOf(b[0]);
    });

    const toggleAccordion = (modelKey) => {
        setExpandedModel(prev => prev === modelKey ? null : modelKey);
    };

    const toggleStatusAccordion = (situacao) => {
        setExpandedStatus(prev => ({
            ...prev,
            [situacao]: !prev[situacao] // Toggle o valor atual
        }));
    };

    const handlePrintConference = async () => {
        const anosUnicos = [...new Set(estoqueFiltrado.map(m => m.AnoFabricacao || m.anofabricacao || '').filter(Boolean))].sort();
        const anosOptions = anosUnicos.map(ano => `<option value="${ano}">Ano: ${ano}</option>`).join('');

        const { value: formValues } = await Swal.fire({
            title: 'Imprimir Conferência',
            html: `
                <div class="text-left space-y-4">
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">Agrupamento do Relatório</label>
                        <select id="swal-print-group" class="w-full border-gray-300 rounded-lg shadow-sm text-sm p-3">
                            <option value="situacao">Por Situação > Modelo (Padrão)</option>
                            <option value="patio">Por Pátio Físico > Modelo</option>
                            <option value="modelo">Apenas por Modelo</option>
                            <option value="lista">Lista Simples (Sem agrupamento)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">Filtrar por Ano</label>
                        <select id="swal-print-ano" class="w-full border-gray-300 rounded-lg shadow-sm text-sm p-3">
                            <option value="todos">Todos os Anos</option>
                            ${anosOptions}
                        </select>
                    </div>
                    <p class="text-xs text-gray-500 mt-2 text-center">Serão impressas apenas as motos (<b>${estoqueFiltrado.length}</b>) atualmente visíveis em tela pelos filtros de busca.</p>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Gerar Relatório',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                return {
                    grupo: document.getElementById('swal-print-group').value,
                    ano: document.getElementById('swal-print-ano').value
                }
            }
        });

        if (formValues) {
            generatePrint(formValues.grupo, formValues.ano);
        }
    };

    const generatePrint = (agrupamento, anoFiltro) => {
        let itemsParaImprimir = estoqueFiltrado;
        if (anoFiltro && anoFiltro !== 'todos') {
            itemsParaImprimir = itemsParaImprimir.filter(m => (m.AnoFabricacao || m.anofabricacao) == anoFiltro);
        }

        // Re-agrupar baseado apenas nos itemsParaImprimir para o agrupamento por "situação"
        const gruposImprimir = itemsParaImprimir.reduce((acc, moto) => {
            const patioStr = (moto.patio || '').toUpperCase();
            let situacao = 'Indisponível';
            if (patioStr.includes('MOTOS MONTADAS')) situacao = 'Disponível (Montadas)';
            else if (patioStr.includes('DESMONTADA CD')) situacao = 'Desmontadas';
            else if (patioStr.includes('CD EXPEDI')) situacao = 'Separada / Solicitada';
            else if (patioStr.includes('AVARIA')) situacao = 'Em Conserto';
            else if (patioStr.includes('INATIVADA')) situacao = 'Parada';

            if (!acc[situacao]) acc[situacao] = { total: 0, modelos: {} };
            const modelo = moto.Modelo || moto.modelo || 'Outros Modelos / N/A';
            if (!acc[situacao].modelos[modelo]) acc[situacao].modelos[modelo] = { motos: [], total: 0 };

            acc[situacao].modelos[modelo].motos.push(moto);
            acc[situacao].modelos[modelo].total++;
            acc[situacao].total++;
            return acc;
        }, {});

        const orderSituacoes = ['Disponível (Montadas)', 'Desmontadas', 'Separada / Solicitada', 'Em Conserto', 'Parada', 'Indisponível'];
        const situacoesAgrupadasImprimir = Object.entries(gruposImprimir).sort((a, b) => orderSituacoes.indexOf(a[0]) - orderSituacoes.indexOf(b[0]));

        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório de Conferência de Estoque CD</title>
                <style>
                    body { font-family: sans-serif; font-size: 11px; margin: 20px; color: #333; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 25px; page-break-inside: avoid; }
                    th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
                    th { border-bottom: 2px solid #000; font-weight: bold; background-color: #f8f8f8; font-size: 10px; text-transform: uppercase; }
                    td { font-size: 11px; }
                    h2 { font-size: 16px; margin: 0 0 5px 0; }
                    h3 { font-size: 14px; margin: 20px 0 5px 0; background: #eee; padding: 6px; border-left: 5px solid #333; page-break-after: avoid; }
                    h4 { font-size: 12px; margin: 15px 0 5px 0; border-bottom: 1px solid #ddd; padding-bottom: 3px; page-break-after: avoid; }
                    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    .header-info { text-align: right; font-size: 10px; color: #555; }
                    .res { color: #d00; font-weight: bold; font-size: 9px; }
                    @media print {
                        @page { margin: 1.5cm; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h2>Conferência de Estoque: ${agrupamento.toUpperCase()}</h2>
                        <p style="margin:0;">Shineray By Sabel - Logística</p>
                    </div>
                    <div class="header-info">
                        Impresso em: ${new Date().toLocaleString('pt-BR')}<br/>
                        Usuário: ${user?.name || 'Sistema'}<br/>
                        Total de Veículos Impressos: <b>${itemsParaImprimir.length}</b>${anoFiltro !== 'todos' ? ` (Ano: ${anoFiltro})` : ''}
                    </div>
                </div>
        `;

        const renderTableHead = () => `
            <thead>
                <tr>
                    <th width="5%">#</th>
                    <th width="20%">Chassi</th>
                    <th width="20%">Modelo</th>
                    <th width="10%">Cor</th>
                    <th width="15%">Pátio Físico</th>
                    <th width="10%">Dias</th>
                    <th width="20%">Situação no ERP</th>
                </tr>
            </thead><tbody>
        `;

        const renderTableRow = (moto, i) => {
            const isRes = reservas.includes(moto.Chassi || moto.chassi) ? '<span class="res">(RESERVADO)</span>' : '';
            return `
                <tr>
                    <td>${i + 1}</td>
                    <td><strong>${moto.Chassi || moto.chassi}</strong> ${isRes}</td>
                    <td>${moto.Modelo || moto.modelo}</td>
                    <td>${moto.Cor || moto.cor}</td>
                    <td>${moto.patio || '-'}</td>
                    <td>${moto.diasestoque ?? moto.DiasEstoque ?? '-'}</td>
                    <td>${moto.SituacaoDescricao || moto.situacaoestoque || moto.Situacao || moto.situacao || '-'}</td>
                </tr>
            `;
        };

        if (itemsParaImprimir.length === 0) {
            html += '<p>Nenhuma moto encontrada com os filtros atuais.</p>';
        } else {
            if (agrupamento === 'situacao') {
                situacoesAgrupadasImprimir.forEach(([sitName, sitData]) => {
                    html += `<h3>${sitName} (Total: ${sitData.total})</h3>`;
                    Object.entries(sitData.modelos).sort().forEach(([modName, modData]) => {
                        html += `<h4>Modelo: ${modName} (QTD: ${modData.total})</h4>`;
                        html += `<table>${renderTableHead()}`;
                        modData.motos.forEach((m, idx) => html += renderTableRow(m, idx));
                        html += `</tbody></table>`;
                    });
                });
            } else if (agrupamento === 'patio') {
                const porPatio = {};
                itemsParaImprimir.forEach(m => {
                    const p = m.patio || 'NÃO LOCALIZADO';
                    if (!porPatio[p]) porPatio[p] = { motos: [], total: 0 };
                    porPatio[p].motos.push(m);
                    porPatio[p].total++;
                });
                
                Object.entries(porPatio).sort().forEach(([patName, patData]) => {
                    html += `<h3>PÁTIO FÍSICO: ${patName} (Total: ${patData.total})</h3>`;
                    const porModeloDentroP = {};
                    patData.motos.forEach(m => {
                        const model = m.Modelo || m.modelo || 'Outros';
                        if (!porModeloDentroP[model]) porModeloDentroP[model] = [];
                        porModeloDentroP[model].push(m);
                    });

                    Object.entries(porModeloDentroP).sort().forEach(([mName, mMotos]) => {
                        html += `<h4>Modelo: ${mName} (QTD: ${mMotos.length})</h4>`;
                        html += `<table>${renderTableHead()}`;
                        mMotos.forEach((m, idx) => html += renderTableRow(m, idx));
                        html += `</tbody></table>`;
                    });
                });
            } else if (agrupamento === 'modelo') {
                const porModelo = {};
                itemsParaImprimir.forEach(m => {
                    const model = m.Modelo || m.modelo || 'Outros';
                    if (!porModelo[model]) porModelo[model] = [];
                    porModelo[model].push(m);
                });
                Object.entries(porModelo).sort().forEach(([mName, mMotos]) => {
                    html += `<h3>Modelo: ${mName} (Total: ${mMotos.length} motos)</h3>`;
                    html += `<table>${renderTableHead()}`;
                    mMotos.forEach((m, idx) => html += renderTableRow(m, idx));
                    html += `</tbody></table>`;
                });
            } else {
                html += `<table>${renderTableHead()}`;
                itemsParaImprimir.forEach((m, idx) => html += renderTableRow(m, idx));
                html += `</tbody></table>`;
            }
        }

        html += `<script>window.onload = function() { setTimeout(function(){ window.print(); window.close(); }, 500); }</script></body></html>`;

        const printWin = window.open('', '_blank');
        printWin.document.write(html);
        printWin.document.close();
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <BuildingOffice2Icon className="w-6 h-6 text-red-700" /> Estoque Fábrica (Microwork)
                    {loading && <ArrowPathIcon className="w-5 h-5 animate-spin text-gray-500" />}
                </h2>
                
                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                    <select
                        className="w-full md:w-auto border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        value={statusFiltro}
                        onChange={(e) => setStatusFiltro(e.target.value)}
                    >
                        <option value="todas">Todas as Motos</option>
                        <option value="reservadas">Apenas Reservadas</option>
                        <option value="livres">Apenas Livres</option>
                    </select>

                    <input 
                        type="text" 
                        placeholder="Filtrar por Modelo, Cor ou Chassi..." 
                        className="w-full md:w-80 border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                    />
                    {isAdminOrCD && (
                        <button 
                            onClick={handlePrintConference}
                            className="bg-gray-800 text-white p-2 md:px-4 md:py-2 rounded-lg font-bold hover:bg-black transition flex items-center justify-center gap-2 shadow-sm shrink-0"
                            title="Imprimir Relatório de Conferência"
                        >
                            <PrinterIcon className="w-5 h-5" />
                            <span className="hidden md:inline">Imprimir Conferência</span>
                        </button>
                    )}
                </div>
            </div>

            {/* --- ABAS: MONTADAS / DESMONTADAS --- */}
            <div className="flex gap-1 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setAbaAtiva('montadas')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-t-lg border-b-2 transition-all ${
                        abaAtiva === 'montadas'
                            ? 'border-green-600 text-green-700 bg-green-50'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <CheckCircleIcon className="w-4 h-4" />
                    Disponíveis (Montadas)
                    {!loading && (
                        <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
                            abaAtiva === 'montadas' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>{totalMontadas}</span>
                    )}
                </button>

                {!isLoja && (
                    <button
                        onClick={() => setAbaAtiva('desmontadas')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-t-lg border-b-2 transition-all ${
                            abaAtiva === 'desmontadas'
                                ? 'border-amber-600 text-amber-700 bg-amber-50'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        <WrenchIcon className="w-4 h-4" />
                        Desmontadas
                        {!loading && (
                            <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
                                abaAtiva === 'desmontadas' ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-600'
                            }`}>{totalDesmontadas}</span>
                        )}
                    </button>
                )}
            </div>

            {/* Banner informativo para loja */}
            {isLoja && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 shrink-0 text-blue-600" />
                    Exibindo apenas motos <strong>montadas e disponíveis</strong> para solicitação.
                </div>
            )}

            {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded mb-4 flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5" />
                    {error}
                </div>
            )}

            <div className="space-y-6">
                {loading ? (
                    <div className="p-8 text-center text-gray-500 flex justify-center items-center gap-2 border rounded-lg bg-gray-50">
                        <ArrowPathIcon className="w-5 h-5 animate-spin" />
                        Carregando dados do ERP em tempo real...
                    </div>
                ) : situacoesAgrupadas.length > 0 ? (
                    situacoesAgrupadas.map(([nomeSituacao, dadosSituacao], sitIdx) => {
                        
                        let situacaoBg = 'bg-gray-100 border-gray-300';
                        let situacaoText = 'text-gray-800';
                        let SitIcon = PauseCircleIcon;
                        let iconColor = 'text-gray-600';

                        if (nomeSituacao.includes('Montadas')) { 
                            situacaoBg = 'bg-green-100 border-green-300'; 
                            situacaoText = 'text-green-900'; 
                            SitIcon = CheckCircleIcon;
                            iconColor = 'text-green-700';
                        }
                        else if (nomeSituacao.includes('Desmontadas')) {
                            situacaoBg = 'bg-amber-100 border-amber-300';
                            situacaoText = 'text-amber-900';
                            SitIcon = WrenchIcon;
                            iconColor = 'text-amber-700';
                        }
                        else if (nomeSituacao.includes('Separada')) { 
                            situacaoBg = 'bg-blue-100 border-blue-300'; 
                            situacaoText = 'text-blue-900'; 
                            SitIcon = ArchiveBoxIcon;
                            iconColor = 'text-blue-700';
                        }
                        else if (nomeSituacao.includes('Conserto')) { 
                            situacaoBg = 'bg-orange-100 border-orange-300'; 
                            situacaoText = 'text-orange-900'; 
                            SitIcon = WrenchScrewdriverIcon;
                            iconColor = 'text-orange-700';
                        }

                        return (
                            <div key={sitIdx} className={`rounded-xl overflow-hidden border ${situacaoBg}`}>
                                {/* Cabeçalho da Situação (Accordion Principal) */}
                                <div 
                                    className="p-4 flex justify-between items-center border-b border-black/5 bg-black/5 cursor-pointer hover:bg-black/10 transition"
                                    onClick={() => toggleStatusAccordion(nomeSituacao)}
                                >
                                    <div className="flex items-center gap-3">
                                        <button className="text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-sm">
                                            {expandedStatus[nomeSituacao] ? <ChevronUpIcon className="w-6 h-6" /> : <ChevronDownIcon className="w-6 h-6" />}
                                        </button>
                                        <h3 className={`font-black text-xl flex items-center gap-2 ${situacaoText}`}>
                                            <SitIcon className={`w-6 h-6 ${iconColor}`} /> {nomeSituacao}
                                        </h3>
                                    </div>
                                    <span className="bg-white/80 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm border border-black/10">
                                        Total: {dadosSituacao.total} motos
                                    </span>
                                </div>

                                {/* Lista de Modelos dentro da Situação - Visível apenas se Accordion de Situação estiver aberto */}
                                {expandedStatus[nomeSituacao] && (
                                    <div className="p-4 space-y-3 bg-white/60">
                                    {Object.entries(dadosSituacao.modelos).sort((a,b) => a[0].localeCompare(b[0])).map(([nomeModelo, dadosModelo], modIdx) => {
                                        const modelKey = `${nomeSituacao}-${nomeModelo}`;
                                        const isExpanded = expandedModel === modelKey;
                                        
                                        // Extrair Cores (Excluindo Reservadas)
                                        const coresDisp = [...new Set(
                                            dadosModelo.motos
                                                .filter(m => !reservas.includes(m.Chassi || m.chassi))
                                                .map(m => (m.Cor || m.cor || '-').toUpperCase().trim())
                                        )].filter(c => c !== '-').sort();

                                        return (
                                            <div key={modIdx} className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm hover:border-gray-300 transition-colors">
                                                {/* Cabeçalho do Accordion (Resumo do Modelo) */}
                                                <div 
                                                    className="p-4 bg-gray-50 cursor-pointer flex justify-between items-center"
                                                    onClick={() => toggleAccordion(modelKey)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <button className="text-gray-500 hover:text-gray-800 focus:outline-none">
                                                            {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                                                        </button>
                                                        <div>
                                                            <div className="flex items-center gap-3">
                                                                <h4 className="font-bold text-gray-800 text-lg">{nomeModelo}</h4>
                                                                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-bold">
                                                                    {dadosModelo.total} un.
                                                                </span>
                                                            </div>
                                                            {coresDisp.length > 0 && (
                                                                <p className="text-xs text-gray-600 mt-1">
                                                                    <span className="font-semibold text-gray-700">Cores: </span> 
                                                                    {coresDisp.join(', ')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Corpo do Accordion (Tabela Detalhada) */}
                                                {isExpanded && (
                                                    <div className="border-t border-gray-200 overflow-x-auto">
                                                        <table className="w-full text-sm text-left">
                                                            <thead className="bg-gray-100 text-gray-600 uppercase font-bold text-xs">
                                                                <tr>
                                                                    {isLoja && ALLOW_REQUESTS && <th className="p-3 pl-4 text-center w-12">Sel.</th>}
                                                                    <th className={`p-3 ${isLoja && ALLOW_REQUESTS ? '' : 'pl-6'}`}>Cor</th>
                                                                    <th className="p-3">Chassi</th>
                                                                    <th className="p-3">Ano</th>
                                                                    <th className="p-3">Pátio Original</th>
                                                                    <th className="p-3 text-center">Dias Pátio</th>
                                                                    <th className="p-3 text-center">Situação ERP</th>
                                                                    <th className="p-3 text-center w-24">Ações</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {dadosModelo.motos.map((moto, idx) => {
                                                                    const chassi = moto.Chassi || moto.chassi;
                                                                    const isReservado = reservas.includes(chassi);
                                                                    const isDispReal = nomeSituacao.includes('Disponível');
                                                                    const isSelected = selectedMotos.some(m => (m.Chassi || m.chassi) === chassi);

                                                                    return (
                                                                        <tr key={idx} className={`hover:bg-blue-50 transition ${isSelected ? 'bg-blue-50' : 'bg-white'}`}>
                                                                            {isLoja && ALLOW_REQUESTS && (
                                                                                <td className="p-3 pl-4 text-center">
                                                                                    {isDispReal && !isReservado && (
                                                                                        <input 
                                                                                            type="checkbox" 
                                                                                            className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                                                                            checked={isSelected}
                                                                                            onChange={() => handleCheckboxChange(moto)}
                                                                                        />
                                                                                    )}
                                                                                </td>
                                                                            )}
                                                                            <td className={`p-3 ${isLoja && ALLOW_REQUESTS ? '' : 'pl-6'} font-bold text-gray-900 border-l-4 ${isSelected ? 'border-l-blue-600' : 'border-l-blue-500'}`}>{moto.Cor || moto.cor || '-'}</td>
                                                                            <td className="p-3 font-mono text-xs text-gray-600 font-semibold">{chassi || '-'}</td>
                                                                            <td className="p-3 text-gray-600">{moto.AnoFabricacao || moto.anofabricacao || '-'}</td>
                                                                            <td className="p-3 text-xs text-gray-500 font-medium">
                                                                                {moto.patio}
                                                                            </td>
                                                                            <td className="p-3 text-center">
                                                                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-700 font-bold shadow-sm border border-gray-200 text-xs">
                                                                                    {moto.diasestoque !== undefined ? moto.diasestoque : (moto.DiasEstoque !== undefined ? moto.DiasEstoque : '-')}
                                                                                </span>
                                                                            </td>
                                                                            <td className="p-3 text-xs text-gray-500 text-center font-medium">
                                                                                {moto.SituacaoDescricao || moto.situacaodescricao || moto.situacaoestoque || moto.Situacao || moto.situacao || '-'}
                                                                            </td>
                                                                            <td className="p-3 text-center">
                                                                                {isLoja && ALLOW_REQUESTS && isDispReal && !isReservado && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const jsonStr = encodeURIComponent(JSON.stringify([{
                                                                                                chassi: chassi,
                                                                                                modelo: moto.Modelo || moto.modelo || '',
                                                                                                cor: moto.Cor || moto.cor || '',
                                                                                                ano: moto.AnoFabricacao || moto.anofabricacao || ''
                                                                                            }]));
                                                                                            window.location.href = route('solicitar') + '?prefill_motos=' + jsonStr;
                                                                                        }}
                                                                                        className="text-xs px-3 py-1.5 rounded shadow-sm text-white font-bold transition flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700"
                                                                                    >
                                                                                        Solicitar
                                                                                    </button>
                                                                                )}
                                                                                {isAdminOrCD && isReservado && (
                                                                                     <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded shadow-sm border border-red-200">RESERVADO</span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="p-8 text-center text-gray-500 border rounded-lg bg-gray-50">
                        {estoque.length === 0 && !loading ? 'Nenhum veículo encontrado no estoque do CD.' : 'Nenhum resultado para o filtro.'}
                    </div>
                )}
            </div>
            
            {/* Legenda Explicativa */}
            <div className="mt-8 bg-gray-50 p-4 border border-gray-200 rounded-lg shadow-sm">
                <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2 flex items-center gap-2"><ClipboardDocumentListIcon className="w-5 h-5"/> Legenda de Situações (Origem Microwork)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 text-xs text-gray-600">
                    <div className="flex items-start gap-2">
                        <span className="bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 rounded shadow-sm shrink-0 whitespace-nowrap flex items-center gap-1"><CheckCircleIcon className="w-3 h-3"/> Disponível (Montadas)</span>
                        <p>Motos completamente montadas no CD, prontas para faturar.</p>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded shadow-sm shrink-0 whitespace-nowrap flex items-center gap-1"><WrenchIcon className="w-3 h-3"/> Desmontadas</span>
                        <p>Motos no pátio de desmontagem do CD (não disponíveis para lojas).</p>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded shadow-sm shrink-0 whitespace-nowrap flex items-center gap-1"><ArchiveBoxIcon className="w-3 h-3"/> Separada / Solicitada</span>
                        <p>Motos que estão em expedição no Microwork.</p>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="bg-orange-100 text-orange-800 border border-orange-200 px-2 py-0.5 rounded shadow-sm shrink-0 whitespace-nowrap flex items-center gap-1"><WrenchScrewdriverIcon className="w-3 h-3"/> Em Conserto</span>
                        <p>Motos que estão no pátio de avarias.</p>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="bg-gray-200 text-gray-600 border border-gray-300 px-2 py-0.5 rounded shadow-sm shrink-0 whitespace-nowrap flex items-center gap-1"><PauseCircleIcon className="w-3 h-3"/> Parada</span>
                        <p>Motos que estão Inativadas no CD.</p>
                    </div>
                </div>
            </div>

            <div className="mt-4 flex justify-between items-center text-xs text-gray-500 pt-2 px-2">
                <span>Total Visualizado: {estoqueFiltrado.length} motos</span>
                <span>Fonte: Microwork Cloud API</span>
            </div>

            {/* BARRA FLUTUANTE DE SOLICITAÇÃO MÚLTIPLA */}
            {selectedMotos.length > 0 && ALLOW_REQUESTS && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-blue-600 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-4 flex justify-between items-center z-50 transform transition-transform animate-slideUp">
                    <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                            <span className="bg-blue-100 text-blue-800 font-black text-xl px-4 py-2 rounded-lg border border-blue-200">
                                {selectedMotos.length}
                            </span>
                            <div>
                                <h4 className="font-bold text-gray-800 text-lg">Motos Selecionadas</h4>
                                <p className="text-xs text-gray-500">Prontas para adicionar à sua Nova Solicitação.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button 
                                onClick={() => setSelectedMotos([])}
                                className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                                Limpar
                            </button>
                            <button 
                                onClick={handleSolicitarSelecionadas}
                                className="flex-1 sm:flex-none px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
                            >
                                Prosseguir Solicitação ({selectedMotos.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
