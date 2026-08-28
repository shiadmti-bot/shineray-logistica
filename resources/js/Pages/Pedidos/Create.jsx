import AppLayout from '@/Layouts/AppLayout';
import { PageHeader, Button } from '@/Components/UI';
import { Head, useForm, router } from '@inertiajs/react';
import { useState, useEffect, useMemo } from 'react';
import Swal from 'sweetalert2';
import axios from 'axios';
import {
    ArchiveBoxIcon,
    CheckCircleIcon,
    ArrowPathIcon,
    InformationCircleIcon,
    ArrowDownIcon,
    TrashIcon,
    ExclamationTriangleIcon,
    PlusIcon,
} from '@heroicons/react/24/outline';

export default function PedidoCreate({
    auth,
    listaModelos,
    lojasDisponiveis = [],
    cdUserId,
    locaisEntrega = [],
    estoqueCD = [],
    motivosChassiObrigatorio = []
}) {

    // Configura um "Anti-Dormida" para manter a sessão ativa enquanto o usuário demora digitando
    useEffect(() => {
        const interval = setInterval(() => {
            // Chamamos uma rota que possui middleware 'web' para renovar a sessão e o CSRF
            axios.get(route('api.estoque.loja')).catch(() => {});
        }, 14 * 60 * 1000); // Ping a cada 14 minutos
        return () => clearInterval(interval);
    }, []);

    const [logisticaInfo, setLogisticaInfo] = useState(null);

    // Único motivo que autoriza a loja a pedir um CHASSI ESPECÍFICO do CD.
    // É o motivo aplicado automaticamente ao vir da tela de Estoque.
    const MOTIVO_VENDA = "Venda Confirmada (Cliente)";

    const motivosOpcoes = [
        "Estoque Regular (Giro)",
        MOTIVO_VENDA,
        "Test Drive / Frota",
        "Exposição / Showroom",
        "Reposição de Garantia",
        "Uso Interno",
        "Avaria de Transporte",
        "Defeito de Fabricação",
        "Excesso de Estoque",
        "Troca de Modelo",
        "Manutenção / Reparo"
    ];

    // Se o cron do Microwork falhar, estoqueCD vem vazio e o formulário volta
    // automaticamente para digitação livre — a loja nunca fica impedida de pedir.
    const temEstoqueCD = estoqueCD.length > 0;

    // Modelos disponíveis para o dropdown (combina estoque do CD com catálogo completo do banco)
    const modelosCD = useMemo(
        () => Array.from(new Set([...estoqueCD.map(e => e.modelo), ...(listaModelos || [])])).filter(Boolean).sort(),
        [estoqueCD, listaModelos]
    );

    const coresDoModelo = (modelo) => {
        const doEstoque = estoqueCD.filter(e => e.modelo === modelo);
        if (doEstoque.length > 0) {
            return doEstoque.sort((a, b) => a.cor.localeCompare(b.cor));
        }
        // Se o modelo não possui saldo no CD no momento, oferece opções de cores para permitir o pedido
        return [
            { cor: 'VERMELHA', disponivel: 0 },
            { cor: 'PRETA', disponivel: 0 },
            { cor: 'BRANCA', disponivel: 0 },
            { cor: 'CINZA', disponivel: 0 },
            { cor: 'AZUL', disponivel: 0 },
            { cor: 'AMARELA', disponivel: 0 },
            { cor: 'BEGE', disponivel: 0 }
        ];
    };

    const disponivelDe = (modelo, cor) =>
        estoqueCD.find(e => e.modelo === modelo && e.cor === cor)?.disponivel ?? null;

    const novoItem = (base = {}) => ({
        modelo: '',
        chassi: '',
        cor: '',
        ano: '',
        motivo: '',
        quantidade: 1,
        local: locaisEntrega.includes(auth.user.filial) ? auth.user.filial : '',
        travaMotivo: false, // true quando o item veio da tela de Estoque (motivo fixo)
        ...base
    });

    const initPrefill = () => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const prefill = params.get('prefill_motos');
            if (prefill) {
                try {
                    const parsed = JSON.parse(decodeURIComponent(prefill));
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        // Veio da tela de Estoque: pré-preenche modelo, cor e chassi,
                        // mas NÃO trava o motivo em Venda Confirmada para dar flexibilidade ao vendedor.
                        return parsed.map(m => novoItem({
                            modelo: m.modelo || '',
                            chassi: m.chassi || '',
                            cor: m.cor || '',
                            ano: m.ano || '',
                            motivo: MOTIVO_VENDA,
                            travaMotivo: false
                        }));
                    }
                } catch(e) { console.error("Error parsing prefill motos", e); }
            }
        }
        return [novoItem()];
    };

    const { data, setData, post, processing, errors } = useForm({
        origem_id: '',
        destino_id: '', // V2.6: vazio = eu recebo. Preenchido = estou enviando (ex: devolução ao CD)
        itens: initPrefill(),
        observacao: '',
        modo: 'cd',
        cd_user_id: cdUserId
    });

    const enviandoParaCD = data.modo === 'transferencia' && String(data.destino_id) === String(cdUserId) && !!cdUserId;

    /**
     * REGRA V2.6 — Quando o chassi é obrigatório:
     *  - Transferências (a loja já tem a moto física em mãos)
     *  - Venda Confirmada (compatibilidade com pedidos legados)
     * Nos demais casos a loja pede Modelo + Cor + Quantidade e o CD atribui os chassis.
     */
    const exigeChassiPara = (item, modo) =>
        modo === 'transferencia' || motivosChassiObrigatorio.includes(item.motivo);

    const exigeChassi = (item) => exigeChassiPara(item, data.modo);

    // Pedido originado na tela de Estoque (chassi específico já escolhido)
    const veioDoEstoque = data.itens.some(i => i.travaMotivo);

    const totalUnidades = data.itens.reduce(
        (acc, item) => acc + (exigeChassi(item) ? 1 : Math.max(1, parseInt(item.quantidade) || 1)),
        0
    );

    const verificarLogistica = async (fornecedorId) => {
        if (!fornecedorId) {
            setLogisticaInfo(null);
            return;
        }
        try {
            const response = await axios.post(route('pedidos.logistica'), { fornecedor_id: fornecedorId });
            setLogisticaInfo(response.data);
        } catch (error) {
            console.error("Erro validação rota:", error);
        }
    };

    const handleFornecedorChange = async (e) => {
        const id = e.target.value;
        setData('origem_id', id);
        verificarLogistica(id);
    };

    const handleDestinoChange = (e) => {
        const id = e.target.value;
        const paraCD = String(id) === String(cdUserId) && !!cdUserId;

        setData(d => ({
            ...d,
            destino_id: id,
            // Enviando para o CD => a origem sou eu
            origem_id: paraCD ? String(auth.user.id) : '',
            itens: paraCD ? d.itens.map(item => ({ ...item, local: 'Matriz / CD' })) : d.itens
        }));

        if (paraCD) {
            verificarLogistica(auth.user.id);
        } else {
            setLogisticaInfo(null);
        }
    };

    const handleModeChange = (novoModo) => {
        setLogisticaInfo(null);

        setData(d => ({
            ...d,
            modo: novoModo,
            origem_id: '',
            destino_id: '',
            // Ao voltar para Reposição CD, limpa apenas os chassis que deixaram de ser
            // exigidos. Itens de Venda Confirmada (e os vindos do Estoque) mantêm o chassi.
            itens: d.itens.map(i => exigeChassiPara(i, novoModo) ? i : { ...i, chassi: '' })
        }));
    };

    const addItem = () => {
        setData('itens', [
            ...data.itens,
            novoItem({ local: enviandoParaCD ? 'Matriz / CD' : (data.itens[data.itens.length - 1]?.local || '') })
        ]);
    };

    const removeItem = (index) => {
        const novosItens = [...data.itens];
        novosItens.splice(index, 1);
        setData('itens', novosItens);
    };

    const updateItem = (index, field, value) => {
        const novosItens = [...data.itens];
        novosItens[index] = { ...novosItens[index], [field]: value };

        // Trocou o modelo: a cor anterior pode não existir para o novo modelo
        if (field === 'modelo' && temEstoqueCD && data.modo === 'cd') {
            const cores = coresDoModelo(value);
            novosItens[index].cor = cores.length === 1 ? cores[0].cor : '';
        }

        // Trocou para um motivo que não pede chassi: descarta o chassi digitado,
        // senão ele ficaria invisível no formulário mas ainda seria enviado.
        if (field === 'motivo' && !exigeChassiPara(novosItens[index], data.modo)) {
            novosItens[index].chassi = '';
        }

        setData('itens', novosItens);
    };

    const replicarDestino = () => {
        const primeiroLocal = data.itens[0].local;
        if (!primeiroLocal) return Swal.fire('Atenção', 'Selecione um destino na primeira linha.', 'warning');

        setData('itens', data.itens.map(item => ({ ...item, local: primeiroLocal })));

        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
        Toast.fire({ icon: 'success', title: `Destino "${primeiroLocal}" copiado!` });
    };

    const submit = (e) => {
        e.preventDefault();

        const camposFaltando = [];
        const avisos = [];

        data.itens.forEach((item, i) => {
            const precisaChassi = exigeChassi(item);

            if (!item.modelo) camposFaltando.push(`Moto #${i + 1}: Modelo não preenchido`);
            if (!item.cor) camposFaltando.push(`Moto #${i + 1}: Cor não preenchida`);
            if (!item.motivo) camposFaltando.push(`Moto #${i + 1}: Motivo não selecionado`);
            if (!item.local) camposFaltando.push(`Moto #${i + 1}: Destino não selecionado`);

            if (precisaChassi) {
                if (!item.chassi || item.chassi.trim().length < 11) {
                    camposFaltando.push(`Moto #${i + 1}: Chassi inválido ou vazio (mínimo 11 caracteres)`);
                }
            } else {
                const qtd = parseInt(item.quantidade) || 0;
                if (qtd < 1) camposFaltando.push(`Item #${i + 1}: Quantidade deve ser no mínimo 1`);

                // Aviso NÃO bloqueante: o cache do Microwork pode estar defasado em até 15 min
                const disp = disponivelDe(item.modelo, item.cor);
                if (disp !== null && qtd > disp) {
                    avisos.push(`Item #${i + 1}: você pediu ${qtd}x ${item.modelo} ${item.cor}, mas o CD tem ${disp} disponível(is) agora.`);
                }
            }
        });

        if (camposFaltando.length > 0) {
            return Swal.fire({
                icon: 'warning',
                title: 'Campos Obrigatórios',
                html: `<div style="text-align:left;font-size:13px;"><ul style="list-style:disc;padding-left:20px;">${camposFaltando.map(c => `<li>${c}</li>`).join('')}</ul></div>`,
                confirmButtonColor: '#dc2626'
            });
        }

        const enviar = () => post(route('pedidos.store'), {
            onSuccess: (page) => {
                // VERIFICAÇÃO RÍGIDA: Garante que o backend DE FATO criou o pedido
                const successMsg = page.props.flash?.success || page.props.flash?.message;
                const errorMsg = page.props.flash?.error;

                if (successMsg) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Sucesso!',
                        text: typeof successMsg === 'string' ? successMsg : 'Solicitação enviada.',
                        confirmButtonColor: '#dc2626'
                    }).then(() => {
                        router.visit(route('pedidos.index'));
                    });
                } else if (errorMsg) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Falha no Servidor',
                        text: typeof errorMsg === 'string' ? errorMsg : 'Erro desconhecido retornado pelo servidor.'
                    });
                } else if (!page.props.auth?.user) {
                    Swal.fire('Sessão Expirada', 'Você ficou muito tempo inativo. Faça login novamente.', 'error');
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro de Comunicação',
                        text: 'A resposta do servidor foi incompleta (timeout ou erro severo). O seu pedido NÃO foi criado. Atualize a página e tente de novo subdividindo o pedido.'
                    });
                }
            },
            onError: (errors) => {
                Swal.fire({
                    icon: 'error',
                    title: 'Atenção',
                    text: Object.values(errors)[0] || 'Verifique os campos obrigatórios.',
                    confirmButtonColor: '#dc2626'
                });
            }
        });

        if (avisos.length > 0) {
            return Swal.fire({
                icon: 'warning',
                title: 'Quantidade acima do estoque atual',
                html: `<div style="text-align:left;font-size:13px;">
                        <ul style="list-style:disc;padding-left:20px;">${avisos.map(a => `<li>${a}</li>`).join('')}</ul>
                        <p style="margin-top:10px;color:#666;">O estoque exibido é atualizado periodicamente e pode estar defasado. Você pode enviar mesmo assim — o CD atenderá o que houver e informará o saldo em falta.</p>
                       </div>`,
                showCancelButton: true,
                confirmButtonText: 'Enviar assim mesmo',
                cancelButtonText: 'Revisar',
                confirmButtonColor: '#dc2626'
            }).then(r => { if (r.isConfirmed) enviar(); });
        }

        enviar();
    };

    // ---------- Render dos campos (compartilhado entre desktop e mobile) ----------
    // IMPORTANTE: são funções que retornam JSX, e NÃO componentes.
    // Declarar um componente aqui dentro faria o React remontar o input a cada
    // tecla digitada, fazendo o campo perder o foco.

    const campoModelo = (item, index, mobile) => {
        const base = mobile
            ? "w-full border-line-strong rounded-lg uppercase font-bold text-base py-3 px-4 focus:ring-brand-500 focus:border-brand-500 bg-surface-card"
            : "w-full border-line-strong rounded uppercase font-bold text-sm focus:ring-brand-500 focus:border-brand-500 bg-surface-card";

        // Pedido genérico ao CD com estoque sincronizado => select do estoque real
        if (data.modo === 'cd' && !exigeChassi(item) && temEstoqueCD) {
            return (
                <select required value={item.modelo} onChange={(e) => updateItem(index, 'modelo', e.target.value)} className={base}>
                    <option value="">Selecione o modelo...</option>
                    {modelosCD.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            );
        }

        return (
            <input
                required type="text" list="opcoes-modelos" placeholder={mobile ? "Ex: SHI 175 EFI" : "MODELO..."}
                value={item.modelo}
                onChange={(e) => updateItem(index, 'modelo', e.target.value.toUpperCase())}
                className={base}
            />
        );
    };

    const campoMotivo = (item, index, mobile) => {
        const base = mobile
            ? "w-full rounded-lg text-base py-3 px-4 border-line-strong"
            : "w-full rounded text-sm border-line-strong";

        // Item vindo da tela de Estoque: a loja escolheu um chassi específico, e o
        // único motivo que autoriza isso é Venda Confirmada. Motivo fixo e explicado.
        if (item.travaMotivo) {
            return (
                <div>
                    <input
                        disabled
                        value={MOTIVO_VENDA}
                        className={`${base} bg-status-success-bg text-status-success-fg border-status-success-solid/30 font-bold`}
                    />
                    <p className="text-[10px] text-status-success-fg mt-0.5">
                        Fixo: pedido de chassi específico
                    </p>
                </div>
            );
        }

        return (
            <select
                required value={item.motivo}
                onChange={(e) => updateItem(index, 'motivo', e.target.value)}
                className={base}
            >
                <option value="" disabled>Selecione...</option>
                {motivosOpcoes.map((m, i) => <option key={i} value={m}>{m}</option>)}
            </select>
        );
    };

    const campoCor = (item, index, mobile) => {
        const base = mobile
            ? "w-full border-line-strong rounded-lg uppercase text-base py-3 px-4"
            : "w-full border-line-strong rounded uppercase text-sm";

        if (data.modo === 'cd' && !exigeChassi(item) && temEstoqueCD) {
            const cores = coresDoModelo(item.modelo);
            return (
                <select
                    required value={item.cor} disabled={!item.modelo}
                    onChange={(e) => updateItem(index, 'cor', e.target.value)}
                    className={`${base} disabled:bg-surface-sunken disabled:text-content-muted`}
                >
                    <option value="">{item.modelo ? 'Cor...' : 'Escolha o modelo'}</option>
                    {cores.map(c => (
                        <option key={c.cor} value={c.cor}>{c.cor} ({c.disponivel})</option>
                    ))}
                </select>
            );
        }

        return (
            <input
                required type="text" placeholder="COR" value={item.cor}
                onChange={(e) => updateItem(index, 'cor', e.target.value.toUpperCase())}
                className={base}
            />
        );
    };

    const campoChassiOuQtd = (item, index, mobile) => {
        if (exigeChassi(item)) {
            const cls = mobile
                ? `w-full rounded-lg font-mono tracking-wider text-base py-3 px-4 ${!item.chassi ? 'border-status-danger-solid/40 bg-status-danger-bg' : item.chassi.length >= 11 ? 'border-status-success-solid bg-status-success-bg' : 'border-status-warning-solid/40 bg-status-warning-bg'}`
                : `w-full rounded font-mono tracking-widest text-sm ${!item.chassi ? 'border-status-danger-solid/40 bg-status-danger-bg' : item.chassi.length >= 11 ? 'border-status-success-solid bg-status-success-bg' : 'border-status-warning-solid/40 bg-status-warning-bg'}`;

            return (
                <input
                    required type="text" placeholder={mobile ? "99NWJ1125T5003297" : "CHASSI"} minLength={11} maxLength={17}
                    value={item.chassi}
                    onChange={(e) => updateItem(index, 'chassi', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    className={cls}
                />
            );
        }

        const disp = disponivelDe(item.modelo, item.cor);
        const qtd = parseInt(item.quantidade) || 1;
        const excede = disp !== null && qtd > disp;

        return (
            <div>
                <input
                    required type="number" min={1} max={50} inputMode="numeric"
                    value={item.quantidade}
                    onChange={(e) => updateItem(index, 'quantidade', e.target.value)}
                    className={`w-full rounded ${mobile ? 'rounded-lg text-base py-3 px-4' : 'text-sm'} font-black text-center ${excede ? 'border-status-warning-solid bg-status-warning-bg text-status-warning-fg' : 'border-status-info-solid/40 bg-status-info-bg text-status-info-fg'}`}
                />
                {disp !== null && (
                    <p className={`text-[10px] mt-0.5 text-center ${excede ? 'text-status-warning-fg font-bold' : 'text-content-muted'}`}>
                        {excede ? `Só há ${disp} no CD` : `${disp} disponíveis`}
                    </p>
                )}
            </div>
        );
    };

    return (
        <AppLayout user={auth.user}>
            <Head title="Nova Solicitação" />

            {/* pb-32: o rodape de total e envio e fixo e cobriria o fim do formulario. */}
            <div className="pb-32">
                <PageHeader
                    title="Nova Solicitação"
                    description={
                        data.modo === 'transferencia'
                            ? 'Movimentação entre filiais — o chassi identifica a moto que já existe.'
                            : 'Pedido ao CD por modelo, cor e quantidade.'
                    }
                    breadcrumbs={[
                        { label: 'Pedidos', href: route('pedidos.index') },
                        { label: 'Nova Solicitação' },
                    ]}
                />

                    {Object.keys(errors).length > 0 && (
                        <div className="mb-6 flex items-center gap-3 rounded-lg border-l-4 border-status-danger-solid bg-status-danger-bg p-4">
                            <span className="mr-3"><ExclamationTriangleIcon className="w-8 h-8 text-status-danger-fg" /></span>
                            <div>
                                <h3 className="font-bold text-status-danger-fg">Atenção Necessária</h3>
                                <p className="text-sm text-status-danger-fg">{Object.values(errors)[0] || 'Preencha todos os campos obrigatórios.'}</p>
                            </div>
                        </div>
                    )}

                    {veioDoEstoque && (
                        <div className="mb-6 bg-status-success-bg border-l-4 border-status-success-solid p-4 rounded shadow flex items-start gap-3">
                            <CheckCircleIcon className="w-6 h-6 text-status-success-fg flex-shrink-0" />
                            <div>
                                <h3 className="font-bold text-status-success-fg text-sm">Solicitação de chassi específico (vinda do Estoque)</h3>
                                <p className="text-xs text-status-success-fg mt-0.5">
                                    O motivo foi fixado como <b>{MOTIVO_VENDA}</b>, o único que autoriza a loja a reservar
                                    um chassi específico do CD.
                                </p>
                                <p className="text-xs text-status-success-fg mt-1.5">
                                    Para <b>giro / reposição de estoque</b>, não use esta tela a partir do Estoque: entre em{' '}
                                    <b>Nova Solicitação</b> e peça por <b>modelo + cor + quantidade</b> (ex: 5x NEW JEF VERMELHA).
                                    O CD define quais chassis enviar.
                                </p>
                            </div>
                        </div>
                    )}

                    {!temEstoqueCD && (
                        <div className="mb-6 bg-status-warning-bg border-l-4 border-status-warning-solid p-4 rounded shadow flex items-start gap-3">
                            <ExclamationTriangleIcon className="w-6 h-6 text-status-warning-fg flex-shrink-0" />
                            <div>
                                <h3 className="font-bold text-status-warning-fg text-sm">Estoque do CD indisponível no momento</h3>
                                <p className="text-xs text-status-warning-fg">A sincronização com o Microwork não retornou dados. Você pode continuar pedindo normalmente digitando o modelo e a cor à mão.</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.type !== 'textarea') e.preventDefault(); }} className="space-y-6">

                        <div className={`bg-surface-card overflow-hidden shadow-sm sm:rounded-lg p-6 border-l-4 ${data.modo === 'transferencia' ? 'border-status-warning-solid' : 'border-status-info-solid'}`}>
                            <h3 className="text-lg font-bold text-content-primary mb-4 flex items-center gap-2"><ArchiveBoxIcon className="w-5 h-5" /> Tipo de Movimentação</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div
                                    onClick={() => handleModeChange('cd')}
                                    className={`cursor-pointer border-2 rounded-lg p-4 flex items-center gap-4 transition ${data.modo === 'cd' ? 'border-status-info-solid bg-status-info-bg ring-1 ring-status-info-solid' : 'border-line hover:border-status-info-solid/40'}`}
                                >
                                    <ArchiveBoxIcon className={`w-10 h-10 ${data.modo === 'cd' ? 'text-status-info-fg' : 'text-content-muted'}`} />
                                    <div>
                                        <div className="font-bold text-content-primary">Reposição CD</div>
                                        <div className="text-xs text-content-muted">Pedir estoque ao CD por modelo, cor e quantidade.</div>
                                    </div>
                                    {data.modo === 'cd' && <CheckCircleIcon className="w-6 h-6 ml-auto text-status-info-fg" />}
                                </div>

                                <div
                                    onClick={() => handleModeChange('transferencia')}
                                    className={`cursor-pointer border-2 rounded-lg p-4 flex items-center gap-4 transition ${data.modo === 'transferencia' ? 'border-status-warning-solid bg-status-warning-bg ring-1 ring-status-warning-solid' : 'border-line hover:border-status-warning-solid/40'}`}
                                >
                                    <ArrowPathIcon className={`w-10 h-10 ${data.modo === 'transferencia' ? 'text-status-warning-fg' : 'text-content-muted'}`} />
                                    <div>
                                        <div className="font-bold text-content-primary">Transferência</div>
                                        <div className="text-xs text-content-muted">Buscar moto em outra filial <b>ou devolver ao CD</b>.</div>
                                    </div>
                                    {data.modo === 'transferencia' && <CheckCircleIcon className="w-6 h-6 ml-auto text-status-warning-fg" />}
                                </div>
                            </div>

                            {data.modo === 'cd' && (
                                <div className="animate-fadeIn bg-status-info-bg p-4 rounded-lg border border-status-info-solid/20 flex items-start gap-3">
                                    <InformationCircleIcon className="w-8 h-8 text-status-info-fg flex-shrink-0" />
                                    <div>
                                        <h4 className="font-bold text-status-info-fg">Pedido por Modelo e Cor</h4>
                                        <p className="text-xs text-status-info-fg">Escolha o modelo, a cor e a quantidade desejada. <b>A equipe do CD é quem define quais chassis serão enviados.</b> Se o motivo for "Venda Confirmada (Cliente)", o campo de chassi aparece automaticamente.</p>
                                    </div>
                                </div>
                            )}

                            {data.modo === 'transferencia' && (
                                <div className="animate-fadeIn bg-status-warning-bg p-4 rounded-lg border border-status-warning-solid/20 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-content-secondary mb-1">Para onde vai a moto? *</label>
                                        <select
                                            value={data.destino_id}
                                            onChange={handleDestinoChange}
                                            className="w-full border-line-strong rounded-lg shadow-sm focus:ring-status-warning-solid focus:border-status-warning-solid font-bold text-content-secondary"
                                        >
                                            <option value="">Para a minha loja ({auth.user.filial}) — estou recebendo</option>
                                            {cdUserId && <option value={cdUserId}>Para a Matriz / CD — estou devolvendo/enviando</option>}
                                        </select>
                                    </div>

                                    {!enviandoParaCD ? (
                                        <div>
                                            <label className="block text-sm font-bold text-content-secondary mb-1">Selecione a Loja Fornecedora *</label>
                                            <select
                                                required
                                                value={data.origem_id}
                                                onChange={handleFornecedorChange}
                                                className="w-full border-line-strong rounded-lg shadow-sm focus:ring-status-warning-solid focus:border-status-warning-solid font-bold text-content-secondary"
                                            >
                                                <option value="">-- Escolha a loja que tem a moto --</option>
                                                {lojasDisponiveis.filter(l => l.id !== auth.user.id).map(loja => (
                                                    <option key={loja.id} value={loja.id}>{loja.filial ? `${loja.filial} (${loja.name})` : loja.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-3 bg-surface-card p-3 rounded border border-status-warning-solid/30">
                                            <InformationCircleIcon className="w-7 h-7 text-status-warning-fg flex-shrink-0" />
                                            <p className="text-xs text-status-warning-fg">
                                                <b>Envio para o CD.</b> As motos sairão da sua loja ({auth.user.filial}) com destino à Matriz / CD.
                                                Informe o <b>chassi</b> de cada moto que está saindo. Esta operação substitui a antiga "Devolução".
                                            </p>
                                        </div>
                                    )}

                                    <p className="text-[10px] text-status-warning-fg">* Em transferências o chassi é sempre obrigatório, pois a moto já existe fisicamente na loja de origem.</p>
                                </div>
                            )}
                        </div>

                        <div className="overflow-hidden rounded-card border-t-4 border-brand-600 bg-surface-card p-6 shadow-card ring-1 ring-line">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-content-primary">Itens do Pedido</h3>
                                <p className="text-sm text-content-muted">
                                    {data.modo === 'transferencia'
                                        ? 'Informe o chassi de cada moto que será movimentada.'
                                        : 'Escolha modelo, cor e quantidade. O CD definirá os chassis.'}
                                </p>
                            </div>

                            <datalist id="opcoes-modelos">
                                {listaModelos.map((nome, index) => ( <option key={index} value={nome} /> ))}
                            </datalist>

                            {/* CABEÇALHO DESKTOP */}
                            <div className="hidden md:grid grid-cols-12 gap-3 mb-2 font-bold text-xs uppercase text-content-muted px-2 items-end">
                                <div className="col-span-1 text-center">#</div>
                                <div className="col-span-3">Modelo *</div>
                                <div className="col-span-2">{data.modo === 'transferencia' ? 'Chassi *' : 'Chassi / Qtd *'}</div>
                                <div className="col-span-2">Destino Final *</div>
                                <div className="col-span-1">Cor *</div>
                                <div className="col-span-2">Motivo *</div>
                                <div className="col-span-1"></div>
                            </div>

                            <div className="space-y-3">
                                {data.itens.map((item, index) => (
                                    <div key={index} className={`rounded-xl border shadow-sm transition-all relative ${errors[`itens.${index}`] ? 'border-status-danger-solid/40 bg-status-danger-bg' : 'border-line bg-surface-sunken'}`}>

                                        {/* ===== LAYOUT DESKTOP (md+) ===== */}
                                        <div className="hidden md:grid grid-cols-12 gap-3 items-center p-4">
                                            <div className="col-span-1 text-center font-bold text-content-muted">{index + 1}</div>

                                            <div className="col-span-3">
                                                {campoModelo(item, index, false)}
                                            </div>

                                            <div className="col-span-2">
                                                {campoChassiOuQtd(item, index, false)}
                                            </div>

                                            <div className="col-span-2 relative">
                                                {enviandoParaCD ? (
                                                    <input disabled value="Matriz / CD" className="w-full rounded text-sm bg-status-warning-bg text-status-warning-fg border-status-warning-solid/30 font-bold text-center" />
                                                ) : (
                                                    <select required value={item.local} onChange={(e) => updateItem(index, 'local', e.target.value)} className="w-full rounded text-sm bg-status-warning-bg focus:bg-surface-card border-line-strong">
                                                        <option value="" disabled>Selecione...</option>
                                                        {locaisEntrega.map(local => <option key={local} value={local}>{local}</option>)}
                                                    </select>
                                                )}
                                                {index === 0 && data.itens.length > 1 && !enviandoParaCD && (
                                                    <button type="button" onClick={replicarDestino} className="absolute -top-5 right-0 text-[10px] text-status-info-fg hover:underline font-bold flex items-center gap-1">
                                                        Copiar p/ todos <ArrowDownIcon className="w-3 h-3 inline" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="col-span-1">
                                                {campoCor(item, index, false)}
                                            </div>

                                            <div className="col-span-2">
                                                {campoMotivo(item, index, false)}
                                            </div>

                                            <div className="col-span-1 text-center">
                                                {data.itens.length > 1 && (
                                                    <button type="button" onClick={() => removeItem(index)} className="text-content-muted hover:text-status-danger-fg text-xl p-2 transition rounded-full hover:bg-status-danger-bg">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* ===== LAYOUT MOBILE ===== */}
                                        <div className="md:hidden p-4 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="bg-surface-sunken text-content-secondary text-xs font-black px-2.5 py-1 rounded-full">
                                                    {exigeChassi(item) ? `Moto #${index + 1}` : `Item #${index + 1}`}
                                                </span>
                                                {data.itens.length > 1 && (
                                                    <button type="button" onClick={() => removeItem(index)} className="text-status-danger-fg hover:text-status-danger-fg p-1.5 rounded-full hover:bg-status-danger-bg transition">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-content-muted uppercase mb-1">Modelo *</label>
                                                {campoModelo(item, index, true)}
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-content-muted uppercase mb-1">
                                                    {exigeChassi(item)
                                                        ? <>Chassi * <span className="text-content-muted normal-case font-normal">(mín. 11 caracteres)</span></>
                                                        : <>Quantidade * <span className="text-content-muted normal-case font-normal">(o CD define os chassis)</span></>}
                                                </label>
                                                {campoChassiOuQtd(item, index, true)}
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-content-muted uppercase mb-1">Destino Final *</label>
                                                {enviandoParaCD ? (
                                                    <input disabled value="Matriz / CD" className="w-full rounded-lg text-base py-3 px-4 bg-status-warning-bg text-status-warning-fg border-status-warning-solid/30 font-bold text-center" />
                                                ) : (
                                                    <select
                                                        required value={item.local}
                                                        onChange={(e) => updateItem(index, 'local', e.target.value)}
                                                        className="w-full rounded-lg text-base py-3 px-4 bg-status-warning-bg focus:bg-surface-card border-line-strong"
                                                    >
                                                        <option value="" disabled>Selecione o destino...</option>
                                                        {locaisEntrega.map(local => <option key={local} value={local}>{local}</option>)}
                                                    </select>
                                                )}
                                                {index === 0 && data.itens.length > 1 && !enviandoParaCD && (
                                                    <button type="button" onClick={replicarDestino} className="mt-1 text-xs text-status-info-fg hover:underline font-bold flex items-center gap-1">
                                                        <ArrowDownIcon className="w-3 h-3" /> Copiar destino p/ todas as motos
                                                    </button>
                                                )}
                                            </div>

                                            {/* Empilha no celular: Cor e Motivo lado a lado
                                                em 360px deixavam os dois selects com ~150px,
                                                estreitos demais para ler a opção escolhida. */}
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                                                <div className="sm:col-span-2">
                                                    <label className="block text-xs font-bold text-content-muted uppercase mb-1">Cor *</label>
                                                    {campoCor(item, index, true)}
                                                </div>
                                                <div className="sm:col-span-3">
                                                    <label className="block text-xs font-bold text-content-muted uppercase mb-1">Motivo *</label>
                                                    {campoMotivo(item, index, true)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 flex flex-col md:flex-row justify-between items-start gap-6 border-t border-line pt-6">
                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-status-info-solid/40 px-6 py-4 font-bold text-status-info-fg transition hover:bg-status-info-bg md:w-auto"
                                >
                                    <PlusIcon className="h-5 w-5" /> Adicionar Item
                                </button>
                                <div className="w-full md:w-1/2">
                                    <label className="block text-sm font-bold text-content-secondary mb-1">Observações</label>
                                    <textarea
                                        value={data.observacao} onChange={e => setData('observacao', e.target.value)}
                                        className="w-full border-line-strong rounded h-20 text-sm focus:ring-brand-500 focus:border-brand-500"
                                        placeholder="Alguma ressalva importante..."
                                    ></textarea>
                                </div>
                            </div>
                        </div>

                        <div className="fixed bottom-0 left-0 z-overlay w-full border-t border-line bg-surface-card p-3 shadow-overlay md:p-4">
                            <div className="max-w-7xl mx-auto flex justify-between items-center px-2 md:px-4 gap-2">
                                <div className="flex flex-col md:flex-row md:items-baseline">
                                    <span className="text-[10px] md:text-sm text-content-muted font-bold uppercase md:hidden">Motos</span>
                                    <span className="text-content-secondary hidden md:inline font-medium">Total:</span>
                                    <span className="md:ml-2 text-xl md:text-2xl font-black text-brand-600 leading-none">{totalUnidades} <span className="hidden md:inline">motos</span></span>
                                </div>
                                <button
                                    type="submit"
                                    disabled={processing || (data.modo === 'transferencia' && (!logisticaInfo || logisticaInfo.erro))}
                                    className="w-full md:w-auto px-4 md:px-8 py-3 md:py-3 rounded-lg font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 text-white text-xs md:text-base whitespace-nowrap bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800"
                                >
                                    {processing ? 'Processando...' :
                                        data.modo === 'transferencia'
                                            ? (enviandoParaCD ? 'Enviar para o CD ↩️' : 'Solicitar Transferência 🔁')
                                            : 'Solicitar Reposição 🚀'
                                    }
                                </button>
                            </div>
                        </div>

                    </form>
            </div>
        </AppLayout>
    );
}
