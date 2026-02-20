import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import KpiCard from '@/Components/Bi/KpiCard';
import Chart from 'react-apexcharts';
import { 
    ClockIcon, 
    TruckIcon, 
    CheckBadgeIcon, 
    XCircleIcon,
    FunnelIcon,
    BuildingStorefrontIcon,
    ChartBarIcon
} from '@heroicons/react/24/outline';
import { useState } from 'react';

export default function BiIndex({ auth, kpis, status_chart, ranking_lojas, slas, filters }) {
    
    // --- Configuração dos Gráficos ---

    // 1. Gráfico de Status (Donut)
    const statusOptions = {
        labels: status_chart.map(s => s.status.toUpperCase().replace('_', ' ')),
        colors: ['#3B82F6', '#F59E0B', '#10B981', '#6366F1', '#EC4899'],
        legend: { position: 'bottom' },
        plotOptions: { pie: { donut: { size: '65%' } } }
    };
    const statusSeries = status_chart.map(s => s.total);

    // 2. Ranking de Lojas (Bar Horizontal)
    const rankingOptions = {
        chart: { type: 'bar' },
        plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
        xaxis: { categories: ranking_lojas.map(l => l.loja) },
        colors: ['#DC2626'],
        dataLabels: { enabled: true }
    };
    const rankingSeries = [{ name: 'Pedidos', data: ranking_lojas.map(l => l.total) }];

    // 3. SLA (Tempo Médio por Etapa) - Bar Vertical
    const slaOptions = {
        chart: { type: 'bar' },
        xaxis: { 
            categories: [
                'Análise Gestor', 
                'Separação (CD)', 
                'Separação (Lojas)', 
                'Montagem Carga', 
                'Trânsito/Entrega', 
                'LEAD TIME TOTAL'
            ] 
        },
        colors: ['#8B5CF6'],
        plotOptions: { bar: { columnWidth: '60%', borderRadius: 4 } },
        dataLabels: { 
            enabled: true,
            formatter: (val) => val + ' h' 
        },
        tooltip: { y: { formatter: (val) => val + ' horas' } }
    };
    const slaSeries = [{ 
        name: 'Tempo Médio', 
        data: [
            slas.analise, 
            slas.separacao_cd, 
            slas.separacao_loja, 
            slas.expedicao, 
            slas.transito, 
            slas.total
        ] 
    }];

    // --- Filtros de Data ---
    const [dates, setDates] = useState({ 
        start_date: filters.start_date, 
        end_date: filters.end_date 
    });

    const handleFilter = () => {
        router.get(route('bi.index'), dates, { preserveState: true, replace: true });
    };

    return (
        <AuthenticatedLayout
            user={auth.user}
            header={<h2 className="font-bold text-2xl text-gray-800 leading-tight flex items-center gap-2">
                <span className="text-red-600 flex items-center gap-1"><ChartBarIcon className="w-6 h-6"/> BI</span> Logística Integrada
            </h2>}
        >
            <Head title="BI - Dashboard Executivo" />

            <div className="py-8 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    
                    {/* Filtros */}
                    <div className="bg-white p-4 rounded-xl shadow-sm mb-8 flex flex-wrap gap-4 items-end border border-gray-100">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Início</label>
                            <input 
                                type="date" 
                                value={dates.start_date}
                                onChange={e => setDates({...dates, start_date: e.target.value})}
                                className="border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fim</label>
                            <input 
                                type="date" 
                                value={dates.end_date}
                                onChange={e => setDates({...dates, end_date: e.target.value})}
                                className="border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                        <button 
                            onClick={handleFilter}
                            className="bg-gray-800 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-gray-700 transition"
                        >
                            Filtrar
                        </button>
                    </div>

                    {/* KPIs Principais */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <KpiCard 
                            title="Pedidos Totais" 
                            value={kpis.total_pedidos} 
                            icon={<BuildingStorefrontIcon className="w-6 h-6 text-blue-600"/>} 
                            color="blue"
                            helperText="Solicitações no período"
                        />
                        <KpiCard 
                            title="Concluídos" 
                            value={kpis.concluidos} 
                            icon={<CheckBadgeIcon className="w-6 h-6 text-green-600"/>} 
                            color="green" 
                            helperText={`Taxa de Sucesso: ${kpis.taxa_sucesso}%`}
                        />
                        <KpiCard 
                            title="Cancelados" 
                            value={kpis.cancelados} 
                            icon={<XCircleIcon className="w-6 h-6 text-red-600"/>} 
                            color="red"
                            helperText="Pedidos rejeitados"
                        />
                        <KpiCard 
                            title="Lead Time Médio" 
                            value={`${slas.total}h`} 
                            icon={<ClockIcon className="w-6 h-6 text-purple-600"/>} 
                            color="purple"
                            helperText="Tempo total de ciclo"
                        />
                    </div>

                    {/* Gráficos Linha 1 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        {/* SLA Chart */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <ClockIcon className="w-5 h-5 text-purple-600" /> Performance Operacional (SLA)
                            </h3>
                            <div className="h-80">
                                <Chart options={slaOptions} series={slaSeries} type="bar" height="100%" />
                            </div>
                            <p className="text-xs text-gray-400 mt-2 text-center">* Tempo médio em horas entre etapas.</p>
                        </div>

                        {/* Status Chart */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FunnelIcon className="w-5 h-5 text-blue-600" /> Pipeline de Pedidos Ativos
                            </h3>
                            <div className="h-80 flex items-center justify-center">
                                {statusSeries.length > 0 ? (
                                    <Chart options={statusOptions} series={statusSeries} type="donut" height="100%" width="380" />
                                ) : (
                                    <div className="text-gray-400 italic">Sem pedidos em andamento no momento.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Gráficos Linha 2 (Ranking) */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <TruckIcon className="w-5 h-5 text-red-600" /> Top 10 Lojas (Solicitantes)
                        </h3>
                        <div className="h-96">
                            <Chart options={rankingOptions} series={rankingSeries} type="bar" height="100%" />
                        </div>
                    </div>

                </div>
            </div>
        </AuthenticatedLayout>
    );
}
