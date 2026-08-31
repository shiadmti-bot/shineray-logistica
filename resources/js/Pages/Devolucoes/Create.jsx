import { useMemo, useState } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import {
    ArrowUturnLeftIcon,
    MagnifyingGlassIcon,
    TruckIcon,
} from '@heroicons/react/24/outline';

import AppLayout from '@/Layouts/AppLayout';
import { Card, PageHeader, Button, EmptyState, StatusBadge } from '@/Components/UI';

/**
 * Abertura da devolução: escolher as motos e dizer por quê.
 *
 * A lista já vem filtrada pelo servidor com o que PODE ser devolvido — moto no
 * pátio desta loja, fora de qualquer pedido ativo e fora de outra devolução
 * aberta. Mostrar tudo e recusar depois seria mais fácil de programar e pior de
 * usar: a loja escolheria o chassi que quer e só descobriria o problema ao
 * enviar.
 *
 * O checklist NÃO é preenchido aqui. Ele vem na tela seguinte, moto a moto,
 * porque é feito com a moto na frente — e não na mesa, no momento de montar a
 * solicitação.
 */
export default function Create({ motos = [], lojas = [], lojaId = null, motivos = {} }) {
    const [busca, setBusca] = useState('');

    const form = useForm({
        loja_id: lojaId ? String(lojaId) : '',
        motos: [],
        motivo: '',
        observacao: '',
        nf_numero: '',
        transportadora: '',
        placa: '',
        lacre: '',
    });

    const precisaEscolherLoja = lojas.length > 0;

    // A lista já vem filtrada pela loja no servidor; aqui só a busca por texto.
    const disponiveis = useMemo(() => {
        const termo = busca.trim().toUpperCase();

        if (!termo) return motos;

        return motos.filter(
            (moto) =>
                (moto.chassi ?? '').toUpperCase().includes(termo) ||
                (moto.modelo ?? '').toUpperCase().includes(termo) ||
                (moto.cor ?? '').toUpperCase().includes(termo)
        );
    }, [motos, busca]);

    /*
     * Trocar de loja recarrega o pátio pelo servidor, em vez de filtrar mil
     * motos no navegador. `preserveState` mantém o motivo e os dados do
     * embarque já digitados.
     */
    const trocarLoja = (id) => {
        form.setData('loja_id', id);
        form.setData('motos', []);

        router.get(route('devolucoes.create'), id ? { loja_id: id } : {}, {
            preserveState: true,
            replace: true,
            only: ['motos', 'lojaId'],
        });
    };

    const alternar = (id) =>
        form.setData(
            'motos',
            form.data.motos.includes(id)
                ? form.data.motos.filter((m) => m !== id)
                : [...form.data.motos, id]
        );

    const enviar = (e) => {
        e.preventDefault();
        form.post(route('devolucoes.store'));
    };

    return (
        <AppLayout>
            <Head title="Nova devolução" />

            <PageHeader
                title="Nova devolução ao CD"
                description="Selecione as motos que voltam para o Centro de Distribuição. O checklist de cada uma é preenchido no passo seguinte."
                breadcrumbs={[
                    { label: 'Motos' },
                    { label: 'Devoluções', href: route('devolucoes.index') },
                    { label: 'Nova' },
                ]}
            />

            <form onSubmit={enviar} className="grid gap-5 lg:grid-cols-3">
                {/* ---------- SELEÇÃO DAS MOTOS ---------- */}
                <div className="lg:col-span-2">
                    <Card
                        title="Motos a devolver"
                        subtitle={`${form.data.motos.length} selecionada(s) de ${disponiveis.length} disponível(is)`}
                        padding="none"
                    >
                        <div className="border-b border-line p-4">
                            {precisaEscolherLoja && (
                                <label className="mb-3 block">
                                    <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-content-muted">
                                        Loja de origem
                                    </span>
                                    <select
                                        value={form.data.loja_id}
                                        onChange={(e) => trocarLoja(e.target.value)}
                                        className="w-full rounded border-line-strong bg-surface py-2 text-xs focus:ring-brand-500"
                                    >
                                        <option value="">Selecione a loja…</option>
                                        {lojas.map((loja) => (
                                            <option key={loja.id} value={loja.id}>
                                                {loja.filial || loja.name}
                                            </option>
                                        ))}
                                    </select>
                                    {form.errors.loja_id && (
                                        <span className="mt-1 block text-[10px] font-bold text-status-danger-fg">
                                            {form.errors.loja_id}
                                        </span>
                                    )}
                                </label>
                            )}

                            <div className="relative">
                                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-content-muted" />
                                <input
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                    placeholder="Buscar por chassi, modelo ou cor"
                                    className="w-full rounded border-line-strong bg-surface py-2 pl-9 text-xs focus:ring-brand-500"
                                />
                            </div>
                        </div>

                        {disponiveis.length === 0 ? (
                            <EmptyState
                                icon={ArrowUturnLeftIcon}
                                title="Nenhuma moto disponível para devolução"
                                description={
                                    precisaEscolherLoja && !form.data.loja_id
                                        ? 'Escolha a loja de origem para ver o pátio dela.'
                                        : 'Só aparecem aqui motos que estão no pátio da loja e fora de qualquer pedido ou devolução em aberto.'
                                }
                            />
                        ) : (
                            <ul className="max-h-[26rem] divide-y divide-line overflow-y-auto scrollbar-slim">
                                {disponiveis.map((moto) => {
                                    const marcada = form.data.motos.includes(moto.id);

                                    return (
                                        <li key={moto.id}>
                                            <label
                                                className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition
                                                    ${marcada ? 'bg-brand-50' : 'hover:bg-surface-sunken'}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={marcada}
                                                    onChange={() => alternar(moto.id)}
                                                    className="h-4 w-4 rounded border-line-strong text-brand-600 focus:ring-brand-500"
                                                />

                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-xs font-bold text-content-primary">
                                                        {moto.modelo} · {moto.cor}
                                                    </p>
                                                    <p className="font-mono text-[11px] text-content-muted">
                                                        {moto.chassi}
                                                        {moto.ano_fabricacao ? ` · ${moto.ano_fabricacao}` : ''}
                                                    </p>
                                                </div>

                                                <StatusBadge status={moto.status} size="sm" />
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Card>

                    {form.errors.motos && (
                        <p className="mt-2 rounded-lg bg-status-danger-bg p-3 text-xs font-bold text-status-danger-fg">
                            {form.errors.motos}
                        </p>
                    )}
                </div>

                {/* ---------- MOTIVO E MOVIMENTAÇÃO ---------- */}
                <div className="space-y-5">
                    <Card title="Motivo da devolução">
                        <div className="space-y-3">
                            <label className="block">
                                <select
                                    value={form.data.motivo}
                                    onChange={(e) => form.setData('motivo', e.target.value)}
                                    className="w-full rounded border-line-strong bg-surface py-2 text-xs focus:ring-brand-500"
                                >
                                    <option value="">Selecione o motivo…</option>
                                    {Object.entries(motivos).map(([valor, rotulo]) => (
                                        <option key={valor} value={valor}>
                                            {rotulo}
                                        </option>
                                    ))}
                                </select>
                                {form.errors.motivo && (
                                    <span className="mt-1 block text-[10px] font-bold text-status-danger-fg">
                                        {form.errors.motivo}
                                    </span>
                                )}
                            </label>

                            <label className="block">
                                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-content-muted">
                                    Detalhe (opcional)
                                </span>
                                <textarea
                                    value={form.data.observacao}
                                    onChange={(e) => form.setData('observacao', e.target.value)}
                                    rows={3}
                                    maxLength={1000}
                                    placeholder="O que aconteceu, em uma frase."
                                    className="w-full rounded border-line-strong bg-surface text-xs focus:ring-brand-500"
                                />
                            </label>
                        </div>
                    </Card>

                    {/*
                     * Dados do embarque. Opcionais aqui de propósito: a nota e a
                     * placa quase nunca existem no momento em que a loja abre a
                     * devolução — a tela de detalhes deixa completar depois.
                     */}
                    <Card
                        title="Dados da movimentação"
                        subtitle="Pode preencher depois, antes do embarque"
                    >
                        <div className="space-y-3">
                            <Campo
                                rotulo="NF / Romaneio nº"
                                valor={form.data.nf_numero}
                                onChange={(v) => form.setData('nf_numero', v)}
                            />
                            <Campo
                                rotulo="Transportadora"
                                valor={form.data.transportadora}
                                onChange={(v) => form.setData('transportadora', v)}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <Campo
                                    rotulo="Placa"
                                    valor={form.data.placa}
                                    onChange={(v) => form.setData('placa', v.toUpperCase())}
                                />
                                <Campo
                                    rotulo="Lacre"
                                    valor={form.data.lacre}
                                    onChange={(v) => form.setData('lacre', v)}
                                />
                            </div>
                        </div>
                    </Card>

                    <Button
                        type="submit"
                        icon={TruckIcon}
                        loading={form.processing}
                        disabled={form.data.motos.length === 0 || !form.data.motivo}
                        className="w-full"
                    >
                        Abrir devolução e ir ao checklist
                    </Button>
                </div>
            </form>
        </AppLayout>
    );
}

function Campo({ rotulo, valor, onChange }) {
    return (
        <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-content-muted">
                {rotulo}
            </span>
            <input
                value={valor}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded border-line-strong bg-surface py-2 text-xs focus:ring-brand-500"
            />
        </label>
    );
}
