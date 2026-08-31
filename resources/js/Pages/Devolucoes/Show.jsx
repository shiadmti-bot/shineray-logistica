import { useState } from 'react';
import { Head, useForm, Link } from '@inertiajs/react';
import {
    PrinterIcon,
    PaperAirplaneIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClipboardDocumentCheckIcon,
    PaperClipIcon,
    TrashIcon,
    ExclamationTriangleIcon,
    ArchiveBoxArrowDownIcon,
    TruckIcon,
} from '@heroicons/react/24/outline';

import AppLayout from '@/Layouts/AppLayout';
import { Card, PageHeader, Button, StatusBadge } from '@/Components/UI';
import ChecklistMotoForm from '@/Components/Devolucoes/ChecklistMotoForm';

/**
 * O dossiê da devolução.
 *
 * Uma tela só para os três portões, porque é sempre o mesmo documento sendo
 * olhado por gente diferente: a loja preenche a origem, a diretoria decide, o
 * CD confere o destino. `permissoes` vem pronto do servidor — a tela nunca
 * calcula quem pode o quê, ela só desenha o que a permissão autoriza. A trava
 * de verdade está em DevolucaoController.
 *
 * As duas conferências ficam lado a lado em cada moto de propósito: é a
 * comparação entre elas que responde a pergunta da devolução — já saiu assim,
 * ou aconteceu no caminho?
 */
export default function Show({ devolucao, checklist = [], permissoes = {} }) {
    const [aberta, setAberta] = useState(null); // `${itemId}:${etapa}`

    const etapaEditavel = permissoes.conferir_destino
        ? 'destino'
        : permissoes.conferir_origem
          ? 'origem'
          : null;

    const enviar = useForm({});
    const cancelar = useForm({});

    const pendenciasDaEtapa = (etapa) =>
        devolucao.itens.flatMap((item) =>
            (item[etapa].pendencias ?? []).map((p) => `Moto ${item.chassi}: ${p}`)
        );

    const pendenciasAbertas = etapaEditavel ? pendenciasDaEtapa(etapaEditavel) : [];

    return (
        <AppLayout>
            <Head title={`Devolução #${devolucao.id}`} />

            <div className="print:hidden">
                <PageHeader
                    title={`Devolução #${String(devolucao.id).padStart(5, '0')}`}
                    description={`${devolucao.loja} → ${devolucao.destino} · ${devolucao.motivo_rotulo}`}
                    breadcrumbs={[
                        { label: 'Motos' },
                        { label: 'Devoluções', href: route('devolucoes.index') },
                        { label: `#${devolucao.id}` },
                    ]}
                    actions={
                        <>
                            <StatusBadge status={devolucao.status} />
                            <Button
                                variant="secondary"
                                icon={PrinterIcon}
                                href={route('devolucoes.imprimir', devolucao.id)}
                            >
                                Imprimir
                            </Button>
                        </>
                    }
                />

                {/* ---------- AVISOS DE FLUXO ---------- */}
                {devolucao.status === 'recusada' && (
                    <Aviso tom="danger" titulo="Devolução negada pela diretoria">
                        {devolucao.recusa_motivo}
                    </Aviso>
                )}

                {devolucao.status === 'aprovada' && (
                    <Aviso tom="info" titulo="Autorizada — a caminho do CD">
                        Coleta no pedido{' '}
                        <Link
                            href={route('pedidos.show', devolucao.pedido_id)}
                            className="font-bold underline"
                        >
                            #{devolucao.pedido_id}
                        </Link>{' '}
                        ({String(devolucao.pedido_status ?? '').replace(/_/g, ' ')})
                        {devolucao.romaneio_id && ` · carga #${devolucao.romaneio_id}`}. O CD conclui
                        a devolução conferindo cada moto na chegada.
                    </Aviso>
                )}

                {devolucao.status === 'recebida' && (
                    <Aviso tom="success" titulo="Devolução concluída">
                        Recebida por {devolucao.recebido_por} em {formatarData(devolucao.recebido_em)}.
                        As motos voltaram ao pátio do CD.
                    </Aviso>
                )}

                {pendenciasAbertas.length > 0 && (
                    <Aviso tom="warning" titulo="O que ainda falta para avançar">
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                            {pendenciasAbertas.map((p, i) => (
                                <li key={i}>{p}</li>
                            ))}
                        </ul>
                    </Aviso>
                )}

                <div className="grid gap-5 lg:grid-cols-3">
                    {/* ---------- COLUNA PRINCIPAL: AS MOTOS ---------- */}
                    <div className="space-y-4 lg:col-span-2">
                        {devolucao.itens.map((item) => (
                            <MotoCard
                                key={item.id}
                                devolucao={devolucao}
                                item={item}
                                checklist={checklist}
                                etapaEditavel={etapaEditavel}
                                aberta={aberta}
                                setAberta={setAberta}
                            />
                        ))}
                    </div>

                    {/* ---------- COLUNA LATERAL: DADOS E AÇÕES ---------- */}
                    <div className="space-y-5">
                        <DadosMovimentacao devolucao={devolucao} editavel={permissoes.editar} />

                        {permissoes.enviar && (
                            <Card title="Enviar para a diretoria">
                                <p className="mb-3 text-xs text-content-secondary">
                                    A moto só é liberada para coleta depois da aprovação. Envie
                                    quando o checklist de origem estiver assinado em todas as motos.
                                </p>

                                {enviar.errors.geral && (
                                    <p className="mb-3 whitespace-pre-line rounded-lg bg-status-danger-bg p-3 text-xs font-bold text-status-danger-fg">
                                        {enviar.errors.geral}
                                    </p>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        icon={PaperAirplaneIcon}
                                        loading={enviar.processing}
                                        disabled={pendenciasAbertas.length > 0}
                                        onClick={() =>
                                            enviar.post(route('devolucoes.enviar', devolucao.id), {
                                                preserveScroll: true,
                                            })
                                        }
                                    >
                                        Enviar para aprovação
                                    </Button>
                                </div>
                            </Card>
                        )}

                        {permissoes.decidir && <Decisao devolucao={devolucao} />}

                        {permissoes.receber && (
                            <Recebimento devolucao={devolucao} pendencias={pendenciasAbertas} />
                        )}

                        <Anexos
                            devolucao={devolucao}
                            etapa={etapaEditavel}
                            anexos={devolucao.anexos_gerais}
                            titulo="Anexos do embarque"
                            subtitulo="Nota fiscal, canhoto, foto da carga"
                            podeEnviar={Boolean(etapaEditavel)}
                        />

                        {permissoes.cancelar && (
                            <Button
                                variant="ghost"
                                icon={XCircleIcon}
                                loading={cancelar.processing}
                                className="w-full"
                                onClick={() => {
                                    if (confirm('Cancelar esta devolução?')) {
                                        cancelar.post(route('devolucoes.cancelar', devolucao.id));
                                    }
                                }}
                            >
                                Cancelar devolução
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

/* ================================================================== */

/**
 * Uma moto e suas duas conferências.
 *
 * O resumo fica sempre visível e o formulário só abre a pedido: com 31 itens
 * por moto, uma devolução de cinco motos com tudo aberto seria uma página de
 * 150 linhas em que ninguém acha nada.
 */
function MotoCard({ devolucao, item, checklist, etapaEditavel, aberta, setAberta }) {
    const chave = `${item.id}:${etapaEditavel}`;
    const editando = aberta === chave;

    return (
        <Card
            title={`${item.modelo ?? 'Moto'} · ${item.cor ?? ''}`}
            subtitle={`Chassi ${item.chassi}${item.numero_motor ? ` · motor ${item.numero_motor}` : ''}`}
            actions={item.moto_status && <StatusBadge status={item.moto_status} size="sm" />}
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <ResumoConferencia rotulo="Origem — saída da loja" dados={item.origem} />
                <ResumoConferencia rotulo="Destino — chegada ao CD" dados={item.destino} />
            </div>

            {etapaEditavel && (
                <div className="mt-4 border-t border-line pt-4">
                    {!editando ? (
                        <Button
                            size="sm"
                            variant={item[etapaEditavel].assinado_em ? 'secondary' : 'primary'}
                            icon={ClipboardDocumentCheckIcon}
                            onClick={() => setAberta(chave)}
                        >
                            {item[etapaEditavel].assinado_em
                                ? 'Refazer checklist'
                                : `Preencher checklist de ${etapaEditavel}`}
                        </Button>
                    ) : (
                        <div className="space-y-4">
                            <ChecklistMotoForm
                                devolucaoId={devolucao.id}
                                item={item}
                                etapa={etapaEditavel}
                                grupos={checklist}
                                onConcluir={() => setAberta(null)}
                            />
                            <Button size="sm" variant="ghost" onClick={() => setAberta(null)}>
                                Fechar sem salvar
                            </Button>
                        </div>
                    )}

                    <div className="mt-4">
                        <Anexos
                            devolucao={devolucao}
                            item={item}
                            etapa={etapaEditavel}
                            anexos={item[etapaEditavel].anexos}
                            titulo="Fotos desta moto"
                            subtitulo="Obrigatório quando há item não conforme"
                            podeEnviar
                            compacto
                        />
                    </div>
                </div>
            )}
        </Card>
    );
}

/** O que ficou registrado numa das pontas. Vazio também é informação. */
function ResumoConferencia({ rotulo, dados }) {
    const tons = {
        conforme: 'bg-status-success-bg text-status-success-fg',
        ressalva: 'bg-status-warning-bg text-status-warning-fg',
        nao_conforme: 'bg-status-danger-bg text-status-danger-fg',
    };

    const rotulos = {
        conforme: 'Conforme — liberado',
        ressalva: 'Com ressalva',
        nao_conforme: 'Não conforme — retido',
    };

    return (
        <div className="rounded-lg bg-surface-sunken p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-content-muted">
                {rotulo}
            </p>

            {!dados.assinado_em ? (
                <p className="mt-1 text-xs text-content-muted">Ainda não conferida.</p>
            ) : (
                <>
                    <span
                        className={`mt-1.5 inline-block rounded px-2 py-0.5 text-[11px] font-bold ${tons[dados.resultado] ?? ''}`}
                    >
                        {rotulos[dados.resultado] ?? dados.resultado}
                    </span>

                    <p className="mt-1.5 text-[11px] text-content-secondary">
                        {dados.responsavel}
                        {dados.matricula ? ` · mat. ${dados.matricula}` : ''}
                    </p>
                    <p className="text-[10px] text-content-muted">{formatarData(dados.assinado_em)}</p>

                    {dados.nao_conformes.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                            {dados.nao_conformes.map((nc, i) => (
                                <li
                                    key={i}
                                    className="flex items-start gap-1 text-[10px] font-bold text-status-danger-fg"
                                >
                                    <ExclamationTriangleIcon className="mt-px h-3 w-3 shrink-0" />
                                    {nc}
                                </li>
                            ))}
                        </ul>
                    )}

                    {dados.observacao && (
                        <p className="mt-2 text-[11px] italic text-content-secondary">
                            “{dados.observacao}”
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

/* ================================================================== */

function DadosMovimentacao({ devolucao, editavel }) {
    const form = useForm({
        motivo: devolucao.motivo,
        observacao: devolucao.observacao ?? '',
        nf_numero: devolucao.nf_numero ?? '',
        transportadora: devolucao.transportadora ?? '',
        placa: devolucao.placa ?? '',
        lacre: devolucao.lacre ?? '',
        saida_em: devolucao.saida_em ? String(devolucao.saida_em).slice(0, 16) : '',
    });

    if (!editavel) {
        return (
            <Card title="Dados da movimentação">
                <dl className="grid grid-cols-2 gap-3">
                    <Dado rotulo="NF / Romaneio" valor={devolucao.nf_numero} />
                    <Dado rotulo="Transportadora" valor={devolucao.transportadora} />
                    <Dado rotulo="Placa" valor={devolucao.placa} />
                    <Dado rotulo="Lacre" valor={devolucao.lacre} />
                    <Dado rotulo="Saída da loja" valor={formatarData(devolucao.saida_em)} />
                    <Dado rotulo="Chegada ao CD" valor={formatarData(devolucao.chegada_em)} />
                </dl>

                {devolucao.observacao && (
                    <p className="mt-3 border-t border-line pt-3 text-xs text-content-secondary">
                        {devolucao.observacao}
                    </p>
                )}
            </Card>
        );
    }

    return (
        <Card title="Dados da movimentação" subtitle="Complete antes do embarque">
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    form.patch(route('devolucoes.update', devolucao.id), { preserveScroll: true });
                }}
                className="space-y-3"
            >
                <Entrada
                    rotulo="NF / Romaneio nº"
                    valor={form.data.nf_numero}
                    onChange={(v) => form.setData('nf_numero', v)}
                />
                <Entrada
                    rotulo="Transportadora"
                    valor={form.data.transportadora}
                    onChange={(v) => form.setData('transportadora', v)}
                />
                <div className="grid grid-cols-2 gap-3">
                    <Entrada
                        rotulo="Placa"
                        valor={form.data.placa}
                        onChange={(v) => form.setData('placa', v.toUpperCase())}
                    />
                    <Entrada
                        rotulo="Lacre"
                        valor={form.data.lacre}
                        onChange={(v) => form.setData('lacre', v)}
                    />
                </div>
                <Entrada
                    rotulo="Saída da loja"
                    tipo="datetime-local"
                    valor={form.data.saida_em}
                    onChange={(v) => form.setData('saida_em', v)}
                />

                <Button type="submit" size="sm" variant="secondary" loading={form.processing}>
                    Salvar dados
                </Button>
            </form>
        </Card>
    );
}

/* ================================================================== */

/** Portão 2: a diretoria decide. Recusar exige motivo — a loja fica com a moto. */
function Decisao({ devolucao }) {
    const [modo, setModo] = useState(null);

    const aprovar = useForm({});
    const recusar = useForm({ motivo: '' });

    return (
        <Card title="Decisão da diretoria" subtitle="Só a aprovação libera a moto para coleta">
            {aprovar.errors.geral && (
                <p className="mb-3 rounded-lg bg-status-danger-bg p-3 text-xs font-bold text-status-danger-fg">
                    {aprovar.errors.geral}
                </p>
            )}

            {modo !== 'recusar' ? (
                <div className="flex flex-wrap gap-2">
                    <Button
                        icon={CheckCircleIcon}
                        loading={aprovar.processing}
                        onClick={() =>
                            aprovar.post(route('devolucoes.aprovar', devolucao.id), {
                                preserveScroll: true,
                            })
                        }
                    >
                        Aprovar devolução
                    </Button>
                    <Button variant="secondary" icon={XCircleIcon} onClick={() => setModo('recusar')}>
                        Negar
                    </Button>
                </div>
            ) : (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        recusar.post(route('devolucoes.recusar', devolucao.id), {
                            preserveScroll: true,
                        });
                    }}
                    className="space-y-3"
                >
                    <textarea
                        value={recusar.data.motivo}
                        onChange={(e) => recusar.setData('motivo', e.target.value)}
                        rows={3}
                        maxLength={500}
                        placeholder="Por que a moto deve permanecer na loja?"
                        className="w-full rounded border-line-strong bg-surface text-xs focus:ring-brand-500"
                    />
                    {recusar.errors.motivo && (
                        <span className="block text-[10px] font-bold text-status-danger-fg">
                            {recusar.errors.motivo}
                        </span>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="submit"
                            variant="danger"
                            loading={recusar.processing}
                            disabled={recusar.data.motivo.trim().length < 5}
                        >
                            Confirmar recusa
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setModo(null)}>
                            Voltar
                        </Button>
                    </div>
                </form>
            )}
        </Card>
    );
}

/* ================================================================== */

/** Portão 3: o CD fecha. Só passa com o checklist de destino de todas as motos. */
function Recebimento({ devolucao, pendencias }) {
    const form = useForm({
        chegada_em: '',
        entregador_nome: devolucao.entregador_nome ?? '',
        entregador_resultado: devolucao.entregador_resultado ?? '',
    });

    return (
        <Card title="Receber no CD" subtitle="Fecha a devolução e devolve as motos ao pátio">
            {pendencias.length > 0 && (
                <p className="mb-3 rounded-lg bg-status-warning-bg p-3 text-[11px] font-bold text-status-warning-fg">
                    Confira todas as motos antes de fechar — faltam {pendencias.length} pendência(s).
                </p>
            )}

            {form.errors.geral && (
                <p className="mb-3 whitespace-pre-line rounded-lg bg-status-danger-bg p-3 text-xs font-bold text-status-danger-fg">
                    {form.errors.geral}
                </p>
            )}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    form.post(route('devolucoes.receber', devolucao.id), { preserveScroll: true });
                }}
                className="space-y-3"
            >
                <Entrada
                    rotulo="Chegada ao CD"
                    tipo="datetime-local"
                    valor={form.data.chegada_em}
                    onChange={(v) => form.setData('chegada_em', v)}
                />

                <Entrada
                    rotulo="Entregador (conferência do transporte)"
                    valor={form.data.entregador_nome}
                    onChange={(v) => form.setData('entregador_nome', v)}
                />

                <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-content-muted">
                        Veredito do entregador
                    </span>
                    <select
                        value={form.data.entregador_resultado}
                        onChange={(e) => form.setData('entregador_resultado', e.target.value)}
                        className="w-full rounded border-line-strong bg-surface py-2 text-xs focus:ring-brand-500"
                    >
                        <option value="">Não informado</option>
                        <option value="conforme">Conforme — liberado</option>
                        <option value="ressalva">Com ressalva</option>
                        <option value="nao_conforme">Não conforme — retido</option>
                    </select>
                </label>

                <Button
                    type="submit"
                    icon={ArchiveBoxArrowDownIcon}
                    loading={form.processing}
                    disabled={pendencias.length > 0}
                    className="w-full"
                >
                    Fechar devolução
                </Button>
            </form>
        </Card>
    );
}

/* ================================================================== */

function Anexos({
    devolucao,
    item = null,
    etapa,
    anexos = [],
    titulo,
    subtitulo,
    podeEnviar = false,
    compacto = false,
}) {
    const form = useForm({ etapa, item_id: item?.id ?? null, arquivo: null, descricao: '' });
    const remover = useForm({});

    const enviar = (e) => {
        e.preventDefault();

        form.post(route('devolucoes.anexos.store', devolucao.id), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => form.reset('arquivo', 'descricao'),
        });
    };

    const conteudo = (
        <>
            {anexos.length > 0 ? (
                <ul className="mb-3 space-y-1.5">
                    {anexos.map((anexo) => (
                        <li key={anexo.id} className="flex items-center gap-2">
                            <PaperClipIcon className="h-3.5 w-3.5 shrink-0 text-content-muted" />
                            <a
                                href={anexo.url}
                                target="_blank"
                                rel="noreferrer"
                                className="min-w-0 flex-1 truncate text-[11px] font-bold text-brand-700 underline"
                            >
                                {anexo.descricao || anexo.nome || 'Anexo'}
                            </a>
                            {podeEnviar && (
                                <button
                                    type="button"
                                    title="Remover anexo"
                                    onClick={() =>
                                        remover.delete(
                                            route('devolucoes.anexos.destroy', [
                                                devolucao.id,
                                                anexo.id,
                                            ]),
                                            { preserveScroll: true }
                                        )
                                    }
                                    className="shrink-0 text-content-muted hover:text-status-danger-fg"
                                >
                                    <TrashIcon className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mb-3 text-[11px] text-content-muted">Nenhum anexo ainda.</p>
            )}

            {podeEnviar && (
                <form onSubmit={enviar} className="space-y-2">
                    <input
                        type="file"
                        accept="image/*,application/pdf"
                        capture="environment"
                        onChange={(e) => form.setData('arquivo', e.target.files[0])}
                        className="w-full text-[11px] text-content-secondary file:mr-2 file:rounded file:border-0 file:bg-brand-700 file:px-2.5 file:py-1.5 file:text-[11px] file:font-bold file:text-white"
                    />
                    {form.errors.arquivo && (
                        <span className="block text-[10px] font-bold text-status-danger-fg">
                            {form.errors.arquivo}
                        </span>
                    )}

                    <input
                        value={form.data.descricao}
                        onChange={(e) => form.setData('descricao', e.target.value)}
                        placeholder="Legenda (ex.: risco na carenagem direita)"
                        className="w-full rounded border-line-strong bg-surface py-1.5 text-[11px] focus:ring-brand-500"
                    />

                    <Button
                        type="submit"
                        size="sm"
                        variant="secondary"
                        icon={PaperClipIcon}
                        loading={form.processing}
                        disabled={!form.data.arquivo}
                    >
                        Anexar
                    </Button>
                </form>
            )}
        </>
    );

    if (compacto) {
        return (
            <div className="rounded-lg bg-surface-sunken p-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-content-muted">
                    {titulo}
                </p>
                {conteudo}
            </div>
        );
    }

    return (
        <Card title={titulo} subtitle={subtitulo}>
            {conteudo}
        </Card>
    );
}

/* ================================================================== */

function Aviso({ tom, titulo, children }) {
    const tons = {
        info: 'border-status-info-solid/40 bg-status-info-bg text-status-info-fg',
        success: 'border-status-success-solid/40 bg-status-success-bg text-status-success-fg',
        warning: 'border-status-warning-solid/40 bg-status-warning-bg text-status-warning-fg',
        danger: 'border-status-danger-solid/40 bg-status-danger-bg text-status-danger-fg',
    };

    const icones = {
        info: TruckIcon,
        success: CheckCircleIcon,
        warning: ExclamationTriangleIcon,
        danger: XCircleIcon,
    };

    const Icone = icones[tom];

    return (
        <div className={`mb-4 flex items-start gap-3 rounded-lg border p-4 ${tons[tom]}`}>
            <Icone className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 text-xs">
                <p className="font-bold">{titulo}</p>
                <div className="mt-0.5">{children}</div>
            </div>
        </div>
    );
}

function Dado({ rotulo, valor }) {
    return (
        <div>
            <dt className="text-[9px] font-black uppercase tracking-widest text-content-muted">
                {rotulo}
            </dt>
            <dd className="mt-0.5 text-xs font-bold text-content-primary">{valor || '—'}</dd>
        </div>
    );
}

function Entrada({ rotulo, valor, onChange, tipo = 'text' }) {
    return (
        <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-content-muted">
                {rotulo}
            </span>
            <input
                type={tipo}
                value={valor}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded border-line-strong bg-surface py-2 text-xs focus:ring-brand-500"
            />
        </label>
    );
}

function formatarData(valor) {
    if (!valor) return '—';

    return new Date(valor).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}
