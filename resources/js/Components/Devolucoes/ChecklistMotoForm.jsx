import { useMemo } from 'react';
import { useForm } from '@inertiajs/react';
import {
    CheckCircleIcon,
    ExclamationTriangleIcon,
    ShieldExclamationIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';

import { Button } from '@/Components/UI';

/**
 * O checklist de recebimento de moto, na tela.
 *
 * Os grupos e os itens vêm do backend (App\Services\Devolucao\ChecklistMoto) —
 * nada é digitado aqui. Acrescentar uma pergunta ao formulário é mexer em um
 * arquivo PHP, e esta tela passa a mostrá-la sozinha.
 *
 * POR QUE "MARCAR TUDO COMO CONFORME" NÃO É PREGUIÇA
 * São 31 itens e o caso comum é a moto estar inteira. Sem o atalho, quem
 * confere no galpão, de pé, no celular, aprende a clicar 31 vezes no automático
 * — e aí o checklist inteiro perde o valor. Com o atalho, o trabalho de verdade
 * fica onde deve: apontar as exceções e descrevê-las.
 *
 * O contador de marcados fica sempre visível porque a regra do servidor é dura:
 * a assinatura só é aceita com a lista completa.
 */
export default function ChecklistMotoForm({
    devolucaoId,
    item,
    etapa,
    grupos = [],
    onConcluir,
}) {
    const conferencia = item[etapa] ?? {};

    const todasChaves = useMemo(
        () => grupos.flatMap((g) => g.itens.map((i) => i.chave)),
        [grupos]
    );

    const form = useForm({
        etapa,
        respostas: conferencia.respostas ?? {},
        resultado: conferencia.resultado ?? '',
        responsavel: conferencia.responsavel ?? '',
        matricula: conferencia.matricula ?? '',
        observacao: conferencia.observacao ?? '',
        numero_motor: item.numero_motor ?? '',
    });

    const respostas = form.data.respostas;

    const marcados = todasChaves.filter((c) => respostas[c]).length;
    const naoConformes = todasChaves.filter((c) => respostas[c] === 'NC');
    const completo = marcados === todasChaves.length;

    const marcar = (chave, valor) =>
        form.setData('respostas', { ...respostas, [chave]: valor });

    const marcarTudoConforme = () =>
        form.setData(
            'respostas',
            todasChaves.reduce((acc, chave) => ({ ...acc, [chave]: respostas[chave] ?? 'C' }), {})
        );

    /*
     * O veredito é derivável das marcações e mesmo assim é escolhido à mão: o
     * servidor só recusa a combinação impossível (NC + "conforme"). "Com
     * ressalva" e "não conforme – retido" descrevem a mesma folha marcada e
     * significam coisas diferentes para a moto — quem está com ela na frente é
     * que decide qual é.
     */
    const resultados = [
        {
            valor: 'conforme',
            rotulo: 'Conforme — liberado',
            icone: CheckCircleIcon,
            // Classes escritas por extenso: o Tailwind varre o arquivo em busca
            // de literais, e `bg-status-${tom}-bg` nunca chegaria ao CSS.
            selecionado: 'bg-status-success-bg text-status-success-fg ring-status-success-solid',
            bloqueado: naoConformes.length > 0,
        },
        {
            valor: 'ressalva',
            rotulo: 'Com ressalva',
            icone: ExclamationTriangleIcon,
            selecionado: 'bg-status-warning-bg text-status-warning-fg ring-status-warning-solid',
            bloqueado: naoConformes.length === 0,
        },
        {
            valor: 'nao_conforme',
            rotulo: 'Não conforme — retido',
            icone: ShieldExclamationIcon,
            selecionado: 'bg-status-danger-bg text-status-danger-fg ring-status-danger-solid',
            bloqueado: naoConformes.length === 0,
        },
    ];

    const enviar = (e) => {
        e.preventDefault();

        form.post(route('devolucoes.conferir', [devolucaoId, item.id]), {
            preserveScroll: true,
            onSuccess: () => onConcluir?.(),
        });
    };

    return (
        <form onSubmit={enviar} className="space-y-5">
            {/* ---------- BARRA DE PROGRESSO ---------- */}
            <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-sunken px-3 py-2.5 ring-1 ring-line">
                <div className="text-xs">
                    <span className="font-black text-content-primary tabular-nums">
                        {marcados}/{todasChaves.length}
                    </span>{' '}
                    <span className="text-content-secondary">itens marcados</span>
                    {naoConformes.length > 0 && (
                        <span className="ml-2 rounded bg-status-danger-bg px-1.5 py-0.5 font-bold text-status-danger-fg">
                            {naoConformes.length} NC
                        </span>
                    )}
                </div>

                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={CheckIcon}
                    onClick={marcarTudoConforme}
                >
                    Marcar restantes como conforme
                </Button>
            </div>

            {form.errors.respostas && (
                <p className="rounded-lg bg-status-danger-bg p-3 text-xs font-bold text-status-danger-fg">
                    {form.errors.respostas}
                </p>
            )}

            {/* ---------- OS QUATRO BLOCOS ---------- */}
            {grupos.map((grupo) => (
                <div key={grupo.id}>
                    <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-content-muted">
                        {grupo.titulo}
                    </h4>

                    <ul className="divide-y divide-line rounded-lg ring-1 ring-line">
                        {grupo.itens.map((linha) => (
                            <li
                                key={linha.chave}
                                className="flex items-center justify-between gap-3 px-3 py-2"
                            >
                                <span
                                    className={`text-xs ${
                                        respostas[linha.chave] === 'NC'
                                            ? 'font-bold text-status-danger-fg'
                                            : 'text-content-secondary'
                                    }`}
                                >
                                    {linha.rotulo}
                                </span>

                                <div className="flex shrink-0 gap-1">
                                    <Marcador
                                        ativo={respostas[linha.chave] === 'C'}
                                        tom="success"
                                        onClick={() => marcar(linha.chave, 'C')}
                                    >
                                        C
                                    </Marcador>
                                    <Marcador
                                        ativo={respostas[linha.chave] === 'NC'}
                                        tom="danger"
                                        onClick={() => marcar(linha.chave, 'NC')}
                                    >
                                        NC
                                    </Marcador>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}

            {/* ---------- CAMPO 5: DESCRIÇÃO DAS AVARIAS ---------- */}
            <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-content-muted">
                    Observações / descrição das avarias
                    {naoConformes.length > 0 && (
                        <span className="ml-1 text-status-danger-fg">· obrigatório para todo NC</span>
                    )}
                </label>
                <textarea
                    value={form.data.observacao}
                    onChange={(e) => form.setData('observacao', e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Ex.: risco de 12 cm na carenagem direita e pisca esquerdo trincado"
                    className="w-full rounded border-line-strong bg-surface text-xs focus:ring-brand-500"
                />
                {form.errors.observacao && (
                    <span className="mt-1 block text-[10px] font-bold text-status-danger-fg">
                        {form.errors.observacao}
                    </span>
                )}
            </div>

            {/* ---------- VEREDITO ---------- */}
            <div>
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-content-muted">
                    Conferência {etapa === 'origem' ? 'na origem (saída)' : 'no destino (recebimento)'}
                </span>

                <div className="grid gap-2 sm:grid-cols-3">
                    {resultados.map((op) => (
                        <button
                            key={op.valor}
                            type="button"
                            disabled={op.bloqueado}
                            onClick={() => form.setData('resultado', op.valor)}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold ring-1 transition
                                ${
                                    form.data.resultado === op.valor
                                        ? op.selecionado
                                        : 'bg-surface-card text-content-secondary ring-line-strong hover:bg-surface-sunken'
                                }
                                ${op.bloqueado ? 'cursor-not-allowed opacity-40' : ''}`}
                        >
                            <op.icone className="h-4 w-4 shrink-0" />
                            {op.rotulo}
                        </button>
                    ))}
                </div>

                {form.errors.resultado && (
                    <span className="mt-1 block text-[10px] font-bold text-status-danger-fg">
                        {form.errors.resultado}
                    </span>
                )}
            </div>

            {/* ---------- ASSINATURA ---------- */}
            <div className="grid gap-3 sm:grid-cols-3">
                <Campo
                    rotulo="Nome do responsável"
                    valor={form.data.responsavel}
                    onChange={(v) => form.setData('responsavel', v)}
                    erro={form.errors.responsavel}
                />
                <Campo
                    rotulo="Matrícula"
                    valor={form.data.matricula}
                    onChange={(v) => form.setData('matricula', v)}
                    erro={form.errors.matricula}
                />
                <Campo
                    rotulo="Nº do motor"
                    valor={form.data.numero_motor}
                    onChange={(v) => form.setData('numero_motor', v)}
                    erro={form.errors.numero_motor}
                />
            </div>

            {form.errors.geral && (
                <p className="whitespace-pre-line rounded-lg bg-status-danger-bg p-3 text-xs font-bold text-status-danger-fg">
                    {form.errors.geral}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" loading={form.processing} disabled={!completo}>
                    Assinar conferência
                </Button>

                {!completo && (
                    <span className="text-[10px] text-content-muted">
                        Faltam {todasChaves.length - marcados} item(ns) para poder assinar.
                    </span>
                )}
            </div>
        </form>
    );
}

/** Botão C / NC. Alvo grande de propósito: é usado com luva, no galpão. */
function Marcador({ children, ativo, tom, onClick }) {
    const ativos = {
        success: 'bg-status-success-solid text-white ring-status-success-solid',
        danger: 'bg-status-danger-solid text-white ring-status-danger-solid',
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={`min-w-[2.5rem] rounded-md px-2 py-1.5 text-[11px] font-black ring-1 transition
                ${ativo ? ativos[tom] : 'bg-surface-card text-content-muted ring-line-strong hover:bg-surface-sunken'}`}
        >
            {children}
        </button>
    );
}

function Campo({ rotulo, valor, onChange, erro }) {
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
            {erro && (
                <span className="mt-1 block text-[10px] font-bold text-status-danger-fg">{erro}</span>
            )}
        </label>
    );
}
