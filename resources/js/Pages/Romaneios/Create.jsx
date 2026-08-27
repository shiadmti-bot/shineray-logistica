import AppLayout from '@/Layouts/AppLayout';
import { PageHeader } from '@/Components/UI';
import { Head, useForm, router } from '@inertiajs/react';
import { useState, useMemo } from 'react';
import Swal from 'sweetalert2';

export default function RomaneioCreate({ auth, expedicao = [], coletas = [], cargasEmAberto = [], aguardandoChassi = [], pecasProntas = [] }) {

    // --- ESTADOS ---
    // Agora armazena IDs das MOTOS, não dos pedidos, para permitir seleção parcial
    const [selectedMotoIds, setSelectedMotoIds] = useState([]);
    // v3: carga mista — pedidos de peça já separados que vão embarcar junto.
    const [selectedPecaIds, setSelectedPecaIds] = useState([]);
    const [activeTab, setActiveTab] = useState('expedicao'); 
    
    // Estado para controlar quais pedidos estão expandidos (para ver as motos)
    const [expandedPedidoIds, setExpandedPedidoIds] = useState([]);

    const { data, setData, post, processing, errors } = useForm({
        basquetas_ids: [],
        motorista: '',
        placa: '',
        rota_nome: '',
        romaneio_id: '',
        motos_ids: [] // Mudança no nome para refletir que são motos
    });

    // --- 1. AGRUPAMENTO INTELIGENTE ---
    const agrupadosExpedicao = useMemo(() => {
        const grupos = {};
        expedicao.forEach(p => {
            const destino = p.user?.filial || p.user?.name || 'DESTINO NÃO INFORMADO';
            if (!grupos[destino]) grupos[destino] = [];
            grupos[destino].push(p);
        });
        return grupos;
    }, [expedicao]);

    const agrupadosColeta = useMemo(() => {
        const grupos = {};
        coletas.forEach(p => {
            const origem = p.origem?.filial || 'ORIGEM NÃO INFORMADA';
            if (!grupos[origem]) grupos[origem] = [];
            grupos[origem].push(p);
        });
        return grupos;
    }, [coletas]);

    // --- 2. LÓGICA DE SELEÇÃO (GRANULARIDADE: MOTO) ---
    
    // Selecionar/Deselecionar uma única moto
    const toggleMoto = (motoId) => {
        if (selectedMotoIds.includes(motoId)) {
            setSelectedMotoIds(selectedMotoIds.filter(i => i !== motoId));
        } else {
            setSelectedMotoIds([...selectedMotoIds, motoId]);
        }
    };

    // Selecionar/Deselecionar TODAS as motos de um Pedido
    const togglePedido = (pedido) => {
        const motosDoPedido = pedido.motos.map(m => m.id);
        const todasSelecionadas = motosDoPedido.every(id => selectedMotoIds.includes(id));

        if (todasSelecionadas) {
            // Remove todas
            setSelectedMotoIds(selectedMotoIds.filter(id => !motosDoPedido.includes(id)));
        } else {
            // Adiciona as que faltam
            const novas = motosDoPedido.filter(id => !selectedMotoIds.includes(id));
            setSelectedMotoIds([...selectedMotoIds, ...novas]);
        }
    };

    // Selecionar/Deselecionar TODO um Grupo (Destino/Origem)
    const toggleGrupo = (pedidosDoGrupo) => {
        // Pega todas as motos de todos os pedidos do grupo
        const todasMotosDoGrupo = pedidosDoGrupo.flatMap(p => p.motos.map(m => m.id));
        const todasSelecionadas = todasMotosDoGrupo.every(id => selectedMotoIds.includes(id));

        if (todasSelecionadas) {
            setSelectedMotoIds(selectedMotoIds.filter(id => !todasMotosDoGrupo.includes(id)));
        } else {
            const novas = todasMotosDoGrupo.filter(id => !selectedMotoIds.includes(id));
            setSelectedMotoIds([...selectedMotoIds, ...novas]);
        }
    };

    const togglePeca = (pedidoId) => {
        setSelectedPecaIds((atual) =>
            atual.includes(pedidoId)
                ? atual.filter((id) => id !== pedidoId)
                : [...atual, pedidoId]
        );
    };

    const totalPecasUn = pecasProntas
        .filter((p) => selectedPecaIds.includes(p.id))
        .reduce((t, p) => t + p.total_un, 0);

    const toggleExpand = (pedidoId) => {
        if (expandedPedidoIds.includes(pedidoId)) {
            setExpandedPedidoIds(expandedPedidoIds.filter(id => id !== pedidoId));
        } else {
            setExpandedPedidoIds([...expandedPedidoIds, pedidoId]);
        }
    };

    // --- 3. SUBMIT ---
    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (selectedMotoIds.length === 0 && selectedPecaIds.length === 0) {
            Swal.fire('Vazio', 'Selecione ao menos uma moto ou uma basqueta de peças.', 'warning');
            return;
        }

        data.motos_ids = selectedMotoIds;
        data.basquetas_ids = selectedPecaIds;
        
        post(route('romaneios.store'), {
            onSuccess: () => Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Carga gerada! Redirecionando...', timer: 2000, showConfirmButton: false }),
            onError: () => Swal.fire('Erro', 'Verifique os dados obrigatórios.', 'error')
        });
    };

    // --- V2.6: BIPAGEM DE CHASSIS DURANTE A MONTAGEM (FLUXO B) ---
    // O operador bipa o chassi e o sistema descobre sozinho a qual pedido ele pertence
    // (mesmo modelo + cor, pedido mais antigo primeiro).
    const [chassiCarga, setChassiCarga] = useState('');
    const [pedidoAlvo, setPedidoAlvo] = useState(''); // '' = descoberta automática

    const totalChassisPendentes = aguardandoChassi.reduce(
        (acc, p) => acc + p.itens.reduce((s, i) => s + i.qtd_pendente, 0),
        0
    );

    const handleBiparCarga = () => {
        const chassi = chassiCarga.trim().toUpperCase();

        if (chassi.length < 11) {
            return Swal.fire('Chassi inválido', 'Informe ao menos 11 caracteres.', 'warning');
        }

        router.post(route('romaneios.atribuir_chassi'), {
            chassi,
            pedido_id: pedidoAlvo || null
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setChassiCarga('');
                try { new Audio('/plim.mp3').play().catch(() => {}); } catch (e) {}
            },
            onError: (errs) => Swal.fire('Não foi possível atribuir', Object.values(errs)[0] || 'Erro desconhecido.', 'error')
        });
    };

    // --- CÁLCULO DE TOTAIS ---
    const totalMotosSelecionadas = selectedMotoIds.length;

    // Conta quantos pedidos estão PARCIALMENTE ou TOTALMENTE selecionados
    const countExp = expedicao.filter(p => p.motos.some(m => selectedMotoIds.includes(m.id))).length;
    const countCol = coletas.filter(p => p.motos.some(m => selectedMotoIds.includes(m.id))).length;

    return (
        <AppLayout user={auth.user}>
            <Head title="Nova Carga" />

            <div className="pb-40">
                <div>
                    <PageHeader
                        title="Montagem de Carga"
                        description="Monte a carga com motos e peças na mesma viagem."
                        breadcrumbs={[{ label: 'Logística' }, { label: 'Cargas', href: route('romaneios.index') }, { label: 'Nova' }]}
                    />
                    
                    <form onSubmit={handleSubmit}>
                        
                        {/* --- DADOS DA CARGA --- */}
                        <div className="bg-surface-card p-6 rounded-card shadow-sm border border-line mb-6">
                            <div className="flex justify-between items-center mb-4 border-b pb-2 border-line">
                                <h3 className="font-bold text-content-secondary flex items-center gap-2 uppercase text-sm tracking-wider">
                                    🚚 Configuração da Viagem
                                </h3>
                                <div className="flex bg-surface-sunken p-1 rounded-lg">
                                    <button 
                                        type="button"
                                        onClick={() => setData('romaneio_id', '')}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${!data.romaneio_id ? 'bg-surface-card shadow text-content-primary' : 'text-content-secondary hover:text-content-secondary'}`}
                                    >
                                        ✨ NOVA CARGA
                                    </button>
                                    <button 
                                        type="button"
                                        disabled={cargasEmAberto.length === 0}
                                        onClick={() => cargasEmAberto.length > 0 && setData('romaneio_id', cargasEmAberto[0].id)}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${data.romaneio_id ? 'bg-status-warning-bg text-status-warning-fg' : 'text-content-secondary'} ${cargasEmAberto.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:text-content-secondary'}`}
                                    >
                                        ➕ ADICIONAR À EXISTENTE
                                    </button>
                                </div>
                            </div>

                            {!data.romaneio_id ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-down">
                                    <div>
                                        <label className="block text-[10px] font-bold text-content-secondary uppercase mb-1">Rota / Região</label>
                                        <input 
                                            type="text" 
                                            placeholder="Ex: Rota Bragança"
                                            className="w-full border-line-strong rounded-lg text-sm focus:ring-brand-500 focus:border-brand-500"
                                            value={data.rota_nome}
                                            onChange={e => setData('rota_nome', e.target.value)}
                                        />
                                        {errors.rota_nome && <div className="text-status-danger-fg text-[10px] mt-1 font-bold">{errors.rota_nome}</div>}
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-content-secondary uppercase mb-1">Motorista</label>
                                        <input 
                                            type="text" 
                                            placeholder="Nome Completo"
                                            className="w-full border-line-strong rounded-lg text-sm uppercase focus:ring-brand-500 focus:border-brand-500"
                                            value={data.motorista}
                                            onChange={e => setData('motorista', e.target.value)}
                                        />
                                        {errors.motorista && <div className="text-status-danger-fg text-[10px] mt-1 font-bold">{errors.motorista}</div>}
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-content-secondary uppercase mb-1">Placa</label>
                                        <input 
                                            type="text" 
                                            placeholder="ABC-1234"
                                            className="w-full border-line-strong rounded-lg text-sm uppercase text-center font-mono font-bold focus:ring-brand-500 focus:border-brand-500"
                                            maxLength={8}
                                            value={data.placa}
                                            onChange={e => setData('placa', e.target.value.toUpperCase())}
                                        />
                                        {errors.placa && <div className="text-status-danger-fg text-[10px] mt-1 font-bold">{errors.placa}</div>}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-status-warning-bg/50 p-4 rounded-lg border border-status-warning-solid/20 animate-fade-in-down">
                                    <label className="block text-xs font-bold text-status-warning-fg mb-2 uppercase">Selecione a Carga Aberta:</label>
                                    <select 
                                        value={data.romaneio_id} 
                                        onChange={e => setData('romaneio_id', e.target.value)} 
                                        className="block w-full rounded-md border-status-warning-solid/40 shadow-sm font-bold text-content-secondary focus:ring-brand-500 focus:border-brand-500 text-sm"
                                    >
                                        <option value="">-- Selecione --</option>
                                        {cargasEmAberto.map(r => (
                                            <option key={r.id} value={r.id}>
                                                #{String(r.id).padStart(6,'0')} - {r.rota} ({r.motorista}) - {r.motos_count} vols
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* --- ABAS --- */}
                        <div className="mb-6">
                            <div className="flex border-b border-line-strong bg-surface-card rounded-t-xl overflow-hidden shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('expedicao')}
                                    className={`flex-1 py-4 text-center font-black text-xs uppercase tracking-widest border-b-4 transition ${activeTab === 'expedicao' ? 'border-status-info-solid text-status-info-fg bg-status-info-bg/50' : 'border-transparent text-content-muted hover:text-content-secondary hover:bg-surface-sunken'}`}
                                >
                                    🏭 Estoque CD (Saída)
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'expedicao' ? 'bg-status-info-bg text-status-info-fg' : 'bg-surface-sunken text-content-secondary'}`}>{expedicao.length}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('coleta')}
                                    className={`flex-1 py-4 text-center font-black text-xs uppercase tracking-widest border-b-4 transition ${activeTab === 'coleta' ? 'border-status-warning-solid text-status-warning-fg bg-status-warning-bg/50' : 'border-transparent text-content-muted hover:text-content-secondary hover:bg-surface-sunken'}`}
                                >
                                    🚚 Coletas (Milk Run)
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'coleta' ? 'bg-status-warning-bg text-status-warning-fg' : 'bg-surface-sunken text-content-secondary'}`}>{coletas.length}</span>
                                </button>
                                {/* V2.6: pedidos genéricos que ainda não têm chassi definido */}
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('chassi')}
                                    className={`flex-1 py-4 text-center font-black text-xs uppercase tracking-widest border-b-4 transition ${activeTab === 'chassi' ? 'border-status-warning-solid text-status-warning-fg bg-status-warning-bg/50' : 'border-transparent text-content-muted hover:text-content-secondary hover:bg-surface-sunken'}`}
                                >
                                    🔢 Atribuir Chassis
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'chassi' ? 'bg-status-warning-bg text-status-warning-fg' : 'bg-surface-sunken text-content-secondary'}`}>{totalChassisPendentes}</span>
                                </button>
                                {/* v3: pedidos de peça já separados, prontos para embarcar junto */}
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('pecas')}
                                    className={`flex-1 py-4 text-center font-black text-xs uppercase tracking-widest border-b-4 transition ${activeTab === 'pecas' ? 'border-brand-600 text-brand-700 bg-brand-50' : 'border-transparent text-content-muted hover:text-content-secondary hover:bg-surface-sunken'}`}
                                >
                                    🔧 Peças
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'pecas' ? 'bg-brand-100 text-brand-800' : 'bg-surface-sunken text-content-muted'}`}>{pecasProntas.length}</span>
                                </button>
                            </div>
                        </div>

                        {/* --- V2.6: PAINEL DE ATRIBUIÇÃO DE CHASSIS --- */}
                        {activeTab === 'chassi' && (
                            <div className="space-y-6">
                                <div className="bg-surface-card rounded-card shadow-sm border-2 border-status-warning-solid/40 overflow-hidden">
                                    <div className="px-6 py-3 bg-status-warning-bg/50 border-b border-status-warning-solid/20">
                                        <h3 className="font-black text-status-warning-fg text-sm uppercase tracking-wide">Bipagem Rápida</h3>
                                        <p className="text-[11px] text-status-warning-fg mt-0.5">
                                            Bipe o chassi da moto que está sendo carregada. O sistema identifica o modelo/cor
                                            e vincula ao pedido mais antigo que aguarda essa moto.
                                        </p>
                                    </div>

                                    <div className="p-4 space-y-3">
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                                type="text"
                                                placeholder="Bipe ou digite o chassi..."
                                                value={chassiCarga}
                                                maxLength={17}
                                                onChange={e => setChassiCarga(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                                onKeyDown={e => {
                                                    // Impede que o Enter do leitor envie o formulário do romaneio
                                                    if (e.key === 'Enter') { e.preventDefault(); handleBiparCarga(); }
                                                }}
                                                className="flex-1 rounded-lg border-line-strong font-mono tracking-widest text-base py-3 px-4 focus:ring-brand-500 focus:border-brand-500"
                                            />
                                            <select
                                                value={pedidoAlvo}
                                                onChange={e => setPedidoAlvo(e.target.value)}
                                                className="rounded-lg border-line-strong text-sm font-bold text-content-secondary py-3"
                                            >
                                                <option value="">Descobrir automaticamente</option>
                                                {aguardandoChassi.map(p => (
                                                    <option key={p.id} value={p.id}>Forçar Pedido #{p.id} — {p.loja}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={handleBiparCarga}
                                                className="px-6 py-3 rounded-lg bg-brand-600 text-white font-bold text-sm hover:bg-brand-700 transition shadow-sm whitespace-nowrap"
                                            >
                                                Atribuir
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {aguardandoChassi.length === 0 ? (
                                    <div className="bg-surface-card rounded-card border border-line p-10 text-center">
                                        <p className="text-4xl mb-2">✅</p>
                                        <p className="font-bold text-content-secondary">Nenhum pedido aguardando chassi.</p>
                                        <p className="text-sm text-content-muted mt-1">Todos os pedidos aprovados já têm as motos definidas.</p>
                                    </div>
                                ) : (
                                    aguardandoChassi.map(p => (
                                        <div key={p.id} className="bg-surface-card rounded-card shadow-sm border border-line overflow-hidden">
                                            <div className="px-6 py-3 bg-surface-sunken border-b border-line flex justify-between items-center">
                                                <div>
                                                    <h3 className="font-black text-base text-content-primary">
                                                        Pedido #{String(p.id).padStart(6, '0')}
                                                    </h3>
                                                    <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted">{p.loja}</p>
                                                </div>
                                                <a
                                                    href={route('pedidos.show', p.id)}
                                                    className="text-[10px] font-bold px-4 py-2 rounded uppercase border border-line text-content-secondary hover:bg-surface-sunken transition"
                                                >
                                                    Abrir Pedido
                                                </a>
                                            </div>
                                            <div className="divide-y divide-line">
                                                {p.itens.map(item => (
                                                    <div key={item.id} className="px-6 py-3 flex justify-between items-center">
                                                        <div>
                                                            <span className="font-bold text-content-primary">{item.modelo}</span>{' '}
                                                            <span className="text-content-secondary">{item.cor}</span>
                                                            <p className="text-[10px] text-content-muted uppercase font-bold">Destino: {item.local}</p>
                                                        </div>
                                                        <span className="bg-status-warning-bg text-status-warning-fg text-xs font-black px-3 py-1.5 rounded-lg border border-status-warning-solid/20 whitespace-nowrap">
                                                            faltam {item.qtd_pendente} de {item.quantidade}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* --- v3: PEDIDOS DE PEÇA PRONTOS PARA EMBARCAR --- */}
                        {activeTab === 'pecas' && (
                            <div className="space-y-4">
                                <div className="rounded-card border border-status-info-solid/20 bg-status-info-bg/40 px-5 py-3">
                                    <p className="text-xs leading-relaxed text-content-secondary">
                                        A unidade de embarque é a <strong>basqueta</strong>, não o pedido: a caixa
                                        da filial sai inteira, como manda o manual. Só aparecem aqui as já
                                        <strong> faturadas</strong> — sem nota a mercadoria não roda. Embarcar não move
                                        estoque: a peça continua sendo do CD até a loja conferir o recebimento.
                                    </p>
                                </div>

                                {pecasProntas.length === 0 ? (
                                    <div className="rounded-card border border-line bg-surface-card p-10 text-center">
                                        <p className="font-bold text-content-secondary">
                                            Nenhuma basqueta pronta para embarcar.
                                        </p>
                                        <p className="mt-1 text-sm text-content-muted">
                                            A caixa aparece aqui depois de faturada na tela de Basquetas.
                                        </p>
                                    </div>
                                ) : (
                                    pecasProntas.map((pedido) => {
                                        const marcado = selectedPecaIds.includes(pedido.id);

                                        return (
                                            <div
                                                key={pedido.id}
                                                className={`overflow-hidden rounded-card bg-surface-card shadow-card ring-1 transition ${
                                                    marcado ? 'ring-2 ring-brand-500' : 'ring-line'
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => togglePeca(pedido.id)}
                                                    className="flex w-full items-center gap-3 border-b border-line bg-surface-sunken px-5 py-3 text-left transition hover:bg-surface-sunken/70"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={marcado}
                                                        readOnly
                                                        className="h-5 w-5 rounded border-line-strong text-brand-600 focus:ring-brand-500"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="font-black text-content-primary">
                                                            Basqueta #{String(pedido.id).padStart(6, '0')}
                                                        </h3>
                                                        <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted">
                                                            {pedido.loja}
                                                            {pedido.nota && ` · NF ${pedido.nota}`}
                                                            {pedido.volumes && ` · ${pedido.volumes} volume(s)`}
                                                        </p>
                                                    </div>
                                                    <span className="shrink-0 rounded-full bg-status-info-bg px-3 py-1 text-sm font-bold text-status-info-fg">
                                                        {pedido.total_un} un
                                                    </span>
                                                </button>

                                                <div className="divide-y divide-line">
                                                    {pedido.itens.map((item) => (
                                                        <div
                                                            key={item.id}
                                                            className="flex items-center justify-between gap-3 px-5 py-2.5"
                                                        >
                                                            <div className="min-w-0">
                                                                <span className="text-sm font-semibold text-content-primary">
                                                                    {item.descricao}
                                                                </span>
                                                                <p className="font-mono text-[10px] text-content-muted">
                                                                    {item.codigo}
                                                                </p>
                                                            </div>
                                                            <span className="shrink-0 text-sm font-bold tabular-nums text-content-secondary">
                                                                {item.quantidade} {item.unidade}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* --- LISTAGEM DETALHADA --- */}
                        <div className={`space-y-6 ${['chassi', 'pecas'].includes(activeTab) ? 'hidden' : ''}`}>
                            {Object.entries(activeTab === 'coleta' ? agrupadosColeta : agrupadosExpedicao).map(([local, pedidos]) => {
                                // Verifica se TODAS as motos de TODOS os pedidos desse grupo estão selecionadas
                                const todasMotosGrupo = pedidos.flatMap(p => p.motos.map(m => m.id));
                                const grupoSelecionado = todasMotosGrupo.length > 0 && todasMotosGrupo.every(id => selectedMotoIds.includes(id));

                                return (
                                    <div key={local} className="bg-surface-card rounded-card shadow-sm border border-line overflow-hidden transition hover:shadow-md">
                                        
                                        {/* HEADER DO GRUPO (LOCAL) */}
                                        <div className={`px-6 py-3 border-b flex justify-between items-center ${activeTab === 'expedicao' ? 'bg-status-info-bg/50 border-status-info-solid/20' : 'bg-status-warning-bg/50 border-status-warning-solid/20'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full text-lg shadow-sm bg-surface-card ${activeTab === 'expedicao' ? 'text-status-info-fg' : 'text-status-warning-fg'}`}>
                                                    {activeTab === 'expedicao' ? '📍' : '🏪'}
                                                </div>
                                                <div>
                                                    <h3 className={`font-black text-base ${activeTab === 'expedicao' ? 'text-status-info-fg' : 'text-status-warning-fg'}`}>
                                                        {local}
                                                    </h3>
                                                    <p className={`text-[10px] font-bold uppercase tracking-wide ${activeTab === 'expedicao' ? 'text-status-info-fg' : 'text-status-warning-fg'}`}>
                                                        {activeTab === 'expedicao' ? 'Destino Final' : 'Local de Coleta'}
                                                    </p>
                                                </div>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => toggleGrupo(pedidos)}
                                                className={`text-[10px] font-bold px-4 py-2 rounded uppercase border transition shadow-sm ${
                                                    grupoSelecionado
                                                    ? 'bg-status-danger-bg/50 text-status-danger-fg border-status-danger-solid/20 hover:bg-status-danger-bg' 
                                                    : 'bg-surface-card text-content-secondary border-line-strong hover:bg-surface-sunken'
                                                }`}
                                            >
                                                {grupoSelecionado ? 'Desmarcar Local' : 'Selecionar Local'}
                                            </button>
                                        </div>

                                        {/* LISTA DE PEDIDOS DO LOCAL */}
                                        <div className="divide-y divide-line">
                                            {pedidos.map(pedido => {
                                                const motosDoPedido = pedido.motos.map(m => m.id);
                                                const selecionadasDoPedido = motosDoPedido.filter(id => selectedMotoIds.includes(id));
                                                const todasSelecionadas = motosDoPedido.length > 0 && motosDoPedido.length === selecionadasDoPedido.length;
                                                const algumaSelecionada = selecionadasDoPedido.length > 0;
                                                
                                                const isExpanded = expandedPedidoIds.includes(pedido.id);

                                                return (
                                                    <div key={pedido.id} className="bg-surface-card">
                                                        {/* HEADER DO PEDIDO */}
                                                        <div className={`p-4 flex items-center justify-between transition ${algumaSelecionada ? (activeTab === 'expedicao' ? 'bg-status-info-bg/50/20' : 'bg-status-warning-bg/50/20') : ''}`}>
                                                            
                                                            <div className="flex items-center gap-4 cursor-pointer" onClick={() => togglePedido(pedido)}>
                                                                {/* Checkbox "Tri-state" Visual */}
                                                                <div className={`w-6 h-6 rounded border flex items-center justify-center transition shadow-sm ${todasSelecionadas ? 'bg-status-success-solid border-status-success-solid text-white' : (algumaSelecionada ? 'bg-status-success-bg border-status-success-solid/40 text-status-success-fg' : 'bg-surface-card border-line-strong')}`}>
                                                                    {todasSelecionadas && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                                                    {!todasSelecionadas && algumaSelecionada && <div className="w-3 h-3 bg-status-success-solid rounded-sm"></div>}
                                                                </div>
                                                                
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-content-primary text-sm">Pedido #{pedido.id}</span>
                                                                        {pedido.status === 'no_cd' && <span className="text-[9px] bg-status-neutral-bg text-status-neutral-fg px-1.5 py-0.5 rounded border border-status-neutral-solid/20 font-bold">TRANSBORDO</span>}
                                                                    </div>
                                                                    <div className="text-xs text-content-secondary mt-0.5 font-medium">
                                                                        {activeTab === 'expedicao' ? `Solicitante: ${pedido.user.name}` : `Vai para: ${pedido.user.filial || 'Matriz'}`}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-4">
                                                                <div className="text-right">
                                                                    <span className="block text-lg font-black text-content-primary leading-none">
                                                                        {selecionadasDoPedido.length} <span className="text-content-muted text-sm font-normal">/ {pedido.motos.length}</span>
                                                                    </span>
                                                                    <span className="text-[9px] text-content-muted uppercase font-bold tracking-wider">Motos</span>
                                                                </div>
                                                                
                                                                {/* Botão Expandir */}
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => toggleExpand(pedido.id)}
                                                                    className="p-2 rounded-full hover:bg-surface-sunken text-content-muted transition"
                                                                >
                                                                    <svg className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* LISTA DE MOTOS (EXPANDIDA) */}
                                                        {isExpanded && (
                                                            <div className="border-t border-line bg-surface-sunken px-4 py-2 space-y-1 animate-fade-in">
                                                                <div className="text-[10px] font-bold text-content-muted uppercase mb-2 pl-9">Selecione as motos individualmente:</div>
                                                                {pedido.motos.map(moto => {
                                                                    const isMotoSelected = selectedMotoIds.includes(moto.id);
                                                                    return (
                                                                        <div 
                                                                            key={moto.id} 
                                                                            onClick={() => toggleMoto(moto.id)}
                                                                            className={`flex items-center gap-3 p-2 rounded cursor-pointer transition ml-8 border ${isMotoSelected ? 'bg-surface-card border-status-success-solid/40 shadow-sm' : 'border-transparent hover:bg-surface-card hover:border-line'}`}
                                                                        >
                                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${isMotoSelected ? 'bg-status-success-solid border-status-success-solid text-white' : 'bg-surface-card border-line-strong'}`}>
                                                                                {isMotoSelected && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                                                            </div>
                                                                            <div className="flex gap-4 text-xs">
                                                                                <span className="font-mono font-bold text-content-secondary">{moto.chassi}</span>
                                                                                <span className="text-content-secondary font-bold">{moto.modelo}</span>
                                                                                <span className="text-content-secondary">{moto.cor}</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* --- BARRA FLUTUANTE DE RESUMO --- */}
                        <div className="fixed bottom-0 left-0 z-topbar w-full border-t border-white/10 bg-surface-inverted p-4 text-content-inverted shadow-[0_-4px_20px_rgba(0,0,0,0.25)] safe-area-bottom">
                            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex w-full items-center justify-between gap-6 md:w-auto md:justify-start">
                                    {/* v3: a carga é mista, então o total precisa mostrar os dois.
                                        Só motos esconderia uma carga inteira de peças. */}
                                    <div className="flex items-center gap-5">
                                        <div className="flex flex-col">
                                            <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-white/50">
                                                Motos
                                            </span>
                                            <span className="text-3xl font-black leading-none text-white">
                                                {totalMotosSelecionadas}
                                            </span>
                                        </div>

                                        <div className="flex flex-col">
                                            <span className="mb-1 text-[9px] font-bold uppercase tracking-widest text-white/50">
                                                Peças
                                            </span>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-black leading-none text-white">
                                                    {totalPecasUn}
                                                </span>
                                                <span className="text-xs font-bold text-white/40">un</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="hidden h-8 w-px bg-surface-card/20 md:block"></div>

                                    <div className="flex gap-5 text-sm">
                                        <div>
                                            <span className="block text-[10px] font-bold uppercase text-white/50">Expedição</span>
                                            <span className="font-bold text-white/90">{countExp} peds</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold uppercase text-white/50">Coletas</span>
                                            <span className="font-bold text-white/90">{countCol} peds</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold uppercase text-white/50">Peças</span>
                                            <span className="font-bold text-white/90">{selectedPecaIds.length} peds</span>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={processing || (selectedMotoIds.length === 0 && selectedPecaIds.length === 0)}
                                    className={`flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-12 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto ${processing ? 'animate-pulse' : ''}`}
                                >
                                    {processing ? 'Gerando Manifesto...' : (
                                        <>
                                            <span>🚀</span> Gerar Carga
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                    </form>

                </div>
            </div>
        </AppLayout>
    );
}