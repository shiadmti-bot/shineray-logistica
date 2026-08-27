import { useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import Swal from 'sweetalert2';
import {
    ArrowLeftIcon,
    PrinterIcon,
    TruckIcon,
    TrashIcon,
    MapPinIcon,
    CubeIcon,
    WrenchScrewdriverIcon,
    ExclamationTriangleIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';

import AppLayout from '@/Layouts/AppLayout';
import { Card, PageHeader, StatCard, Button, StatusBadge, EmptyState } from '@/Components/UI';

/**
 * Detalhe da carga e manifesto de impressão.
 *
 * CARGA MISTA (v3)
 * Esta tela lia apenas `romaneio.motos`. Com peças no mesmo caminhão isso
 * significava um manifesto que o motorista assina sem que as caixas apareçam
 * nele, e uma loja sem contra o que conferir no recebimento. Agora motos e
 * peças são agrupadas pelo MESMO destino e aparecem juntas — na tela e no
 * papel.
 *
 * DOIS DOCUMENTOS NO MESMO ARQUIVO
 * O bloco `print:hidden` é a tela; o `hidden print:block` é o manifesto
 * oficial. São layouts diferentes de propósito: a tela prioriza ação (coletar,
 * liberar saída) e o papel prioriza conferência (numeração sequencial, campo
 * de assinatura, sem cor de fundo).
 */
export default function RomaneioShow({ auth, romaneio, pecas = [] }) {
    /*
     * O manual pede três documentos e não um: romaneio de peças, de motos e da
     * carga. Os dados já estavam todos aqui, misturados num manifesto só —
     * o modo apenas escolhe o que sai na impressão.
     *
     * 'carga' é o padrão porque é o documento do motorista, o mais impresso.
     */
    const [modoImpressao, setModoImpressao] = useState('carga');
    /* ---------- Milk run: motos a coletar no caminho ---------- */
    const itensParaColetar = useMemo(
        () => (romaneio.motos || []).filter((m) => m.status === 'aguardando_coleta'),
        [romaneio]
    );

    /**
     * Agrupamento por destino final.
     *
     * Motos e peças entram no MESMO grupo. A chave é o nome do destino em
     * maiúsculas — o backend normaliza o destino da peça pela filial do
     * solicitante justamente para bater com a da moto, senão a mesma loja
     * apareceria em dois blocos.
     */
    const destinos = useMemo(() => {
        const grupos = {};

        const grupo = (nome) => {
            const chave = (nome || 'DESTINO NÃO IDENTIFICADO').toUpperCase().trim();
            if (!grupos[chave]) grupos[chave] = { nome: chave, motos: [], pecas: [] };
            return grupos[chave];
        };

        (romaneio.motos || []).forEach((moto) => {
            let destino = '⚠️ DESTINO NÃO IDENTIFICADO';
            let pedidoAtivo = null;

            if (moto.pedidos && moto.pedidos.length > 0) {
                pedidoAtivo = moto.pedidos[0];
                // Prioridade: destino real escolhido no pedido > filial do solicitante.
                const pivotDestino = pedidoAtivo.pivot?.destino;
                if (pivotDestino && pivotDestino.trim() !== '') {
                    destino = pivotDestino;
                } else if (pedidoAtivo.user) {
                    destino = pedidoAtivo.user.filial || pedidoAtivo.user.name;
                }
            } else if (moto.localizacao_atual) {
                destino = 'TRANSBORDO / INDEFINIDO';
            }

            moto._pedido_info = pedidoAtivo;
            grupo(destino).motos.push(moto);
        });

        (pecas || []).forEach((peca) => grupo(peca.destino).pecas.push(peca));

        return Object.keys(grupos)
            .sort()
            .map((chave) => grupos[chave]);
    }, [romaneio, pecas]);

    /* ---------- Totais ---------- */
    const totalMotos = romaneio.motos?.length ?? 0;
    const totalPecasItens = pecas.length;
    const totalPecasUn = useMemo(
        () => pecas.reduce((soma, p) => soma + (p.quantidade || 0), 0),
        [pecas]
    );
    const totalColetasPendentes = itensParaColetar.length;
    const cargaVazia = totalMotos === 0 && totalPecasItens === 0;

    const rotaCalculada = useMemo(() => {
        if (romaneio.rota) return romaneio.rota;
        return destinos.length > 0 ? destinos.map((d) => d.nome).join(' ➔ ') : 'AGUARDANDO ROTA';
    }, [romaneio.rota, destinos]);

    // Passo 2 conta peças também — uma carga só de peças estava travada no passo 1.
    const passoAtual = useMemo(() => {
        if (romaneio.status === 'concluido') return 4;
        if (['em_transito', 'em_transito_cd'].includes(romaneio.status)) return 3;
        if (!cargaVazia && romaneio.status === 'aberto') return 2;
        return 1;
    }, [romaneio.status, cargaVazia]);

    /* ---------- Ações ---------- */
    const handleColeta = (motoId) => {
        router.post(
            route('romaneios.coletar_item', motoId),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    try {
                        new Audio('/plim.mp3').play().catch(() => {});
                    } catch (e) {
                        /* som é opcional */
                    }
                    Swal.fire({
                        title: 'Coletado!',
                        text: 'Item confirmado a bordo.',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end',
                    });
                },
            }
        );
    };

    const handleSaida = () => {
        const volumes = [
            totalMotos > 0 ? `${totalMotos} moto(s)` : null,
            totalPecasUn > 0 ? `${totalPecasUn} un. de peça` : null,
        ]
            .filter(Boolean)
            .join(' e ');

        Swal.fire({
            title: 'Liberar Saída?',
            text:
                totalColetasPendentes > 0
                    ? `Atenção: existem ${totalColetasPendentes} itens pendentes de coleta (Milk Run). Confirma a saída?`
                    : `Confirma a saída física do caminhão com ${volumes || 'a carga atual'}?`,
            icon: totalColetasPendentes > 0 ? 'warning' : 'question',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'Sim, liberar',
            cancelButtonText: 'Cancelar',
        }).then((r) => {
            if (r.isConfirmed) router.post(route('romaneios.saida', romaneio.id));
        });
    };

    const handleDelete = () => {
        Swal.fire({
            title: 'Desfazer carga?',
            text: 'O romaneio será excluído e os itens voltam a ficar disponíveis para montagem.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            confirmButtonText: 'Sim, desfazer',
            cancelButtonText: 'Cancelar',
        }).then((r) => {
            if (r.isConfirmed) router.delete(route('romaneios.destroy', romaneio.id));
        });
    };

    // Cores de pintura da moto — hex literal de propósito: representam a cor
    // física do produto, não um token do tema.
    const corDaMoto = (cor) => {
        if (!cor) return '#cccccc';
        const mapa = {
            VERMELHO: '#ef4444',
            AZUL: '#3b82f6',
            PRETO: '#1f2937',
            BRANCO: '#ffffff',
            PRATA: '#9ca3af',
            CINZA: '#6b7280',
            AMARELO: '#eab308',
        };
        return mapa[cor.toUpperCase()] || '#e5e7eb';
    };

    const numero = String(romaneio.id).padStart(6, '0');
    const podeDesfazer = !['concluido', 'em_transito', 'em_transito_cd'].includes(romaneio.status);

    return (
        <AppLayout user={auth.user}>
            <Head title={`Romaneio #${numero}`} />

            {/* ================= TELA ================= */}
            <div className="print:hidden">
                <PageHeader
                    title={`Romaneio #${numero}`}
                    description={`Aberto em ${new Date(romaneio.created_at).toLocaleDateString('pt-BR')} · ${rotaCalculada}`}
                    breadcrumbs={[
                        { label: 'Logística' },
                        { label: 'Expedição', href: route('romaneios.index') },
                        { label: `#${numero}` },
                    ]}
                    actions={
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="ghost" icon={ArrowLeftIcon} href={route('romaneios.index')}>
                                Voltar
                            </Button>
                            {/* Três documentos, não um: o manual pede romaneio de
                                peças, de motos e da carga. O modo decide o que o
                                bloco de impressão renderiza. */}
                            <select
                                value={modoImpressao}
                                onChange={(e) => setModoImpressao(e.target.value)}
                                className="rounded border-line-strong bg-surface-card py-2 text-xs font-bold text-content-secondary focus:ring-brand-500"
                                aria-label="O que imprimir"
                            >
                                <option value="carga">Carga completa</option>
                                <option value="motos">Só motos</option>
                                <option value="pecas">Só peças</option>
                            </select>
                            <Button variant="secondary" icon={PrinterIcon} onClick={() => window.print()}>
                                Imprimir
                            </Button>
                            {romaneio.status === 'aberto' && (
                                <Button icon={TruckIcon} onClick={handleSaida}>
                                    Liberar Saída
                                </Button>
                            )}
                            {podeDesfazer && (
                                <Button variant="ghost" icon={TrashIcon} onClick={handleDelete}>
                                    Desfazer
                                </Button>
                            )}
                        </div>
                    }
                />

                <div className="space-y-6">
                    {/* --- Progresso --- */}
                    <Card>
                        <Stepper passoAtual={passoAtual} />
                    </Card>

                    {/* --- Resumo da carga --- */}
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <StatCard label="Motos" value={totalMotos} icon={CubeIcon} tone="info" />
                        <StatCard
                            label="Peças"
                            value={totalPecasUn}
                            icon={WrenchScrewdriverIcon}
                            tone="brand"
                            hint={totalPecasItens > 0 ? `${totalPecasItens} item(ns)` : 'nenhuma nesta carga'}
                        />
                        <StatCard label="Destinos" value={destinos.length} icon={MapPinIcon} tone="neutral" />
                        <StatCard
                            label="A coletar"
                            value={totalColetasPendentes}
                            icon={ExclamationTriangleIcon}
                            tone={totalColetasPendentes > 0 ? 'warning' : 'success'}
                            hint={totalColetasPendentes > 0 ? 'bipar na loja de origem' : 'tudo a bordo'}
                        />
                    </div>

                    {/* --- Motorista --- */}
                    <Card padding="none">
                        <div className="flex flex-col gap-4 border-l-4 border-brand-600 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                            <div className="flex items-center gap-4">
                                <span className="rounded-full bg-brand-50 p-3 text-brand-700">
                                    <TruckIcon className="h-6 w-6" />
                                </span>
                                <div className="min-w-0">
                                    <h2 className="text-lg font-bold text-content-primary">
                                        {romaneio.motorista}
                                    </h2>
                                    <p className="mt-0.5 text-sm text-content-secondary">
                                        Placa{' '}
                                        <span className="rounded border border-line bg-surface-sunken px-2 py-0.5 font-mono font-bold uppercase text-content-primary">
                                            {romaneio.placa}
                                        </span>
                                        {romaneio.transportadora && (
                                            <span className="ml-2 text-content-muted">
                                                · {romaneio.transportadora}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <StatusBadge status={romaneio.status} />
                        </div>
                    </Card>

                    {/* --- Milk run --- */}
                    {itensParaColetar.length > 0 && (
                        <Card padding="none" className="ring-2 ring-status-warning-solid/30">
                            <div className="flex items-center gap-3 border-b border-line bg-status-warning-bg px-5 py-4 sm:px-6">
                                <span className="rounded-full bg-surface-card p-2 text-status-warning-fg">
                                    <ExclamationTriangleIcon className="h-5 w-5" />
                                </span>
                                <div>
                                    <h2 className="text-sm font-black uppercase tracking-wide text-status-warning-fg">
                                        Pendências de coleta
                                    </h2>
                                    <p className="text-xs font-medium text-status-warning-fg/80">
                                        Bipar estes itens na loja de origem antes de liberar a saída.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
                                {itensParaColetar.map((moto) => (
                                    <div
                                        key={moto.id}
                                        className="flex flex-col justify-between rounded-xl bg-surface-sunken p-4 ring-1 ring-line"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-base font-bold text-content-primary">
                                                {moto.modelo}
                                            </p>
                                            <p className="my-2 inline-block rounded border border-line bg-surface-card px-2 py-1 font-mono text-[11px] text-content-secondary">
                                                {moto.chassi}
                                            </p>
                                            <p className="text-xs text-content-muted">
                                                Retirar em{' '}
                                                <span className="font-bold uppercase text-content-secondary">
                                                    {moto._pedido_info?.origem?.filial || 'CD'}
                                                </span>
                                            </p>
                                        </div>

                                        <Button
                                            variant="primary"
                                            size="sm"
                                            icon={CheckIcon}
                                            className="mt-4 w-full"
                                            onClick={() => handleColeta(moto.id)}
                                        >
                                            Confirmar coleta
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* --- Carga por destino --- */}
                    <div className="space-y-5">
                        <h2 className="px-1 text-base font-bold text-content-primary">Carga a bordo</h2>

                        {cargaVazia && (
                            <Card>
                                <EmptyState
                                    icon={CubeIcon}
                                    title="Carga vazia"
                                    description="Nenhuma moto ou peça foi vinculada a este romaneio."
                                    action={
                                        <Button href={route('romaneios.create')} icon={CubeIcon}>
                                            Montar carga
                                        </Button>
                                    }
                                />
                            </Card>
                        )}

                        {destinos.map((destino) => {
                            const motosABordo = destino.motos.filter(
                                (m) => m.status !== 'aguardando_coleta'
                            );

                            // O bloco some se tudo deste destino ainda está para coletar.
                            if (motosABordo.length === 0 && destino.pecas.length === 0) return null;

                            const unidadesPeca = destino.pecas.reduce(
                                (s, p) => s + (p.quantidade || 0),
                                0
                            );

                            return (
                                <Card key={destino.nome} padding="none">
                                    {/* Cabeçalho do destino */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-sunken px-5 py-4 sm:px-6">
                                        <div className="flex items-center gap-3">
                                            <span className="rounded-full bg-surface-card p-2 text-status-success-fg ring-1 ring-line">
                                                <MapPinIcon className="h-5 w-5" />
                                            </span>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-content-muted">
                                                    Destino final
                                                </p>
                                                <h3 className="text-lg font-black leading-tight text-content-primary">
                                                    {destino.nome}
                                                </h3>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {motosABordo.length > 0 && (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-info-bg px-3 py-1 text-xs font-bold text-status-info-fg ring-1 ring-inset ring-status-info-solid/20">
                                                    <CubeIcon className="h-3.5 w-3.5" />
                                                    {motosABordo.length} moto(s)
                                                </span>
                                            )}
                                            {unidadesPeca > 0 && (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 ring-1 ring-inset ring-brand-600/20">
                                                    <WrenchScrewdriverIcon className="h-3.5 w-3.5" />
                                                    {unidadesPeca} un. de peça
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Motos */}
                                    {motosABordo.length > 0 && (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-line">
                                                <thead>
                                                    <tr>
                                                        {['Modelo', 'Cor', 'Chassi'].map((h) => (
                                                            <th
                                                                key={h}
                                                                className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-wide text-content-muted sm:px-6"
                                                            >
                                                                {h}
                                                            </th>
                                                        ))}
                                                        <th className="px-5 py-3 text-center text-[11px] font-black uppercase tracking-wide text-content-muted sm:px-6">
                                                            Pedido
                                                        </th>
                                                        <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-wide text-content-muted sm:px-6">
                                                            Origem
                                                        </th>
                                                    </tr>
                                                </thead>

                                                <tbody className="divide-y divide-line">
                                                    {motosABordo.map((moto) => (
                                                        <tr key={moto.id} className="hover:bg-surface-sunken">
                                                            <td className="px-5 py-3 text-sm font-bold text-content-primary sm:px-6">
                                                                {moto.modelo}
                                                            </td>
                                                            <td className="px-5 py-3 sm:px-6">
                                                                <span className="flex items-center gap-2">
                                                                    <span
                                                                        className="h-3 w-3 rounded-full ring-1 ring-line-strong"
                                                                        style={{
                                                                            backgroundColor: corDaMoto(moto.cor),
                                                                        }}
                                                                    />
                                                                    <span className="text-xs font-bold uppercase text-content-secondary">
                                                                        {moto.cor}
                                                                    </span>
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-3 font-mono text-sm text-content-secondary sm:px-6">
                                                                {moto.chassi}
                                                            </td>
                                                            <td className="px-5 py-3 text-center sm:px-6">
                                                                {moto._pedido_info?.id ? (
                                                                    <Link
                                                                        href={route(
                                                                            'pedidos.show',
                                                                            moto._pedido_info.id
                                                                        )}
                                                                        className="inline-flex items-center rounded-lg bg-status-info-bg px-2.5 py-1 text-[11px] font-bold text-status-info-fg ring-1 ring-inset ring-status-info-solid/20 transition hover:brightness-95"
                                                                    >
                                                                        #{moto._pedido_info.id}
                                                                    </Link>
                                                                ) : (
                                                                    <span className="text-xs text-content-muted">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-3 text-right sm:px-6">
                                                                <OrigemTag
                                                                    transferencia={
                                                                        !!moto._pedido_info?.origem_user_id
                                                                    }
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Peças */}
                                    {destino.pecas.length > 0 && (
                                        <div className="overflow-x-auto border-t border-line">
                                            <div className="flex items-center gap-2 bg-surface-sunken/60 px-5 py-2 sm:px-6">
                                                <WrenchScrewdriverIcon className="h-4 w-4 text-content-muted" />
                                                <span className="text-[11px] font-black uppercase tracking-widest text-content-muted">
                                                    Peças
                                                </span>
                                            </div>

                                            <table className="min-w-full divide-y divide-line">
                                                <thead>
                                                    <tr>
                                                        <th className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-wide text-content-muted sm:px-6">
                                                            Código
                                                        </th>
                                                        <th className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-wide text-content-muted sm:px-6">
                                                            Descrição
                                                        </th>
                                                        <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-wide text-content-muted sm:px-6">
                                                            Qtd
                                                        </th>
                                                        <th className="px-5 py-3 text-center text-[11px] font-black uppercase tracking-wide text-content-muted sm:px-6">
                                                            Pedido
                                                        </th>
                                                        <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-wide text-content-muted sm:px-6">
                                                            Situação
                                                        </th>
                                                    </tr>
                                                </thead>

                                                <tbody className="divide-y divide-line">
                                                    {destino.pecas.map((peca) => (
                                                        <tr key={peca.id} className="hover:bg-surface-sunken">
                                                            <td className="px-5 py-3 font-mono text-sm font-bold text-content-primary sm:px-6">
                                                                {peca.codigo}
                                                            </td>
                                                            <td className="max-w-md px-5 py-3 sm:px-6">
                                                                <p className="truncate text-sm text-content-secondary">
                                                                    {peca.descricao}
                                                                </p>
                                                                {peca.marca && (
                                                                    <p className="text-[10px] uppercase text-content-muted">
                                                                        {peca.marca}
                                                                    </p>
                                                                )}
                                                            </td>
                                                            <td className="whitespace-nowrap px-5 py-3 text-right text-sm font-black tabular-nums text-content-primary sm:px-6">
                                                                {peca.quantidade}
                                                                <span className="ml-1 text-[10px] font-normal uppercase text-content-muted">
                                                                    {peca.unidade}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-3 text-center sm:px-6">
                                                                {peca.pedido_id ? (
                                                                    <Link
                                                                        href={route('pedidos.show', peca.pedido_id)}
                                                                        className="inline-flex items-center rounded-lg bg-status-info-bg px-2.5 py-1 text-[11px] font-bold text-status-info-fg ring-1 ring-inset ring-status-info-solid/20 transition hover:brightness-95"
                                                                    >
                                                                        #{peca.pedido_id}
                                                                    </Link>
                                                                ) : (
                                                                    <span className="text-xs text-content-muted">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-3 text-right sm:px-6">
                                                                <StatusBadge status={peca.status} size="sm" />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ================= MANIFESTO (IMPRESSÃO) ================= */}
            <div className="hidden bg-white font-sans text-black print:fixed print:inset-0 print:z-[9999] print:block print:h-full print:w-full print:bg-white print:p-0">
                {/* Cabeçalho */}
                <div className="mb-6 flex items-end justify-between border-b-2 border-black px-8 pb-4 pt-8">
                    <div>
                        <h1 className="text-4xl font-black uppercase leading-none tracking-tighter">
                            Manifesto de Carga
                        </h1>
                        <p className="mt-1 text-sm font-bold uppercase tracking-widest">
                            Shineray Norte — Logística Integrada
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] font-bold uppercase">Romaneio Digital</div>
                        <div className="font-mono text-5xl font-bold leading-none tracking-tight">
                            #{numero}
                        </div>
                        <div className="mt-1 text-[10px] font-bold">
                            {new Date().toLocaleString('pt-BR')}
                        </div>
                    </div>
                </div>

                {/* Dados do transporte. A carga é descrita em duas grandezas
                    porque moto se conta por volume e peça por unidade — somar
                    as duas num número só esconde o que está no caminhão. */}
                <div className="mx-8 mb-8 grid grid-cols-5 divide-x divide-black border border-black text-xs">
                    <div className="p-3">
                        <span className="mb-1 block text-[9px] font-bold uppercase">Motorista</span>
                        <span className="block text-sm font-bold uppercase">{romaneio.motorista}</span>
                    </div>
                    <div className="p-3">
                        <span className="mb-1 block text-[9px] font-bold uppercase">Placa</span>
                        <span className="block font-mono text-sm font-bold uppercase">{romaneio.placa}</span>
                    </div>
                    <div className="p-3">
                        <span className="mb-1 block text-[9px] font-bold uppercase">Rota prevista</span>
                        <span className="block text-sm font-bold uppercase">{rotaCalculada}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-3">
                        <span className="block text-[9px] font-bold uppercase">Motos</span>
                        <span className="block text-xl font-black">{totalMotos}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-3">
                        <span className="block text-[9px] font-bold uppercase">Un. de peça</span>
                        <span className="block text-xl font-black">{totalPecasUn}</span>
                    </div>
                </div>

                {/* Blocos por destino */}
                <div className="mx-8">
                    {destinos.map((destino) => {
                        const unidadesPeca = destino.pecas.reduce((s, p) => s + (p.quantidade || 0), 0);

                        return (
                            <div
                                key={destino.nome}
                                className="page-break-inside-avoid mb-8 break-inside-avoid overflow-hidden rounded-sm border border-black"
                            >
                                <div className="flex items-center justify-between bg-black px-4 py-2 text-sm font-bold uppercase text-white print:bg-black print:text-white">
                                    <span>📍 DESTINO: {destino.nome}</span>
                                    <span className="flex gap-2">
                                        {destino.motos.length > 0 && (
                                            <span className="rounded bg-white px-2 py-0.5 text-xs font-black text-black">
                                                {destino.motos.length} VOLS
                                            </span>
                                        )}
                                        {unidadesPeca > 0 && (
                                            <span className="rounded bg-white px-2 py-0.5 text-xs font-black text-black">
                                                {unidadesPeca} UN PEÇA
                                            </span>
                                        )}
                                    </span>
                                </div>

                                {/* Motos */}
                                {modoImpressao !== 'pecas' && destino.motos.length > 0 && (
                                    <table className="w-full border-collapse text-[10px]">
                                        <thead className="border-b border-black font-bold">
                                            <tr>
                                                <th className="w-10 border-r border-black p-2 text-center">#</th>
                                                <th className="border-r border-black p-2 text-left">
                                                    MODELO
                                                </th>
                                                <th className="w-32 border-r border-black p-2 text-left">
                                                    CHASSI
                                                </th>
                                                <th className="w-20 border-r border-black p-2 text-center">
                                                    COR
                                                </th>
                                                <th className="w-24 border-r border-black p-2 text-center">
                                                    ORIGEM
                                                </th>
                                                <th className="w-32 p-2 text-center">CONFERÊNCIA</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {destino.motos.map((moto, i) => (
                                                <tr key={moto.id} className="border-b border-black/30 last:border-0">
                                                    <td className="border-r border-black p-2 text-center font-bold">
                                                        {i + 1}
                                                    </td>
                                                    <td className="border-r border-black p-2 font-bold">
                                                        {moto.modelo}
                                                    </td>
                                                    <td className="border-r border-black p-2 font-mono text-xs">
                                                        {moto.chassi}
                                                    </td>
                                                    <td className="border-r border-black p-2 text-center text-[9px] uppercase">
                                                        {moto.cor}
                                                    </td>
                                                    <td className="border-r border-black p-2 text-center font-bold">
                                                        {moto.status === 'aguardando_coleta'
                                                            ? '⚠️ COLETAR'
                                                            : moto._pedido_info?.origem_user_id
                                                              ? 'TRANSF.'
                                                              : 'CD'}
                                                    </td>
                                                    <td className="p-2 text-center">________________</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}

                                {/* Peças — tabela própria porque as colunas não são
                                    as mesmas da moto (código e quantidade no lugar
                                    de chassi e cor). */}
                                {modoImpressao !== 'motos' && destino.pecas.length > 0 && (
                                    <table className="w-full border-collapse border-t border-black text-[10px]">
                                        <thead className="border-b border-black font-bold">
                                            <tr>
                                                <th
                                                    colSpan={5}
                                                    className="border-b border-black p-1.5 text-left text-[9px] uppercase tracking-widest"
                                                >
                                                    Peças / Componentes
                                                </th>
                                            </tr>
                                            <tr>
                                                <th className="w-10 border-r border-black p-2 text-center">#</th>
                                                <th className="w-28 border-r border-black p-2 text-left">
                                                    CÓDIGO
                                                </th>
                                                <th className="border-r border-black p-2 text-left">
                                                    DESCRIÇÃO
                                                </th>
                                                <th className="w-16 border-r border-black p-2 text-center">
                                                    QTD
                                                </th>
                                                <th className="w-32 p-2 text-center">CONFERÊNCIA</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {destino.pecas.map((peca, i) => (
                                                <tr key={peca.id} className="border-b border-black/30 last:border-0">
                                                    <td className="border-r border-black p-2 text-center font-bold">
                                                        {i + 1}
                                                    </td>
                                                    <td className="border-r border-black p-2 font-mono font-bold">
                                                        {peca.codigo}
                                                    </td>
                                                    <td className="border-r border-black p-2">
                                                        {peca.descricao}
                                                    </td>
                                                    <td className="border-r border-black p-2 text-center font-black">
                                                        {peca.quantidade}
                                                    </td>
                                                    <td className="p-2 text-center">________________</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}

                                {destino.motos.some((m) => m.status === 'aguardando_coleta') && (
                                    <div className="border-t border-black p-2 text-center text-[10px] font-bold uppercase">
                                        ⚠️ Atenção motorista: este destino possui itens que devem ser
                                        coletados no caminho.
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Assinaturas */}
                <div className="page-break-inside-avoid mx-8 mt-12 break-inside-avoid border-t-2 border-black pt-4">
                    <p className="mb-16 text-justify text-[10px] font-medium uppercase italic leading-relaxed">
                        Declaro ter recebido os volumes e as unidades constantes neste manifesto em
                        perfeito estado de conservação e funcionamento, conferindo chassis, cores,
                        códigos e quantidades no ato da entrega. Avarias ou divergências não
                        reportadas no ato do recebimento não serão aceitas posteriormente.
                    </p>

                    <div className="grid grid-cols-3 gap-16 text-center">
                        {[
                            ['Expedição CD', 'Conferente / Responsável'],
                            ['Motorista', 'Transportadora'],
                            ['Recebedor (Loja)', 'Carimbo e Assinatura'],
                        ].map(([titulo, sub]) => (
                            <div key={titulo}>
                                <div className="mb-2 border-t border-black" />
                                <p className="text-[10px] font-bold uppercase">{titulo}</p>
                                <p className="text-[8px]">{sub}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

/** Marca se o item veio do CD ou de uma transferência entre lojas. */
function OrigemTag({ transferencia }) {
    return transferencia ? (
        <span className="inline-flex rounded bg-status-warning-bg px-2 py-1 text-[10px] font-bold text-status-warning-fg ring-1 ring-inset ring-status-warning-solid/20">
            TRANSF.
        </span>
    ) : (
        <span className="inline-flex rounded bg-status-info-bg px-2 py-1 text-[10px] font-bold text-status-info-fg ring-1 ring-inset ring-status-info-solid/20">
            CD
        </span>
    );
}

/** Régua de progresso da carga. */
function Stepper({ passoAtual }) {
    const passos = [
        { id: 1, label: 'Abertura' },
        { id: 2, label: 'Carregamento' },
        { id: 3, label: 'Trânsito' },
        { id: 4, label: 'Concluído' },
    ];

    const progresso = ((passoAtual - 1) / (passos.length - 1)) * 100;

    return (
        <div className="relative mx-auto flex w-full max-w-3xl items-center justify-between">
            <div className="absolute left-0 top-1/2 -z-10 h-1 w-full rounded bg-surface-sunken" />
            <div
                className="absolute left-0 top-1/2 -z-10 h-1 rounded bg-status-success-solid transition-all duration-700"
                style={{ width: `${progresso}%` }}
            />

            {passos.map((passo) => {
                const alcancado = passo.id <= passoAtual;

                return (
                    <div key={passo.id} className="flex flex-col items-center bg-surface-card px-2">
                        <span
                            className={`flex h-10 w-10 items-center justify-center rounded-full border-4 transition-all duration-500 ${
                                alcancado
                                    ? 'border-status-success-solid bg-status-success-solid text-white shadow-lg'
                                    : 'border-line bg-surface-card text-content-muted'
                            }`}
                        >
                            {passo.id < passoAtual ? (
                                <CheckIcon className="h-4 w-4" strokeWidth={3} />
                            ) : (
                                <span className="text-sm font-black">{passo.id}</span>
                            )}
                        </span>

                        <span
                            className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${
                                alcancado ? 'text-status-success-fg' : 'text-content-muted'
                            }`}
                        >
                            {passo.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
