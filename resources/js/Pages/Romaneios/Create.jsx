import AppLayout from '@/Layouts/AppLayout';
import { PageHeader, Card, StatCard, Button, StatusBadge, EmptyState } from '@/Components/UI';
import { Head, useForm, router } from '@inertiajs/react';
import { useState, useMemo, useRef } from 'react';
import Swal from 'sweetalert2';
import {
    TruckIcon,
    WrenchScrewdriverIcon,
    ArrowPathIcon,
    QrCodeIcon,
    CheckCircleIcon,
    XMarkIcon,
    MagnifyingGlassIcon,
    ClipboardDocumentCheckIcon,
    MapPinIcon,
    UserIcon,
    IdentificationIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    SparklesIcon,
    BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';

export default function RomaneioCreate({
    auth,
    expedicao = [],
    coletas = [],
    cargasEmAberto = [],
    aguardandoChassi = [],
    pecasProntas = [],
    rotas = [],
}) {
    // --- ESTADOS DE SELEÇÃO ---
    const [selectedMotoIds, setSelectedMotoIds] = useState([]);
    const [selectedPecaIds, setSelectedPecaIds] = useState([]);
    const [activeTab, setActiveTab] = useState('expedicao');

    // Estado para controlar quais pedidos e basquetas estão expandidos
    const [expandedPedidoIds, setExpandedPedidoIds] = useState([]);
    const [expandedBasquetaIds, setExpandedBasquetaIds] = useState([]);

    // Filtro de busca por destino / filial / pedido
    const [filtroTexto, setFiltroTexto] = useState('');

    // Bipagem de chassi
    const [chassiCarga, setChassiCarga] = useState('');
    const [pedidoAlvo, setPedidoAlvo] = useState('');
    const [isBipando, setIsBipando] = useState(false);
    const chassiInputRef = useRef(null);

    // Formulário do Romaneio
    const { data, setData, post, processing, errors } = useForm({
        motorista: '',
        placa: '',
        rota_nome: '',
        romaneio_id: '',
        motos_ids: [],
        basquetas_ids: [],
    });

    // --- TOTAIS GERAIS DISPONÍVEIS ---
    const totalMotosExpedicao = useMemo(
        () => expedicao.reduce((acc, p) => acc + (p.motos?.length || 0), 0),
        [expedicao]
    );

    const totalMotosColeta = useMemo(
        () => coletas.reduce((acc, p) => acc + (p.motos?.length || 0), 0),
        [coletas]
    );

    const totalBasquetasProntas = pecasProntas.length;

    const totalPecasProntasUn = useMemo(
        () => pecasProntas.reduce((acc, b) => acc + (b.total_un || 0), 0),
        [pecasProntas]
    );

    const totalChassisPendentes = useMemo(
        () => aguardandoChassi.reduce(
            (acc, p) => acc + p.itens.reduce((s, i) => s + (i.qtd_pendente || 0), 0),
            0
        ),
        [aguardandoChassi]
    );

    // --- 1. AGRUPAMENTO INTELIGENTE POR FILIAL/DESTINO ---
    const agrupadosExpedicao = useMemo(() => {
        const grupos = {};
        expedicao.forEach((p) => {
            const destino = p.user?.filial || p.user?.name || 'DESTINO NÃO INFORMADO';
            if (!grupos[destino]) grupos[destino] = [];
            grupos[destino].push(p);
        });
        return grupos;
    }, [expedicao]);

    const agrupadosColeta = useMemo(() => {
        const grupos = {};
        coletas.forEach((p) => {
            const origem = p.origem?.filial || 'ORIGEM NÃO INFORMADA';
            if (!grupos[origem]) grupos[origem] = [];
            grupos[origem].push(p);
        });
        return grupos;
    }, [coletas]);

    const agrupadosPecas = useMemo(() => {
        const grupos = {};
        pecasProntas.forEach((b) => {
            const destino = b.loja || 'DESTINO NÃO INFORMADO';
            if (!grupos[destino]) grupos[destino] = [];
            grupos[destino].push(b);
        });
        return grupos;
    }, [pecasProntas]);

    // --- FILTRAGEM DINÂMICA POR TEXTO ---
    const termoBusca = filtroTexto.trim().toLowerCase();

    const expedicaoFiltrada = useMemo(() => {
        if (!termoBusca) return agrupadosExpedicao;
        const filtrado = {};
        Object.entries(agrupadosExpedicao).forEach(([local, pedidos]) => {
            if (local.toLowerCase().includes(termoBusca)) {
                filtrado[local] = pedidos;
                return;
            }
            const pedidosMatch = pedidos.filter((p) =>
                String(p.id).includes(termoBusca) ||
                (p.user?.name && p.user.name.toLowerCase().includes(termoBusca)) ||
                (p.motos && p.motos.some((m) =>
                    m.chassi?.toLowerCase().includes(termoBusca) ||
                    m.modelo?.toLowerCase().includes(termoBusca)
                ))
            );
            if (pedidosMatch.length > 0) {
                filtrado[local] = pedidosMatch;
            }
        });
        return filtrado;
    }, [agrupadosExpedicao, termoBusca]);

    const pecasFiltradas = useMemo(() => {
        if (!termoBusca) return agrupadosPecas;
        const filtrado = {};
        Object.entries(agrupadosPecas).forEach(([local, basquetas]) => {
            if (local.toLowerCase().includes(termoBusca)) {
                filtrado[local] = basquetas;
                return;
            }
            const basquetasMatch = basquetas.filter((b) =>
                String(b.id).includes(termoBusca) ||
                (b.nota && b.nota.toLowerCase().includes(termoBusca)) ||
                (b.itens && b.itens.some((i) =>
                    i.codigo?.toLowerCase().includes(termoBusca) ||
                    i.descricao?.toLowerCase().includes(termoBusca)
                ))
            );
            if (basquetasMatch.length > 0) {
                filtrado[local] = basquetasMatch;
            }
        });
        return filtrado;
    }, [agrupadosPecas, termoBusca]);

    const coletasFiltradas = useMemo(() => {
        if (!termoBusca) return agrupadosColeta;
        const filtrado = {};
        Object.entries(agrupadosColeta).forEach(([origem, pedidos]) => {
            if (origem.toLowerCase().includes(termoBusca)) {
                filtrado[origem] = pedidos;
                return;
            }
            const pedidosMatch = pedidos.filter((p) =>
                String(p.id).includes(termoBusca) ||
                (p.user?.filial && p.user.filial.toLowerCase().includes(termoBusca)) ||
                (p.motos && p.motos.some((m) =>
                    m.chassi?.toLowerCase().includes(termoBusca) ||
                    m.modelo?.toLowerCase().includes(termoBusca)
                ))
            );
            if (pedidosMatch.length > 0) {
                filtrado[origem] = pedidosMatch;
            }
        });
        return filtrado;
    }, [agrupadosColeta, termoBusca]);

    const aguardandoChassiFiltrado = useMemo(() => {
        if (!termoBusca) return aguardandoChassi;
        return aguardandoChassi.filter((p) =>
            String(p.id).includes(termoBusca) ||
            p.loja.toLowerCase().includes(termoBusca) ||
            p.itens.some((i) =>
                i.modelo.toLowerCase().includes(termoBusca) ||
                i.cor?.toLowerCase().includes(termoBusca)
            )
        );
    }, [aguardandoChassi, termoBusca]);

    // Contadores de abas filtradas
    const countMotosExpFiltradas = useMemo(() => {
        return Object.values(expedicaoFiltrada).reduce(
            (acc, peds) => acc + peds.reduce((s, p) => s + (p.motos?.length || 0), 0),
            0
        );
    }, [expedicaoFiltrada]);

    const countBasquetasFiltradas = useMemo(() => {
        return Object.values(pecasFiltradas).reduce((acc, bs) => acc + bs.length, 0);
    }, [pecasFiltradas]);

    const countColetasFiltradas = useMemo(() => {
        return Object.values(coletasFiltradas).reduce(
            (acc, peds) => acc + peds.reduce((s, p) => s + (p.motos?.length || 0), 0),
            0
        );
    }, [coletasFiltradas]);

    // --- 2. LÓGICA DE SELEÇÃO (GRANULARIDADE: MOTO E BASQUETA) ---
    const toggleMoto = (motoId) => {
        setSelectedMotoIds((prev) =>
            prev.includes(motoId) ? prev.filter((id) => id !== motoId) : [...prev, motoId]
        );
    };

    const togglePedido = (pedido) => {
        const motosDoPedido = (pedido.motos || []).map((m) => m.id);
        const todasSelecionadas = motosDoPedido.every((id) => selectedMotoIds.includes(id));

        if (todasSelecionadas) {
            setSelectedMotoIds((prev) => prev.filter((id) => !motosDoPedido.includes(id)));
        } else {
            const novas = motosDoPedido.filter((id) => !selectedMotoIds.includes(id));
            setSelectedMotoIds((prev) => [...prev, ...novas]);
        }
    };

    const toggleGrupoMotos = (pedidosDoGrupo) => {
        const todasMotos = pedidosDoGrupo.flatMap((p) => (p.motos || []).map((m) => m.id));
        const todasSelecionadas = todasMotos.length > 0 && todasMotos.every((id) => selectedMotoIds.includes(id));

        if (todasSelecionadas) {
            setSelectedMotoIds((prev) => prev.filter((id) => !todasMotos.includes(id)));
        } else {
            const novas = todasMotos.filter((id) => !selectedMotoIds.includes(id));
            setSelectedMotoIds((prev) => [...prev, ...novas]);
        }
    };

    const togglePeca = (basquetaId) => {
        setSelectedPecaIds((prev) =>
            prev.includes(basquetaId) ? prev.filter((id) => id !== basquetaId) : [...prev, basquetaId]
        );
    };

    const toggleGrupoPecas = (basquetasDoGrupo) => {
        const todasBasquetas = basquetasDoGrupo.map((b) => b.id);
        const todasSelecionadas = todasBasquetas.length > 0 && todasBasquetas.every((id) => selectedPecaIds.includes(id));

        if (todasSelecionadas) {
            setSelectedPecaIds((prev) => prev.filter((id) => !todasBasquetas.includes(id)));
        } else {
            const novas = todasBasquetas.filter((id) => !selectedPecaIds.includes(id));
            setSelectedPecaIds((prev) => [...prev, ...novas]);
        }
    };

    // Ação Especial Carga Mista: Seleciona tanto as MOTOS quanto as PEÇAS de um destino
    const toggleDestinoMisto = (destinoNome) => {
        const pedidos = agrupadosExpedicao[destinoNome] || [];
        const basquetas = agrupadosPecas[destinoNome] || [];

        const motosIds = pedidos.flatMap((p) => (p.motos || []).map((m) => m.id));
        const basquetasIds = basquetas.map((b) => b.id);

        const motosMarcadas = motosIds.length > 0 && motosIds.every((id) => selectedMotoIds.includes(id));
        const pecasMarcadas = basquetasIds.length > 0 && basquetasIds.every((id) => selectedPecaIds.includes(id));

        const tudoMarcado = (motosIds.length === 0 || motosMarcadas) && (basquetasIds.length === 0 || pecasMarcadas);

        if (tudoMarcado) {
            // Desmarca tudo do destino
            setSelectedMotoIds((prev) => prev.filter((id) => !motosIds.includes(id)));
            setSelectedPecaIds((prev) => prev.filter((id) => !basquetasIds.includes(id)));
        } else {
            // Marca tudo do destino
            setSelectedMotoIds((prev) => {
                const novas = motosIds.filter((id) => !prev.includes(id));
                return [...prev, ...novas];
            });
            setSelectedPecaIds((prev) => {
                const novas = basquetasIds.filter((id) => !prev.includes(id));
                return [...prev, ...novas];
            });
        }
    };

    const toggleExpandPedido = (pedidoId) => {
        setExpandedPedidoIds((prev) =>
            prev.includes(pedidoId) ? prev.filter((id) => id !== pedidoId) : [...prev, pedidoId]
        );
    };

    const toggleExpandBasqueta = (basquetaId) => {
        setExpandedBasquetaIds((prev) =>
            prev.includes(basquetaId) ? prev.filter((id) => id !== basquetaId) : [...prev, basquetaId]
        );
    };

    // --- 3. CÁLCULO DE ITENS DA CARGA SELECIONADA ---
    const totalMotosSelecionadas = selectedMotoIds.length;

    const basquetasSelecionadasObj = useMemo(() => {
        return pecasProntas.filter((b) => selectedPecaIds.includes(b.id));
    }, [pecasProntas, selectedPecaIds]);

    const totalBasquetasSelecionadas = selectedPecaIds.length;

    const totalPecasSelecionadasUn = useMemo(() => {
        return basquetasSelecionadasObj.reduce((t, b) => t + (b.total_un || 0), 0);
    }, [basquetasSelecionadasObj]);

    const totalVolumesSelecionados = useMemo(() => {
        return basquetasSelecionadasObj.reduce((t, b) => t + (b.volumes || 1), 0);
    }, [basquetasSelecionadasObj]);

    // Paradas / Destinos Únicos
    const destinosUnicos = useMemo(() => {
        const mapa = {};

        // Motos de Expedição
        expedicao.forEach((p) => {
            const destino = p.user?.filial || p.user?.name || 'DESTINO NÃO INFORMADO';
            const motosSel = (p.motos || []).filter((m) => selectedMotoIds.includes(m.id));
            if (motosSel.length > 0) {
                if (!mapa[destino]) mapa[destino] = { motos: [], basquetas: [], coletas: [] };
                motosSel.forEach((m) => mapa[destino].motos.push({ ...m, pedidoId: p.id }));
            }
        });

        // Basquetas de Peças
        basquetasSelecionadasObj.forEach((b) => {
            const destino = b.loja || 'DESTINO NÃO INFORMADO';
            if (!mapa[destino]) mapa[destino] = { motos: [], basquetas: [], coletas: [] };
            mapa[destino].basquetas.push(b);
        });

        // Coletas
        coletas.forEach((p) => {
            const destino = p.user?.filial || 'CD Matriz';
            const origem = p.origem?.filial || 'Origem';
            const motosSel = (p.motos || []).filter((m) => selectedMotoIds.includes(m.id));
            if (motosSel.length > 0) {
                const label = `${origem} ➔ ${destino}`;
                if (!mapa[label]) mapa[label] = { motos: [], basquetas: [], coletas: [] };
                motosSel.forEach((m) => mapa[label].coletas.push({ ...m, pedidoId: p.id, origem, destino }));
            }
        });

        return mapa;
    }, [expedicao, coletas, selectedMotoIds, basquetasSelecionadasObj]);

    const totalDestinos = Object.keys(destinosUnicos).length;
    const totalGeralItens = totalMotosSelecionadas + totalBasquetasSelecionadas;

    // --- 4. SUBMIT ---
    const handleSubmit = (e) => {
        e.preventDefault();

        if (selectedMotoIds.length === 0 && selectedPecaIds.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Nenhum item selecionado',
                text: 'Selecione ao menos uma moto ou uma basqueta de peças para montar a carga.',
            });
            return;
        }

        if (!data.romaneio_id) {
            if (!data.rota_nome || !data.motorista || !data.placa) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Dados da Viagem Incompletos',
                    text: 'Informe a Rota/Região, o Motorista e a Placa do veículo para criar uma nova carga.',
                });
                return;
            }
        }

        data.motos_ids = selectedMotoIds;
        data.basquetas_ids = selectedPecaIds;

        post(route('romaneios.store'), {
            onSuccess: () => {
                Swal.fire({
                    icon: 'success',
                    title: 'Carga Criada com Sucesso!',
                    text: 'Redirecionando para o romaneio...',
                    timer: 2000,
                    showConfirmButton: false,
                });
            },
            onError: (errs) => {
                const firstErr = Object.values(errs)[0] || 'Verifique os dados obrigatórios.';
                Swal.fire({
                    icon: 'error',
                    title: 'Erro ao Salvar Carga',
                    text: firstErr,
                });
            },
        });
    };

    // --- 5. BIPAGEM DE CHASSIS (FLUXO B) ---
    const handleBiparCarga = () => {
        const chassi = chassiCarga.trim().toUpperCase();

        if (chassi.length < 11) {
            Swal.fire({
                icon: 'warning',
                title: 'Chassi Inválido',
                text: 'Informe ao menos 11 caracteres para buscar o chassi.',
            });
            return;
        }

        setIsBipando(true);

        router.post(
            route('romaneios.atribuir_chassi'),
            {
                chassi,
                pedido_id: pedidoAlvo || null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setChassiCarga('');
                    setIsBipando(false);
                    try {
                        new Audio('/plim.mp3').play().catch(() => {});
                    } catch (e) {}
                    if (chassiInputRef.current) {
                        chassiInputRef.current.focus();
                    }
                },
                onError: (errs) => {
                    setIsBipando(false);
                    Swal.fire({
                        icon: 'error',
                        title: 'Não foi possível atribuir',
                        text: Object.values(errs)[0] || 'Erro desconhecido ao validar chassi.',
                    });
                },
            }
        );
    };

    // Carga aberta atualmente selecionada
    const cargaAbertaSelecionada = useMemo(() => {
        if (!data.romaneio_id) return null;
        return cargasEmAberto.find((c) => String(c.id) === String(data.romaneio_id));
    }, [cargasEmAberto, data.romaneio_id]);

    return (
        <AppLayout user={auth.user}>
            <Head title="Montagem de Carga" />

            <div className="space-y-6 pb-44">
                {/* --- CABEÇALHO --- */}
                <PageHeader
                    title="Montagem de Carga"
                    description="Mesa de expedição unificada para montagem de cargas mistas com motos e peças ou coletas Milk Run."
                    breadcrumbs={[
                        { label: 'Logística' },
                        { label: 'Cargas', href: route('romaneios.index') },
                        { label: 'Nova Carga' },
                    ]}
                />

                {/* --- STAT CARDS DO FLUXO --- */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <StatCard
                        label="Motos no CD"
                        value={totalMotosExpedicao}
                        hint={`${expedicao.length} pedido(s) de saída`}
                        icon={TruckIcon}
                        tone="brand"
                    />
                    <StatCard
                        label="Basquetas Prontas"
                        value={totalBasquetasProntas}
                        hint={`${totalPecasProntasUn} peça(s) faturada(s)`}
                        icon={WrenchScrewdriverIcon}
                        tone="info"
                    />
                    <StatCard
                        label="Coletas Milk Run"
                        value={totalMotosColeta}
                        hint={`${coletas.length} pedido(s) em lojas`}
                        icon={ArrowPathIcon}
                        tone="warning"
                    />
                    <StatCard
                        label="Chassis Pendentes"
                        value={totalChassisPendentes}
                        hint={`${aguardandoChassi.length} pedido(s) a bipar`}
                        icon={QrCodeIcon}
                        tone={totalChassisPendentes > 0 ? 'danger' : 'success'}
                    />
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* --- CONFIGURAÇÃO DA VIAGEM --- */}
                    <Card
                        title="Configuração da Viagem"
                        subtitle="Defina o destino, veículo e motorista ou vincule os itens a uma carga aberta existente."
                        actions={
                            <div className="inline-flex rounded-lg bg-surface-sunken p-1 ring-1 ring-line">
                                <button
                                    type="button"
                                    onClick={() => setData('romaneio_id', '')}
                                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                                        !data.romaneio_id
                                            ? 'bg-surface-card text-content-primary shadow-sm'
                                            : 'text-content-secondary hover:text-content-primary'
                                    }`}
                                >
                                    <SparklesIcon className="h-3.5 w-3.5 text-brand-600" />
                                    Nova Carga
                                </button>
                                <button
                                    type="button"
                                    disabled={cargasEmAberto.length === 0}
                                    onClick={() => {
                                        if (cargasEmAberto.length > 0 && !data.romaneio_id) {
                                            setData('romaneio_id', String(cargasEmAberto[0].id));
                                        }
                                    }}
                                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                                        data.romaneio_id
                                            ? 'bg-brand-600 text-white shadow-sm'
                                            : 'text-content-secondary hover:text-content-primary'
                                    } ${cargasEmAberto.length === 0 ? 'cursor-not-allowed opacity-40' : ''}`}
                                >
                                    <span>➕ Adicionar à Carga Aberta</span>
                                    {cargasEmAberto.length > 0 && (
                                        <span
                                            className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                                                data.romaneio_id
                                                    ? 'bg-brand-700 text-white'
                                                    : 'bg-surface-card text-content-secondary'
                                            }`}
                                        >
                                            {cargasEmAberto.length}
                                        </span>
                                    )}
                                </button>
                            </div>
                        }
                    >
                        {!data.romaneio_id ? (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                {/* Rota / Região */}
                                <div>
                                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-content-secondary">
                                        <MapPinIcon className="h-4 w-4 text-brand-600" />
                                        Rota / Região Destino
                                    </label>
                                    <input
                                        type="text"
                                        list="rotas-sugeridas"
                                        placeholder="Ex: Rota Castanhal / Bragança"
                                        className="w-full rounded-lg border-line-strong bg-surface-card text-sm text-content-primary placeholder-content-muted focus:border-brand-500 focus:ring-brand-500"
                                        value={data.rota_nome}
                                        onChange={(e) => setData('rota_nome', e.target.value)}
                                    />
                                    <datalist id="rotas-sugeridas">
                                        {rotas.map((r) => (
                                            <option key={r.id} value={r.name}>
                                                {r.code} - {r.name}
                                            </option>
                                        ))}
                                    </datalist>
                                    {errors.rota_nome && (
                                        <p className="mt-1 text-xs font-semibold text-status-danger-fg">
                                            {errors.rota_nome}
                                        </p>
                                    )}
                                    {rotas.length > 0 && !data.rota_nome && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            <span className="text-[10px] font-semibold text-content-muted">
                                                Sugestões:
                                            </span>
                                            {rotas.slice(0, 4).map((r) => (
                                                <button
                                                    key={r.id}
                                                    type="button"
                                                    onClick={() => setData('rota_nome', r.name)}
                                                    className="rounded bg-surface-sunken px-2 py-0.5 text-[10px] font-bold text-content-secondary transition hover:bg-brand-50 hover:text-brand-700"
                                                >
                                                    {r.name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Motorista */}
                                <div>
                                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-content-secondary">
                                        <UserIcon className="h-4 w-4 text-brand-600" />
                                        Motorista Responsável
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Nome Completo do Motorista"
                                        className="w-full rounded-lg border-line-strong bg-surface-card text-sm uppercase text-content-primary placeholder-content-muted focus:border-brand-500 focus:ring-brand-500"
                                        value={data.motorista}
                                        onChange={(e) => setData('motorista', e.target.value)}
                                    />
                                    {errors.motorista && (
                                        <p className="mt-1 text-xs font-semibold text-status-danger-fg">
                                            {errors.motorista}
                                        </p>
                                    )}
                                </div>

                                {/* Placa do Veículo */}
                                <div>
                                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-content-secondary">
                                        <IdentificationIcon className="h-4 w-4 text-brand-600" />
                                        Placa do Caminhão
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="ABC-1234"
                                        maxLength={8}
                                        className="w-full rounded-lg border-line-strong bg-surface-card text-center font-mono text-sm font-bold uppercase tracking-widest text-content-primary placeholder-content-muted focus:border-brand-500 focus:ring-brand-500"
                                        value={data.placa}
                                        onChange={(e) => setData('placa', e.target.value.toUpperCase())}
                                    />
                                    {errors.placa && (
                                        <p className="mt-1 text-xs font-semibold text-status-danger-fg">
                                            {errors.placa}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-content-secondary">
                                        Selecione a Carga em Aberto:
                                    </label>
                                    <select
                                        value={data.romaneio_id}
                                        onChange={(e) => setData('romaneio_id', e.target.value)}
                                        className="w-full rounded-lg border-line-strong bg-surface-card text-sm font-bold text-content-primary focus:border-brand-500 focus:ring-brand-500"
                                    >
                                        <option value="">-- Selecione a Carga Aberta --</option>
                                        {cargasEmAberto.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                Carga #{String(r.id).padStart(6, '0')} — {r.rota || 'Rota não informada'} ({r.motorista}) · {r.motos_count || 0} moto(s) · {r.itens_pecas_count || 0} peça(s)
                                            </option>
                                        ))}
                                    </select>
                                    {errors.romaneio_id && (
                                        <p className="mt-1 text-xs font-semibold text-status-danger-fg">
                                            {errors.romaneio_id}
                                        </p>
                                    )}
                                </div>

                                {cargaAbertaSelecionada && (
                                    <div className="rounded-card bg-surface-sunken p-4 ring-1 ring-line">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <span className="rounded-lg bg-brand-50 p-2 text-brand-700">
                                                    <TruckIcon className="h-5 w-5" />
                                                </span>
                                                <div>
                                                    <h4 className="text-sm font-bold text-content-primary">
                                                        Carga #{String(cargaAbertaSelecionada.id).padStart(6, '0')}
                                                    </h4>
                                                    <p className="text-xs text-content-secondary">
                                                        Rota: <strong>{cargaAbertaSelecionada.rota || 'Livre'}</strong> · Motorista: <strong>{cargaAbertaSelecionada.motorista}</strong> · Placa: <strong className="font-mono">{cargaAbertaSelecionada.placa}</strong>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="rounded-full bg-surface-card px-2.5 py-1 text-xs font-bold text-content-secondary ring-1 ring-line">
                                                    🏍️ {cargaAbertaSelecionada.motos_count || 0} motos
                                                </span>
                                                <span className="rounded-full bg-surface-card px-2.5 py-1 text-xs font-bold text-content-secondary ring-1 ring-line">
                                                    📦 {cargaAbertaSelecionada.itens_pecas_count || 0} peças
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* --- BARRA DE FERRAMENTAS E FILTRO RÁPIDO --- */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* Campo de Busca */}
                        <div className="relative flex-1">
                            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                            <input
                                type="text"
                                placeholder="Filtrar por cidade, filial, cliente, pedido ou chassi..."
                                value={filtroTexto}
                                onChange={(e) => setFiltroTexto(e.target.value)}
                                className="w-full rounded-lg border-line-strong bg-surface-card py-2 pl-9 pr-9 text-sm text-content-primary placeholder-content-muted focus:border-brand-500 focus:ring-brand-500"
                            />
                            {filtroTexto && (
                                <button
                                    type="button"
                                    onClick={() => setFiltroTexto('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-content-muted hover:text-content-primary"
                                >
                                    <XMarkIcon className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Atalhos Rápidos */}
                        <div className="flex items-center gap-2">
                            {totalGeralItens > 0 && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedMotoIds([]);
                                        setSelectedPecaIds([]);
                                    }}
                                    icon={XMarkIcon}
                                >
                                    Limpar Seleção ({totalGeralItens})
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* --- ABAS DE NAVEGAÇÃO V3 --- */}
                    <div className="border-b border-line">
                        <nav className="-mb-px flex space-x-2 overflow-x-auto scrollbar-slim" aria-label="Abas de Montagem">
                            {/* Aba 1: Motos CD */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('expedicao')}
                                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition ${
                                    activeTab === 'expedicao'
                                        ? 'border-brand-600 text-brand-700 bg-brand-50/50'
                                        : 'border-transparent text-content-secondary hover:border-line-strong hover:text-content-primary'
                                }`}
                            >
                                <TruckIcon className="h-4 w-4" />
                                Motos CD (Saída)
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                                        activeTab === 'expedicao'
                                            ? 'bg-brand-100 text-brand-800'
                                            : 'bg-surface-sunken text-content-secondary'
                                    }`}
                                >
                                    {countMotosExpFiltradas}
                                </span>
                            </button>

                            {/* Aba 2: Peças (Basquetas) */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('pecas')}
                                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition ${
                                    activeTab === 'pecas'
                                        ? 'border-brand-600 text-brand-700 bg-brand-50/50'
                                        : 'border-transparent text-content-secondary hover:border-line-strong hover:text-content-primary'
                                }`}
                            >
                                <WrenchScrewdriverIcon className="h-4 w-4" />
                                Peças (Basquetas)
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                                        activeTab === 'pecas'
                                            ? 'bg-brand-100 text-brand-800'
                                            : 'bg-surface-sunken text-content-secondary'
                                    }`}
                                >
                                    {countBasquetasFiltradas}
                                </span>
                            </button>

                            {/* Aba 3: Coletas (Milk Run) */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('coleta')}
                                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition ${
                                    activeTab === 'coleta'
                                        ? 'border-status-warning-solid text-status-warning-fg bg-status-warning-bg/40'
                                        : 'border-transparent text-content-secondary hover:border-line-strong hover:text-content-primary'
                                }`}
                            >
                                <ArrowPathIcon className="h-4 w-4" />
                                Coletas (Milk Run)
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                                        activeTab === 'coleta'
                                            ? 'bg-status-warning-bg text-status-warning-fg'
                                            : 'bg-surface-sunken text-content-secondary'
                                    }`}
                                >
                                    {countColetasFiltradas}
                                </span>
                            </button>

                            {/* Aba 4: Bipar Chassi */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('chassi')}
                                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition ${
                                    activeTab === 'chassi'
                                        ? 'border-brand-600 text-brand-700 bg-brand-50/50'
                                        : 'border-transparent text-content-secondary hover:border-line-strong hover:text-content-primary'
                                }`}
                            >
                                <QrCodeIcon className="h-4 w-4" />
                                Bipar Chassi
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                                        totalChassisPendentes > 0
                                            ? 'bg-status-danger-bg text-status-danger-fg'
                                            : 'bg-surface-sunken text-content-secondary'
                                    }`}
                                >
                                    {totalChassisPendentes}
                                </span>
                            </button>

                            {/* Aba 5: Composição da Carga (Prévia) */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('composicao')}
                                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition ${
                                    activeTab === 'composicao'
                                        ? 'border-brand-600 text-brand-700 bg-brand-50/50'
                                        : 'border-transparent text-content-secondary hover:border-line-strong hover:text-content-primary'
                                }`}
                            >
                                <ClipboardDocumentCheckIcon className="h-4 w-4" />
                                Composição da Carga
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                                        totalGeralItens > 0
                                            ? 'bg-status-success-bg text-status-success-fg'
                                            : 'bg-surface-sunken text-content-secondary'
                                    }`}
                                >
                                    {totalGeralItens}
                                </span>
                            </button>
                        </nav>
                    </div>

                    {/* ========================================================================= */}
                    {/* --- CONTEÚDO: ABA 1 - EXPEDIÇÃO CD (MOTOS) --- */}
                    {/* ========================================================================= */}
                    {activeTab === 'expedicao' && (
                        <div className="space-y-6">
                            {Object.keys(expedicaoFiltrada).length === 0 ? (
                                <EmptyState
                                    icon={TruckIcon}
                                    title="Nenhuma moto disponível para expedição"
                                    description={
                                        filtroTexto
                                            ? 'Nenhum pedido ou moto encontrado para os termos da busca.'
                                            : 'Todos os pedidos de motos aprovados já foram embarcados ou aguardam faturamento/chassi.'
                                    }
                                />
                            ) : (
                                Object.entries(expedicaoFiltrada).map(([local, pedidos]) => {
                                    const todasMotos = pedidos.flatMap((p) => (p.motos || []).map((m) => m.id));
                                    const grupoSelecionado =
                                        todasMotos.length > 0 && todasMotos.every((id) => selectedMotoIds.includes(id));
                                    const motosSelecionadasNesteLocal = todasMotos.filter((id) =>
                                        selectedMotoIds.includes(id)
                                    ).length;

                                    // Checa se há basquetas prontas para esta mesma filial
                                    const basquetasDestaFilial = agrupadosPecas[local] || [];
                                    const basquetasSelecionadasDestaFilial = basquetasDestaFilial.filter((b) =>
                                        selectedPecaIds.includes(b.id)
                                    ).length;

                                    return (
                                        <Card key={local} padding="none" className="overflow-hidden">
                                            {/* Header do Destino */}
                                            <div className="flex flex-col gap-3 border-b border-line bg-surface-sunken/80 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="rounded-lg bg-surface-card p-2 text-brand-600 shadow-sm ring-1 ring-line">
                                                        <MapPinIcon className="h-5 w-5" />
                                                    </span>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-base font-extrabold text-content-primary">
                                                                {local}
                                                            </h3>
                                                            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                                                                {motosSelecionadasNesteLocal} / {todasMotos.length} motos
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-content-secondary">
                                                            Destino Final · {pedidos.length} pedido(s)
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    {/* Botão Selecionar Todo o Local (Motos) */}
                                                    <Button
                                                        variant={grupoSelecionado ? 'secondary' : 'primary'}
                                                        size="sm"
                                                        onClick={() => toggleGrupoMotos(pedidos)}
                                                    >
                                                        {grupoSelecionado ? 'Desmarcar Motos' : 'Selecionar Motos'}
                                                    </Button>

                                                    {/* Ação Especial: Selecionar Motos + Peças deste destino */}
                                                    {basquetasDestaFilial.length > 0 && (
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() => toggleDestinoMisto(local)}
                                                            className="text-brand-700 hover:text-brand-800"
                                                        >
                                                            Tudo ({todasMotos.length} motos + {basquetasDestaFilial.length} basq.)
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Alerta Inteligente de Cross-Docking (Motos + Peças para o mesmo destino) */}
                                            {basquetasDestaFilial.length > 0 && (
                                                <div className="flex items-center justify-between gap-3 border-b border-status-info-solid/20 bg-status-info-bg/40 px-5 py-2.5 text-xs">
                                                    <div className="flex items-center gap-2 text-status-info-fg">
                                                        <WrenchScrewdriverIcon className="h-4 w-4 shrink-0" />
                                                        <span>
                                                            <strong>Carga Mista:</strong> Há{' '}
                                                            <strong>{basquetasDestaFilial.length} basqueta(s)</strong> de peças
                                                            prontas para <strong>{local}</strong>.
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleGrupoPecas(basquetasDestaFilial)}
                                                        className="font-bold text-status-info-fg underline transition hover:opacity-80"
                                                    >
                                                        {basquetasSelecionadasDestaFilial === basquetasDestaFilial.length
                                                            ? 'Desmarcar Peças'
                                                            : `+ Incluir ${basquetasDestaFilial.length} Basqueta(s)`}
                                                    </button>
                                                </div>
                                            )}

                                            {/* Lista de Pedidos do Destino */}
                                            <div className="divide-y divide-line">
                                                {pedidos.map((pedido) => {
                                                    const motosPedido = pedido.motos || [];
                                                    const selMotosPedido = motosPedido.filter((m) =>
                                                        selectedMotoIds.includes(m.id)
                                                    );
                                                    const todasSel =
                                                        motosPedido.length > 0 &&
                                                        motosPedido.length === selMotosPedido.length;
                                                    const algumaSel = selMotosPedido.length > 0;
                                                    const isExpanded = expandedPedidoIds.includes(pedido.id);

                                                    return (
                                                        <div key={pedido.id} className="transition hover:bg-surface-sunken/40">
                                                            {/* Linha do Pedido */}
                                                            <div className="flex items-center justify-between gap-4 px-5 py-3">
                                                                <div
                                                                    className="flex flex-1 cursor-pointer items-center gap-3"
                                                                    onClick={() => togglePedido(pedido)}
                                                                >
                                                                    {/* Checkbox estilizado tri-state */}
                                                                    <div
                                                                        className={`flex h-5 w-5 items-center justify-center rounded border transition ${
                                                                            todasSel
                                                                                ? 'border-brand-600 bg-brand-600 text-white'
                                                                                : algumaSel
                                                                                ? 'border-brand-600 bg-brand-50 text-brand-700'
                                                                                : 'border-line-strong bg-surface-card'
                                                                        }`}
                                                                    >
                                                                        {todasSel && (
                                                                            <svg
                                                                                className="h-3.5 w-3.5"
                                                                                fill="none"
                                                                                stroke="currentColor"
                                                                                viewBox="0 0 24 24"
                                                                            >
                                                                                <path
                                                                                    strokeLinecap="round"
                                                                                    strokeLinejoin="round"
                                                                                    strokeWidth="3"
                                                                                    d="M5 13l4 4L19 7"
                                                                                />
                                                                            </svg>
                                                                        )}
                                                                        {!todasSel && algumaSel && (
                                                                            <div className="h-2 w-2 rounded-xs bg-brand-600" />
                                                                        )}
                                                                    </div>

                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-sm font-bold text-content-primary">
                                                                                Pedido #{String(pedido.id).padStart(6, '0')}
                                                                            </span>
                                                                            <StatusBadge status={pedido.status} size="sm" />
                                                                        </div>
                                                                        <p className="text-xs text-content-secondary">
                                                                            Solicitante: {pedido.user?.name || 'Cliente'}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-sm font-bold text-content-primary">
                                                                        {selMotosPedido.length} / {motosPedido.length} motos
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleExpandPedido(pedido.id)}
                                                                        className="rounded p-1.5 text-content-muted hover:bg-surface-sunken hover:text-content-primary"
                                                                        title={isExpanded ? 'Recolher motos' : 'Ver motos'}
                                                                    >
                                                                        {isExpanded ? (
                                                                            <ChevronUpIcon className="h-5 w-5" />
                                                                        ) : (
                                                                            <ChevronDownIcon className="h-5 w-5" />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Lista de Motos Expandida */}
                                                            {isExpanded && (
                                                                <div className="border-t border-line bg-surface-sunken px-6 py-3">
                                                                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-content-muted">
                                                                        Motos disponíveis neste pedido:
                                                                    </p>
                                                                    <div className="space-y-1.5">
                                                                        {motosPedido.map((moto) => {
                                                                            const isChecked = selectedMotoIds.includes(
                                                                                moto.id
                                                                            );
                                                                            return (
                                                                                <div
                                                                                    key={moto.id}
                                                                                    onClick={() => toggleMoto(moto.id)}
                                                                                    className={`flex cursor-pointer items-center justify-between rounded-md p-2.5 transition ${
                                                                                        isChecked
                                                                                            ? 'bg-surface-card ring-1 ring-brand-500'
                                                                                            : 'hover:bg-surface-card'
                                                                                    }`}
                                                                                >
                                                                                    <div className="flex items-center gap-3">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={isChecked}
                                                                                            readOnly
                                                                                            className="h-4 w-4 rounded border-line-strong text-brand-600 focus:ring-brand-500"
                                                                                        />
                                                                                        <div>
                                                                                            <span className="font-mono text-xs font-bold text-content-primary">
                                                                                                {moto.chassi}
                                                                                            </span>
                                                                                            <span className="ml-2 text-xs font-semibold text-content-secondary">
                                                                                                {moto.modelo} · {moto.cor}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <StatusBadge status={moto.status} size="sm" />
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </Card>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* --- CONTEÚDO: ABA 2 - PEÇAS (BASQUETAS DE PEÇAS) --- */}
                    {/* ========================================================================= */}
                    {activeTab === 'pecas' && (
                        <div className="space-y-6">
                            {/* Banner Informativo Gate 2 */}
                            <div className="rounded-card border border-status-info-solid/30 bg-status-info-bg/40 p-4">
                                <div className="flex items-start gap-3">
                                    <span className="rounded-md bg-status-info-solid/20 p-2 text-status-info-fg">
                                        <WrenchScrewdriverIcon className="h-5 w-5" />
                                    </span>
                                    <div>
                                        <h4 className="text-sm font-bold text-status-info-fg">
                                            Gate 2 de Logística de Peças (Conferência e Faturamento)
                                        </h4>
                                        <p className="mt-0.5 text-xs text-content-secondary leading-relaxed">
                                            A unidade de embarque oficial é a <strong>basqueta lacrada</strong>. Apenas
                                            basquetas faturadas e liberadas pelo Pós-Venda aparecem para embarque, garantindo
                                            que a nota fiscal bata com a mercadoria em trânsito. O estoque segue sob
                                            responsabilidade do CD até a conferência pela filial receptora.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {Object.keys(pecasFiltradas).length === 0 ? (
                                <EmptyState
                                    icon={WrenchScrewdriverIcon}
                                    title="Nenhuma basqueta pronta para embarcar"
                                    description={
                                        filtroTexto
                                            ? 'Nenhuma basqueta de peças corresponde aos filtros da busca.'
                                            : 'Assim que as caixas forem faturadas e liberadas na tela de Basquetas, elas aparecerão automaticamente aqui.'
                                    }
                                />
                            ) : (
                                Object.entries(pecasFiltradas).map(([local, basquetas]) => {
                                    const todasBasquetasIds = basquetas.map((b) => b.id);
                                    const grupoSelecionado =
                                        todasBasquetasIds.length > 0 &&
                                        todasBasquetasIds.every((id) => selectedPecaIds.includes(id));
                                    const basquetasSelCount = todasBasquetasIds.filter((id) =>
                                        selectedPecaIds.includes(id)
                                    ).length;
                                    const totalPecasGrupo = basquetas.reduce((acc, b) => acc + (b.total_un || 0), 0);

                                    // Checa se há motos no CD para a mesma filial
                                    const motosDestaFilial = agrupadosExpedicao[local] || [];
                                    const totalMotosDestaFilial = motosDestaFilial.reduce(
                                        (acc, p) => acc + (p.motos?.length || 0),
                                        0
                                    );

                                    return (
                                        <Card key={local} padding="none" className="overflow-hidden">
                                            {/* Header do Grupo de Peças */}
                                            <div className="flex flex-col gap-3 border-b border-line bg-surface-sunken/80 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="rounded-lg bg-surface-card p-2 text-brand-600 shadow-sm ring-1 ring-line">
                                                        <BuildingStorefrontIcon className="h-5 w-5" />
                                                    </span>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-base font-extrabold text-content-primary">
                                                                {local}
                                                            </h3>
                                                            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700">
                                                                {basquetasSelCount} / {basquetas.length} basquetas ({totalPecasGrupo} peças)
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-content-secondary">
                                                            Filial Receptora · {basquetas.length} caixa(s) pronta(s)
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Button
                                                        variant={grupoSelecionado ? 'secondary' : 'primary'}
                                                        size="sm"
                                                        onClick={() => toggleGrupoPecas(basquetas)}
                                                    >
                                                        {grupoSelecionado ? 'Desmarcar Basquetas' : 'Selecionar Basquetas'}
                                                    </Button>

                                                    {motosDestaFilial.length > 0 && (
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() => toggleDestinoMisto(local)}
                                                            className="text-brand-700 hover:text-brand-800"
                                                        >
                                                            Tudo ({totalMotosDestaFilial} motos + {basquetas.length} basq.)
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Alerta de Carga Mista (Motos disponíveis para este destino) */}
                                            {motosDestaFilial.length > 0 && (
                                                <div className="flex items-center justify-between gap-3 border-b border-brand-500/20 bg-brand-50/40 px-5 py-2.5 text-xs">
                                                    <div className="flex items-center gap-2 text-brand-700">
                                                        <TruckIcon className="h-4 w-4 shrink-0" />
                                                        <span>
                                                            <strong>Carga Mista:</strong> Há{' '}
                                                            <strong>{totalMotosDestaFilial} moto(s)</strong> no CD prontas para{' '}
                                                            <strong>{local}</strong>.
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleGrupoMotos(motosDestaFilial)}
                                                        className="font-bold text-brand-700 underline transition hover:opacity-80"
                                                    >
                                                        + Incluir Motos no Caminhão
                                                    </button>
                                                </div>
                                            )}

                                            {/* Cards das Basquetas */}
                                            <div className="divide-y divide-line">
                                                {basquetas.map((basqueta) => {
                                                    const isChecked = selectedPecaIds.includes(basqueta.id);
                                                    const isExpanded = expandedBasquetaIds.includes(basqueta.id);

                                                    return (
                                                        <div key={basqueta.id} className="transition hover:bg-surface-sunken/40">
                                                            <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                                                                <div
                                                                    className="flex flex-1 cursor-pointer items-center gap-3"
                                                                    onClick={() => togglePeca(basqueta.id)}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        readOnly
                                                                        className="h-5 w-5 rounded border-line-strong text-brand-600 focus:ring-brand-500"
                                                                    />
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-sm font-bold text-content-primary">
                                                                                Basqueta #{String(basqueta.id).padStart(6, '0')}
                                                                            </span>
                                                                            {basqueta.nota && (
                                                                                <span className="rounded bg-surface-sunken px-2 py-0.5 text-xs font-mono font-bold text-content-secondary ring-1 ring-line">
                                                                                    NF {basqueta.nota}
                                                                                </span>
                                                                            )}
                                                                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                                                                                {basqueta.total_un} un
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-xs text-content-secondary">
                                                                            {basqueta.volumes || 1} volume(s) · {basqueta.itens?.length || 0} SKU(s)
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleExpandBasqueta(basqueta.id)}
                                                                        className="rounded p-1.5 text-content-muted hover:bg-surface-sunken hover:text-content-primary"
                                                                        title={isExpanded ? 'Recolher itens' : 'Ver peças'}
                                                                    >
                                                                        {isExpanded ? (
                                                                            <ChevronUpIcon className="h-5 w-5" />
                                                                        ) : (
                                                                            <ChevronDownIcon className="h-5 w-5" />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Lista de Peças da Basqueta */}
                                                            {isExpanded && (
                                                                <div className="border-t border-line bg-surface-sunken px-6 py-3">
                                                                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-content-muted">
                                                                        Itens contidos nesta basqueta:
                                                                    </p>
                                                                    <div className="divide-y divide-line rounded-lg bg-surface-card ring-1 ring-line">
                                                                        {(basqueta.itens || []).map((item) => (
                                                                            <div
                                                                                key={item.id}
                                                                                className="flex items-center justify-between px-4 py-2 text-xs"
                                                                            >
                                                                                <div>
                                                                                    <span className="font-semibold text-content-primary">
                                                                                        {item.descricao}
                                                                                    </span>
                                                                                    <span className="ml-2 font-mono text-[11px] text-content-muted">
                                                                                        ({item.codigo})
                                                                                    </span>
                                                                                </div>
                                                                                <span className="font-bold tabular-nums text-content-primary">
                                                                                    {item.quantidade} {item.unidade}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </Card>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* --- CONTEÚDO: ABA 3 - COLETAS (MILK RUN) --- */}
                    {/* ========================================================================= */}
                    {activeTab === 'coleta' && (
                        <div className="space-y-6">
                            {Object.keys(coletasFiltradas).length === 0 ? (
                                <EmptyState
                                    icon={ArrowPathIcon}
                                    title="Nenhuma coleta solicitada"
                                    description={
                                        filtroTexto
                                            ? 'Nenhuma coleta corresponde aos termos da busca.'
                                            : 'Não há transferências ou devoluções de motos pendentes de coleta nas lojas.'
                                    }
                                />
                            ) : (
                                Object.entries(coletasFiltradas).map(([origem, pedidos]) => {
                                    const todasMotos = pedidos.flatMap((p) => (p.motos || []).map((m) => m.id));
                                    const grupoSelecionado =
                                        todasMotos.length > 0 && todasMotos.every((id) => selectedMotoIds.includes(id));
                                    const motosSelCount = todasMotos.filter((id) => selectedMotoIds.includes(id)).length;

                                    return (
                                        <Card key={origem} padding="none" className="overflow-hidden">
                                            <div className="flex flex-col gap-3 border-b border-line bg-surface-sunken/80 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="rounded-lg bg-surface-card p-2 text-status-warning-fg shadow-sm ring-1 ring-line">
                                                        <ArrowPathIcon className="h-5 w-5" />
                                                    </span>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-base font-extrabold text-content-primary">
                                                                {origem}
                                                            </h3>
                                                            <span className="rounded-full bg-status-warning-bg px-2.5 py-0.5 text-xs font-bold text-status-warning-fg">
                                                                {motosSelCount} / {todasMotos.length} motos
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-content-secondary">
                                                            Origem da Coleta (Loja) · {pedidos.length} pedido(s)
                                                        </p>
                                                    </div>
                                                </div>

                                                <Button
                                                    variant={grupoSelecionado ? 'secondary' : 'primary'}
                                                    size="sm"
                                                    onClick={() => toggleGrupoMotos(pedidos)}
                                                >
                                                    {grupoSelecionado ? 'Desmarcar Coleta' : 'Selecionar Coleta'}
                                                </Button>
                                            </div>

                                            <div className="divide-y divide-line">
                                                {pedidos.map((pedido) => {
                                                    const motosPedido = pedido.motos || [];
                                                    const selMotosPedido = motosPedido.filter((m) =>
                                                        selectedMotoIds.includes(m.id)
                                                    );
                                                    const todasSel =
                                                        motosPedido.length > 0 &&
                                                        motosPedido.length === selMotosPedido.length;
                                                    const algumaSel = selMotosPedido.length > 0;
                                                    const isExpanded = expandedPedidoIds.includes(pedido.id);

                                                    return (
                                                        <div key={pedido.id} className="transition hover:bg-surface-sunken/40">
                                                            <div className="flex items-center justify-between gap-4 px-5 py-3">
                                                                <div
                                                                    className="flex flex-1 cursor-pointer items-center gap-3"
                                                                    onClick={() => togglePedido(pedido)}
                                                                >
                                                                    <div
                                                                        className={`flex h-5 w-5 items-center justify-center rounded border transition ${
                                                                            todasSel
                                                                                ? 'border-brand-600 bg-brand-600 text-white'
                                                                                : algumaSel
                                                                                ? 'border-brand-600 bg-brand-50 text-brand-700'
                                                                                : 'border-line-strong bg-surface-card'
                                                                        }`}
                                                                    >
                                                                        {todasSel && (
                                                                            <svg
                                                                                className="h-3.5 w-3.5"
                                                                                fill="none"
                                                                                stroke="currentColor"
                                                                                viewBox="0 0 24 24"
                                                                            >
                                                                                <path
                                                                                    strokeLinecap="round"
                                                                                    strokeLinejoin="round"
                                                                                    strokeWidth="3"
                                                                                    d="M5 13l4 4L19 7"
                                                                                />
                                                                            </svg>
                                                                        )}
                                                                        {!todasSel && algumaSel && (
                                                                            <div className="h-2 w-2 rounded-xs bg-brand-600" />
                                                                        )}
                                                                    </div>

                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-sm font-bold text-content-primary">
                                                                                Pedido #{String(pedido.id).padStart(6, '0')}
                                                                            </span>
                                                                            <StatusBadge status={pedido.status} size="sm" />
                                                                        </div>
                                                                        <p className="text-xs text-content-secondary">
                                                                            Destino da Moto:{' '}
                                                                            <strong>
                                                                                {pedido.user?.filial || pedido.user?.name || 'CD Matriz'}
                                                                            </strong>
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-sm font-bold text-content-primary">
                                                                        {selMotosPedido.length} / {motosPedido.length} motos
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleExpandPedido(pedido.id)}
                                                                        className="rounded p-1.5 text-content-muted hover:bg-surface-sunken hover:text-content-primary"
                                                                    >
                                                                        {isExpanded ? (
                                                                            <ChevronUpIcon className="h-5 w-5" />
                                                                        ) : (
                                                                            <ChevronDownIcon className="h-5 w-5" />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {isExpanded && (
                                                                <div className="border-t border-line bg-surface-sunken px-6 py-3">
                                                                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-content-muted">
                                                                        Motos para coleta:
                                                                    </p>
                                                                    <div className="space-y-1.5">
                                                                        {motosPedido.map((moto) => {
                                                                            const isChecked = selectedMotoIds.includes(
                                                                                moto.id
                                                                            );
                                                                            return (
                                                                                <div
                                                                                    key={moto.id}
                                                                                    onClick={() => toggleMoto(moto.id)}
                                                                                    className={`flex cursor-pointer items-center justify-between rounded-md p-2.5 transition ${
                                                                                        isChecked
                                                                                            ? 'bg-surface-card ring-1 ring-brand-500'
                                                                                            : 'hover:bg-surface-card'
                                                                                    }`}
                                                                                >
                                                                                    <div className="flex items-center gap-3">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={isChecked}
                                                                                            readOnly
                                                                                            className="h-4 w-4 rounded border-line-strong text-brand-600 focus:ring-brand-500"
                                                                                        />
                                                                                        <div>
                                                                                            <span className="font-mono text-xs font-bold text-content-primary">
                                                                                                {moto.chassi}
                                                                                            </span>
                                                                                            <span className="ml-2 text-xs font-semibold text-content-secondary">
                                                                                                {moto.modelo} · {moto.cor}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <StatusBadge status={moto.status} size="sm" />
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </Card>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* --- CONTEÚDO: ABA 4 - BIPAR CHASSIS (FLUXO B) --- */}
                    {/* ========================================================================= */}
                    {activeTab === 'chassi' && (
                        <div className="space-y-6">
                            {/* Card de Bipagem Rápida */}
                            <Card
                                title="Bipagem Rápida de Chassis no Embarque"
                                subtitle="Bipe o chassi da moto nas docas. O sistema identifica o modelo e cor e vincula automaticamente ao pedido mais antigo (FIFO) que aguarda a moto."
                            >
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-3 sm:flex-row">
                                        <div className="relative flex-1">
                                            <QrCodeIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-600" />
                                            <input
                                                ref={chassiInputRef}
                                                type="text"
                                                placeholder="Bipe ou digite o número do chassi (11 a 17 dígitos)..."
                                                value={chassiCarga}
                                                maxLength={17}
                                                disabled={isBipando}
                                                onChange={(e) =>
                                                    setChassiCarga(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleBiparCarga();
                                                    }
                                                }}
                                                className="w-full rounded-lg border-line-strong py-3 pl-10 pr-4 font-mono text-base font-bold tracking-widest text-content-primary placeholder-content-muted focus:border-brand-500 focus:ring-brand-500"
                                            />
                                        </div>

                                        <select
                                            value={pedidoAlvo}
                                            onChange={(e) => setPedidoAlvo(e.target.value)}
                                            className="rounded-lg border-line-strong text-sm font-bold text-content-primary focus:border-brand-500 focus:ring-brand-500"
                                        >
                                            <option value="">Descoberta Automática (FIFO)</option>
                                            {aguardandoChassi.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    Forçar Pedido #{p.id} — {p.loja}
                                                </option>
                                            ))}
                                        </select>

                                        <Button
                                            type="button"
                                            variant="primary"
                                            loading={isBipando}
                                            onClick={handleBiparCarga}
                                            icon={QrCodeIcon}
                                            className="px-6 py-3"
                                        >
                                            Atribuir
                                        </Button>
                                    </div>
                                </div>
                            </Card>

                            {/* Pedidos que Aguardam Chassi */}
                            {aguardandoChassiFiltrado.length === 0 ? (
                                <EmptyState
                                    icon={CheckCircleIcon}
                                    title="Nenhum pedido aguardando chassi"
                                    description="Todos os pedidos aprovados já possuem motos vinculadas e estão prontos para expedição."
                                />
                            ) : (
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-content-muted">
                                        Fila de Pedidos Aguardando Atribuição ({aguardandoChassiFiltrado.length})
                                    </h4>

                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        {aguardandoChassiFiltrado.map((pedido) => (
                                            <Card key={pedido.id} padding="none" className="overflow-hidden">
                                                <div className="flex items-center justify-between border-b border-line bg-surface-sunken px-4 py-3">
                                                    <div>
                                                        <h5 className="text-sm font-bold text-content-primary">
                                                            Pedido #{String(pedido.id).padStart(6, '0')}
                                                        </h5>
                                                        <p className="text-xs text-content-secondary">{pedido.loja}</p>
                                                    </div>
                                                    <a
                                                        href={route('pedidos.show', pedido.id)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-xs font-bold text-brand-600 hover:underline"
                                                    >
                                                        Abrir ↗
                                                    </a>
                                                </div>

                                                <div className="divide-y divide-line p-3">
                                                    {pedido.itens.map((item) => (
                                                        <div
                                                            key={item.id}
                                                            className="flex items-center justify-between py-2 text-xs"
                                                        >
                                                            <div>
                                                                <span className="font-bold text-content-primary">
                                                                    {item.modelo}
                                                                </span>{' '}
                                                                <span className="text-content-secondary">{item.cor}</span>
                                                            </div>
                                                            <span className="rounded-full bg-status-warning-bg px-2.5 py-0.5 font-bold text-status-warning-fg">
                                                                Faltam {item.qtd_pendente} de {item.quantidade}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* --- CONTEÚDO: ABA 5 - COMPOSIÇÃO DA CARGA (PRÉVIA DO MANIFESTO) --- */}
                    {/* ========================================================================= */}
                    {activeTab === 'composicao' && (
                        <div className="space-y-6">
                            {totalGeralItens === 0 ? (
                                <EmptyState
                                    icon={ClipboardDocumentCheckIcon}
                                    title="Nenhum item na carga ainda"
                                    description="Navegue pelas abas de Motos e Peças e selecione os itens que irão embarcar neste caminhão."
                                    action={
                                        <Button
                                            variant="primary"
                                            onClick={() => setActiveTab('expedicao')}
                                            icon={TruckIcon}
                                        >
                                            Ir para Motos CD
                                        </Button>
                                    }
                                />
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="text-base font-extrabold text-content-primary">
                                                Resumo da Viagem · {totalDestinos} Parada(s) Programada(s)
                                            </h3>
                                            <p className="text-xs text-content-secondary">
                                                Total de <strong>{totalMotosSelecionadas} motos</strong> e{' '}
                                                <strong>
                                                    {totalBasquetasSelecionadas} basquetas ({totalPecasSelecionadasUn} peças em{' '}
                                                    {totalVolumesSelecionados} vol.)
                                                </strong>
                                            </p>
                                        </div>

                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedMotoIds([]);
                                                setSelectedPecaIds([]);
                                            }}
                                            icon={XMarkIcon}
                                        >
                                            Esvaziar Carga
                                        </Button>
                                    </div>

                                    {/* Lista de Paradas por Destino */}
                                    <div className="space-y-4">
                                        {Object.entries(destinosUnicos).map(([parada, conteudo], index) => {
                                            const totalMotosParada = conteudo.motos.length + conteudo.coletas.length;
                                            const totalBasquetasParada = conteudo.basquetas.length;

                                            return (
                                                <Card key={parada} padding="none" className="overflow-hidden">
                                                    <div className="flex items-center justify-between border-b border-line bg-surface-sunken px-5 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-black text-white">
                                                                {index + 1}
                                                            </span>
                                                            <div>
                                                                <h4 className="text-sm font-extrabold text-content-primary">
                                                                    Parada: {parada}
                                                                </h4>
                                                                <p className="text-xs text-content-secondary">
                                                                    {totalMotosParada} moto(s) · {totalBasquetasParada} basqueta(s)
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="divide-y divide-line p-4 space-y-3">
                                                        {/* Motos da Parada */}
                                                        {conteudo.motos.length > 0 && (
                                                            <div>
                                                                <h5 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-content-muted">
                                                                    🏍️ Motos de Saída ({conteudo.motos.length}):
                                                                </h5>
                                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                                    {conteudo.motos.map((m) => (
                                                                        <div
                                                                            key={m.id}
                                                                            className="flex items-center justify-between rounded-lg bg-surface-sunken p-2.5 text-xs ring-1 ring-line"
                                                                        >
                                                                            <div>
                                                                                <span className="font-mono font-bold text-content-primary">
                                                                                    {m.chassi}
                                                                                </span>
                                                                                <p className="text-content-secondary">
                                                                                    {m.modelo} · {m.cor} (Ped #{m.pedidoId})
                                                                                </p>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => toggleMoto(m.id)}
                                                                                className="rounded p-1 text-content-muted hover:text-status-danger-fg"
                                                                                title="Remover da carga"
                                                                            >
                                                                                <XMarkIcon className="h-4 w-4" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Coletas da Parada */}
                                                        {conteudo.coletas.length > 0 && (
                                                            <div>
                                                                <h5 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-content-muted">
                                                                    🔄 Coletas Milk Run ({conteudo.coletas.length}):
                                                                </h5>
                                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                                    {conteudo.coletas.map((m) => (
                                                                        <div
                                                                            key={m.id}
                                                                            className="flex items-center justify-between rounded-lg bg-status-warning-bg/30 p-2.5 text-xs ring-1 ring-status-warning-solid/30"
                                                                        >
                                                                            <div>
                                                                                <span className="font-mono font-bold text-content-primary">
                                                                                    {m.chassi}
                                                                                </span>
                                                                                <p className="text-content-secondary">
                                                                                    {m.modelo} · {m.cor} ({m.origem} ➔ {m.destino})
                                                                                </p>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => toggleMoto(m.id)}
                                                                                className="rounded p-1 text-content-muted hover:text-status-danger-fg"
                                                                                title="Remover da carga"
                                                                            >
                                                                                <XMarkIcon className="h-4 w-4" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Basquetas de Peças da Parada */}
                                                        {conteudo.basquetas.length > 0 && (
                                                            <div>
                                                                <h5 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-content-muted">
                                                                    📦 Basquetas de Peças ({conteudo.basquetas.length}):
                                                                </h5>
                                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                                    {conteudo.basquetas.map((b) => (
                                                                        <div
                                                                            key={b.id}
                                                                            className="flex items-center justify-between rounded-lg bg-brand-50/40 p-2.5 text-xs ring-1 ring-brand-500/30"
                                                                        >
                                                                            <div>
                                                                                <span className="font-bold text-content-primary">
                                                                                    Basqueta #{String(b.id).padStart(6, '0')}
                                                                                </span>
                                                                                <p className="text-content-secondary">
                                                                                    {b.nota ? `NF ${b.nota} · ` : ''}
                                                                                    {b.total_un} peças · {b.volumes || 1} vol.
                                                                                </p>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => togglePeca(b.id)}
                                                                                className="rounded p-1 text-content-muted hover:text-status-danger-fg"
                                                                                title="Remover da carga"
                                                                            >
                                                                                <XMarkIcon className="h-4 w-4" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* --- BARRA FLUTUANTE DE RESUMO E AÇÃO (MESA DE EMBARQUE V3) --- */}
                    {/* ========================================================================= */}
                    <div className="fixed bottom-0 left-0 z-topbar w-full border-t border-white/10 bg-surface-inverted p-4 text-content-inverted shadow-2xl safe-area-bottom">
                        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
                            {/* Indicadores de Carga */}
                            <div className="flex w-full items-center justify-between gap-6 md:w-auto md:justify-start">
                                <div className="flex items-center gap-6">
                                    {/* Motos */}
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                                            Motos
                                        </span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-black leading-none text-white">
                                                {totalMotosSelecionadas}
                                            </span>
                                            <span className="text-xs font-semibold text-white/50">un</span>
                                        </div>
                                    </div>

                                    {/* Peças (Basquetas) */}
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                                            Peças (Basquetas)
                                        </span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-black leading-none text-white">
                                                {totalBasquetasSelecionadas}
                                            </span>
                                            <span className="text-xs font-semibold text-white/50">
                                                cx ({totalPecasSelecionadasUn} un)
                                            </span>
                                        </div>
                                    </div>

                                    {/* Destinos */}
                                    <div className="hidden flex-col sm:flex">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                                            Destinos
                                        </span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-black leading-none text-white">
                                                {totalDestinos}
                                            </span>
                                            <span className="text-xs font-semibold text-white/50">parada(s)</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="hidden h-10 w-px bg-white/20 md:block" />

                                {/* Acesso Rápido à Prévia */}
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('composicao')}
                                    className="hidden text-xs font-bold text-white/80 underline transition hover:text-white lg:block"
                                >
                                    Ver Composição Detalhada ↗
                                </button>
                            </div>

                            {/* Botão Primário de Disparo */}
                            <div className="flex w-full items-center justify-end gap-3 md:w-auto">
                                <button
                                    type="submit"
                                    disabled={processing || totalGeralItens === 0}
                                    className={`inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-8 py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-lg transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40 md:w-auto ${
                                        processing ? 'animate-pulse' : ''
                                    }`}
                                >
                                    {processing ? (
                                        <>
                                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle
                                                    className="opacity-25"
                                                    cx="12"
                                                    cy="12"
                                                    r="10"
                                                    stroke="currentColor"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    className="opacity-75"
                                                    fill="currentColor"
                                                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                                />
                                            </svg>
                                            Salvando Manifesto...
                                        </>
                                    ) : (
                                        <>
                                            <span>🚀</span>
                                            {!data.romaneio_id
                                                ? `Gerar Carga (${totalGeralItens} itens)`
                                                : `Adicionar à Carga #${data.romaneio_id}`}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}