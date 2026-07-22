import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
    ExclamationTriangleIcon
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

    // Modelos disponíveis no CD (para os selects do pedido genérico)
    const modelosCD = useMemo(
        () => [...new Set(estoqueCD.map(e => e.modelo))].sort(),
        [estoqueCD]
    );

    const coresDoModelo = (modelo) =>
        estoqueCD.filter(e => e.modelo === modelo).sort((a, b) => a.cor.localeCompare(b.cor));

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
                confirmButtonColor: '#d33'
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
                        confirmButtonColor: '#3085d6'
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
                    confirmButtonColor: '#d33'
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
                confirmButtonColor: '#d33'
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
            ? "w-full border-gray-300 rounded-lg uppercase font-bold text-base py-3 px-4 focus:ring-red-500 focus:border-red-500 bg-white"
            : "w-full border-gray-300 rounded uppercase font-bold text-sm focus:ring-red-500 focus:border-red-500 bg-white";

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
            ? "w-full rounded-lg text-base py-3 px-4 border-gray-300"
            : "w-full rounded text-sm border-gray-300";

        // Item vindo da tela de Estoque: a loja escolheu um chassi específico, e o
        // único motivo que autoriza isso é Venda Confirmada. Motivo fixo e explicado.
        if (item.travaMotivo) {
            return (
                <div>
                    <input
                        disabled
                        value={MOTIVO_VENDA}
                        className={`${base} bg-emerald-50 text-emerald-800 border-emerald-200 font-bold`}
                    />
                    <p className="text-[10px] text-emerald-700 mt-0.5">
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
            ? "w-full border-gray-300 rounded-lg uppercase text-base py-3 px-4"
            : "w-full border-gray-300 rounded uppercase text-sm";

        if (data.modo === 'cd' && !exigeChassi(item) && temEstoqueCD) {
            const cores = coresDoModelo(item.modelo);
            return (
                <select
                    required value={item.cor} disabled={!item.modelo}
                    onChange={(e) => updateItem(index, 'cor', e.target.value)}
                    className={`${base} disabled:bg-gray-100 disabled:text-gray-400`}
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
                ? `w-full rounded-lg font-mono tracking-wider text-base py-3 px-4 ${!item.chassi ? 'border-red-300 bg-red-50' : item.chassi.length >= 11 ? 'border-green-400 bg-green-50' : 'border-orange-300 bg-orange-50'}`
                : `w-full rounded font-mono tracking-widest text-sm ${!item.chassi ? 'border-red-300 bg-red-50' : item.chassi.length >= 11 ? 'border-green-400 bg-green-50' : 'border-orange-300 bg-orange-50'}`;

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
                    className={`w-full rounded ${mobile ? 'rounded-lg text-base py-3 px-4' : 'text-sm'} font-black text-center ${excede ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-blue-300 bg-blue-50 text-blue-800'}`}
                />
                {disp !== null && (
                    <p className={`text-[10px] mt-0.5 text-center ${excede ? 'text-orange-600 font-bold' : 'text-gray-500'}`}>
                        {excede ? `Só há ${disp} no CD` : `${disp} disponíveis`}
                    </p>
                )}
            </div>
        );
    };

    return (
        <AuthenticatedLayout user={auth.user} header={<h2 className="font-bold text-2xl text-red-700">Nova Solicitação</h2>}>
            <Head title="Nova Solicitação" />
            <div className="py-8 bg-gray-100 min-h-screen pb-32">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                    {Object.keys(errors).length > 0 && (
                        <div className="mb-6 bg-red-50 border-l-4 border-red-600 p-4 rounded shadow flex items-center">
                            <span className="mr-3"><ExclamationTriangleIcon className="w-8 h-8 text-red-600" /></span>
                            <div>
                                <h3 className="font-bold text-red-800">Atenção Necessária</h3>
                                <p className="text-sm text-red-700">{Object.values(errors)[0] || 'Preencha todos os campos obrigatórios.'}</p>
                            </div>
                        </div>
                    )}

                    {veioDoEstoque && (
                        <div className="mb-6 bg-emerald-50 border-l-4 border-emerald-600 p-4 rounded shadow flex items-start gap-3">
                            <CheckCircleIcon className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                            <div>
                                <h3 className="font-bold text-emerald-900 text-sm">Solicitação de chassi específico (vinda do Estoque)</h3>
                                <p className="text-xs text-emerald-800 mt-0.5">
                                    O motivo foi fixado como <b>{MOTIVO_VENDA}</b>, o único que autoriza a loja a reservar
                                    um chassi específico do CD.
                                </p>
                                <p className="text-xs text-emerald-700 mt-1.5">
                                    Para <b>giro / reposição de estoque</b>, não use esta tela a partir do Estoque: entre em{' '}
                                    <b>Nova Solicitação</b> e peça por <b>modelo + cor + quantidade</b> (ex: 5x NEW JEF VERMELHA).
                                    O CD define quais chassis enviar.
                                </p>
                            </div>
                        </div>
                    )}

                    {!temEstoqueCD && (
                        <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded shadow flex items-start gap-3">
                            <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                            <div>
                                <h3 className="font-bold text-yellow-800 text-sm">Estoque do CD indisponível no momento</h3>
                                <p className="text-xs text-yellow-700">A sincronização com o Microwork não retornou dados. Você pode continuar pedindo normalmente digitando o modelo e a cor à mão.</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.type !== 'textarea') e.preventDefault(); }} className="space-y-6">

                        <div className={`bg-white overflow-hidden shadow-sm sm:rounded-lg p-6 border-l-4 ${data.modo === 'transferencia' ? 'border-orange-500' : 'border-blue-600'}`}>
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><ArchiveBoxIcon className="w-5 h-5" /> Tipo de Movimentação</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div
                                    onClick={() => handleModeChange('cd')}
                                    className={`cursor-pointer border-2 rounded-lg p-4 flex items-center gap-4 transition ${data.modo === 'cd' ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-gray-200 hover:border-blue-300'}`}
                                >
                                    <ArchiveBoxIcon className={`w-10 h-10 ${data.modo === 'cd' ? 'text-blue-600' : 'text-gray-400'}`} />
                                    <div>
                                        <div className="font-bold text-gray-800">Reposição CD</div>
                                        <div className="text-xs text-gray-500">Pedir estoque ao CD por modelo, cor e quantidade.</div>
                                    </div>
                                    {data.modo === 'cd' && <CheckCircleIcon className="w-6 h-6 ml-auto text-blue-600" />}
                                </div>

                                <div
                                    onClick={() => handleModeChange('transferencia')}
                                    className={`cursor-pointer border-2 rounded-lg p-4 flex items-center gap-4 transition ${data.modo === 'transferencia' ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-gray-200 hover:border-orange-300'}`}
                                >
                                    <ArrowPathIcon className={`w-10 h-10 ${data.modo === 'transferencia' ? 'text-orange-600' : 'text-gray-400'}`} />
                                    <div>
                                        <div className="font-bold text-gray-800">Transferência</div>
                                        <div className="text-xs text-gray-500">Buscar moto em outra filial <b>ou devolver ao CD</b>.</div>
                                    </div>
                                    {data.modo === 'transferencia' && <CheckCircleIcon className="w-6 h-6 ml-auto text-orange-600" />}
                                </div>
                            </div>

                            {data.modo === 'cd' && (
                                <div className="animate-fadeIn bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
                                    <InformationCircleIcon className="w-8 h-8 text-blue-600 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-bold text-blue-800">Pedido por Modelo e Cor</h4>
                                        <p className="text-xs text-blue-700">Escolha o modelo, a cor e a quantidade desejada. <b>A equipe do CD é quem define quais chassis serão enviados.</b> Se o motivo for "Venda Confirmada (Cliente)", o campo de chassi aparece automaticamente.</p>
                                    </div>
                                </div>
                            )}

                            {data.modo === 'transferencia' && (
                                <div className="animate-fadeIn bg-orange-50 p-4 rounded-lg border border-orange-100 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Para onde vai a moto? *</label>
                                        <select
                                            value={data.destino_id}
                                            onChange={handleDestinoChange}
                                            className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-orange-500 focus:border-orange-500 font-bold text-gray-700"
                                        >
                                            <option value="">Para a minha loja ({auth.user.filial}) — estou recebendo</option>
                                            {cdUserId && <option value={cdUserId}>Para a Matriz / CD — estou devolvendo/enviando</option>}
                                        </select>
                                    </div>

                                    {!enviandoParaCD ? (
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Selecione a Loja Fornecedora *</label>
                                            <select
                                                required
                                                value={data.origem_id}
                                                onChange={handleFornecedorChange}
                                                className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-orange-500 focus:border-orange-500 font-bold text-gray-700"
                                            >
                                                <option value="">-- Escolha a loja que tem a moto --</option>
                                                {lojasDisponiveis.filter(l => l.id !== auth.user.id).map(loja => (
                                                    <option key={loja.id} value={loja.id}>{loja.filial ? `${loja.filial} (${loja.name})` : loja.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-3 bg-white p-3 rounded border border-orange-200">
                                            <InformationCircleIcon className="w-7 h-7 text-orange-600 flex-shrink-0" />
                                            <p className="text-xs text-orange-800">
                                                <b>Envio para o CD.</b> As motos sairão da sua loja ({auth.user.filial}) com destino à Matriz / CD.
                                                Informe o <b>chassi</b> de cada moto que está saindo. Esta operação substitui a antiga "Devolução".
                                            </p>
                                        </div>
                                    )}

                                    <p className="text-[10px] text-orange-600">* Em transferências o chassi é sempre obrigatório, pois a moto já existe fisicamente na loja de origem.</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg p-6 border-t-4 border-red-600">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-gray-800">Itens do Pedido</h3>
                                <p className="text-sm text-gray-500">
                                    {data.modo === 'transferencia'
                                        ? 'Informe o chassi de cada moto que será movimentada.'
                                        : 'Escolha modelo, cor e quantidade. O CD definirá os chassis.'}
                                </p>
                            </div>

                            <datalist id="opcoes-modelos">
                                {listaModelos.map((nome, index) => ( <option key={index} value={nome} /> ))}
                            </datalist>

                            {/* CABEÇALHO DESKTOP */}
                            <div className="hidden md:grid grid-cols-12 gap-3 mb-2 font-bold text-xs uppercase text-gray-500 px-2 items-end">
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
                                    <div key={index} className={`rounded-xl border shadow-sm transition-all relative ${errors[`itens.${index}`] ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>

                                        {/* ===== LAYOUT DESKTOP (md+) ===== */}
                                        <div className="hidden md:grid grid-cols-12 gap-3 items-center p-4">
                                            <div className="col-span-1 text-center font-bold text-gray-400">{index + 1}</div>

                                            <div className="col-span-3">
                                                {campoModelo(item, index, false)}
                                            </div>

                                            <div className="col-span-2">
                                                {campoChassiOuQtd(item, index, false)}
                                            </div>

                                            <div className="col-span-2 relative">
                                                {enviandoParaCD ? (
                                                    <input disabled value="Matriz / CD" className="w-full rounded text-sm bg-orange-100 text-orange-800 border-orange-200 font-bold text-center" />
                                                ) : (
                                                    <select required value={item.local} onChange={(e) => updateItem(index, 'local', e.target.value)} className="w-full rounded text-sm bg-yellow-50 focus:bg-white border-gray-300">
                                                        <option value="" disabled>Selecione...</option>
                                                        {locaisEntrega.map(local => <option key={local} value={local}>{local}</option>)}
                                                    </select>
                                                )}
                                                {index === 0 && data.itens.length > 1 && !enviandoParaCD && (
                                                    <button type="button" onClick={replicarDestino} className="absolute -top-5 right-0 text-[10px] text-blue-600 hover:underline font-bold flex items-center gap-1">
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
                                                    <button type="button" onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-600 text-xl p-2 transition rounded-full hover:bg-red-50">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* ===== LAYOUT MOBILE ===== */}
                                        <div className="md:hidden p-4 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="bg-gray-200 text-gray-600 text-xs font-black px-2.5 py-1 rounded-full">
                                                    {exigeChassi(item) ? `Moto #${index + 1}` : `Item #${index + 1}`}
                                                </span>
                                                {data.itens.length > 1 && (
                                                    <button type="button" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modelo *</label>
                                                {campoModelo(item, index, true)}
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                    {exigeChassi(item)
                                                        ? <>Chassi * <span className="text-gray-400 normal-case font-normal">(mín. 11 caracteres)</span></>
                                                        : <>Quantidade * <span className="text-gray-400 normal-case font-normal">(o CD define os chassis)</span></>}
                                                </label>
                                                {campoChassiOuQtd(item, index, true)}
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Destino Final *</label>
                                                {enviandoParaCD ? (
                                                    <input disabled value="Matriz / CD" className="w-full rounded-lg text-base py-3 px-4 bg-orange-100 text-orange-800 border-orange-200 font-bold text-center" />
                                                ) : (
                                                    <select
                                                        required value={item.local}
                                                        onChange={(e) => updateItem(index, 'local', e.target.value)}
                                                        className="w-full rounded-lg text-base py-3 px-4 bg-yellow-50 focus:bg-white border-gray-300"
                                                    >
                                                        <option value="" disabled>Selecione o destino...</option>
                                                        {locaisEntrega.map(local => <option key={local} value={local}>{local}</option>)}
                                                    </select>
                                                )}
                                                {index === 0 && data.itens.length > 1 && !enviandoParaCD && (
                                                    <button type="button" onClick={replicarDestino} className="mt-1 text-xs text-blue-600 hover:underline font-bold flex items-center gap-1">
                                                        <ArrowDownIcon className="w-3 h-3" /> Copiar destino p/ todas as motos
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-5 gap-3">
                                                <div className="col-span-2">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cor *</label>
                                                    {campoCor(item, index, true)}
                                                </div>
                                                <div className="col-span-3">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motivo *</label>
                                                    {campoMotivo(item, index, true)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 flex flex-col md:flex-row justify-between items-start gap-6 border-t pt-6">
                                <button type="button" onClick={addItem} className="w-full md:w-auto flex items-center justify-center gap-2 text-blue-600 font-bold border-2 border-dashed border-blue-300 rounded-lg px-6 py-4 hover:bg-blue-50 transition">
                                    <span>➕</span> Adicionar Item
                                </button>
                                <div className="w-full md:w-1/2">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Observações</label>
                                    <textarea
                                        value={data.observacao} onChange={e => setData('observacao', e.target.value)}
                                        className="w-full border-gray-300 rounded h-20 text-sm focus:ring-red-500 focus:border-red-500"
                                        placeholder="Alguma ressalva importante..."
                                    ></textarea>
                                </div>
                            </div>
                        </div>

                        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-3 md:p-4 z-50">
                            <div className="max-w-7xl mx-auto flex justify-between items-center px-2 md:px-4 gap-2">
                                <div className="flex flex-col md:flex-row md:items-baseline">
                                    <span className="text-[10px] md:text-sm text-gray-500 font-bold uppercase md:hidden">Motos</span>
                                    <span className="text-gray-600 hidden md:inline font-medium">Total:</span>
                                    <span className="md:ml-2 text-xl md:text-2xl font-black text-red-600 leading-none">{totalUnidades} <span className="hidden md:inline">motos</span></span>
                                </div>
                                <button
                                    type="submit"
                                    disabled={processing || (data.modo === 'transferencia' && (!logisticaInfo || logisticaInfo.erro))}
                                    className="w-full md:w-auto px-4 md:px-8 py-3 md:py-3 rounded-lg font-bold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 text-white text-xs md:text-base whitespace-nowrap bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
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
            </div>
        </AuthenticatedLayout>
    );
}
