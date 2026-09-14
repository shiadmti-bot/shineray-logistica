import ChatBox from "@/Components/ChatBox";
// v3: painel do fluxo de peça. Só renderiza quando o pedido é de peça —
// pedido de moto não é afetado.
import PainelAtendimentoPecas from "@/Components/Pecas/PainelAtendimento";
import AppLayout from "@/Layouts/AppLayout";
import { Card, PageHeader, Button, StatusBadge } from "@/Components/UI";
import { Head, useForm, Link, router } from "@inertiajs/react";
import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import imageCompression from "browser-image-compression";
import {
    CalendarIcon,
    ClockIcon,
    MapPinIcon,
    DocumentTextIcon,
    PaperClipIcon,
    ExclamationTriangleIcon,
    BoltIcon,
    CheckCircleIcon,
    XCircleIcon,
    TruckIcon,
    ScissorsIcon,
    TrashIcon,
    CameraIcon,
    HandThumbUpIcon,
    ArrowUpOnSquareIcon,
    ArrowDownOnSquareIcon,
    ArrowsRightLeftIcon,
    BuildingOffice2Icon,
    ChatBubbleBottomCenterTextIcon,
    PlayIcon,
    StopIcon,
    CubeIcon,
    WrenchScrewdriverIcon,
    ShieldCheckIcon,
    ClipboardDocumentCheckIcon,
    ArchiveBoxIcon,
} from "@heroicons/react/24/outline";

export default function PedidoShow({ auth, pedido, atribuicao = null, peca = null }) {
    // --- 1. CONFIGURAÇÕES E PERMISSÕES ---
    const [compressing, setCompressing] = useState(false);
    const formAcoes = useForm({});

    const ehPeca = !!peca?.ativo || pedido.tipo_carga === 'peca';

    // V2.6: bipagem de chassis pelo CD. Pedidos legados vêm com atribuicao.legado = true
    // e nada disto é renderizado — a tela se comporta como na versão anterior.
    const cotas = pedido.itens_pedido || [];
    const cotasPendentes = ehPeca ? [] : cotas.filter((c) => c.qtd_pendente > 0);
    const podeAtribuir = !ehPeca && !!atribuicao?.permitido && !atribuicao?.legado;
    const [bipando, setBipando] = useState({}); // { [cotaId]: chassiDigitado }

    // Identifica o Papel do Usuário
    const souOrigem = auth.user.id === pedido.origem_user_id;
    const souDestino = auth.user.id === pedido.user_id;
    const souCD = auth.user.perfil === "cd";
    const souAdmin =
        auth.user.perfil === "admin" || auth.user.perfil === "gestor";
    // Exclusivo do perfil ADMIN (não inclui gestor): remoção direta de itens
    const souAdminExclusivo = auth.user.perfil === "admin";
    // O CD só deve ter a opção de recebimento se o destino final for para eles (ex: transferência/devolução para o CD ou Matriz)
    const isDestinoCD = !pedido.user_id 
        || ["cd", "admin"].includes(pedido.user?.perfil) 
        || pedido.status === "em_transito_cd";

    const ehDestinatarioFinal = souDestino || (souCD && isDestinoCD) || souAdmin;
        
    // CORREÇÃO: Só é transferência se houver origem E a origem for uma loja (evita que envios do CD sejam rotulados como transferência visualmente)
    const isTransferencia = !ehPeca && !!(pedido.origem_user_id && pedido.origem && pedido.origem.perfil === "loja");

    // --- CÁLCULO DE EMBARQUE PARCIAL (v2.6/v3) ---
    const saldoPendente = atribuicao?.saldo_pendente ?? 0;
    const motosEmTransito = (pedido.motos || []).filter((m) =>
        ['em_transito', 'transito_loja'].includes(m.status)
    ).length;
    const motosNoCd = (pedido.motos || []).filter((m) =>
        ['em_analise', 'solicitado', 'separado', 'aguardando_rota', 'estoque_fabrica'].includes(m.status)
    ).length;
    const totalNaoDespachado = saldoPendente + motosNoCd;
    const isEmbarqueParcial = !ehPeca && motosEmTransito > 0 && totalNaoDespachado > 0;
    const totalItensSolicitados =
        (cotas.length > 0
            ? cotas.reduce((acc, i) => acc + Math.max(0, (i.quantidade || 0) - (i.qtd_cancelada || 0)), 0)
            : (pedido.motos?.length || 0)) || (motosEmTransito + totalNaoDespachado);

    // Calcula destinos reais a partir do pivot
    const destinosReais = [
        ...new Set(
            (pedido.motos || []).map((m) => m.pivot?.destino).filter(Boolean),
        ),
    ];
    const destinoFinalLabel =
        destinosReais.length > 0
            ? destinosReais.join(", ")
            : pedido.user?.filial || "Destino não definido";

    // --- 2. ATUALIZAÇÃO EM TEMPO REAL (ECHO) ---
    useEffect(() => {
        if (!auth.user?.id || !window.Echo) return;
        const channel = window.Echo.private(`App.Models.User.${auth.user.id}`);

        channel.notification((notification) => {
            if (
                notification.link &&
                notification.link.includes(`/pedidos/${pedido.id}`)
            ) {
                try {
                    const audio = new Audio("/plim.mp3");
                    audio.play().catch(() => {});
                } catch (e) {}

                Swal.fire({
                    toast: true,
                    position: "top-end",
                    icon: "info",
                    title: "Atualização",
                    text: notification.mensagem,
                    timer: 5000,
                    timerProgressBar: true,
                    showConfirmButton: false,
                });
                router.reload({ only: ["pedido"] });
            }
        });
        return () => channel.stopListening("Notification");
    }, [pedido.id, auth.user.id]);

    // --- 3. AÇÕES DE SOLICITAÇÃO ---
    const handleSolicitarRetirada = (motoId, pergunta) => {
        Swal.fire({
            title: "Solicitar Retirada/Corte",
            text: pergunta,
            input: "text",
            inputPlaceholder:
                "Motivo (Ex: Avaria no estoque, Erro de sistema...)",
            showCancelButton: true,
            confirmButtonText: "Enviar Solicitação",
            confirmButtonColor: "#d33",
            inputValidator: (value) =>
                !value && "Você precisa escrever o motivo!",
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                router.post(
                    route("motos.solicitarRetirada", motoId),
                    { motivo: result.value },
                    {
                        onSuccess: () =>
                            Swal.fire(
                                "Enviado!",
                                "Solicitação de corte enviada para análise.",
                                "success",
                            ),
                    },
                );
            }
        });
    };

    // --- 3.1 V2.6: ATRIBUIÇÃO DE CHASSIS PELO CD ---
    const handleAtribuirChassi = (cota) => {
        const chassi = (bipando[cota.id] || "").trim().toUpperCase();

        if (chassi.length < 11) {
            return Swal.fire(
                "Chassi inválido",
                "Informe ao menos 11 caracteres.",
                "warning",
            );
        }

        router.post(
            route("pedidos.atribuir_chassi", pedido.id),
            { chassi, pedido_item_id: cota.id },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setBipando((b) => ({ ...b, [cota.id]: "" }));
                    const audio = new Audio("/plim.mp3");
                    audio.play().catch(() => {});
                },
                onError: (errs) =>
                    Swal.fire(
                        "Não foi possível atribuir",
                        Object.values(errs)[0] || "Erro desconhecido.",
                        "error",
                    ),
            },
        );
    };

    const handleDesatribuirChassi = (moto) => {
        Swal.fire({
            title: "Desfazer atribuição?",
            html: `O chassi <b>${moto.chassi}</b> será desvinculado deste pedido e voltará ao estoque do CD.`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sim, desfazer",
            confirmButtonColor: "#d33",
            cancelButtonText: "Cancelar",
        }).then((r) => {
            if (!r.isConfirmed) return;
            router.delete(
                route("pedidos.desatribuir_chassi", [pedido.id, moto.id]),
                {
                    preserveScroll: true,
                    onError: (errs) =>
                        Swal.fire(
                            "Erro",
                            Object.values(errs)[0] || "Não foi possível desfazer.",
                            "error",
                        ),
                },
            );
        });
    };

    const handleEncerrarSaldo = (cota) => {
        Swal.fire({
            title: "Encerrar saldo em falta",
            html: `<p style="font-size:14px">Serão baixadas <b>${cota.qtd_pendente}x ${cota.modelo} ${cota.cor}</b> que não serão enviadas.</p>`,
            input: "textarea",
            inputPlaceholder:
                "Justificativa (ex: sem estoque no CD, modelo descontinuado...)",
            showCancelButton: true,
            confirmButtonText: "Encerrar saldo",
            confirmButtonColor: "#d33",
            cancelButtonText: "Cancelar",
            inputValidator: (v) =>
                (!v || v.trim().length < 5) &&
                "Descreva o motivo (mínimo 5 caracteres).",
        }).then((r) => {
            if (!r.isConfirmed || !r.value) return;
            router.post(
                route("pedidos.encerrar_saldo", cota.id),
                { justificativa: r.value },
                {
                    preserveScroll: true,
                    onError: (errs) =>
                        Swal.fire(
                            "Erro",
                            Object.values(errs)[0] || "Não foi possível encerrar.",
                            "error",
                        ),
                },
            );
        });
    };

    // Remoção direta (EXCLUSIVO ADMIN): remove a moto do pedido sem passar pela aprovação do gestor
    const handleRemoverAdmin = (moto) => {
        Swal.fire({
            title: "Remover Moto (Admin)",
            html: `Você está prestes a remover a moto <strong>${moto.modelo}</strong> (${moto.chassi}) deste pedido <strong>imediatamente</strong>, sem passar pelo fluxo de aprovação de estorno.`,
            icon: "warning",
            input: "text",
            inputPlaceholder: "Motivo da remoção (obrigatório)",
            showCancelButton: true,
            confirmButtonText: "Remover Agora",
            confirmButtonColor: "#d33",
            cancelButtonText: "Cancelar",
            inputValidator: (value) =>
                !value && "Você precisa informar o motivo!",
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                router.delete(
                    route("pedidos.removerMoto", {
                        id: pedido.id,
                        motoId: moto.id,
                    }),
                    {
                        data: { motivo: result.value },
                        onSuccess: () =>
                            Swal.fire(
                                "Removida!",
                                "A moto foi removida do pedido e devolvida ao estoque.",
                                "success",
                            ),
                    },
                );
            }
        });
    };

    // --- 4. CONFERÊNCIA DE ENTREGA ---
    const handleConferenciaEntrega = () => {
        if (totalNaoDespachado > 0) {
            return Swal.fire({
                title: "Aguardando Despacho Integral",
                html: `
                    <div class="text-left text-sm space-y-3">
                        <div class="bg-status-warning-bg p-3 rounded-lg border border-status-warning-solid/30 text-status-warning-fg font-bold">
                            ⚠️ Este pedido possui ${totalNaoDespachado} unidade(s) pendente(s) no CD.
                        </div>
                        <p class="text-content-secondary leading-relaxed">
                            Por determinação da diretoria comercial e logística, a conferência com envio do comprovante só pode ser realizada quando <b>100% da carga</b> for despachada e entregue.
                        </p>
                        <p class="text-xs text-content-muted">
                            Aguarde a equipe do CD enviar as unidades restantes na próxima rota ou solicite o encerramento do saldo em falta se não houver envio.
                        </p>
                    </div>
                `,
                icon: "info",
                confirmButtonText: "Entendido",
                confirmButtonColor: "#E52521",
            });
        }

        Swal.fire({
            title: '<h3 class="font-bold text-content-primary">Conferência de Entrega 📋</h3>',
            width: "650px",
            html: `
                <div class="text-left text-sm">
                    <div class="bg-status-info-bg/50 p-4 rounded-lg border border-status-info-solid/20 mb-4 text-status-info-fg">
                        <strong>Instruções:</strong> Verifique fisicamente as motos. Se houver avaria, tire foto. Por fim, anexe o canhoto assinado.
                    </div>
                    <div class="bg-surface-sunken rounded-lg border border-line mb-4 max-h-[250px] overflow-y-auto p-2 custom-scrollbar">
                        ${pedido.motos
                            .map(
                                (m) => `
                            <div class="mb-2 bg-surface-card p-3 rounded shadow-sm border border-line flex flex-col gap-2">
                                <div class="flex justify-between items-center">
                                    <span class="font-bold text-content-primary">🏍️ ${m.modelo}</span>
                                    <span class="font-mono text-xs bg-surface-sunken px-2 py-1 rounded text-content-secondary">${m.chassi}</span>
                                </div>
                                ${
                                    !m.estorno_pendente
                                        ? `
                                    <div class="grid grid-cols-1 gap-2">
                                        <input type="text" id="avaria-texto-${m.id}" class="swal2-input w-full text-xs h-8 m-0 focus:ring-status-danger-solid" placeholder="Houve avaria? Descreva aqui...">
                                        <label class="flex items-center justify-center w-full text-xs text-content-secondary border border-dashed border-line p-2 rounded cursor-pointer hover:bg-surface-sunken transition">
                                            <span id="label-foto-${m.id}" class="flex items-center gap-2">📸 Anexar Foto da Avaria</span>
                                            <input type="file" id="avaria-foto-${m.id}" class="hidden" accept="image/*" onchange="document.getElementById('label-foto-${m.id}').innerHTML = '✅ Foto Selecionada'; document.getElementById('label-foto-${m.id}').classList.add('text-status-success-fg', 'font-bold');">
                                        </label>
                                    </div>
                                `
                                        : '<span class="text-xs text-status-danger-fg bg-status-danger-bg/50 px-2 py-1 rounded font-bold text-center">🚫 Em análise de corte/estorno</span>'
                                }
                            </div>
                        `,
                            )
                            .join("")}
                    </div>
                    <div class="p-4 bg-status-success-bg rounded-lg border border-status-success-solid/20">
                        <label class="block font-bold text-status-success-fg mb-2 text-xs uppercase tracking-wide">📄 Foto do Romaneio/Canhoto Assinado *</label>
                        <input type="file" id="upload-comprovante" class="block w-full text-xs text-content-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-status-success-bg file:text-status-success-fg hover:file:brightness-95 cursor-pointer" accept="image/*,application/pdf">
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: "Confirmar Recebimento",
            confirmButtonColor: "#16a34a",
            cancelButtonText: "Cancelar",
            preConfirm: () => {
                const file =
                    document.getElementById("upload-comprovante").files[0];
                if (!file)
                    return Swal.showValidationMessage(
                        "O comprovante assinado é obrigatório!",
                    );

                const avarias = {},
                    fotos = {};
                pedido.motos.forEach((m) => {
                    if (m.estorno_pendente) return;
                    const txt = document.getElementById(
                        `avaria-texto-${m.id}`,
                    )?.value;
                    const img = document.getElementById(`avaria-foto-${m.id}`)
                        ?.files[0];
                    if (txt) {
                        avarias[m.id] = txt;
                        if (img) fotos[m.id] = img;
                    }
                });
                return { file, avarias, fotos };
            },
        }).then((result) => {
            if (result.isConfirmed)
                processarEnvio(
                    result.value.file,
                    result.value.avarias,
                    result.value.fotos,
                );
        });
    };

    const processarEnvio = async (file, avarias, fotos) => {
        setCompressing(true);
        Swal.fire({
            title: "Comprimindo Arquivos...",
            html: "Ajustando imagens para envio rápido...",
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
        });

        try {
            const options = {
                maxSizeMB: 1,
                maxWidthOrHeight: 1280,
                useWebWorker: true,
            };

            // 1. Comprimir Canhoto/Romaneio
            let compressedFile = file;
            if (file && file.type.startsWith("image/")) {
                compressedFile = await imageCompression(file, options);
            }

            // 2. Comprimir Fotos das Avarias (se houver)
            const compressedFotos = {};
            if (fotos) {
                for (const motoId in fotos) {
                    const fotoFile = fotos[motoId];
                    if (fotoFile && fotoFile.type.startsWith("image/")) {
                        compressedFotos[motoId] = await imageCompression(
                            fotoFile,
                            options,
                        );
                    } else {
                        compressedFotos[motoId] = fotoFile;
                    }
                }
            }

            Swal.fire({
                title: "Enviando...",
                html: "Salvando entrega no sistema...",
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            });

            router.post(
                route("pedidos.finalizar", pedido.id),
                {
                    _method: "post",
                    arquivo_romaneio: compressedFile,
                    avarias,
                    fotos_avarias: compressedFotos,
                },
                {
                    forceFormData: true,
                    onSuccess: () => {
                        setCompressing(false);
                        Swal.fire(
                            "Sucesso!",
                            "Recebimento confirmado.",
                            "success",
                        );
                    },
                    onError: (err) => {
                        setCompressing(false);
                        Swal.fire(
                            "Erro",
                            "Falha ao enviar. Tente novamente.",
                            "error",
                        );
                    },
                },
            );
        } catch (error) {
            console.error("Erro ao comprimir imagem:", error);
            setCompressing(false);
            Swal.fire(
                "Erro",
                "Falha ao processar as fotos. Tente enviar uma imagem menor.",
                "error",
            );
        }
    };

    // --- 5. AÇÕES DE FLUXO ---
    const confirmarSeparacao = () => {
        const texto = isTransferencia
            ? "Confirma que as motos foram separadas e estão prontas para coleta?"
            : "Confirma a separação física destas motos no CD?";
        Swal.fire({
            title: "Confirmar Separação",
            text: texto,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Sim",
            confirmButtonColor: "#2563eb",
        }).then((res) => {
            if (res.isConfirmed)
                formAcoes.post(route("pedidos.separar", pedido.id));
        });
    };

    const confirmarSaida = () => {
        Swal.fire({
            title: "Liberar Saída?",
            text: 'Mudar status para "Em Trânsito"?',
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sim",
            confirmButtonColor: "#f97316",
        }).then((res) => {
            if (res.isConfirmed)
                formAcoes.post(route("pedidos.saida", pedido.id));
        });
    };

    const handleRejeitar = () => {
        Swal.fire({
            title: "Rejeitar Pedido",
            input: "textarea",
            inputPlaceholder: "Motivo...",
            showCancelButton: true,
            confirmButtonText: "Rejeitar",
            confirmButtonColor: "#ef4444",
        }).then((res) => {
            if (res.isConfirmed && res.value)
                router.post(route("pedidos.rejeitar", pedido.id), {
                    motivo: res.value,
                });
        });
    };

    // --- RENDER ---
    return (
        <AppLayout user={auth.user}>
            <Head title={`Pedido #${pedido.id}`} />

            <div className="space-y-6 pb-28">
                <PageHeader
                    title={`Pedido #${pedido.id}`}
                    breadcrumbs={[
                        { label: ehPeca ? "Peças" : "Motos" },
                        { label: "Pedidos", href: route("pedidos.index") },
                        { label: `#${pedido.id}` },
                    ]}
                    actions={
                        <div className="flex items-center gap-2">
                            {ehPeca && peca?.pode_cancelar && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={XCircleIcon}
                                    onClick={handleRejeitar}
                                    className="!text-status-danger-fg hover:!bg-status-danger-bg border-status-danger-border"
                                >
                                    Cancelar Pedido
                                </Button>
                            )}
                            <TipoBadge isTransferencia={isTransferencia} isPeca={ehPeca} />
                            {isEmbarqueParcial ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-status-warning-bg text-status-warning-fg ring-1 ring-inset ring-status-warning-solid/20 shadow-xs">
                                    <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                    Embarque Parcial ({motosEmTransito}/{totalItensSolicitados})
                                </span>
                            ) : (
                                <StatusBadge status={pedido.status} />
                            )}
                        </div>
                    }
                    className="mb-0"
                />

                    {/* --- ALERTA DE EMBARQUE PARCIAL --- */}
                    {isEmbarqueParcial && (
                        <div className="rounded-card border-2 border-status-warning-solid/40 bg-status-warning-bg p-5 shadow-sm space-y-2">
                            <div className="flex items-center gap-2 text-status-warning-fg font-black text-sm uppercase tracking-wide">
                                <TruckIcon className="w-5 h-5 text-status-warning-fg" />
                                Embarque Parcial em Andamento ({motosEmTransito} de {totalItensSolicitados} unidades despachadas)
                            </div>
                            <p className="text-xs text-content-secondary leading-relaxed font-medium">
                                <strong>{motosEmTransito} motocicleta(s)</strong> deste pedido já estão a caminho da loja na Carga <strong>#{pedido.romaneio_id || 'em trânsito'}</strong>. As <strong>{totalNaoDespachado} unidade(s)</strong> restantes continuam no CD e serão enviadas na próxima viagem disponível.
                            </p>
                            <p className="text-[11px] text-content-muted">
                                🔒 <em>Conforme a regra da diretoria, o recebimento final com foto do canhoto assinado só será liberado após o despacho integral (100%) das motos solicitadas.</em>
                            </p>
                        </div>
                    )}

                    {/* --- 0. FLUXO DE PEÇA (v3) ---
                        Aparece apenas em pedido de peça; em pedido de moto
                        `peca.ativo` é false e nada é renderizado. */}
                    {peca?.ativo && (
                        <PainelAtendimentoPecas pedido={pedido} peca={peca} />
                    )}

                    {/* --- 1. CARD DE DETALHES --- */}
                    <div className="bg-surface-card rounded-card shadow-sm border border-line overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line">
                        {/* Origem */}
                        <div className="p-6 bg-surface-sunken/50">
                            <h3 className="text-xs font-bold text-content-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                                <ArrowUpOnSquareIcon className="w-4 h-4 text-status-info-fg" />{" "}
                                Origem (Sai De)
                            </h3>
                            <div className="text-lg font-bold text-content-primary leading-tight">
                                {pedido.origem
                                    ? pedido.origem.filial
                                    : "Centro de Distribuição"}
                            </div>
                            <div className="text-sm text-content-secondary mt-1 font-medium">
                                {pedido.origem?.name ||
                                    "Matriz Shineray By Sabel"}
                            </div>

                            {pedido.previsao_coleta && (
                                <div className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-status-warning-fg bg-status-warning-bg px-3 py-1.5 rounded-full border border-status-warning-solid/20">
                                    <CalendarIcon className="w-4 h-4" />{" "}
                                    Previsão Coleta:{" "}
                                    {new Date(
                                        pedido.previsao_coleta.substring(0, 10) + "T12:00:00",
                                    ).toLocaleDateString()}
                                </div>
                            )}
                        </div>

                        {/* Destino */}
                        <div className="p-6">
                            <h3 className="text-xs font-bold text-content-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                                <ArrowDownOnSquareIcon className="w-4 h-4 text-status-success-fg" />{" "}
                                Destino (Vai Para)
                            </h3>
                            <div className="text-lg font-bold text-content-primary leading-tight">
                                {destinoFinalLabel}
                            </div>
                            <div className="text-sm text-content-secondary mt-1 font-medium">
                                Solicitado por: {pedido.user.name}
                            </div>

                            {pedido.previsao_entrega && (
                                <div className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-status-success-fg bg-status-success-bg px-3 py-1.5 rounded-full border border-status-success-solid/20">
                                    <CalendarIcon className="w-4 h-4" />{" "}
                                    Previsão Saída:{" "}
                                    {new Date(
                                        pedido.previsao_entrega.substring(0, 10) + "T12:00:00",
                                    ).toLocaleDateString('pt-BR')}
                                </div>
                            )}
                        </div>

                        {/* Info Logística */}
                        <div className="p-6 bg-surface-sunken/50 flex flex-col justify-center gap-1">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-content-muted uppercase tracking-wide">
                                    Data Criação
                                </span>
                                <span className="text-sm font-bold text-content-secondary">
                                    {new Date(
                                        pedido.created_at,
                                    ).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-line">
                                <span className="text-xs font-bold text-content-muted uppercase tracking-wide">
                                    Carga
                                </span>
                                {pedido.romaneio_id ? (
                                    <Link
                                        href={route(
                                            "romaneios.show",
                                            pedido.romaneio_id,
                                        )}
                                        className="flex items-center gap-1 bg-status-info-solid text-white px-2 py-1 rounded text-xs font-bold hover:brightness-95 transition"
                                    >
                                        <DocumentTextIcon className="w-4 h-4" />{" "}
                                        #{pedido.romaneio_id}
                                    </Link>
                                ) : (
                                    <span className="text-xs italic text-content-muted">
                                        Aguardando...
                                    </span>
                                )}
                            </div>

                            {pedido.comprovante_url && (
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-line">
                                    <span className="text-xs font-bold text-content-muted uppercase tracking-wide">
                                        Comprovante
                                    </span>
                                    <a
                                        href={pedido.comprovante_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 bg-status-success-bg text-status-success-fg px-2 py-1 rounded text-xs font-bold hover:brightness-95 transition"
                                    >
                                        <PaperClipIcon className="w-4 h-4" />{" "}
                                        Ver Anexo
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- 2. ALERTAS CONTEXTUAIS --- */}
                    
                    {/*
                        ALERTAS DE CONTEXTO
                        Antes eram cinco blocos com paletas próprias (âmbar, azul,
                        rosa, teal, laranja) que não queriam dizer nada — a cor
                        mudava por bloco, não por significado. Agora o tom carrega
                        a informação: `warning` = alguém precisa agir, `info` =
                        está em curso, aguarde.
                    */}
                    {!ehPeca && isTransferencia && pedido.status === "solicitado" && souOrigem && (
                        <AlertaContexto
                            tom="warning"
                            icon={ExclamationTriangleIcon}
                            titulo="Ação necessária: separação pendente"
                        >
                            Separe as motos fisicamente e confirme a separação para que fiquem
                            disponíveis para coleta pelo CD.
                        </AlertaContexto>
                    )}

                    {!ehPeca && isTransferencia && pedido.status === "solicitado" && (souCD || souAdmin) && !souOrigem && (
                        <AlertaContexto
                            tom="info"
                            icon={ClockIcon}
                            titulo="Aguardando separação da origem"
                        >
                            A loja <strong>{pedido.origem?.filial}</strong> precisa separar as motos
                            antes de ficarem disponíveis para coleta.
                        </AlertaContexto>
                    )}

                    {!ehPeca && pedido.status === "aguardando_rota" && (
                        <AlertaContexto
                            tom="warning"
                            icon={TruckIcon}
                            titulo="Aguardando rota (agendamento do destino)"
                        >
                            Motos separadas. Aguarde o CD definir a rota para a loja de destino no
                            calendário — assim que a entrega final for agendada, a coleta nesta
                            origem é confirmada automaticamente.
                        </AlertaContexto>
                    )}

                    {!ehPeca && pedido.status === "rota_confirmada" && (
                        <AlertaContexto tom="info" icon={MapPinIcon} titulo="Rota confirmada">
                            O CD agendou uma viagem que passará na loja de destino. Aguardando a
                            carga ser montada.
                        </AlertaContexto>
                    )}

                    {!ehPeca && pedido.status === "aguardando_coleta" && (
                        <AlertaContexto
                            tom="warning"
                            icon={ExclamationTriangleIcon}
                            titulo="Aguardando coleta"
                        >
                            Motos separadas e prontas. Aguardando o motorista do CD realizar a
                            coleta na loja de origem.
                        </AlertaContexto>
                    )}

                    {/* Previsão de saída */}
                    {pedido.previsao_entrega && !['concluido', 'cancelado'].includes(pedido.status) && (
                        <div className="flex items-center gap-4 rounded-card border border-status-success-solid/20 bg-status-success-bg/50 p-4">
                            <span className="shrink-0 rounded-full bg-status-success-bg p-2.5 text-status-success-fg">
                                <CalendarIcon className="h-6 w-6" />
                            </span>
                            <div>
                                <span className="text-xs font-bold uppercase tracking-widest text-status-success-fg">
                                    Previsão de saída
                                </span>
                                <div className="mt-0.5 text-lg font-black text-content-primary">
                                    {new Date(pedido.previsao_entrega.substring(0, 10) + "T12:00:00").toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- 3. TIMELINE --- */}
                    <Timeline
                        status={pedido.status}
                        isTransferencia={isTransferencia}
                        isEmbarqueParcial={isEmbarqueParcial}
                        isPeca={ehPeca}
                        peca={peca}
                        pedido={pedido}
                    />

                    {/* --- 3.5 V2.6: COTAS AGUARDANDO CHASSI --- */}
                    {!ehPeca && cotas.length > 0 && cotasPendentes.length > 0 && (
                        <div className="bg-surface-card rounded-card shadow-sm border-2 border-status-warning-solid/40 overflow-hidden">
                            <div className="px-6 py-4 bg-status-warning-bg border-b border-status-warning-solid/20 flex flex-wrap justify-between items-center gap-2">
                                <h3 className="font-black text-status-warning-fg text-sm uppercase tracking-wide flex items-center gap-2">
                                    <ExclamationTriangleIcon className="w-5 h-5" />
                                    Aguardando definição de chassi
                                </h3>
                                <span className="bg-status-warning-solid text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                                    {atribuicao?.saldo_pendente ?? 0} pendente(s)
                                </span>
                            </div>

                            <div className="p-4 space-y-3">
                                {!podeAtribuir && (
                                    <p className="text-xs text-content-secondary bg-status-warning-bg/50 border border-status-warning-solid/20 rounded-lg p-3">
                                        A equipe do CD ainda não informou quais motos serão enviadas.
                                        {pedido.status === "em_analise" &&
                                            " O pedido precisa ser aprovado pela diretoria antes disso."}
                                    </p>
                                )}

                                {cotasPendentes.map((cota) => (
                                    <div
                                        key={cota.id}
                                        className="border border-line rounded-xl p-4 bg-surface-sunken"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                            <div>
                                                <h4 className="font-extrabold text-content-primary">
                                                    {cota.modelo}{" "}
                                                    <span className="text-content-secondary font-bold">
                                                        {cota.cor}
                                                    </span>
                                                </h4>
                                                <p className="text-[11px] text-content-secondary uppercase font-bold tracking-wide">
                                                    {cota.motivo} · Destino: {cota.local}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-2xl font-black text-status-warning-fg leading-none">
                                                    {cota.qtd_atribuida}/{cota.quantidade}
                                                </span>
                                                <p className="text-[10px] text-content-secondary uppercase font-bold">
                                                    atribuídas
                                                </p>
                                            </div>
                                        </div>

                                        {podeAtribuir && (
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Bipe ou digite o chassi..."
                                                    value={bipando[cota.id] || ""}
                                                    onChange={(e) =>
                                                        setBipando((b) => ({
                                                            ...b,
                                                            [cota.id]: e.target.value
                                                                .toUpperCase()
                                                                .replace(/[^A-Z0-9]/g, ""),
                                                        }))
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            handleAtribuirChassi(cota);
                                                        }
                                                    }}
                                                    maxLength={17}
                                                    className="flex-1 rounded-lg border-line bg-surface-card font-mono tracking-widest text-sm py-3 px-4 text-content-primary focus:border-brand-500 focus:ring-brand-500"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleAtribuirChassi(cota)}
                                                    className="whitespace-nowrap rounded-lg bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
                                                >
                                                    Atribuir
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleEncerrarSaldo(cota)}
                                                    className="px-4 py-3 rounded-lg bg-surface-card border-2 border-line text-content-secondary font-bold text-xs hover:bg-status-danger-bg/50 hover:border-status-danger-solid/20 hover:text-status-danger-fg transition whitespace-nowrap"
                                                    title="Baixar as unidades que não serão enviadas"
                                                >
                                                    Encerrar saldo
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {podeAtribuir && (
                                    <p className="text-[11px] text-content-secondary px-1">
                                        Dica: com um leitor de código de barras, basta clicar no campo e
                                        bipar — o Enter do leitor já confirma a atribuição.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- 4. LISTA DE ITENS (LÓGICA GESTOR APLICADA) --- */}
                    {ehPeca ? (
                        /* --- LISTA DE ITENS (PEÇAS) --- */
                        <div className="bg-surface-card rounded-card shadow-sm border border-line overflow-hidden">
                            <div className="px-6 py-4 bg-surface-sunken/80 border-b border-line flex justify-between items-center backdrop-blur-sm">
                                <h3 className="font-black text-content-primary text-sm uppercase tracking-wide flex items-center gap-2">
                                    <WrenchScrewdriverIcon className="w-5 h-5 text-content-secondary" />
                                    Peças Solicitadas
                                </h3>
                                <span className="bg-surface-inverted text-content-inverted text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                                    {(pedido.itens_pedido || []).reduce(
                                        (acc, c) => acc + Math.max(0, (c.quantidade || 0) - (c.qtd_cancelada || 0)),
                                        0,
                                    )}{" "}
                                    Unidades ({(pedido.itens_pedido || []).length} {(pedido.itens_pedido || []).length === 1 ? 'item' : 'itens'})
                                </span>
                            </div>

                            <div className="divide-y divide-line">
                                {(pedido.itens_pedido || []).map((item, idx) => {
                                    const liberada = !!item.confirmado_em;
                                    const recusada = !!item.recusa_motivo && !liberada;
                                    const identificada = !!item.peca_id;

                                    return (
                                        <div
                                            key={item.id || idx}
                                            className="group p-5 flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-surface-sunken transition duration-150 ease-in-out"
                                        >
                                            <div className="flex items-center gap-5 flex-1 w-full md:w-auto">
                                                <div className="h-14 w-14 rounded-card bg-surface-card border border-line flex items-center justify-center text-content-muted shadow-sm flex-shrink-0 group-hover:scale-105 transition">
                                                    <CubeIcon className="w-6 h-6 text-brand-600" />
                                                </div>
                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h4 className="font-extrabold text-content-primary text-base">
                                                            {item.quantidade}x {item.peca?.descricao || item.descricao_solicitada || "Peça não identificada"}
                                                        </h4>
                                                        {item.peca?.codigo ? (
                                                            <span className="font-mono text-xs text-status-info-fg bg-status-info-bg/50 px-2 py-0.5 rounded border border-status-info-solid/20 font-bold tracking-wider">
                                                                {item.peca.codigo}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-status-warning-fg bg-status-warning-bg/50 px-2 py-0.5 rounded border border-status-warning-solid/20 font-bold uppercase tracking-wide">
                                                                Aguardando SKU (CD)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary">
                                                        {item.peca?.unidade && (
                                                            <span className="font-semibold uppercase tracking-wide text-[11px] bg-surface-card px-2 py-0.5 rounded border border-line">
                                                                UN: {item.peca.unidade}
                                                            </span>
                                                        )}
                                                        {item.preco_unitario && (
                                                            <span className="text-content-muted text-[11px]">
                                                                Preço unit.: <strong>R$ {Number(item.preco_unitario).toFixed(2)}</strong>
                                                            </span>
                                                        )}
                                                        {item.basqueta && (
                                                            <span className="inline-flex items-center gap-1 font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-200 text-[11px]">
                                                                🧺 Basqueta #{item.basqueta.id}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.motivo && (
                                                        <p className="text-[11px] text-content-muted font-medium">
                                                            Motivo: <span className="text-content-secondary">{item.motivo}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4 md:pl-6 md:border-l border-line">
                                                <div className="flex flex-col items-start md:items-end">
                                                    <span className="text-[9px] font-bold text-content-muted uppercase tracking-widest mb-1">
                                                        Status Item
                                                    </span>
                                                    {recusada ? (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide bg-status-danger-bg text-status-danger-fg border border-status-danger-solid/20">
                                                            <XCircleIcon className="w-3.5 h-3.5" /> Recusado Pós-Venda
                                                        </span>
                                                    ) : liberada ? (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide bg-status-success-bg text-status-success-fg border border-status-success-solid/20">
                                                            <CheckCircleIcon className="w-3.5 h-3.5" /> Liberado (Gate 1)
                                                        </span>
                                                    ) : identificada ? (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide bg-status-info-bg text-status-info-fg border border-status-info-solid/20">
                                                            <ClockIcon className="w-3.5 h-3.5" /> Aguard. Liberação
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide bg-status-warning-bg text-status-warning-fg border border-status-warning-solid/20">
                                                            <ClockIcon className="w-3.5 h-3.5" /> Em Atendimento
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-content-muted font-bold mt-1">
                                                        Separado: {item.qtd_atribuida || 0}/{item.quantidade}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {(pedido.itens_pedido || []).length === 0 && (
                                    <div className="p-8 text-center text-content-secondary">
                                        <ExclamationTriangleIcon className="w-12 h-12 mx-auto text-content-muted mb-3" />
                                        <p className="font-bold text-content-secondary text-lg">Nenhuma peça encontrada neste pedido.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                    <div className="bg-surface-card rounded-card shadow-sm border border-line overflow-hidden">
                        <div className="px-6 py-4 bg-surface-sunken/80 border-b border-line flex justify-between items-center backdrop-blur-sm">
                            <h3 className="font-black text-content-primary text-sm uppercase tracking-wide flex items-center gap-2">
                                <span className="text-content-secondary">
                                    <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                                </span>{" "}
                                Motocicletas
                            </h3>
                            <span className="bg-surface-inverted text-content-inverted text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                                {/* V2.6: conta as cotas ativas solicitadas ou as motos vinculadas em pedidos legados */}
                                {(cotas.length > 0
                                    ? cotas.reduce(
                                        (acc, c) => acc + Math.max(0, (c.quantidade || 0) - (c.qtd_cancelada || 0)),
                                        0,
                                    )
                                    : pedido.motos?.length) || 0}{" "}
                                Unidades
                            </span>
                        </div>

                        <div className="divide-y divide-line">
                            {/* Apenas mostra os itens do JSON de backup se o pedido for NOVO (em análise). 
                                Caso contrário, confia 100% no banco de dados pivot (motos reais). */}
                            {((pedido.status === 'em_analise' && pedido.motos.length === 0) 
                                ? (pedido.itens || []) 
                                : pedido.motos
                            ).map((item, idx) => {
                                // === APLICAÇÃO DA LÓGICA DO GESTOR (CORRIGIDA) ===
                                // Prioridade:
                                // 1. Pivot (Tabela de relacionamento real do pedido)
                                // 2. Item direto (Caso seja leitura do JSON de backup)
                                // 3. Coluna na tabela Motos (Legado)
                                // 4. Fallback 'Venda'
                                const motivoReal =
                                    item.pivot?.motivo ||
                                    item.motivo ||
                                    item.motivo_solicitacao ||
                                    "Venda";

                                // 5. Avarias (Novo Pivot + Legado Moto)
                                const avariaTexto =
                                    item.pivot?.detalhes_avaria ||
                                    item.detalhes_avaria;
                                const avariaFoto =
                                    item.pivot?.foto_avaria || item.foto_avaria;
                                const temAvaria =
                                    item.status === "avariado" || !!avariaTexto;

                                return (
                                    <div
                                        key={item.id || idx}
                                        className="group p-5 flex flex-col md:flex-row items-center gap-6 hover:bg-surface-sunken transition duration-150 ease-in-out"
                                    >
                                        <div className="flex items-center gap-5 flex-1 w-full md:w-auto">
                                            <div className="h-14 w-14 rounded-card bg-surface-card border border-line flex items-center justify-center text-content-muted shadow-sm flex-shrink-0 group-hover:scale-105 transition">
                                                <PlayIcon className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="font-extrabold text-content-primary text-base">
                                                        {/* V2.6: itens genéricos exibem a quantidade pedida */}
                                                        {!item.chassi &&
                                                            item.quantidade > 1 &&
                                                            `${item.quantidade}x `}
                                                        {item.modelo}
                                                    </h4>
                                                    {!item.chassi && (
                                                        <span className="text-[10px] text-status-warning-fg bg-status-warning-bg/50 px-2 py-0.5 rounded border border-status-warning-solid/20 font-bold uppercase tracking-wide">
                                                            Chassi a definir pelo CD
                                                        </span>
                                                    )}
                                                    {item.chassi && (
                                                        <span className="font-mono text-[10px] text-status-info-fg bg-status-info-bg/50 px-2 py-0.5 rounded border border-status-info-solid/20 tracking-wider">
                                                            {item.chassi}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-2 px-2 py-1 rounded-full border border-line bg-surface-card shadow-sm w-fit">
                                                        <span
                                                            className="h-3 w-3 rounded-full border border-line shadow-inner"
                                                            style={{
                                                                backgroundColor:
                                                                    getColorHex(
                                                                        item.cor,
                                                                    ),
                                                                }}
                                                        ></span>
                                                        <span className="text-[10px] font-bold text-content-secondary uppercase tracking-wide">
                                                            {item.cor ||
                                                                "COR NÃO DEFINIDA"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-6 md:pl-6 md:border-l border-line">
                                            {/* MOTIVO (USANDO LÓGICA GESTOR) */}
                                            {/* min-w só a partir de md: dois blocos de 140px
                                                + gap estouravam a largura em telas de 320px. */}
                                            <div className="flex flex-col items-start md:items-end md:min-w-[140px]">
                                                <span className="text-[9px] font-bold text-content-muted uppercase tracking-widest mb-1">
                                                    Motivo
                                                </span>
                                                <span
                                                    className={`px-3 py-1.5 rounded-lg border text-[10px] uppercase font-black tracking-wide shadow-sm whitespace-nowrap ${getMotivoStyle(motivoReal)}`}
                                                >
                                                    {motivoReal}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {temAvaria ? (
                                                    <div className="flex flex-col gap-2 items-end">
                                                        <span className="flex items-center gap-1 text-[10px] bg-status-danger-bg text-status-danger-fg px-3 py-1.5 rounded-lg border border-status-danger-solid/20 font-bold uppercase">
                                                            <ExclamationTriangleIcon className="w-3 h-3" />{" "}
                                                            Avariado
                                                        </span>
                                                        {avariaTexto && (
                                                            <span className="text-[10px] text-status-danger-fg bg-status-danger-bg/50 px-2 py-1 rounded max-w-[200px] text-right">
                                                                "{avariaTexto}"
                                                            </span>
                                                        )}
                                                        {avariaFoto && (
                                                            <a
                                                                href={
                                                                    avariaFoto
                                                                }
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1 text-[10px] text-status-info-fg hover:underline"
                                                            >
                                                                <CameraIcon className="w-3 h-3" />{" "}
                                                                Ver Foto
                                                            </a>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        {/* V2.6: desfazer bipagem errada (só para chassis atribuídos pelo CD) */}
                                                        {podeAtribuir &&
                                                            item.pivot?.pedido_item_id && (
                                                                <button
                                                                    onClick={() =>
                                                                        handleDesatribuirChassi(item)
                                                                    }
                                                                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-surface-card border border-line text-content-secondary hover:text-status-warning-fg hover:border-status-warning-solid/40 hover:bg-status-warning-bg/50 transition shadow-sm"
                                                                    title="Desfazer atribuição deste chassi"
                                                                >
                                                                    <XCircleIcon className="w-4 h-4" />
                                                                    <span className="text-xs font-bold hidden md:inline">
                                                                        Desfazer
                                                                    </span>
                                                                </button>
                                                            )}

                                                        {(souCD || souOrigem) &&
                                                            [
                                                                "solicitado",
                                                                "separado",
                                                                "estoque_fabrica",
                                                            ].includes(item.status) && (
                                                                <button
                                                                    onClick={() =>
                                                                        handleSolicitarRetirada(
                                                                            item.id,
                                                                            "Motivo do corte?",
                                                                        )
                                                                    }
                                                                    className="group/btn flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-surface-card border border-line text-content-secondary hover:text-status-danger-fg hover:border-status-danger-solid/20 hover:bg-status-danger-bg/50 transition shadow-sm"
                                                                    title="Cortar Item"
                                                                >
                                                                    <ScissorsIcon className="w-4 h-4" />
                                                                    <span className="text-xs font-bold hidden md:inline">
                                                                        Cortar
                                                                    </span>
                                                                </button>
                                                            )}
                                                    </div>
                                                )}

                                                {/* EXCLUSIVO ADMIN: Remoção direta sem fluxo de aprovação */}
                                                {souAdminExclusivo &&
                                                    item.pivot &&
                                                    ![
                                                        "concluido",
                                                        "cancelado",
                                                    ].includes(
                                                        pedido.status,
                                                    ) && (
                                                        <button
                                                            onClick={() =>
                                                                handleRemoverAdmin(
                                                                    item,
                                                                )
                                                            }
                                                            className="group/btn flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-status-danger-solid border border-status-danger-solid text-white hover:brightness-95 transition shadow-sm"
                                                            title="Remover do pedido imediatamente (Exclusivo Admin)"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                            <span className="text-xs font-bold hidden md:inline">
                                                                Remover
                                                            </span>
                                                        </button>
                                                    )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Empty State se não houver motos reais após análise */}
                            {((pedido.status === 'em_analise' && pedido.motos.length === 0) 
                                ? (pedido.itens || []) 
                                : pedido.motos
                            ).length === 0 && (
                                <div className="p-8 text-center text-content-secondary">
                                    <ExclamationTriangleIcon className="w-12 h-12 mx-auto text-content-muted mb-3" />
                                    <p className="font-bold text-content-secondary text-lg">Nenhuma motocicleta neste pedido.</p>
                                    <p className="text-sm text-content-muted mt-1">Todos os itens foram estornados ou rejeitados na etapa de análise.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    )}

                    {/* --- 5. AÇÕES GLOBAIS --- */}
                    {!ehPeca && pedido.status !== "cancelado" &&
                        pedido.status !== "concluido" && (
                            <div className="mt-8 rounded-card border-l-4 border-brand-600 bg-surface-card p-6 shadow-card">
                                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-content-primary">
                                    <span className="rounded-lg bg-brand-50 p-1.5 text-brand-600">
                                        <BoltIcon className="h-5 w-5" />
                                    </span>
                                    Ações
                                </h3>
                                <div className="flex flex-wrap gap-4">
                                    {pedido.status === "solicitado" &&
                                        (souOrigem ||
                                            (souCD && !isTransferencia) ||
                                            souAdmin) && (
                                            <>
                                                <Button
                                                    onClick={confirmarSeparacao}
                                                    icon={CheckCircleIcon}
                                                    size="lg"
                                                    className="flex-1 justify-center"
                                                >
                                                    Confirmar separação
                                                </Button>
                                                <Button
                                                    onClick={handleRejeitar}
                                                    icon={XCircleIcon}
                                                    variant="secondary"
                                                    size="lg"
                                                    className="flex-1 justify-center text-status-danger-fg"
                                                >
                                                    Rejeitar
                                                </Button>
                                            </>
                                        )}
                                    {pedido.status === "expedido" &&
                                        (souCD || souAdmin) && (
                                            <Button
                                                onClick={confirmarSaida}
                                                icon={TruckIcon}
                                                size="lg"
                                                className="flex-1 justify-center"
                                            >
                                                Confirmar saída manual
                                            </Button>
                                        )}
                                </div>
                            </div>
                        )}

                    {/* --- 5. AÇÕES GLOBAIS (PEÇAS) --- */}
                    {ehPeca && peca?.pode_cancelar && (
                        <div className="mt-8 rounded-card border-l-4 border-status-danger-solid bg-surface-card p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="flex items-center gap-2 text-base font-bold text-content-primary">
                                    <span className="rounded-lg bg-status-danger-bg p-1.5 text-status-danger-fg">
                                        <XCircleIcon className="h-5 w-5" />
                                    </span>
                                    Cancelar Pedido de Peças
                                </h3>
                                <p className="text-xs text-content-secondary mt-1">
                                    Caso este pedido tenha sido criado por engano, em testes, ou não seja mais necessário, você pode cancelá-lo. As reservas serão liberadas.
                                </p>
                            </div>
                            <Button
                                onClick={handleRejeitar}
                                icon={XCircleIcon}
                                variant="secondary"
                                size="md"
                                className="!text-status-danger-fg hover:!bg-status-danger-bg border-status-danger-border shrink-0"
                            >
                                Cancelar / Rejeitar Pedido
                            </Button>
                        </div>
                    )}

                    {/* --- 6. HISTÓRICO --- */}
                    <div className="mt-8 pt-6 border-t border-line">
                        <h3 className="font-bold text-content-muted text-xs uppercase mb-6 tracking-widest">
                            Linha do Tempo
                        </h3>
                        <div className="space-y-6 pl-2">
                            {pedido.logs?.map((log, i) => (
                                <div
                                    key={log.id}
                                    className="flex gap-4 relative group"
                                >
                                    {i !== pedido.logs.length - 1 && (
                                        <div className="absolute left-[5px] top-6 w-0.5 h-full bg-line group-last:hidden"></div>
                                    )}
                                    <div className="relative z-10 flex-shrink-0 mt-1">
                                        <div className="h-3 w-3 rounded-full bg-line-strong ring-4 ring-surface-card group-hover:bg-status-info-solid transition"></div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-content-muted font-mono mb-0.5">
                                            {new Date(
                                                log.created_at,
                                            ).toLocaleString()}
                                        </p>
                                        <p className="text-sm font-bold text-content-primary">
                                            {log.titulo}
                                        </p>
                                        <p className="text-sm text-content-secondary leading-relaxed">
                                            {log.descricao}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
            </div>

            {/* FAB */}
            {!ehPeca && ["em_transito", "em_transito_cd"].includes(pedido.status) &&
                ehDestinatarioFinal && (
                    <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-50 pointer-events-none">
                        <button
                            onClick={handleConferenciaEntrega}
                            disabled={compressing}
                            className={`pointer-events-auto flex items-center gap-3 rounded-full px-8 py-4 font-bold text-white shadow-overlay ring-4 transition disabled:opacity-70 ${
                                isEmbarqueParcial
                                    ? "bg-status-warning-solid ring-status-warning-solid/30 hover:brightness-95"
                                    : "bg-brand-600 ring-brand-600/20 hover:bg-brand-700"
                            }`}
                        >
                            {compressing ? (
                                <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full"></span>
                            ) : (
                                <DocumentTextIcon className="w-6 h-6" />
                            )}{" "}
                            <span className="uppercase tracking-wide text-sm">
                                {isEmbarqueParcial
                                    ? `Recebimento Parcial (${motosEmTransito}/${totalItensSolicitados} em trânsito)`
                                    : "Conferir e Finalizar Entrega"}
                            </span>
                        </button>
                    </div>
                )}

            <ChatBox pedidoId={pedido.id} />
        </AppLayout>
    );
}

// --- HELPERS ---
function getMotivoStyle(motivo) {
    const m = (motivo || "").toLowerCase();
    if (m.includes("venda"))
        return "bg-status-success-bg text-status-success-fg border-status-success-solid/20";
    if (m.includes("garantia") || m.includes("frota"))
        return "bg-status-danger-bg text-status-danger-fg border-status-danger-solid/20";
    if (m.includes("exposição"))
        return "bg-status-warning-bg text-status-warning-fg border-status-warning-solid/20";
    return "bg-status-info-bg text-status-info-fg border-status-info-solid/20";
}

function getColorHex(cor) {
    if (!cor) return "#e5e7eb";
    const c = cor.toLowerCase().trim();
    const map = {
        vermelho: "#ef4444",
        vermelha: "#ef4444",
        azul: "#3b82f6",
        "azul escuro": "#1e3a8a",
        preto: "#111827",
        preta: "#111827",
        branco: "#ffffff",
        branca: "#ffffff",
        prata: "#9ca3af",
        cinza: "#6b7280",
        amarelo: "#eab308",
        amarela: "#eab308",
        verde: "#22c55e",
    };
    return map[c] || "#9ca3af";
}

function TipoBadge({ isTransferencia, isPeca = false }) {
    if (isPeca) {
        return (
            <span className="text-[10px] bg-brand-50 text-brand-700 px-2 py-1 rounded border border-brand-200 font-bold uppercase tracking-wide flex items-center gap-1">
                <WrenchScrewdriverIcon className="w-3 h-3" /> Peças · Reposição CD
            </span>
        );
    }
    return isTransferencia ? (
        <span className="text-[10px] bg-status-warning-bg text-status-warning-fg px-2 py-1 rounded border border-status-warning-solid/20 font-bold uppercase tracking-wide flex items-center gap-1">
            <ArrowsRightLeftIcon className="w-3 h-3" /> Transferência
        </span>
    ) : (
        <span className="text-[10px] bg-status-info-bg text-status-info-fg px-2 py-1 rounded border border-status-info-solid/20 font-bold uppercase tracking-wide flex items-center gap-1">
            <BuildingOffice2Icon className="w-3 h-3" /> Reposição CD
        </span>
    );
}

function Timeline({ status, isTransferencia, isEmbarqueParcial = false, isPeca = false, peca = null, pedido = null }) {
    let steps = [];
    let activeStepId = null;
    let activeStepWeight = 1;
    let infoEtapa = null;

    if (isPeca) {
        // Fluxo de Peças (v3.3): Didático em 6 etapas claras
        steps = [
            { id: "solicitado", weight: 1, label: "1. Solicitação", sub: "Catálogo", ator: "Loja", icon: DocumentTextIcon },
            { id: "aguardando_confirmacao", weight: 2, label: "2. Liberação", sub: "Gate 1", ator: "Pós-Venda", icon: ShieldCheckIcon },
            { id: "separado", weight: 3, label: "3. Separação", sub: "Basqueta CD", ator: "Estoque CD", icon: WrenchScrewdriverIcon },
            { id: "faturamento_gate2", weight: 4, label: "4. Faturamento", sub: "Gate 2 (NF)", ator: "CD & Loja", icon: ClipboardDocumentCheckIcon },
            { id: "em_transito", weight: 5, label: "5. Em Trânsito", sub: "Carga", ator: "Transporte", icon: TruckIcon },
            { id: "concluido", weight: 6, label: "6. Recebimento", sub: "Baixa Estoque", ator: "Filial Destino", icon: CheckCircleIcon },
        ];

        const basqueta = peca?.basquetas?.[0];
        const basquetaStatus = basqueta?.status;
        const todasSeparadas = (pedido?.itens_pedido ?? []).length > 0 && (pedido?.itens_pedido ?? []).every((i) => (i.qtd_pendente ?? 0) === 0);

        if (status === 'cancelado') {
            activeStepId = 'cancelado';
            activeStepWeight = 0;
            infoEtapa = {
                badge: 'Cancelado',
                titulo: 'Pedido Cancelado',
                ator: 'Sistema / Usuário',
                tom: 'danger',
                descricao: 'A solicitação foi cancelada e os saldos reservados foram liberados no estoque do CD.',
                proximo: 'Nenhuma ação pendente.',
            };
        } else if (status === 'solicitado') {
            activeStepId = 'solicitado';
            activeStepWeight = 1;
            infoEtapa = {
                badge: 'Etapa 1 de 6',
                titulo: 'Aguardando Atendimento do CD / Call Center',
                ator: 'Equipe de Peças do CD',
                tom: 'info',
                descricao: 'A loja enviou a solicitação de peças. O CD está conferindo os itens no catálogo oficial, definindo os SKUs e valores de reposição.',
                proximo: 'Assim que todos os itens tiverem códigos SKU atribuídos, o pedido segue automaticamente para liberação técnica do Pós-Venda.',
            };
        } else if (status === 'em_atendimento') {
            activeStepId = 'solicitado';
            activeStepWeight = 1.5;
            infoEtapa = {
                badge: 'Etapa 1 de 6',
                titulo: 'Em Triagem Técnica no CD',
                ator: 'Operador de Peças (CD)',
                tom: 'info',
                descricao: 'O operador do Call Center está identificando as peças de balcão e vinculando ao catálogo oficial da montadora.',
                proximo: 'Conclusão da triagem e encaminhamento ao Gate 1.',
            };
        } else if (status === 'aguardando_confirmacao') {
            activeStepId = 'aguardando_confirmacao';
            activeStepWeight = 2;
            infoEtapa = {
                badge: 'Etapa 2 de 6',
                titulo: 'Gate 1: Aguardando Assinatura do Pós-Venda',
                ator: 'Validador Técnico (Pós-Venda)',
                tom: 'warning',
                descricao: 'Todos os itens foram identificados. O validador do Pós-Venda precisa aprovar os itens e preços para autorizar a separação física.',
                proximo: 'O validador assina a liberação no painel de Atendimento de Peças. Sem essa assinatura, o galpão não pode separar.',
            };
        } else if (status === 'aprovado') {
            activeStepId = 'separado';
            activeStepWeight = 2.5;
            infoEtapa = {
                badge: 'Etapa 3 de 6',
                titulo: 'Aprovado no Gate 1 — Aguardando Separação no CD',
                ator: 'Operador de Estoque (Galpão CD)',
                tom: 'info',
                descricao: 'Solicitação liberada tecnicamente pelo Pós-Venda. O operador do galpão deve localizar as peças nas prateleiras e colocá-las na basqueta.',
                proximo: 'O CD confirma a separação física dos itens.',
            };
        } else if (status === 'separado') {
            if (basquetaStatus === 'faturada' || basquetaStatus === 'em_conferencia') {
                activeStepId = 'faturamento_gate2';
                activeStepWeight = 4;
                infoEtapa = {
                    badge: 'Etapa 4 de 6',
                    titulo: 'Gate 2: Basqueta Faturada — Aguardando Conferência da Filial',
                    ator: 'Filial de Destino (Loja)',
                    tom: 'warning',
                    descricao: `A basqueta #${basqueta?.id} foi faturada pelo CD sob a NF ${basqueta?.nota_fiscal || 'emitida'}. O romaneio de peças está pronto para conferência.`,
                    proximo: 'A filial deve abrir o romaneio digital da basqueta e anexar a foto do canhoto assinado para liberar o embarque.',
                };
            } else if (basquetaStatus === 'liberada') {
                activeStepId = 'faturamento_gate2';
                activeStepWeight = 4.5;
                infoEtapa = {
                    badge: 'Etapa 4 de 6',
                    titulo: 'Gate 2 Concluído — Basqueta Liberada para Carga',
                    ator: 'Expedição CD',
                    tom: 'success',
                    descricao: `A basqueta #${basqueta?.id} foi conferida e liberada pela filial. Está pronta no CD para ser embarcada no caminhão.`,
                    proximo: 'A expedição do CD vincula a basqueta à carga no caminhão.',
                };
            } else if (todasSeparadas) {
                activeStepId = 'faturamento_gate2';
                activeStepWeight = 3.5;
                infoEtapa = {
                    badge: 'Etapa 3 de 6 (Concluída)',
                    titulo: 'Peças 100% Separadas na Basqueta — Próximo: Faturamento',
                    ator: 'Equipe de Faturamento (CD)',
                    tom: 'info',
                    descricao: `Todos os itens foram reservados e acondicionados na Basqueta #${basqueta?.id || ''} da filial.`,
                    proximo: 'O CD deve emitir a Nota Fiscal em Peças > Basquetas para liberar o romaneio e conferência da filial.',
                };
            } else {
                activeStepId = 'separado';
                activeStepWeight = 3;
                infoEtapa = {
                    badge: 'Etapa 3 de 6',
                    titulo: 'Separação Parcial em Andamento no CD',
                    ator: 'Operador de Estoque (CD)',
                    tom: 'info',
                    descricao: 'Parte dos itens já foi colocada na basqueta. Restam peças pendentes a localizar no estoque.',
                    proximo: 'Concluir a separação dos itens restantes.',
                };
            }
        } else if (['rota_confirmada', 'expedido', 'aguardando_rota'].includes(status)) {
            activeStepId = 'faturamento_gate2';
            activeStepWeight = 4.8;
            infoEtapa = {
                badge: 'Etapa 4 de 6',
                titulo: 'Carga Agendada — Aguardando Saída da Frota',
                ator: 'Logística & Frota CD',
                tom: 'info',
                descricao: 'A basqueta de peças foi embarcada na carga e a rota está agendada no Calendário.',
                proximo: 'O status mudará para Em Trânsito assim que o caminhão for liberado na portaria do CD.',
            };
        } else if (['em_transito', 'em_transito_cd'].includes(status)) {
            activeStepId = 'em_transito';
            activeStepWeight = 5;
            infoEtapa = {
                badge: 'Etapa 5 de 6',
                titulo: 'Em Trânsito Rodoviário para a Filial',
                ator: 'Transporte / Motorista',
                tom: 'info',
                descricao: 'O caminhão está na estrada realizando a rota de entrega das peças até a loja.',
                proximo: 'Ao descarregar na filial, o responsável deve conferir fisicamente os volumes e confirmar o recebimento na tela.',
            };
        } else if (status === 'concluido') {
            activeStepId = 'concluido';
            activeStepWeight = 6;
            infoEtapa = {
                badge: 'Etapa 6 de 6 (Concluído)',
                titulo: 'Pedido Entregue e Saldo Integrado ao Estoque',
                ator: 'Filial Destino',
                tom: 'success',
                descricao: 'Conferência física finalizada com sucesso. O saldo das peças foi transferido definitivamente do CD para o estoque local da filial.',
                proximo: 'Ciclo encerrado. Peças disponíveis no inventário da loja.',
            };
        }
    } else if (isTransferencia) {
        // Fluxo de Transferência de Motos entre Lojas (7 etapas didáticas completas)
        steps = [
            { id: "solicitado_origem", weight: 1, label: "1. Solicitação", sub: "Loja Destino", ator: "Loja Solicitante", icon: DocumentTextIcon },
            { id: "em_analise", weight: 2, label: "2. Análise", sub: "Diretoria", ator: "Gestor Comercial", icon: ShieldCheckIcon },
            { id: "solicitado", weight: 3, label: "3. Confirmação", sub: "Pátio Cedente", ator: "Loja Cedente", icon: BuildingOffice2Icon },
            { id: "separado", weight: 4, label: "4. Separação", sub: "Pronta p/ Coleta", ator: "Loja Cedente", icon: CubeIcon },
            { id: "rota_confirmada", weight: 5, label: "5. Agendamento", sub: "Calendário", ator: "Logística Frota", icon: CalendarIcon },
            { id: "em_transito", weight: 6, label: "6. Em Trânsito", sub: "Transporte", ator: "Motorista Frota", icon: TruckIcon },
            { id: "concluido", weight: 7, label: "7. Recebimento", sub: "Entrada Estoque", ator: "Loja Destino", icon: CheckCircleIcon },
        ];

        if (status === 'cancelado') {
            activeStepId = 'cancelado';
            activeStepWeight = 0;
            infoEtapa = {
                badge: 'Cancelado',
                titulo: 'Transferência Cancelada',
                ator: 'Sistema / Diretoria',
                tom: 'danger',
                descricao: 'A transferência de motocicleta foi cancelada e a unidade permanece no estoque regular da filial cedente.',
                proximo: 'Nenhuma ação pendente.',
            };
        } else if (status === 'em_analise') {
            activeStepId = 'em_analise';
            activeStepWeight = 2;
            infoEtapa = {
                badge: 'Etapa 2 de 7',
                titulo: 'Aguardando Análise Comercial da Diretoria',
                ator: 'Diretoria Comercial / Gestor',
                tom: 'warning',
                descricao: 'A transferência entre filiais foi solicitada pela loja de destino e aguarda autorização da diretoria comercial.',
                proximo: 'O gestor autoriza a movimentação no sistema para liberar a confirmação da loja cedente.',
            };
        } else if (status === 'solicitado') {
            activeStepId = 'solicitado';
            activeStepWeight = 3;
            infoEtapa = {
                badge: 'Etapa 3 de 7',
                titulo: 'Aguardando Confirmação da Loja Cedente',
                ator: 'Loja Cedente (Origem)',
                tom: 'warning',
                descricao: `A transferência foi autorizada pela diretoria. A filial cedente (${pedido?.origem?.filial || 'Origem'}) precisa inspecionar a unidade no pátio e confirmar a separação.`,
                proximo: 'A loja de origem clica em Confirmar Separação na tela do pedido.',
            };
        } else if (status === 'separado') {
            activeStepId = 'separado';
            activeStepWeight = 4;
            infoEtapa = {
                badge: 'Etapa 4 de 7',
                titulo: 'Moto Separada no Pátio — Pronta para Coleta',
                ator: 'Loja Cedente & Logística',
                tom: 'info',
                descricao: 'A motocicleta foi inspecionada, limpa e alocada na área de coleta da filial cedente com os documentos separados.',
                proximo: 'A equipe de logística do CD inclui o recolhimento no roteiro do Calendário da frota.',
            };
        } else if (['rota_confirmada', 'aguardando_coleta', 'coletado', 'expedido', 'aguardando_rota'].includes(status)) {
            activeStepId = 'rota_confirmada';
            activeStepWeight = 5;
            infoEtapa = {
                badge: 'Etapa 5 de 7',
                titulo: 'Coleta Agendada no Calendário da Frota',
                ator: 'Logística & Frota CD',
                tom: 'info',
                descricao: 'A viagem para recolhimento da unidade foi programada no roteiro de transporte da frota.',
                proximo: 'O caminhão fará a parada na filial de origem para coletar a moto.',
            };
        } else if (['em_transito', 'em_transito_cd'].includes(status)) {
            activeStepId = 'em_transito';
            activeStepWeight = 6;
            infoEtapa = {
                badge: 'Etapa 6 de 7',
                titulo: 'Moto em Transporte para a Filial Destino',
                ator: 'Transporte / Motorista',
                tom: 'info',
                descricao: `A unidade está embarcada no caminhão da frota a caminho da loja de destino (${pedido?.user?.filial || 'Destino'}).`,
                proximo: 'Conferência do chassi no descarregamento na filial e upload da foto do canhoto assinado.',
            };
        } else if (status === 'concluido') {
            activeStepId = 'concluido';
            activeStepWeight = 7;
            infoEtapa = {
                badge: 'Etapa 7 de 7 (Concluído)',
                titulo: 'Transferência Concluída e Chassi Integrado',
                ator: 'Loja Destino',
                tom: 'success',
                descricao: 'Moto recebida e conferida pela filial de destino com comprovante anexado. A posse do chassi agora pertence formalmente ao estoque da loja.',
                proximo: 'Unidade pronta para exposição e venda ao cliente final.',
            };
        }
    } else {
        // Fluxo de Reposição Regular de Motos (CD -> Loja) (7 etapas didáticas completas)
        steps = [
            { id: "solicitado_loja", weight: 1, label: "1. Solicitação", sub: "Grade & Cota", ator: "Loja Destino", icon: DocumentTextIcon },
            { id: "em_analise", weight: 2, label: "2. Análise", sub: "Diretoria", ator: "Gestor Comercial", icon: ShieldCheckIcon },
            { id: "atribuicao", weight: 3, label: "3. Atribuição", sub: "Chassi no Pátio", ator: "Operação CD", icon: CubeIcon },
            { id: "separado", weight: 4, label: "4. Separação", sub: "Baia Expedição", ator: "Expedição CD", icon: WrenchScrewdriverIcon },
            { id: "rota_confirmada", weight: 5, label: "5. Agendamento", sub: "Calendário", ator: "Logística CD", icon: CalendarIcon },
            { id: "em_transito", weight: 6, label: "6. Em Trânsito", sub: isEmbarqueParcial ? "Parcial" : "Cegonha Frota", ator: "Transporte", icon: TruckIcon },
            { id: "concluido", weight: 7, label: "7. Recebimento", sub: "Canhoto & Estoque", ator: "Filial Destino", icon: CheckCircleIcon },
        ];

        const cotas = pedido?.itens_pedido || [];
        const cotasPendentes = cotas.filter((c) => (c.qtd_pendente ?? 0) > 0);
        const totalItens = cotas.reduce((acc, c) => acc + (c.quantidade ?? 0), 0);
        const totalAtribuidos = cotas.reduce((acc, c) => acc + (c.qtd_atribuida ?? 0), 0);

        if (status === 'cancelado') {
            activeStepId = 'cancelado';
            activeStepWeight = 0;
            infoEtapa = {
                badge: 'Cancelado',
                titulo: 'Pedido Cancelado',
                ator: 'Sistema / Gestor',
                tom: 'danger',
                descricao: 'O pedido foi cancelado e eventuais reservas de chassi foram desfeitas no estoque do CD.',
                proximo: 'Nenhuma ação pendente.',
            };
        } else if (status === 'em_analise') {
            activeStepId = 'em_analise';
            activeStepWeight = 2;
            infoEtapa = {
                badge: 'Etapa 2 de 7',
                titulo: 'Aguardando Análise Comercial do Gestor',
                ator: 'Diretoria Comercial / Gestor',
                tom: 'warning',
                descricao: 'O pedido de reposição foi emitido pela filial e está na fila da diretoria para validação de crédito e cota comercial.',
                proximo: 'O gestor avalia a grade solicitada e clica em Aprovar Pedido.',
            };
        } else if (status === 'solicitado') {
            if (cotas.length > 0 && cotasPendentes.length > 0) {
                activeStepId = 'atribuicao';
                activeStepWeight = 3;
                infoEtapa = {
                    badge: 'Etapa 3 de 7',
                    titulo: 'Aprovado — Bipagem e Vinculação de Chassis no CD',
                    ator: 'Operação de Pátio (CD)',
                    tom: 'warning',
                    descricao: `Pedido aprovado pela diretoria. O operador do CD precisa bipar ou vincular os chassis físicos no pátio para cada modelo solicitado (${totalAtribuidos} de ${totalItens} unidades bipadas).`,
                    proximo: 'O CD bipa os chassis pendentes (ou encerra o saldo em falta) para liberar a separação física.',
                };
            } else if (cotas.length > 0 && cotasPendentes.length === 0) {
                activeStepId = 'separado';
                activeStepWeight = 3.8;
                infoEtapa = {
                    badge: 'Etapa 3 de 7 (Concluída)',
                    titulo: 'Chassis 100% Atribuídos — Aguardando Separação no CD',
                    ator: 'Expedição do CD',
                    tom: 'info',
                    descricao: `Todos os ${totalAtribuidos} números de chassi foram vinculados com sucesso no sistema. As motos estão prontas para serem alocadas na baia de expedição.`,
                    proximo: 'A equipe de expedição confirma a separação física das motos para liberar o agendamento no Calendário.',
                };
            } else {
                activeStepId = 'atribuicao';
                activeStepWeight = 3;
                infoEtapa = {
                    badge: 'Etapa 3 de 7',
                    titulo: 'Aprovado — Vinculação de Chassi no CD',
                    ator: 'Equipe de Pátio (CD)',
                    tom: 'info',
                    descricao: 'O pedido foi aprovado comercialmente. O CD está atribuindo os números de chassi das motos reservadas.',
                    proximo: 'O CD vincula os chassis físicos para encaminhar à separação.',
                };
            }
        } else if (status === 'separado') {
            activeStepId = 'separado';
            activeStepWeight = 4;
            infoEtapa = {
                badge: 'Etapa 4 de 7',
                titulo: 'Motos Separadas na Baia de Expedição do CD',
                ator: 'Expedição CD & Logística',
                tom: 'info',
                descricao: 'As motos foram inspecionadas e alocadas fisicamente na baia de expedição do CD, aguardando inclusão no romaneio de carga.',
                proximo: 'A equipe de logística agenda a rota no Calendário semanal e gera o romaneio de carga.',
            };
        } else if (['rota_confirmada', 'expedido', 'aguardando_coleta', 'coletado', 'aguardando_rota'].includes(status)) {
            activeStepId = 'rota_confirmada';
            activeStepWeight = 5;
            infoEtapa = {
                badge: 'Etapa 5 de 7',
                titulo: 'Viagem Agendada no Calendário da Frota',
                ator: 'Logística & Expedição CD',
                tom: 'info',
                descricao: 'O romaneio de carga foi gerado e a viagem está confirmada no Calendário semanal da frota.',
                proximo: 'Carregamento do caminhão cegonha e liberação da viagem pela portaria do CD.',
            };
        } else if (['em_transito', 'em_transito_cd'].includes(status)) {
            activeStepId = 'em_transito';
            activeStepWeight = 6;
            infoEtapa = {
                badge: 'Etapa 6 de 7',
                titulo: isEmbarqueParcial ? 'Carga em Trânsito Parcial' : 'Caminhão Cegonha em Trânsito Rodoviário',
                ator: 'Transporte / Motorista',
                tom: 'info',
                descricao: 'As motos estão embarcadas na cegonha e em deslocamento rodoviário a caminho da loja.',
                proximo: 'Descarregamento na filial, conferência dos chassis e upload do canhoto assinado.',
            };
        } else if (status === 'concluido') {
            activeStepId = 'concluido';
            activeStepWeight = 7;
            infoEtapa = {
                badge: 'Etapa 7 de 7 (Concluído)',
                titulo: 'Entrega Realizada e Concluída',
                ator: 'Filial Destino',
                tom: 'success',
                descricao: 'Conferência física finalizada na loja, canhoto assinado arquivado no sistema e motos integradas ao estoque.',
                proximo: 'Unidades prontas no pátio da loja para venda e entrega ao cliente.',
            };
        }
    }

    const activeIndex = status === 'cancelado'
        ? -1
        : status === 'concluido'
        ? steps.length - 1
        : Math.max(0, steps.findIndex((s) => s.id === activeStepId));

    const percentConcluido = status === 'cancelado'
        ? 0
        : status === 'concluido'
        ? 100
        : Math.round((activeIndex / (steps.length - 1)) * 100);

    return (
        <div className="bg-surface-card rounded-2xl border border-line p-5 md:p-6 shadow-sm space-y-6">
            {/* CABEÇALHO DO PROGRESSO */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-4">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-brand-50 text-brand-700">
                        <ClockIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-content-primary tracking-tight">
                            Progresso do Pedido {isPeca ? 'de Peças' : (isTransferencia ? 'de Transferência' : 'de Motos')}
                        </h3>
                        <p className="text-xs text-content-muted">
                            Acompanhe cada fase desde a solicitação inicial até a entrada no estoque da filial
                        </p>
                    </div>
                </div>

                {infoEtapa && (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider self-start sm:self-auto ${
                        infoEtapa.tom === 'warning'
                            ? 'bg-status-warning-bg text-status-warning-fg border border-status-warning-solid/30'
                            : infoEtapa.tom === 'success'
                            ? 'bg-status-success-bg text-status-success-fg border border-status-success-solid/30'
                            : infoEtapa.tom === 'danger'
                            ? 'bg-status-danger-bg text-status-danger-fg border border-status-danger-solid/30'
                            : 'bg-brand-50 text-brand-700 border border-brand-200'
                    }`}>
                        <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                        {infoEtapa.badge}
                    </span>
                )}
            </div>

            {/* BARRA DE ETAPAS VISUAL */}
            <div className="relative pt-2 pb-3">
                {/* Linha conectora de fundo */}
                <div className={`hidden ${steps.length === 7 ? 'lg:block' : 'md:block'} absolute left-8 right-8 top-[28px] h-1.5 bg-line rounded-full -z-0`}></div>
                {/* Linha conectora de progresso preenchido */}
                {status !== 'cancelado' && (
                    <div
                        className={`hidden ${steps.length === 7 ? 'lg:block' : 'md:block'} absolute left-8 top-[28px] h-1.5 bg-status-success-solid rounded-full transition-all duration-700 ease-out z-0`}
                        style={{ width: `calc(${Math.min(percentConcluido, 100)}% - 20px)` }}
                    ></div>
                )}

                {/* Grid dos Passos */}
                <div className={`grid grid-cols-2 sm:grid-cols-3 ${steps.length === 7 ? 'md:grid-cols-4 lg:grid-cols-7' : 'md:grid-cols-6'} gap-3 md:gap-2 relative z-10`}>
                    {steps.map((step) => {
                        const isParcialStep = isEmbarqueParcial && step.id === "em_transito";
                        const isConcluido = status !== "cancelado" && (status === "concluido" || step.weight < activeStepWeight);
                        const isAtual = status !== "cancelado" && status !== "concluido" && step.id === activeStepId;
                        const StepIcon = step.icon;

                        return (
                            <div
                                key={step.id}
                                className={`flex flex-col items-center text-center p-2 rounded-xl transition-all ${
                                    isAtual ? 'bg-brand-50/60 ring-2 ring-brand-600/20' : ''
                                }`}
                            >
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xs shadow-sm transition-all duration-300 ${
                                    isConcluido
                                        ? 'bg-status-success-solid text-white'
                                        : isAtual
                                        ? 'bg-brand-600 text-white shadow-md ring-4 ring-brand-600/20 scale-105'
                                        : 'bg-surface-card border-2 border-line text-content-muted'
                                }`}>
                                    {isConcluido ? (
                                        <CheckCircleIcon className="w-6 h-6" />
                                    ) : (
                                        <StepIcon className="w-5 h-5" />
                                    )}
                                </div>

                                <div className="mt-2 space-y-0.5 w-full">
                                    <p className={`text-xs font-black tracking-tight leading-tight truncate ${
                                        isAtual ? 'text-brand-700' : isConcluido ? 'text-content-primary' : 'text-content-muted'
                                    }`}>
                                        {step.label}
                                    </p>
                                    {step.sub && (
                                        <p className="text-[10px] font-bold text-content-muted uppercase tracking-wider truncate">
                                            {step.sub}
                                        </p>
                                    )}
                                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded truncate max-w-full ${
                                        isAtual ? 'bg-brand-100 text-brand-800' : 'bg-surface-sunken text-content-secondary'
                                    }`}>
                                        {step.ator}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* CARD DIDÁTICO AUTOEXPLICATIVO DA ETAPA ATUAL */}
            {infoEtapa && (
                <div className={`p-4 md:p-5 rounded-xl border flex flex-col sm:flex-row items-start gap-4 transition-all ${
                    infoEtapa.tom === 'warning'
                        ? 'bg-status-warning-bg/60 border-status-warning-solid/40 text-status-warning-fg'
                        : infoEtapa.tom === 'success'
                        ? 'bg-status-success-bg/60 border-status-success-solid/40 text-status-success-fg'
                        : infoEtapa.tom === 'danger'
                        ? 'bg-status-danger-bg/60 border-status-danger-solid/40 text-status-danger-fg'
                        : 'bg-status-info-bg/60 border-status-info-solid/40 text-status-info-fg'
                }`}>
                    <div className="p-2.5 rounded-xl bg-surface-card shrink-0 shadow-sm border border-line">
                        <ClockIcon className="w-6 h-6 text-content-primary" />
                    </div>

                    <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm md:text-base font-black text-content-primary flex items-center gap-2">
                                <span>📍</span>
                                <span>Etapa Atual: {infoEtapa.titulo}</span>
                            </h4>
                            <span className="text-xs font-bold text-content-secondary bg-surface-card px-2.5 py-1 rounded-lg border border-line shadow-2xs">
                                Responsável: <strong className="text-content-primary">{infoEtapa.ator}</strong>
                            </span>
                        </div>

                        <p className="text-xs md:text-sm text-content-secondary leading-relaxed">
                            {infoEtapa.descricao}
                        </p>

                        <div className="flex items-start gap-2 pt-1 text-xs font-medium text-content-primary">
                            <span className="font-bold shrink-0">⚡ Próximo passo:</span>
                            <span className="text-content-secondary">{infoEtapa.proximo}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Aviso de contexto do pedido.
 *
 * O tom carrega o significado, não a decoração:
 *   warning -> alguém precisa agir agora
 *   info    -> está em curso, é só aguardar
 *   danger  -> algo deu errado
 */
function AlertaContexto({ tom = "info", icon: Icon, titulo, children }) {
    const tons = {
        warning: {
            caixa: "border-status-warning-solid bg-status-warning-bg/50",
            marca: "bg-status-warning-bg text-status-warning-fg",
            titulo: "text-status-warning-fg",
        },
        info: {
            caixa: "border-status-info-solid bg-status-info-bg/50",
            marca: "bg-status-info-bg text-status-info-fg",
            titulo: "text-status-info-fg",
        },
        danger: {
            caixa: "border-status-danger-solid bg-status-danger-bg/50",
            marca: "bg-status-danger-bg text-status-danger-fg",
            titulo: "text-status-danger-fg",
        },
    }[tom];

    return (
        <div className={`flex items-start gap-4 rounded-card border-l-4 p-5 shadow-card ${tons.caixa}`}>
            {Icon && (
                <span className={`shrink-0 rounded-full p-2 ${tons.marca}`}>
                    <Icon className="h-6 w-6" />
                </span>
            )}
            <div>
                <h4 className={`text-sm font-bold uppercase tracking-wide ${tons.titulo}`}>
                    {titulo}
                </h4>
                <p className="mt-1 text-sm text-content-secondary">{children}</p>
            </div>
        </div>
    );
}
