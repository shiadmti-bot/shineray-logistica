import { useState, useEffect, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import {
    MagnifyingGlassIcon,
    ArrowDownTrayIcon,
    ClipboardDocumentCheckIcon,
    CubeIcon,
    WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

import AppLayout from '@/Layouts/AppLayout';
import { Card, PageHeader, StatCard, Button, DataTable, StatusBadge, EmptyState } from '@/Components/UI';

/**
 * Entrada e inventário de peças.
 *
 * Desenhada para lançamento em série: o foco volta para a busca depois de cada
 * lançamento, então dá para bipar/digitar item após item sem tocar no mouse.
 *
 * Dois modos, com efeitos diferentes sobre o saldo — a tela deixa isso explícito
 * porque confundi-los corrompe o estoque de forma silenciosa:
 *   Entrada    -> SOMA ao saldo (recebeu mercadoria)
 *   Inventário -> SUBSTITUI o saldo (contou a prateleira)
 */
export default function EntradaPecas({ local, locais = [], movimentos = [], resumo = {} }) {
    const [modo, setModo] = useState('entrada');
    const [termo, setTermo] = useState('');
    const [resultados, setResultados] = useState([]);
    const [selecionada, setSelecionada] = useState(null);
    const [quantidade, setQuantidade] = useState('');
    const [observacao, setObservacao] = useState('');
    const [minimo, setMinimo] = useState(0);
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState('');

    const buscaRef = useRef(null);
    const qtdRef = useRef(null);

    // Busca com atraso: evita uma requisição por tecla digitada.
    useEffect(() => {
        if (termo.trim().length < 2 || selecionada) {
            setResultados([]);
            return;
        }

        const t = setTimeout(() => {
            axios
                .get(route('pecas.estoque.buscar'), { params: { termo, local_id: local?.id } })
                .then((r) => setResultados(r.data.pecas ?? []))
                .catch(() => setResultados([]));
        }, 250);

        return () => clearTimeout(t);
    }, [termo, selecionada, local?.id]);

    const selecionar = (peca) => {
        setSelecionada(peca);
        setTermo(`${peca.codigo} — ${peca.descricao}`);
        setMinimo(peca.minimo ?? 0);
        setResultados([]);
        setErro('');
        setTimeout(() => qtdRef.current?.focus(), 50);
    };

    const salvarMinimo = () => {
        if (!selecionada) return;

        router.post(
            route('pecas.pendencias.minimo'),
            { peca_id: selecionada.id, local_id: local.id, minimo: parseInt(minimo, 10) || 0 },
            { preserveScroll: true, preserveState: true }
        );
    };

    const limpar = () => {
        setSelecionada(null);
        setTermo('');
        setQuantidade('');
        setObservacao('');
        setResultados([]);
        buscaRef.current?.focus();
    };

    const lancar = () => {
        if (!selecionada || quantidade === '') return;

        const qtd = parseInt(quantidade, 10);

        if (modo === 'inventario' && !observacao.trim()) {
            setErro('Inventário exige justificativa.');
            return;
        }
        if (modo === 'entrada' && qtd < 1) {
            setErro('Quantidade deve ser maior que zero.');
            return;
        }

        setEnviando(true);
        setErro('');

        const rota = modo === 'entrada' ? 'pecas.estoque.entrada' : 'pecas.estoque.inventario';
        const dados =
            modo === 'entrada'
                ? { peca_id: selecionada.id, local_id: local.id, quantidade: qtd, observacao }
                : { peca_id: selecionada.id, local_id: local.id, saldo_contado: qtd, observacao };

        router.post(route(rota), dados, {
            preserveScroll: true,
            onSuccess: () => limpar(),
            onError: (e) => setErro(Object.values(e)[0] ?? 'Erro ao lançar.'),
            onFinish: () => setEnviando(false),
        });
    };

    const colunas = [
        { key: 'quando', header: 'Quando', className: 'whitespace-nowrap text-xs text-content-secondary' },
        {
            key: 'peca',
            header: 'Peça',
            render: (r) => (
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-content-primary">{r.peca}</p>
                    <p className="font-mono text-[10px] text-content-muted">{r.codigo}</p>
                </div>
            ),
        },
        { key: 'tipo', header: 'Tipo', render: (r) => <StatusBadge status={r.tipo} size="sm" /> },
        {
            key: 'quantidade',
            header: 'Qtd',
            align: 'right',
            render: (r) => (
                <span
                    className={`font-bold tabular-nums ${
                        r.quantidade > 0 ? 'text-status-success-fg' : 'text-status-danger-fg'
                    }`}
                >
                    {r.quantidade > 0 ? '+' : ''}
                    {r.quantidade}
                </span>
            ),
        },
        { key: 'saldo', header: 'Saldo', align: 'right', className: 'tabular-nums font-semibold' },
        { key: 'usuario', header: 'Por', className: 'text-xs text-content-secondary' },
    ];

    if (!local) {
        return (
            <AppLayout>
                <Head title="Entrada de Peças" />
                <Card>
                    <EmptyState
                        title="Local de estoque não definido"
                        description="Seu usuário não está vinculado a um local. Peça ao administrador para configurar."
                    />
                </Card>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Head title="Entrada de Peças" />

            <PageHeader
                title="Entrada e Inventário"
                description={`Movimentando o estoque de ${local.nome}.`}
                breadcrumbs={[{ label: 'Peças' }, { label: 'Entrada' }]}
                actions={
                    locais.length > 1 && (
                        <select
                            value={local.id}
                            onChange={(e) => router.get(route('pecas.estoque.index'), { local: e.target.value })}
                            className="rounded-lg border-line bg-surface-card py-2 text-sm font-semibold focus:border-brand-500 focus:ring-brand-500"
                        >
                            {locais.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.nome}
                                </option>
                            ))}
                        </select>
                    )
                }
            />

            <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-md">
                <StatCard label="SKUs com saldo" value={resumo.skus} icon={WrenchScrewdriverIcon} tone="brand" />
                <StatCard label="Unidades" value={resumo.unidades} icon={CubeIcon} tone="info" />
            </div>

            <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
                {/* --- LANÇAMENTO --- */}
                <Card padding="none" className="lg:sticky lg:top-20 lg:self-start">
                    {/* Modo */}
                    <div className="grid grid-cols-2 border-b border-line">
                        {[
                            { id: 'entrada', label: 'Entrada', icon: ArrowDownTrayIcon, hint: 'Soma ao saldo' },
                            { id: 'inventario', label: 'Inventário', icon: ClipboardDocumentCheckIcon, hint: 'Substitui o saldo' },
                        ].map((m) => {
                            const ativo = modo === m.id;
                            const Icon = m.icon;

                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => { setModo(m.id); setErro(''); }}
                                    className={`flex flex-col items-center gap-0.5 px-3 py-3 text-sm font-bold transition ${
                                        ativo
                                            ? 'bg-brand-600 text-white'
                                            : 'text-content-secondary hover:bg-surface-sunken'
                                    }`}
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Icon className="h-4 w-4" />
                                        {m.label}
                                    </span>
                                    <span className={`text-[10px] font-medium ${ativo ? 'text-white/80' : 'text-content-muted'}`}>
                                        {m.hint}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="space-y-3 p-4">
                        {/* Busca */}
                        <div className="relative">
                            <label className="mb-1 block text-xs font-bold text-content-secondary">Peça</label>
                            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-[30px] h-4 w-4 text-content-muted" />
                            <input
                                ref={buscaRef}
                                type="text"
                                value={termo}
                                autoFocus
                                onChange={(e) => { setTermo(e.target.value); setSelecionada(null); }}
                                placeholder="Código, descrição ou cód. barras"
                                className="w-full rounded-lg border-line bg-surface-card py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:ring-brand-500"
                            />

                            {resultados.length > 0 && (
                                <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto scrollbar-slim rounded-lg bg-surface-card shadow-overlay ring-1 ring-line">
                                    {resultados.map((p) => (
                                        <li key={p.id}>
                                            <button
                                                type="button"
                                                onClick={() => selecionar(p)}
                                                className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left hover:bg-surface-sunken"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-xs font-semibold text-content-primary">
                                                        {p.descricao}
                                                    </p>
                                                    <p className="font-mono text-[10px] text-content-muted">{p.codigo}</p>
                                                </div>
                                                <span className="shrink-0 text-xs font-bold tabular-nums text-content-secondary">
                                                    {p.saldo}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Peça selecionada */}
                        {selecionada && (
                            <div className="space-y-2 rounded-lg bg-surface-sunken p-3 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-content-secondary">Saldo atual</span>
                                    <span className="font-bold tabular-nums text-content-primary">
                                        {selecionada.saldo} {selecionada.unidade}
                                    </span>
                                </div>
                                {selecionada.reservado > 0 && (
                                    <div className="flex justify-between">
                                        <span className="text-content-secondary">Reservado</span>
                                        <span className="font-bold tabular-nums text-status-warning-fg">
                                            {selecionada.reservado}
                                        </span>
                                    </div>
                                )}

                                {/*
                                    Ponto de reposição: definido aqui porque é o
                                    momento em que alguém está olhando a peça e
                                    sabe o giro dela.
                                */}
                                <div className="flex items-center justify-between gap-2 border-t border-line pt-2">
                                    <span className="text-content-secondary">Avisar quando cair abaixo de</span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            min="0"
                                            value={minimo}
                                            onChange={(e) => setMinimo(e.target.value)}
                                            className="w-16 rounded border-line bg-surface-card py-1 text-center text-xs font-bold tabular-nums focus:border-brand-500 focus:ring-brand-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={salvarMinimo}
                                            className="rounded bg-brand-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-brand-700"
                                        >
                                            OK
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Quantidade */}
                        <div>
                            <label className="mb-1 block text-xs font-bold text-content-secondary">
                                {modo === 'entrada' ? 'Quantidade a somar' : 'Saldo contado na prateleira'}
                            </label>
                            <input
                                ref={qtdRef}
                                type="number"
                                min={modo === 'entrada' ? 1 : 0}
                                value={quantidade}
                                onChange={(e) => setQuantidade(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && lancar()}
                                className="w-full rounded-lg border-line bg-surface-card py-2 text-lg font-bold tabular-nums focus:border-brand-500 focus:ring-brand-500"
                            />
                        </div>

                        {/* Observação */}
                        <div>
                            <label className="mb-1 block text-xs font-bold text-content-secondary">
                                Observação {modo === 'inventario' && <span className="text-status-danger-fg">*</span>}
                            </label>
                            <input
                                type="text"
                                value={observacao}
                                onChange={(e) => setObservacao(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && lancar()}
                                placeholder={modo === 'entrada' ? 'Nota fiscal, origem…' : 'Motivo do ajuste'}
                                className="w-full rounded-lg border-line bg-surface-card py-2 text-sm focus:border-brand-500 focus:ring-brand-500"
                            />
                        </div>

                        {erro && (
                            <p className="rounded-lg bg-status-danger-bg px-3 py-2 text-xs font-semibold text-status-danger-fg">
                                {erro}
                            </p>
                        )}

                        <div className="flex gap-2">
                            <Button
                                className="flex-1"
                                variant={modo === 'entrada' ? 'primary' : 'secondary'}
                                loading={enviando}
                                disabled={!selecionada || quantidade === ''}
                                onClick={lancar}
                            >
                                {modo === 'entrada' ? 'Lançar entrada' : 'Ajustar saldo'}
                            </Button>
                            {selecionada && (
                                <Button variant="ghost" onClick={limpar}>
                                    Limpar
                                </Button>
                            )}
                        </div>
                    </div>
                </Card>

                {/* --- HISTÓRICO --- */}
                <Card
                    title="Últimos movimentos"
                    subtitle="O ledger registra toda alteração de saldo deste local."
                    padding="none"
                >
                    <DataTable
                        columns={colunas}
                        rows={movimentos}
                        dense
                        emptyTitle="Nenhum movimento ainda"
                        emptyDescription="Os lançamentos aparecem aqui assim que forem registrados."
                    />
                </Card>
            </div>
        </AppLayout>
    );
}
