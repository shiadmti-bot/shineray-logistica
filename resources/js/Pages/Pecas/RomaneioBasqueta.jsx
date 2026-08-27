import { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import {
    PrinterIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import AppLayout from '@/Layouts/AppLayout';
import { PageHeader, Button, Card } from '@/Components/UI';

/**
 * Romaneio de peças — o documento do Passo 6 do manual.
 *
 * É o que a filial confere antes do despacho. Nasce quando a basqueta é
 * faturada, e não junto com o manifesto da carga, porque os dois têm momentos
 * diferentes: este sai com a NF; o manifesto sai no dia, na montagem.
 *
 * O bloco `print:hidden` é a tela; o `hidden print:block` é o documento —
 * mesma convenção do manifesto em Romaneios/Show.
 */
export default function RomaneioBasqueta({ basqueta, podeConferir = false }) {
    const valorTotal = basqueta.itens.reduce(
        (soma, i) => soma + (Number(i.preco) || 0) * i.quantidade,
        0
    );

    return (
        <AppLayout>
            <Head title={`Romaneio de Peças — ${basqueta.local}`} />

            <div className="print:hidden">
                <PageHeader
                    title={`Romaneio de Peças #${basqueta.id}`}
                    subtitle={`${basqueta.local} · ${basqueta.total_un} unidade(s)`}
                    breadcrumbs={[
                        { label: 'Peças' },
                        { label: 'Basquetas', href: route('pecas.basquetas') },
                        { label: `#${basqueta.id}` },
                    ]}
                    actions={
                        <Button icon={PrinterIcon} onClick={() => window.print()}>
                            Imprimir
                        </Button>
                    }
                />

                {basqueta.versao > 1 && (
                    <div className="mb-4 rounded-lg border border-status-warning-solid/40 bg-status-warning-bg p-4">
                        <p className="text-sm font-bold text-status-warning-fg">
                            Versão {basqueta.versao} deste romaneio
                        </p>
                        <p className="mt-0.5 text-xs text-status-warning-fg">
                            A caixa foi reaberta e a nota reemitida. Descarte a via anterior.
                            {basqueta.ajuste_motivo && ` Ajuste pedido: ${basqueta.ajuste_motivo}`}
                        </p>
                    </div>
                )}

                {basqueta.conferida_em && (
                    <div className="mb-4 flex items-start gap-3 rounded-lg border border-status-success-solid/40 bg-status-success-bg p-4">
                        <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-status-success-fg" />
                        <div>
                            <p className="text-sm font-bold text-status-success-fg">
                                Romaneio conferido{basqueta.conferida_por && ` por ${basqueta.conferida_por}`}
                            </p>
                            {basqueta.foto && (
                                <a
                                    href={basqueta.foto}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-bold text-status-success-fg underline"
                                >
                                    Ver foto do romaneio assinado
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {podeConferir && <Conferencia basqueta={basqueta} />}
            </div>

            {/* --- DOCUMENTO --- */}
            <div className="rounded-card bg-surface-card p-6 shadow-card ring-1 ring-line print:fixed print:inset-0 print:z-[9999] print:block print:h-full print:w-full print:rounded-none print:bg-white print:p-8 print:shadow-none print:ring-0">
                <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-content-primary pb-4 print:border-black">
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight text-content-primary print:text-black">
                            Romaneio de Peças
                        </h1>
                        <p className="text-xs font-bold uppercase tracking-widest text-content-muted print:text-black">
                            Shineray By Sabel · Conferência do Pós-Venda
                        </p>
                    </div>

                    <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-content-muted print:text-black">
                            Basqueta
                        </p>
                        <p className="font-mono text-lg font-black text-content-primary print:text-black">
                            #{String(basqueta.id).padStart(6, '0')}
                        </p>
                        {basqueta.versao > 1 && (
                            <p className="text-[10px] font-bold uppercase text-content-muted print:text-black">
                                Versão {basqueta.versao}
                            </p>
                        )}
                    </div>
                </header>

                <dl className="grid grid-cols-2 gap-4 border-b border-line py-4 sm:grid-cols-4 print:border-black">
                    <Campo rotulo="Destino" valor={basqueta.local} />
                    <Campo rotulo="Nota Fiscal" valor={basqueta.nota?.rotulo ?? 'Não faturada'} />
                    <Campo rotulo="Volumes" valor={basqueta.volumes ?? '—'} />
                    <Campo rotulo="Saída prevista" valor={formatarData(basqueta.viagem)} />
                </dl>

                {basqueta.nota?.chave && (
                    <p className="border-b border-line py-2 font-mono text-[10px] tracking-tight text-content-muted print:border-black print:text-black">
                        Chave NF-e: {basqueta.nota.chave}
                    </p>
                )}

                <div className="overflow-x-auto py-4">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-line text-content-muted print:border-black print:text-black">
                                <th className="py-2 pr-3 text-left font-bold uppercase tracking-wide">Código</th>
                                <th className="py-2 pr-3 text-left font-bold uppercase tracking-wide">Descrição</th>
                                <th className="py-2 pr-3 text-left font-bold uppercase tracking-wide">Pedido</th>
                                <th className="py-2 pr-3 text-right font-bold uppercase tracking-wide">Qtd</th>
                                <th className="py-2 text-right font-bold uppercase tracking-wide">Conferido</th>
                            </tr>
                        </thead>
                        <tbody>
                            {basqueta.itens.map((i) => (
                                <tr
                                    key={i.id}
                                    className="border-b border-line text-content-primary print:border-black print:text-black"
                                >
                                    <td className="py-2 pr-3 font-mono font-bold">{i.codigo}</td>
                                    <td className="py-2 pr-3">{i.descricao}</td>
                                    <td className="py-2 pr-3 text-content-muted print:text-black">
                                        #{i.pedido_id}
                                    </td>
                                    <td className="py-2 pr-3 text-right font-bold tabular-nums">
                                        {i.quantidade} {i.unidade}
                                    </td>
                                    {/* Caixa vazia de propósito: a conferência é feita
                                        com o documento na mão, ao lado da caixa aberta. */}
                                    <td className="py-2 text-right">
                                        <span className="inline-block h-4 w-10 border border-content-muted print:border-black" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="font-black text-content-primary print:text-black">
                                <td className="py-3" colSpan={3}>
                                    TOTAL
                                </td>
                                <td className="py-3 text-right tabular-nums">{basqueta.total_un}</td>
                                <td className="py-3 text-right tabular-nums">
                                    {valorTotal > 0 && `R$ ${valorTotal.toFixed(2)}`}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-8 pt-8">
                    <Assinatura rotulo="Conferido pelo Pós-Venda" />
                    <Assinatura rotulo="Separado pelo Estoque Central" />
                </div>

                <p className="mt-6 text-center text-[9px] uppercase tracking-widest text-content-muted print:text-black">
                    Nenhuma embalagem é despachada sem a conferência do Pós-Venda
                </p>
            </div>
        </AppLayout>
    );
}

/**
 * GATE 2 — a conferência da filial antes do despacho (Passo 7).
 *
 * Dois desfechos, e é essa dualidade que o manual descreve: "se estiver tudo
 * certo, a caixa segue viagem; se estiver faltando alguma peça, a equipe do
 * estoque abre novamente a caixa".
 *
 * A foto do romaneio assinado é obrigatória para liberar — é o que transforma
 * a conferência em evidência, e não em um clique.
 */
function Conferencia({ basqueta }) {
    const [modo, setModo] = useState(null);

    const liberar = useForm({ foto: null, observacao: '' });
    const ajuste = useForm({ motivo: '' });

    const enviarLiberacao = (e) => {
        e.preventDefault();
        liberar.post(route('pecas.basquetas.conferir', basqueta.id), {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    const enviarAjuste = (e) => {
        e.preventDefault();
        ajuste.post(route('pecas.basquetas.ajustar', basqueta.id), { preserveScroll: true });
    };

    return (
        <Card
            className="mb-6"
            title="Conferência do Pós-Venda"
            subtitle="Nenhuma caixa é despachada sem esta confirmação"
        >
            {!modo && (
                <div className="space-y-3">
                    <p className="text-xs text-content-secondary">
                        Confira o conteúdo da caixa contra a lista abaixo. Se estiver tudo certo,
                        libere o despacho anexando a foto do romaneio assinado. Se faltar alguma
                        peça, peça o ajuste — a caixa é reaberta e a nota, reemitida.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button icon={CheckCircleIcon} onClick={() => setModo('liberar')}>
                            Está tudo certo
                        </Button>
                        <Button
                            variant="secondary"
                            icon={ExclamationTriangleIcon}
                            onClick={() => setModo('ajuste')}
                        >
                            Está faltando peça
                        </Button>
                    </div>
                </div>
            )}

            {modo === 'liberar' && (
                <form onSubmit={enviarLiberacao} className="space-y-3">
                    <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-content-muted">
                            Foto do romaneio assinado
                        </span>
                        <input
                            type="file"
                            accept="image/*,application/pdf"
                            capture="environment"
                            onChange={(e) => liberar.setData('foto', e.target.files[0])}
                            className="w-full text-xs text-content-secondary file:mr-3 file:rounded file:border-0 file:bg-brand-700 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
                        />
                        {liberar.errors.foto && (
                            <span className="mt-1 block text-[10px] text-status-danger-fg">
                                {liberar.errors.foto}
                            </span>
                        )}
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-content-muted">
                            Observação (opcional)
                        </span>
                        <input
                            value={liberar.data.observacao}
                            onChange={(e) => liberar.setData('observacao', e.target.value)}
                            className="w-full rounded border-line-strong bg-surface py-2 text-xs focus:ring-brand-500"
                        />
                    </label>

                    {liberar.errors.geral && (
                        <p className="text-xs font-bold text-status-danger-fg">{liberar.errors.geral}</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="submit"
                            icon={CheckCircleIcon}
                            loading={liberar.processing}
                            disabled={!liberar.data.foto}
                        >
                            Liberar despacho
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setModo(null)}>
                            Voltar
                        </Button>
                    </div>
                </form>
            )}

            {modo === 'ajuste' && (
                <form onSubmit={enviarAjuste} className="space-y-3">
                    <p className="text-xs text-content-secondary">
                        A nota fiscal atual será cancelada e a caixa voltará a aceitar peça. O CD
                        inclui o item faltante e emite uma nova NF antes de reenviar para conferência.
                    </p>

                    <label className="block">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-content-muted">
                            O que faltou ou veio errado
                        </span>
                        <textarea
                            value={ajuste.data.motivo}
                            onChange={(e) => ajuste.setData('motivo', e.target.value)}
                            rows={3}
                            maxLength={500}
                            placeholder="Ex.: faltaram as 2 pastilhas de freio do pedido #1042"
                            className="w-full rounded border-line-strong bg-surface text-xs focus:ring-brand-500"
                        />
                        {ajuste.errors.motivo && (
                            <span className="mt-1 block text-[10px] text-status-danger-fg">
                                {ajuste.errors.motivo}
                            </span>
                        )}
                    </label>

                    {ajuste.errors.geral && (
                        <p className="text-xs font-bold text-status-danger-fg">{ajuste.errors.geral}</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="submit"
                            variant="danger"
                            loading={ajuste.processing}
                            disabled={ajuste.data.motivo.trim().length < 5}
                        >
                            Solicitar ajuste
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setModo(null)}>
                            Voltar
                        </Button>
                    </div>
                </form>
            )}
        </Card>
    );
}

function Campo({ rotulo, valor }) {
    return (
        <div>
            <dt className="text-[9px] font-bold uppercase tracking-widest text-content-muted print:text-black">
                {rotulo}
            </dt>
            <dd className="mt-0.5 text-sm font-bold text-content-primary print:text-black">{valor}</dd>
        </div>
    );
}

function Assinatura({ rotulo }) {
    return (
        <div className="text-center">
            <div className="border-t border-content-primary pt-1 print:border-black">
                <p className="text-[9px] font-bold uppercase tracking-widest text-content-muted print:text-black">
                    {rotulo}
                </p>
            </div>
        </div>
    );
}

function formatarData(valor) {
    if (!valor) return 'Sem viagem marcada';

    // 'YYYY-MM-DD' montado por partes: new Date('2026-08-26') seria lido como
    // UTC e voltaria um dia em fuso negativo.
    const [ano, mes, dia] = String(valor).slice(0, 10).split('-');

    return `${dia}/${mes}/${ano}`;
}
