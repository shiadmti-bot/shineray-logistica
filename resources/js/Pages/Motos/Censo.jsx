import { Head, router, Link, usePage } from '@inertiajs/react';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
    QrCodeIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    PrinterIcon,
    BuildingStorefrontIcon,
    BuildingOffice2Icon,
    MagnifyingGlassIcon,
    XMarkIcon,
    SpeakerWaveIcon,
    SpeakerXMarkIcon,
    ArrowUturnLeftIcon,
    SparklesIcon,
    TrashIcon,
    CheckIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';

import {
    Card,
    PageHeader,
    Button,
    StatusBadge,
    StatCard,
    EmptyState,
    Tabs,
    Alert,
} from '@/Components/UI';
import BotaoTourDoModulo from '@/Components/Tour/BotaoTourDoModulo';

/**
 * Censo / Inventário Rápido de Pátio com Bipagem Contínua.
 *
 * Projetado para operações físicas de pátio em Lojas e CD Matriz:
 * - Campo proeminente com auto-foco persistente para leitores de código de barras USB/Bluetooth ou celular.
 * - Feedback auditivo imediato (Plim na confirmação, alarme sintético em divergências).
 * - Três listas dinâmicas em memória local (zero latência):
 *     1. Confirmadas no Pátio (bipadas com sucesso)
 *     2. Faltantes / Pendentes (esperadas no sistema mas não localizadas)
 *     3. Intrusas / Fora de Lugar (de outra loja ou não cadastradas)
 * - Barra de progresso e estatísticas em tempo real.
 * - Impressão de relatório executivo de conferência.
 */
export default function MotosCenso({
    auth,
    localAtual,
    lojas = [],
    motosEsperadas = [],
    catalogoGeral = [],
    podeTrocarUnidade = false,
}) {
    const inputRef = useRef(null);

    // Preferências do operador
    const [manterFoco, setManterFoco] = useState(true);
    const [somHabilitado, setSomHabilitado] = useState(true);

    // Estado do campo de bipagem
    const [bipInput, setBipInput] = useState('');
    const [ultimoBip, setUltimoBip] = useState(null);

    // Filtros e Abas
    const [abaAtiva, setAbaAtiva] = useState('confirmadas');
    const [buscaFiltro, setBuscaFiltro] = useState('');

    // Chave de persistência local para não perder progresso acidentalmente
    const storageKey = `shineray_censo_${localAtual.tipo}_${localAtual.id}`;

    // Listas locais de bipagem
    const [confirmadas, setConfirmadas] = useState(() => {
        try {
            const salvo = localStorage.getItem(storageKey);
            if (salvo) {
                const parsed = JSON.parse(salvo);
                if (Array.isArray(parsed.confirmadas)) return parsed.confirmadas;
            }
        } catch {
            // Ignora erro de JSON ou storage
        }
        return [];
    });

    const [intrusas, setIntrusas] = useState(() => {
        try {
            const salvo = localStorage.getItem(storageKey);
            if (salvo) {
                const parsed = JSON.parse(salvo);
                if (Array.isArray(parsed.intrusas)) return parsed.intrusas;
            }
        } catch {
            // Ignora erro de JSON ou storage
        }
        return [];
    });

    // Salva progresso no localStorage a cada atualização
    useEffect(() => {
        try {
            localStorage.setItem(
                storageKey,
                JSON.stringify({
                    data: new Date().toISOString(),
                    confirmadas,
                    intrusas,
                })
            );
        } catch {
            // Storage quota ou modo privado
        }
    }, [confirmadas, intrusas, storageKey]);

    // Auto-foco inicial e persistente
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [localAtual.id]);

    const handleInputBlur = () => {
        if (manterFoco) {
            // Pequeno delay para permitir clique em botões e controles sem travar o clique
            setTimeout(() => {
                if (
                    document.activeElement?.tagName !== 'INPUT' &&
                    document.activeElement?.tagName !== 'SELECT' &&
                    document.activeElement?.tagName !== 'BUTTON' &&
                    document.activeElement?.tagName !== 'A'
                ) {
                    inputRef.current?.focus();
                }
            }, 180);
        }
    };

    // Gera o conjunto de chassis já confirmados para cálculo imediato de faltantes
    const confirmadasMap = useMemo(() => {
        const map = new Map();
        confirmadas.forEach((item) => {
            map.set(item.chassi.toUpperCase(), item);
        });
        return map;
    }, [confirmadas]);

    // Lista derivada de motos faltantes/pendentes
    const pendentes = useMemo(() => {
        return motosEsperadas.filter((moto) => !confirmadasMap.has(moto.chassi.toUpperCase()));
    }, [motosEsperadas, confirmadasMap]);

    // Contagens para os KPIs
    const totalEsperadas = motosEsperadas.length;
    const totalConfirmadas = confirmadas.length;
    const totalPendentes = pendentes.length;
    const totalIntrusas = intrusas.length;

    // Percentual de progresso
    const percentualProgresso =
        totalEsperadas > 0 ? Math.min(100, Math.round((totalConfirmadas / totalEsperadas) * 100)) : 0;

    // -------------------------------------------------------------------------
    // SONS & FEEDBACK HÁPTICO
    // -------------------------------------------------------------------------
    const tocarSucesso = () => {
        if (!somHabilitado) return;

        try {
            const audio = new Audio('/plim.mp3');
            audio.currentTime = 0;
            const promessa = audio.play();
            if (promessa !== undefined) {
                promessa.catch(() => playSyntheticBeep(880, 0.15, 'sine'));
            }
        } catch {
            playSyntheticBeep(880, 0.15, 'sine');
        }

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(80);
        }
    };

    const tocarAviso = () => {
        if (!somHabilitado) return;
        playSyntheticAlert();

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([140, 60, 140]);
        }
    };

    const playSyntheticBeep = (freq, duration, type = 'sine') => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch {
            // Ignora erro de áudio
        }
    };

    const playSyntheticAlert = () => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();

            const emitTone = (freq, start, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
                gain.gain.setValueAtTime(0.2, ctx.currentTime + start);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + start);
                osc.stop(ctx.currentTime + start + duration);
            };

            emitTone(320, 0, 0.12);
            emitTone(220, 0.14, 0.16);
        } catch {
            // Ignora erro de áudio
        }
    };

    // -------------------------------------------------------------------------
    // LÓGICA DE PROCESSAMENTO DE BIPAGEM CONTÍNUA
    // -------------------------------------------------------------------------
    const processarBip = (e) => {
        if (e) e.preventDefault();
        const termo = bipInput.trim().toUpperCase();
        if (!termo) return;

        setBipInput('');
        if (inputRef.current) {
            inputRef.current.focus();
        }

        const agora = new Date().toLocaleTimeString();

        // 1. Checa se já foi bipada anteriormente nesta sessão
        const jaConfirmada = confirmadas.find(
            (c) => c.chassi.toUpperCase() === termo || (termo.length >= 6 && c.chassi.toUpperCase().endsWith(termo))
        );
        if (jaConfirmada) {
            tocarAviso();
            setUltimoBip({
                tipo: 'duplicado',
                mensagem: `Chassi ${jaConfirmada.chassi} já foi bipado anteriormente às ${jaConfirmada.bipadaEm}!`,
                chassi: jaConfirmada.chassi,
                modelo: jaConfirmada.modelo,
                cor: jaConfirmada.cor,
                timestamp: agora,
            });
            return;
        }

        const jaIntrusa = intrusas.find(
            (i) => i.chassi.toUpperCase() === termo || (termo.length >= 6 && i.chassi.toUpperCase().endsWith(termo))
        );
        if (jaIntrusa) {
            tocarAviso();
            setUltimoBip({
                tipo: 'duplicado',
                mensagem: `Chassi ${jaIntrusa.chassi} já foi registrado na lista de Intrusas!`,
                chassi: jaIntrusa.chassi,
                modelo: jaIntrusa.modelo,
                cor: jaIntrusa.cor,
                timestamp: agora,
            });
            return;
        }

        // 2. Busca nas motos esperadas deste pátio
        // Correspondência exata primeiro; se não houver e termo >= 6 caracteres, tenta por sufixo
        let motoEsperada = motosEsperadas.find((m) => m.chassi.toUpperCase() === termo);
        if (!motoEsperada && termo.length >= 6) {
            motoEsperada = motosEsperadas.find((m) => m.chassi.toUpperCase().endsWith(termo));
        }

        if (motoEsperada) {
            // 🟢 CONFIRMADA
            const novaConfirmada = {
                id: motoEsperada.id,
                chassi: motoEsperada.chassi,
                modelo: motoEsperada.modelo,
                cor: motoEsperada.cor,
                statusOriginal: motoEsperada.status,
                bipadaEm: agora,
            };

            setConfirmadas((prev) => [novaConfirmada, ...prev]);
            tocarSucesso();
            setUltimoBip({
                tipo: 'sucesso',
                mensagem: `Moto confirmada no pátio: ${motoEsperada.modelo} (${motoEsperada.cor})`,
                chassi: motoEsperada.chassi,
                modelo: motoEsperada.modelo,
                cor: motoEsperada.cor,
                statusOriginal: motoEsperada.status,
                timestamp: agora,
            });
            return;
        }

        // 3. Não é esperada neste pátio! Verifica no catálogo geral de todas as motos
        let motoCatalogo = catalogoGeral.find((m) => m.chassi.toUpperCase() === termo);
        if (!motoCatalogo && termo.length >= 6) {
            motoCatalogo = catalogoGeral.find((m) => m.chassi.toUpperCase().endsWith(termo));
        }

        if (motoCatalogo) {
            // 🟡 INTRUSA DE OUTRA LOJA OU DO CD
            const novaIntrusa = {
                id: motoCatalogo.id,
                chassi: motoCatalogo.chassi,
                modelo: motoCatalogo.modelo,
                cor: motoCatalogo.cor,
                status: motoCatalogo.status,
                lojaNome: motoCatalogo.loja_nome || 'CD Matriz (Fábrica)',
                lojaId: motoCatalogo.loja_id,
                tipoDivergencia: 'outra_loja',
                bipadaEm: agora,
            };

            setIntrusas((prev) => [novaIntrusa, ...prev]);
            tocarAviso();
            setUltimoBip({
                tipo: 'aviso',
                mensagem: `ALERTA DE PÁTIO: Moto cadastrada para ${novaIntrusa.lojaNome}!`,
                chassi: motoCatalogo.chassi,
                modelo: motoCatalogo.modelo,
                cor: motoCatalogo.cor,
                detalhe: `Deveria estar em: ${novaIntrusa.lojaNome}`,
                timestamp: agora,
            });
        } else {
            // 🟡 INTRUSA NÃO CADASTRADA NO SISTEMA
            const novaNaoCadastrada = {
                chassi: termo,
                modelo: 'Não identificado',
                cor: '-',
                status: 'desconhecido',
                lojaNome: 'Chassi não consta na base BySabel',
                lojaId: null,
                tipoDivergencia: 'nao_cadastrada',
                bipadaEm: agora,
            };

            setIntrusas((prev) => [novaNaoCadastrada, ...prev]);
            tocarAviso();
            setUltimoBip({
                tipo: 'aviso',
                mensagem: `ATENÇÃO: Chassi ${termo} não foi encontrado no sistema BySabel!`,
                chassi: termo,
                modelo: 'Chassi desconhecido',
                cor: '-',
                detalhe: 'Não possui cadastro prévio no banco de dados',
                timestamp: agora,
            });
        }
    };

    // Confirmação manual de item da lista de faltantes (caso o código de barras esteja danificado)
    const handleConfirmarManual = (moto) => {
        const agora = new Date().toLocaleTimeString();
        const novaConfirmada = {
            id: moto.id,
            chassi: moto.chassi,
            modelo: moto.modelo,
            cor: moto.cor,
            statusOriginal: moto.status,
            bipadaEm: `${agora} (Manual)`,
        };

        setConfirmadas((prev) => [novaConfirmada, ...prev]);
        tocarSucesso();
        setUltimoBip({
            tipo: 'sucesso',
            mensagem: `Confirmada manualmente: ${moto.modelo} (${moto.cor})`,
            chassi: moto.chassi,
            modelo: moto.modelo,
            cor: moto.cor,
            statusOriginal: moto.status,
            timestamp: agora,
        });

        if (inputRef.current) inputRef.current.focus();
    };

    // Desfazer confirmação
    const handleDesfazerConfirmacao = (chassi) => {
        setConfirmadas((prev) => prev.filter((c) => c.chassi !== chassi));
        if (inputRef.current) inputRef.current.focus();
    };

    // Remover intrusa
    const handleRemoverIntrusa = (chassi) => {
        setIntrusas((prev) => prev.filter((i) => i.chassi !== chassi));
        if (inputRef.current) inputRef.current.focus();
    };

    // Reset completo do censo
    const handleResetarCenso = () => {
        if (
            window.confirm(
                'Tem certeza que deseja reiniciar o censo deste pátio? Todas as bipagens realizadas nesta sessão serão descartadas.'
            )
        ) {
            setConfirmadas([]);
            setIntrusas([]);
            setUltimoBip(null);
            try {
                localStorage.removeItem(storageKey);
            } catch {
                // Ignora
            }
            if (inputRef.current) inputRef.current.focus();
        }
    };

    // Troca de unidade (para Admin, CD e Gestor)
    const handleTrocarUnidade = (e) => {
        const novoLocalId = e.target.value;
        router.get(
            route('motos.censo'),
            { loja_id: novoLocalId },
            { preserveState: false }
        );
    };

    // Impressão do Relatório Resumido
    const handleImprimirRelatorio = () => {
        window.print();
    };

    // -------------------------------------------------------------------------
    // FILTROS DAS LISTAS DINÂMICAS
    // -------------------------------------------------------------------------
    const termoBusca = buscaFiltro.trim().toLowerCase();

    const confirmadasFiltradas = useMemo(() => {
        if (!termoBusca) return confirmadas;
        return confirmadas.filter(
            (c) =>
                c.chassi.toLowerCase().includes(termoBusca) ||
                c.modelo.toLowerCase().includes(termoBusca) ||
                c.cor.toLowerCase().includes(termoBusca)
        );
    }, [confirmadas, termoBusca]);

    const pendentesFiltradas = useMemo(() => {
        if (!termoBusca) return pendentes;
        return pendentes.filter(
            (p) =>
                p.chassi.toLowerCase().includes(termoBusca) ||
                p.modelo.toLowerCase().includes(termoBusca) ||
                p.cor.toLowerCase().includes(termoBusca)
        );
    }, [pendentes, termoBusca]);

    const intrusasFiltradas = useMemo(() => {
        if (!termoBusca) return intrusas;
        return intrusas.filter(
            (i) =>
                i.chassi.toLowerCase().includes(termoBusca) ||
                i.modelo.toLowerCase().includes(termoBusca) ||
                i.lojaNome.toLowerCase().includes(termoBusca)
        );
    }, [intrusas, termoBusca]);

    // Definição das Abas
    const abas = [
        {
            key: 'confirmadas',
            label: 'Confirmadas no Pátio',
            count: totalConfirmadas,
            icon: CheckCircleIcon,
        },
        {
            key: 'pendentes',
            label: 'Faltantes / Pendentes',
            count: totalPendentes,
            icon: ExclamationCircleIcon,
        },
        {
            key: 'intrusas',
            label: 'Intrusas / Fora de Lugar',
            count: totalIntrusas,
            icon: ExclamationTriangleIcon,
        },
    ];

    return (
        <>
            <Head title={`Censo de Pátio - ${localAtual.nome}`} />

            {/* ---------- ESTILOS DE IMPRESSÃO EXECUTIVA ---------- */}
            <style>{`
                @media print {
                    nav, header, footer, .nao-imprimir, [data-tour="censo.bipagem"], [data-tour="censo.acoes"] {
                        display: none !important;
                    }
                    body {
                        background: white !important;
                        color: black !important;
                        font-size: 11pt !important;
                    }
                    .imprimir-apenas {
                        display: block !important;
                    }
                    .pagina-censo {
                        padding: 0 !important;
                        max-width: 100% !important;
                    }
                    .card-print {
                        box-shadow: none !important;
                        border: 1px solid #ccc !important;
                        break-inside: avoid;
                    }
                }
                .imprimir-apenas {
                    display: none;
                }
            `}</style>

            {/* ---------- CABEÇALHO DA PÁGINA (DESIGN SYSTEM V3) ---------- */}
            <div className="nao-imprimir">
                <PageHeader
                    title="Censo / Inventário Rápido de Pátio"
                    description={`Auditoria física com bipagem contínua para ${localAtual.nome}.`}
                    breadcrumbs={[
                        { label: 'Motos', href: route('motos.index') },
                        { label: 'Censo de Pátio' },
                    ]}
                    actions={
                        <div className="flex flex-wrap items-center gap-2" data-tour="censo.acoes">
                            <Button
                                href={route('motos.index')}
                                variant="secondary"
                                icon={ArrowUturnLeftIcon}
                            >
                                Voltar
                            </Button>

                            <Button
                                variant="secondary"
                                icon={PrinterIcon}
                                onClick={handleImprimirRelatorio}
                                title="Imprimir Relatório de Auditoria"
                            >
                                Imprimir
                            </Button>

                            <Button
                                variant="secondary"
                                icon={ArrowPathIcon}
                                onClick={handleResetarCenso}
                                className="text-status-danger-fg hover:bg-status-danger-bg"
                                title="Reiniciar conferência deste pátio"
                            >
                                Resetar
                            </Button>

                            <BotaoTourDoModulo modulo="motos.censo" />
                        </div>
                    }
                />
            </div>

            {/* ---------- RELATÓRIO CABEÇALHO DE IMPRESSÃO (EXCLUSIVO PRINT) ---------- */}
            <div className="imprimir-apenas mb-6 border-b-2 border-black pb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight text-black">
                            Shineray BySabel — Relatório de Censo de Pátio
                        </h1>
                        <p className="text-sm font-semibold text-gray-700">
                            Unidade Auditada: <span className="font-bold">{localAtual.nome}</span> | Tipo: {localAtual.tipo === 'cd' ? 'Centro de Distribuição' : 'Filial Concessionária'}
                        </p>
                    </div>
                    <div className="text-right text-xs text-gray-600">
                        <p>Data do Censo: {new Date().toLocaleDateString()} às {new Date().toLocaleTimeString()}</p>
                        <p>Auditor Responsável: {auth.user.name} ({auth.user.perfil})</p>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-4 border border-gray-300 p-3 text-center text-xs">
                    <div>
                        <div className="font-bold uppercase text-gray-500">Esperadas no Sistema</div>
                        <div className="text-xl font-black text-black">{totalEsperadas}</div>
                    </div>
                    <div>
                        <div className="font-bold uppercase text-emerald-700">Confirmadas (Presentes)</div>
                        <div className="text-xl font-black text-emerald-700">{totalConfirmadas} ({percentualProgresso}%)</div>
                    </div>
                    <div>
                        <div className="font-bold uppercase text-red-700">Faltantes / Pendentes</div>
                        <div className="text-xl font-black text-red-700">{totalPendentes}</div>
                    </div>
                    <div>
                        <div className="font-bold uppercase text-amber-700">Intrusas / Divergentes</div>
                        <div className="text-xl font-black text-amber-700">{totalIntrusas}</div>
                    </div>
                </div>
            </div>

            <div className="pagina-censo space-y-6">
                {/* ---------- CONTROLES SUPERIORES (SELEÇÃO DE PÁTIO & PREFERÊNCIAS) ---------- */}
                <div className="nao-imprimir flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Seletor de Unidade (para Admin/CD/Gestor) */}
                    {podeTrocarUnidade ? (
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold uppercase text-content-secondary whitespace-nowrap">
                                Pátio Auditado:
                            </label>
                            <select
                                className="rounded-lg border-line bg-surface-card text-sm font-bold text-content-primary shadow-sm focus:border-brand-500 focus:ring-brand-500"
                                value={localAtual.tipo === 'cd' ? 'cd' : localAtual.id}
                                onChange={handleTrocarUnidade}
                            >
                                <option value="cd">🏢 CD Matriz (Estoque Fábrica)</option>
                                <optgroup label="Lojas e Concessionárias">
                                    {lojas.map((loja) => (
                                        <option key={loja.id} value={loja.id}>
                                            🏪 {loja.filial || loja.name}
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-sm font-bold text-content-secondary">
                            <BuildingStorefrontIcon className="h-5 w-5 text-brand-600" />
                            <span>Pátio: <strong className="text-content-primary">{localAtual.nome}</strong></span>
                        </div>
                    )}

                    {/* Toggles de Som e Auto-foco */}
                    <div className="flex items-center gap-4 text-xs font-medium text-content-secondary">
                        <label className="flex cursor-pointer items-center gap-2 select-none">
                            <input
                                type="checkbox"
                                checked={somHabilitado}
                                onChange={(e) => setSomHabilitado(e.target.checked)}
                                className="rounded border-line text-brand-600 focus:ring-brand-500"
                            />
                            {somHabilitado ? (
                                <span className="flex items-center gap-1 text-status-success-fg">
                                    <SpeakerWaveIcon className="h-4 w-4" /> Som Ativado
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-content-muted">
                                    <SpeakerXMarkIcon className="h-4 w-4" /> Som Mudo
                                </span>
                            )}
                        </label>

                        <label className="flex cursor-pointer items-center gap-2 select-none" title="Mantém o cursor pronto para a próxima leitura automaticamente">
                            <input
                                type="checkbox"
                                checked={manterFoco}
                                onChange={(e) => setManterFoco(e.target.checked)}
                                className="rounded border-line text-brand-600 focus:ring-brand-500"
                            />
                            <span>Auto-foco contínuo</span>
                        </label>
                    </div>
                </div>

                {/* ---------- ESTATÍSTICAS E BARRA DE PROGRESSO EM TEMPO REAL ---------- */}
                <div data-tour="censo.kpis" className="space-y-4">
                    {/* Barra de Progresso Principal */}
                    <Card className="card-print p-4">
                        <div className="mb-2 flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black uppercase tracking-wider text-content-primary">
                                    Conferência do Pátio:
                                </span>
                                <span className="text-lg font-black tabular-nums text-content-primary">
                                    {totalConfirmadas} / {totalEsperadas} motos confirmadas
                                </span>
                            </div>
                            <div className="text-right">
                                <span
                                    className={`text-lg font-black tabular-nums ${
                                        percentualProgresso === 100
                                            ? 'text-status-success-fg'
                                            : percentualProgresso >= 75
                                            ? 'text-brand-600'
                                            : 'text-status-warning-fg'
                                    }`}
                                >
                                    {percentualProgresso}% concluído
                                </span>
                            </div>
                        </div>

                        {/* Barra Visual */}
                        <div className="h-3.5 w-full overflow-hidden rounded-full bg-surface-sunken ring-1 ring-line">
                            <div
                                className={`h-full transition-all duration-300 ease-out ${
                                    percentualProgresso === 100
                                        ? 'bg-status-success-solid'
                                        : percentualProgresso >= 50
                                        ? 'bg-brand-600'
                                        : 'bg-status-warning-solid'
                                }`}
                                style={{ width: `${percentualProgresso}%` }}
                            />
                        </div>
                    </Card>

                    {/* Cards de Métricas */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <StatCard
                            label="Esperadas no Pátio"
                            value={totalEsperadas}
                            icon={BuildingOffice2Icon}
                            tone="neutral"
                            hint="Estoque registrado no sistema"
                        />
                        <StatCard
                            label="Confirmadas (Presentes)"
                            value={totalConfirmadas}
                            icon={CheckCircleIcon}
                            tone="success"
                            hint="Bipadas fisicamente no pátio"
                        />
                        <StatCard
                            label="Faltantes / Pendentes"
                            value={totalPendentes}
                            icon={ExclamationCircleIcon}
                            tone={totalPendentes > 0 ? 'danger' : 'neutral'}
                            hint="Ainda não localizadas"
                        />
                        <StatCard
                            label="Intrusas / Fora de Lugar"
                            value={totalIntrusas}
                            icon={ExclamationTriangleIcon}
                            tone={totalIntrusas > 0 ? 'warning' : 'neutral'}
                            hint="De outra filial ou não cadastradas"
                        />
                    </div>
                </div>

                {/* ---------- CAMPO DE BIPAGEM CONTÍNUA (ERGONOMIA DE PÁTIO) ---------- */}
                <div data-tour="censo.bipagem" className="nao-imprimir">
                    <Card className="relative overflow-hidden border-2 border-brand-500/40 bg-surface-card shadow-md">
                        <form onSubmit={processarBip} className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label
                                    htmlFor="bipagem-input"
                                    className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-brand-700 dark:text-brand-400"
                                >
                                    <QrCodeIcon className="h-5 w-5 animate-pulse text-brand-600" />
                                    Leitor de Chassi / Bipagem Contínua
                                </label>
                                <span className="text-[11px] font-semibold text-content-muted">
                                    Aponte o leitor ou digite o chassi e pressione Enter
                                </span>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row">
                                <div className="relative flex-1">
                                    <input
                                        ref={inputRef}
                                        id="bipagem-input"
                                        type="text"
                                        autoFocus
                                        value={bipInput}
                                        onChange={(e) => setBipInput(e.target.value.toUpperCase())}
                                        onBlur={handleInputBlur}
                                        placeholder="Bipe o código de barras ou digite o chassi..."
                                        className="w-full rounded-xl border-2 border-line bg-surface-sunken px-4 py-3.5 font-mono text-lg font-black tracking-widest text-content-primary placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-content-muted focus:border-brand-600 focus:bg-surface-card focus:ring-4 focus:ring-brand-500/20"
                                    />
                                    {bipInput && (
                                        <button
                                            type="button"
                                            onClick={() => setBipInput('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-primary"
                                        >
                                            <XMarkIcon className="h-5 w-5" />
                                        </button>
                                    )}
                                </div>

                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    icon={SparklesIcon}
                                    className="justify-center px-6 py-3.5 text-base font-bold sm:w-auto"
                                >
                                    Bipar Chassi
                                </Button>
                            </div>
                        </form>

                        {/* Banner de Feedback em Tempo Real do Último Bip */}
                        {ultimoBip && (
                            <div
                                className={`mt-3 flex items-start gap-3 rounded-lg p-3 text-xs font-semibold animate-fade-in ${
                                    ultimoBip.tipo === 'sucesso'
                                        ? 'bg-status-success-bg text-status-success-fg ring-1 ring-status-success-solid/20'
                                        : ultimoBip.tipo === 'duplicado'
                                        ? 'bg-status-info-bg text-status-info-fg ring-1 ring-status-info-solid/20'
                                        : 'bg-status-warning-bg text-status-warning-fg ring-1 ring-status-warning-solid/30'
                                }`}
                            >
                                {ultimoBip.tipo === 'sucesso' ? (
                                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-status-success-fg" />
                                ) : ultimoBip.tipo === 'duplicado' ? (
                                    <InformationCircleIcon className="h-5 w-5 shrink-0 text-status-info-fg" />
                                ) : (
                                    <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-status-warning-fg" />
                                )}

                                <div className="flex-1">
                                    <div className="font-bold">{ultimoBip.mensagem}</div>
                                    <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] opacity-90">
                                        <span className="font-mono font-bold tracking-wider">Chassi: {ultimoBip.chassi}</span>
                                        {ultimoBip.modelo && <span>• Modelo: {ultimoBip.modelo}</span>}
                                        {ultimoBip.cor && <span>• Cor: {ultimoBip.cor}</span>}
                                        {ultimoBip.detalhe && (
                                            <span className="rounded bg-black/10 px-1 font-bold">{ultimoBip.detalhe}</span>
                                        )}
                                        <span>• Registrado às {ultimoBip.timestamp}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>

                {/* ---------- ABAS E TABELAS DINÂMICAS ---------- */}
                <div data-tour="censo.abas" className="space-y-4">
                    {/* Barra de Abas e Campo de Busca Rápida */}
                    <div className="nao-imprimir flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Tabs tabs={abas} active={abaAtiva} onChange={setAbaAtiva} className="flex-1" />

                        {/* Busca local dentro da aba ativa */}
                        <div className="relative w-full sm:w-64">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                            <input
                                type="text"
                                placeholder="Filtrar por chassi ou modelo..."
                                value={buscaFiltro}
                                onChange={(e) => setBuscaFiltro(e.target.value)}
                                className="w-full rounded-lg border-line bg-surface-card pl-9 pr-3 py-1.5 text-xs text-content-primary focus:border-brand-500 focus:ring-brand-500"
                            />
                            {buscaFiltro && (
                                <button
                                    onClick={() => setBuscaFiltro('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-primary"
                                >
                                    <XMarkIcon className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ---------- CONTEÚDO DA ABA: 🟢 CONFIRMADAS NO PÁTIO ---------- */}
                    {abaAtiva === 'confirmadas' && (
                        <div className="space-y-3">
                            {confirmadasFiltradas.length > 0 ? (
                                <div className="overflow-x-auto rounded-card bg-surface-card shadow-card ring-1 ring-line">
                                    <table className="w-full text-left text-sm">
                                        <thead className="border-b border-line bg-surface-sunken text-xs font-bold uppercase text-content-secondary">
                                            <tr>
                                                <th className="px-4 py-3">Chassi</th>
                                                <th className="px-4 py-3">Modelo</th>
                                                <th className="px-4 py-3">Cor</th>
                                                <th className="px-4 py-3">Status Sistema</th>
                                                <th className="px-4 py-3">Hora da Bipagem</th>
                                                <th className="px-4 py-3 text-right nao-imprimir">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line font-medium text-content-primary">
                                            {confirmadasFiltradas.map((item) => (
                                                <tr key={item.chassi} className="hover:bg-surface-sunken/60">
                                                    <td className="px-4 py-3 font-mono font-bold tracking-wider text-brand-700 dark:text-brand-400">
                                                        {item.chassi}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold">{item.modelo}</td>
                                                    <td className="px-4 py-3 text-content-secondary">{item.cor}</td>
                                                    <td className="px-4 py-3">
                                                        <StatusBadge status={item.statusOriginal || 'disponivel'} size="sm" />
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-content-muted">
                                                        {item.bipadaEm}
                                                    </td>
                                                    <td className="px-4 py-3 text-right nao-imprimir">
                                                        <Button
                                                            size="xs"
                                                            variant="secondary"
                                                            onClick={() => handleDesfazerConfirmacao(item.chassi)}
                                                            title="Desfazer bipagem deste chassi"
                                                            className="text-content-muted hover:text-status-danger-fg"
                                                        >
                                                            Desfazer
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <EmptyState
                                    icon={CheckCircleIcon}
                                    title="Nenhuma moto confirmada ainda"
                                    description={
                                        buscaFiltro
                                            ? 'Nenhum resultado para o filtro informado.'
                                            : 'Utilize o leitor de código de barras ou digite o chassi no campo de bipagem para iniciar a conferência.'
                                    }
                                />
                            )}
                        </div>
                    )}

                    {/* ---------- CONTEÚDO DA ABA: 🔴 FALTANTES / PENDENTES ---------- */}
                    {abaAtiva === 'pendentes' && (
                        <div className="space-y-3">
                            {pendentes.length > 0 && (
                                <Alert tone="warning" title="Motos pendentes de localização no pátio">
                                    As motos abaixo constam registradas no sistema para este pátio, mas ainda não foram encontradas ou bipadas fisicamente nesta sessão.
                                </Alert>
                            )}

                            {pendentesFiltradas.length > 0 ? (
                                <div className="overflow-x-auto rounded-card bg-surface-card shadow-card ring-1 ring-line">
                                    <table className="w-full text-left text-sm">
                                        <thead className="border-b border-line bg-surface-sunken text-xs font-bold uppercase text-content-secondary">
                                            <tr>
                                                <th className="px-4 py-3">Chassi</th>
                                                <th className="px-4 py-3">Modelo</th>
                                                <th className="px-4 py-3">Cor</th>
                                                <th className="px-4 py-3">Status Atual</th>
                                                <th className="px-4 py-3">Localização Registrada</th>
                                                <th className="px-4 py-3 text-right nao-imprimir">Conferência</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line font-medium text-content-primary">
                                            {pendentesFiltradas.map((moto) => (
                                                <tr key={moto.chassi} className="hover:bg-surface-sunken/60">
                                                    <td className="px-4 py-3 font-mono font-bold tracking-wider">
                                                        {moto.chassi}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold">{moto.modelo}</td>
                                                    <td className="px-4 py-3 text-content-secondary">{moto.cor}</td>
                                                    <td className="px-4 py-3">
                                                        <StatusBadge status={moto.status} size="sm" />
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-content-muted">
                                                        {moto.localizacao_atual || 'Não informada'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right nao-imprimir">
                                                        <Button
                                                            size="xs"
                                                            variant="secondary"
                                                            icon={CheckIcon}
                                                            onClick={() => handleConfirmarManual(moto)}
                                                            title="Confirmar manualmente caso a etiqueta esteja ilegível"
                                                        >
                                                            Confirmar Manual
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <EmptyState
                                    icon={CheckCircleIcon}
                                    title={
                                        buscaFiltro
                                            ? 'Nenhuma moto encontrada com este filtro'
                                            : 'Parabéns! Pátio 100% conferido!'
                                    }
                                    description={
                                        buscaFiltro
                                            ? 'Tente buscar por outro chassi ou modelo.'
                                            : 'Todas as motos esperadas para este pátio foram encontradas e confirmadas.'
                                    }
                                />
                            )}
                        </div>
                    )}

                    {/* ---------- CONTEÚDO DA ABA: 🟡 INTRUSAS / FORA DE LUGAR ---------- */}
                    {abaAtiva === 'intrusas' && (
                        <div className="space-y-3">
                            {intrusas.length > 0 && (
                                <Alert tone="danger" title="Divergência de Pátio Detectada">
                                    As motos abaixo foram fisicamente bipadas neste pátio, porém o cadastro do sistema indica que pertencem a outra loja ou não constam na base.
                                </Alert>
                            )}

                            {intrusasFiltradas.length > 0 ? (
                                <div className="overflow-x-auto rounded-card bg-surface-card shadow-card ring-1 ring-line">
                                    <table className="w-full text-left text-sm">
                                        <thead className="border-b border-line bg-surface-sunken text-xs font-bold uppercase text-content-secondary">
                                            <tr>
                                                <th className="px-4 py-3">Chassi</th>
                                                <th className="px-4 py-3">Modelo</th>
                                                <th className="px-4 py-3">Cor</th>
                                                <th className="px-4 py-3">Destino Correto no Sistema</th>
                                                <th className="px-4 py-3">Tipo de Divergência</th>
                                                <th className="px-4 py-3">Hora do Bip</th>
                                                <th className="px-4 py-3 text-right nao-imprimir">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-line font-medium text-content-primary">
                                            {intrusasFiltradas.map((item) => (
                                                <tr key={item.chassi} className="bg-status-warning-bg/10 hover:bg-status-warning-bg/30">
                                                    <td className="px-4 py-3 font-mono font-bold tracking-wider text-status-warning-fg">
                                                        {item.chassi}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold">{item.modelo}</td>
                                                    <td className="px-4 py-3 text-content-secondary">{item.cor}</td>
                                                    <td className="px-4 py-3 font-bold text-content-primary">
                                                        <span className="inline-flex items-center gap-1 rounded bg-surface-sunken px-2 py-0.5 text-xs ring-1 ring-line">
                                                            <BuildingStorefrontIcon className="h-3 w-3 text-brand-600" />
                                                            {item.lojaNome}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {item.tipoDivergencia === 'outra_loja' ? (
                                                            <span className="inline-flex items-center rounded-full bg-status-warning-bg px-2 py-0.5 text-[11px] font-bold text-status-warning-fg ring-1 ring-inset ring-status-warning-solid/30">
                                                                Pertence a outra filial
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center rounded-full bg-status-danger-bg px-2 py-0.5 text-[11px] font-bold text-status-danger-fg ring-1 ring-inset ring-status-danger-solid/30">
                                                                Não cadastrada no sistema
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-content-muted">
                                                        {item.bipadaEm}
                                                    </td>
                                                    <td className="px-4 py-3 text-right nao-imprimir">
                                                        <Button
                                                            size="xs"
                                                            variant="secondary"
                                                            icon={TrashIcon}
                                                            onClick={() => handleRemoverIntrusa(item.chassi)}
                                                            title="Remover este registro de divergência"
                                                            className="text-status-danger-fg hover:bg-status-danger-bg"
                                                        >
                                                            Remover
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <EmptyState
                                    icon={CheckCircleIcon}
                                    title="Nenhuma moto intrusa detectada"
                                    description={
                                        buscaFiltro
                                            ? 'Nenhum resultado para o filtro informado.'
                                            : 'Todas as motos bipadas até agora pertencem legitimamente a este pátio.'
                                    }
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* ---------- BLOCO DE ASSINATURAS (PRINT EXCLUSIVO) ---------- */}
                <div className="imprimir-apenas mt-12 pt-8">
                    <div className="grid grid-cols-2 gap-12 text-center text-xs">
                        <div className="border-t border-black pt-2">
                            <p className="font-bold">{auth.user.name}</p>
                            <p className="text-gray-600">Auditor de Estoque / Pátio</p>
                        </div>
                        <div className="border-t border-black pt-2">
                            <p className="font-bold">Gerente da Filial / Coordenador Logístico</p>
                            <p className="text-gray-600">{localAtual.nome}</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
