import { Head } from '@inertiajs/react';
import { PrinterIcon } from '@heroicons/react/24/outline';

import AppLayout from '@/Layouts/AppLayout';
import { PageHeader, Button } from '@/Components/UI';

/**
 * O formulário de papel — uma folha por moto.
 *
 * Continua existindo porque a conferência acontece com a moto na frente, e nem
 * todo galpão tem sinal. O conferente imprime, marca na prancheta e depois
 * lança no sistema; do outro lado, o CD recebe a via da loja e confere contra
 * ela.
 *
 * Imprimir COM as marcações já lançadas é o que dá valor à segunda via: a folha
 * que chega ao CD mostra o que a loja assinou, e as colunas de destino vêm em
 * branco, esperando a conferência de quem recebe.
 *
 * Mesma convenção de Pecas/RomaneioBasqueta: `print:hidden` é a tela,
 * `print:` no documento é o papel.
 */
export default function Imprimir({ devolucao, checklist = [] }) {
    return (
        <AppLayout>
            <Head title={`Checklist — Devolução #${devolucao.id}`} />

            <div className="print:hidden">
                <PageHeader
                    title={`Checklist da devolução #${devolucao.id}`}
                    description={`${devolucao.itens.length} folha(s) — uma por moto.`}
                    breadcrumbs={[
                        { label: 'Devoluções', href: route('devolucoes.index') },
                        { label: `#${devolucao.id}`, href: route('devolucoes.show', devolucao.id) },
                        { label: 'Imprimir' },
                    ]}
                    actions={
                        <Button icon={PrinterIcon} onClick={() => window.print()}>
                            Imprimir
                        </Button>
                    }
                />
            </div>

            <div className="space-y-6 print:space-y-0">
                {devolucao.itens.map((item, indice) => (
                    <Folha
                        key={item.id}
                        devolucao={devolucao}
                        item={item}
                        checklist={checklist}
                        ultima={indice === devolucao.itens.length - 1}
                    />
                ))}
            </div>
        </AppLayout>
    );
}

function Folha({ devolucao, item, checklist, ultima }) {
    return (
        <article
            className={`rounded-card bg-surface-card p-6 shadow-card ring-1 ring-line
                print:rounded-none print:bg-white print:p-0 print:shadow-none print:ring-0
                ${ultima ? '' : 'print:break-after-page'}`}
        >
            <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-content-primary pb-3 print:border-black">
                <div>
                    <h1 className="text-lg font-black uppercase tracking-tight text-content-primary print:text-black">
                        Checklist de recebimento de moto
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-content-muted print:text-black">
                        Shineray By Sabel · Devolução Loja → CD
                    </p>
                </div>

                <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-content-muted print:text-black">
                        Devolução
                    </p>
                    <p className="font-mono text-base font-black text-content-primary print:text-black">
                        #{String(devolucao.id).padStart(5, '0')}
                    </p>
                </div>
            </header>

            <p className="border-b border-line py-2 text-[9px] leading-relaxed text-content-muted print:border-black print:text-black">
                Preencher em duas etapas: (1) no local de origem, antes do embarque; (2) no destino,
                no ato do recebimento. Marcar C = conforme ou NC = não conforme. Todo NC exige
                descrição no campo 5. Divergência identificada deve ser comunicada em até 24 h, com
                registro fotográfico anexado.
            </p>

            {/* ---------- DADOS DA MOVIMENTAÇÃO ---------- */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-line py-3 sm:grid-cols-3 print:border-black">
                <Campo rotulo="NF / Romaneio nº" valor={devolucao.nf_numero} />
                <Campo rotulo="Local de origem" valor={devolucao.loja} />
                <Campo rotulo="Destino" valor={devolucao.destino} />
                <Campo rotulo="Marca / Modelo" valor={item.modelo} />
                <Campo rotulo="Cor" valor={item.cor} />
                <Campo rotulo="Ano/Modelo" valor={item.ano_modelo} />
                <Campo rotulo="Chassi" valor={item.chassi} mono />
                <Campo rotulo="Nº do motor" valor={item.numero_motor} mono />
                <Campo rotulo="Transportadora / Placa" valor={juntar(devolucao.transportadora, devolucao.placa)} />
                <Campo rotulo="Saída da loja" valor={formatarData(devolucao.saida_em)} />
                <Campo rotulo="Chegada ao CD" valor={formatarData(devolucao.chegada_em)} />
                <Campo rotulo="Nº do lacre" valor={devolucao.lacre} />
            </dl>

            {/* ---------- OS QUATRO BLOCOS ---------- */}
            <table className="mt-3 w-full border-collapse text-[10px]">
                <thead>
                    <tr className="border-b border-content-primary text-content-muted print:border-black print:text-black">
                        <th className="py-1.5 text-left font-black uppercase tracking-wide">
                            Item verificado
                        </th>
                        <th className="w-10 py-1.5 text-center font-black">C</th>
                        <th className="w-10 py-1.5 text-center font-black">NC</th>
                        <th className="w-10 py-1.5 text-center font-black">C</th>
                        <th className="w-10 py-1.5 text-center font-black">NC</th>
                    </tr>
                    <tr className="text-[8px] uppercase tracking-widest text-content-muted print:text-black">
                        <th />
                        <th colSpan={2} className="pb-1 font-bold">
                            Origem
                        </th>
                        <th colSpan={2} className="pb-1 font-bold">
                            Destino
                        </th>
                    </tr>
                </thead>

                {/*
                    Um <tbody> por grupo, e não uma tabela aninhada dentro de
                    cada linha: aninhar faz a tabela de dentro calcular a própria
                    largura, e as caixas de C/NC deixam de ficar embaixo dos
                    cabeçalhos C/NC — que é justamente o que o conferente segue
                    com o dedo na folha impressa.
                */}
                {checklist.map((grupo) => (
                    <tbody key={grupo.id}>
                        <tr>
                            <td
                                colSpan={5}
                                className="bg-surface-sunken px-1 py-1 text-[9px] font-black uppercase tracking-widest text-content-primary print:bg-transparent print:text-black"
                            >
                                {grupo.titulo}
                            </td>
                        </tr>

                        {grupo.itens.map((linha) => (
                            <tr
                                key={linha.chave}
                                className="border-b border-line print:border-black/30"
                            >
                                <td className="py-1 pr-2 text-content-secondary print:text-black">
                                    {linha.rotulo}
                                </td>
                                <Caixa marcada={item.origem.respostas[linha.chave] === 'C'} />
                                <Caixa marcada={item.origem.respostas[linha.chave] === 'NC'} />
                                <Caixa marcada={item.destino.respostas[linha.chave] === 'C'} />
                                <Caixa marcada={item.destino.respostas[linha.chave] === 'NC'} />
                            </tr>
                        ))}
                    </tbody>
                ))}
            </table>

            {/* ---------- CAMPO 5 ---------- */}
            <section className="mt-3 border-t border-content-primary pt-2 print:border-black">
                <p className="text-[9px] font-black uppercase tracking-widest text-content-muted print:text-black">
                    5. Observações / descrição das avarias (obrigatório para todo NC)
                </p>

                <div className="mt-1 min-h-[3.5rem] rounded border border-line p-2 text-[10px] text-content-secondary print:border-black print:text-black">
                    {item.origem.observacao && (
                        <p>
                            <strong>Origem:</strong> {item.origem.observacao}
                        </p>
                    )}
                    {item.destino.observacao && (
                        <p>
                            <strong>Destino:</strong> {item.destino.observacao}
                        </p>
                    )}
                </div>
            </section>

            {/* ---------- ASSINATURAS ---------- */}
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Assinatura
                    titulo="Conferência na origem (saída)"
                    resultado={item.origem.resultado}
                    nome={item.origem.responsavel}
                    matricula={item.origem.matricula}
                    em={item.origem.assinado_em}
                />
                <Assinatura
                    titulo="Conferência do entregador"
                    resultado={devolucao.entregador_resultado}
                    nome={devolucao.entregador_nome}
                />
                <Assinatura
                    titulo="Conferência no destino (recebimento)"
                    resultado={item.destino.resultado}
                    nome={item.destino.responsavel}
                    matricula={item.destino.matricula}
                    em={item.destino.assinado_em}
                />
            </div>
        </article>
    );
}

/* ================================================================== */

/** Quadradinho do papel: vazio para marcar à mão, com ✕ quando já foi lançado. */
function Caixa({ marcada }) {
    return (
        <td className="py-1 text-center">
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center border border-content-muted text-[9px] font-black leading-none text-content-primary print:border-black print:text-black">
                {marcada ? '✕' : ''}
            </span>
        </td>
    );
}

function Assinatura({ titulo, resultado, nome, matricula, em }) {
    const opcoes = [
        ['conforme', 'Conforme – liberado'],
        ['ressalva', 'Com ressalva'],
        ['nao_conforme', 'Não conforme – retido'],
    ];

    return (
        <div className="rounded border border-line p-2 print:border-black">
            <p className="text-[8px] font-black uppercase tracking-widest text-content-muted print:text-black">
                {titulo}
            </p>

            <ul className="mt-1 space-y-0.5">
                {opcoes.map(([valor, rotulo]) => (
                    <li
                        key={valor}
                        className="flex items-center gap-1 text-[9px] text-content-secondary print:text-black"
                    >
                        <span className="inline-flex h-2.5 w-2.5 items-center justify-center border border-content-muted text-[7px] leading-none print:border-black">
                            {resultado === valor ? '✕' : ''}
                        </span>
                        {rotulo}
                    </li>
                ))}
            </ul>

            <div className="mt-3 border-t border-content-muted pt-1 print:border-black">
                <p className="text-[9px] font-bold text-content-primary print:text-black">
                    {nome || ' '}
                    {matricula ? ` · mat. ${matricula}` : ''}
                </p>
                <p className="text-[7px] uppercase tracking-widest text-content-muted print:text-black">
                    Nome / matrícula do responsável — assinatura
                </p>
                <p className="mt-1 text-[8px] text-content-muted print:text-black">
                    {em ? formatarData(em) : 'Data ____/____/______   Hora ____:____'}
                </p>
            </div>
        </div>
    );
}

function Campo({ rotulo, valor, mono = false }) {
    return (
        <div>
            <dt className="text-[8px] font-black uppercase tracking-widest text-content-muted print:text-black">
                {rotulo}
            </dt>
            <dd
                className={`mt-0.5 border-b border-line pb-0.5 text-[11px] font-bold text-content-primary print:border-black print:text-black ${mono ? 'font-mono' : ''}`}
            >
                {valor || ' '}
            </dd>
        </div>
    );
}

function juntar(...partes) {
    return partes.filter(Boolean).join(' / ');
}

function formatarData(valor) {
    if (!valor) return '';

    return new Date(valor).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
