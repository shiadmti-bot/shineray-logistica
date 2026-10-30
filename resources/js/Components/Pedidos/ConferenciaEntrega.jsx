import { useState, useRef, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import imageCompression from 'browser-image-compression';
import {
    DocumentTextIcon,
    CameraIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    XMarkIcon,
    ArrowPathIcon,
    PhotoIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import { Button } from '@/Components/UI';
import { avisar, avisarErro } from '@/Lib/alertas';

const COMPRESSAO = { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true };

const comprimirSeImagem = (arquivo) =>
    arquivo && arquivo.type?.startsWith('image/')
        ? imageCompression(arquivo, COMPRESSAO)
        : Promise.resolve(arquivo);

const CORES = {
    vermelho: '#ef4444',
    vermelha: '#ef4444',
    azul: '#3b82f6',
    'azul escuro': '#1e3a8a',
    preto: '#111827',
    preta: '#111827',
    branco: '#ffffff',
    branca: '#ffffff',
    prata: '#9ca3af',
    cinza: '#6b7280',
    amarelo: '#eab308',
    amarela: '#eab308',
    verde: '#22c55e',
};

const hexDaCor = (cor) => (cor ? CORES[cor.toLowerCase().trim()] || '#9ca3af' : '#e5e7eb');

/**
 * Modal Nativo de Conferência e Recebimento na Loja (v3.8).
 *
 * Modo Primário: Recebimento Rápido 100% Conforme (sem avarias).
 *   - 1 clique + upload/câmera do canhoto/romaneio assinado.
 *   - Preview instantâneo do documento antes de submeter.
 * Modo Secundário: Registro de Avarias por Exceção.
 *   - Acionado via toggle quando houver dano ou defeito em unidade específica.
 */
export default function ConferenciaEntrega({ pedido, papel }) {
    const { isEmbarqueParcial, motosEmTransito, totalItensSolicitados, totalNaoDespachado } = papel;
    const motos = pedido.motos || [];

    // Controle do Modal
    const [modalAberto, setModalAberto] = useState(false);
    const [modoAvarias, setModoAvarias] = useState(false);

    // Estado do Canhoto / Romaneio
    const [arquivoRomaneio, setArquivoRomaneio] = useState(null);
    const [previewRomaneio, setPreviewRomaneio] = useState(null);
    const romaneioInputRef = useRef(null);

    // Estado de Avarias por Moto: { [motoId]: { ativa: boolean, texto: string, foto: File, preview: string } }
    const [avariasPorMoto, setAvariasPorMoto] = useState({});

    // Estados de Envio
    const [enviando, setEnviando] = useState(false);
    const [statusProgresso, setStatusProgresso] = useState('');

    // Limpeza de URLs de preview para evitar memory leak
    useEffect(() => {
        return () => {
            if (previewRomaneio) URL.revokeObjectURL(previewRomaneio);
            Object.values(avariasPorMoto).forEach((item) => {
                if (item?.preview) URL.revokeObjectURL(item.preview);
            });
        };
    }, []);

    // Manipulação da foto do romaneio
    const handleRomaneioChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (previewRomaneio) URL.revokeObjectURL(previewRomaneio);

        setArquivoRomaneio(file);
        if (file.type.startsWith('image/')) {
            setPreviewRomaneio(URL.createObjectURL(file));
        } else {
            setPreviewRomaneio(null);
        }
    };

    const removerRomaneio = () => {
        if (previewRomaneio) URL.revokeObjectURL(previewRomaneio);
        setArquivoRomaneio(null);
        setPreviewRomaneio(null);
        if (romaneioInputRef.current) romaneioInputRef.current.value = '';
    };

    // Manipulação das avarias por unidade
    const toggleAvariaMoto = (motoId) => {
        setAvariasPorMoto((prev) => {
            const atual = prev[motoId];
            if (atual?.ativa) {
                if (atual.preview) URL.revokeObjectURL(atual.preview);
                const copia = { ...prev };
                delete copia[motoId];
                return copia;
            }
            return {
                ...prev,
                [motoId]: { ativa: true, texto: '', foto: null, preview: null },
            };
        });
    };

    const atualizarTextoAvaria = (motoId, texto) => {
        setAvariasPorMoto((prev) => ({
            ...prev,
            [motoId]: { ...prev[motoId], texto },
        }));
    };

    const handleFotoAvariaChange = (motoId, file) => {
        if (!file) return;
        setAvariasPorMoto((prev) => {
            const item = prev[motoId] || { ativa: true, texto: '' };
            if (item.preview) URL.revokeObjectURL(item.preview);
            return {
                ...prev,
                [motoId]: {
                    ...item,
                    foto: file,
                    preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
                },
            };
        });
    };

    const removerFotoAvaria = (motoId) => {
        setAvariasPorMoto((prev) => {
            const item = prev[motoId];
            if (!item) return prev;
            if (item.preview) URL.revokeObjectURL(item.preview);
            return {
                ...prev,
                [motoId]: { ...item, foto: null, preview: null },
            };
        });
    };

    const qtdAvariasRegistradas = Object.values(avariasPorMoto).filter(
        (a) => a?.ativa && a?.texto?.trim()
    ).length;

    // Submissão do Recebimento
    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();

        if (!arquivoRomaneio) {
            avisar('Atenção', 'É obrigatório anexar a foto ou PDF do romaneio assinado.', 'warning');
            return;
        }

        setEnviando(true);
        setStatusProgresso('Otimizando imagem do romaneio...');

        try {
            const canhotoComprimido = await comprimirSeImagem(arquivoRomaneio);

            const avariasPayload = {};
            const fotosPayload = {};

            const listaAvarias = Object.entries(avariasPorMoto).filter(
                ([_, item]) => item?.ativa && item?.texto?.trim()
            );

            if (listaAvarias.length > 0) {
                setStatusProgresso('Comprimindo fotos das avarias...');
                for (const [motoId, item] of listaAvarias) {
                    avariasPayload[motoId] = item.texto.trim();
                    if (item.foto) {
                        fotosPayload[motoId] = await comprimirSeImagem(item.foto);
                    }
                }
            }

            setStatusProgresso('Confirmando recebimento no servidor...');

            router.post(
                route('pedidos.finalizar', pedido.id),
                {
                    arquivo_romaneio: canhotoComprimido,
                    avarias: avariasPayload,
                    fotos_avarias: fotosPayload,
                },
                {
                    forceFormData: true,
                    onSuccess: () => {
                        setModalAberto(false);
                        avisar('Sucesso!', 'Recebimento confirmado com sucesso.', 'success');
                    },
                    onError: (erros) => {
                        avisarErro(erros, 'Erro no Recebimento', 'Não foi possível finalizar o pedido.');
                    },
                    onFinish: () => {
                        setEnviando(false);
                        setStatusProgresso('');
                    },
                }
            );
        } catch (erro) {
            console.error('Falha na compressão/envio:', erro);
            setEnviando(false);
            setStatusProgresso('');
            avisar('Erro', 'Falha ao processar as fotos. Tente enviar arquivos menores.', 'error');
        }
    };

    const abrirConferencia = () => {
        if (totalNaoDespachado > 0) {
            avisar(
                'Aguardando Despacho Integral',
                `Este pedido possui ${totalNaoDespachado} unidade(s) pendente(s) no CD. O recebimento oficial só pode ser feito com 100% da carga despachada.`,
                'warning'
            );
            return;
        }
        setModalAberto(true);
    };

    return (
        <>
            {/* Botão Flutuante de Ação */}
            <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-40 pointer-events-none">
                <button
                    type="button"
                    onClick={abrirConferencia}
                    disabled={enviando}
                    className={`pointer-events-auto flex items-center gap-3 rounded-full px-8 py-4 font-bold text-white shadow-overlay ring-4 transition hover:scale-102 active:scale-98 disabled:opacity-70 ${
                        isEmbarqueParcial
                            ? 'bg-status-warning-solid ring-status-warning-solid/30 hover:brightness-95'
                            : 'bg-brand-600 ring-brand-600/20 hover:bg-brand-700'
                    }`}
                >
                    {enviando ? (
                        <ArrowPathIcon className="w-6 h-6 animate-spin" />
                    ) : (
                        <DocumentTextIcon className="w-6 h-6" />
                    )}
                    <span className="uppercase tracking-wide text-sm">
                        {isEmbarqueParcial
                            ? `Recebimento Parcial (${motosEmTransito}/${totalItensSolicitados} em trânsito)`
                            : 'Conferir e Receber Pedido'}
                    </span>
                </button>
            </div>

            {/* Modal Nativo de Conferência */}
            <Transition show={modalAberto} leave="duration-200">
                <Dialog as="div" className="relative z-50" onClose={() => !enviando && setModalAberto(false)}>
                    <TransitionChild
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-content-muted/75 backdrop-blur-xs transition-opacity" />
                    </TransitionChild>

                    <div className="fixed inset-0 z-10 overflow-y-auto p-4 sm:p-6 md:p-10 flex items-center justify-center">
                        <TransitionChild
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <DialogPanel className="relative w-full max-w-2xl transform rounded-2xl bg-surface-card shadow-2xl ring-1 ring-line overflow-hidden flex flex-col max-h-[90vh]">
                                
                                {/* Cabeçalho */}
                                <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-surface-raised">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-status-success-bg text-status-success-fg">
                                            <DocumentTextIcon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-extrabold text-content-primary">
                                                Recebimento na Loja — Pedido #{pedido.id}
                                            </h3>
                                            <p className="text-xs text-content-secondary">
                                                Conferência física e arquivamento do canhoto assinado
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={enviando}
                                        onClick={() => setModalAberto(false)}
                                        className="rounded-lg p-2 text-content-muted hover:bg-surface-sunken hover:text-content-primary transition"
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Corpo Rolável */}
                                <form id="form-conferencia" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                                    
                                    {/* MODO PRIMÁRIO DESTACADO: 100% Conforme */}
                                    <div className={`p-4 rounded-xl border transition ${
                                        !modoAvarias
                                            ? 'bg-status-success-bg/40 border-status-success-border text-status-success-fg'
                                            : 'bg-surface-sunken border-line text-content-secondary'
                                    }`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-5 w-5 rounded-full bg-status-success-solid text-white flex items-center justify-center shrink-0">
                                                    <CheckIcon className="w-3.5 h-3.5 stroke-[3]" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-sm text-content-primary">
                                                        Modo Padrão: Carga 100% Conforme
                                                    </h4>
                                                    <p className="text-xs text-content-secondary">
                                                        {motos.length} unidade(s) conferida(s) no caminhão, sem avarias físicas.
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setModoAvarias(!modoAvarias)}
                                                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                                                    modoAvarias
                                                        ? 'bg-status-warning-bg text-status-warning-fg border-status-warning-border'
                                                        : 'bg-surface-card text-content-secondary border-line hover:bg-surface-sunken'
                                                }`}
                                            >
                                                {modoAvarias ? 'Ocultar Avarias' : '⚠️ Registrar Avaria'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Resumo Rápido das Motos */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-content-muted">
                                                Motos do Pedido ({motos.length})
                                            </span>
                                            {modoAvarias && qtdAvariasRegistradas > 0 && (
                                                <span className="text-xs font-bold text-status-danger-fg bg-status-danger-bg px-2 py-0.5 rounded-full">
                                                    {qtdAvariasRegistradas} avaria(s) marcada(s)
                                                </span>
                                            )}
                                        </div>

                                        <div className="divide-y divide-line rounded-xl border border-line bg-surface-card overflow-hidden max-h-56 overflow-y-auto">
                                            {motos.map((moto) => {
                                                const temAvaria = avariasPorMoto[moto.id]?.ativa;
                                                return (
                                                    <div key={moto.id} className="p-3 text-sm flex flex-col gap-2 hover:bg-surface-sunken/50 transition">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span
                                                                    className="h-3 w-3 rounded-full border border-line shrink-0"
                                                                    style={{ backgroundColor: hexDaCor(moto.cor) }}
                                                                    title={moto.cor}
                                                                />
                                                                <span className="font-bold text-content-primary truncate">
                                                                    {moto.modelo}
                                                                </span>
                                                                <span className="text-[11px] font-mono bg-surface-sunken px-2 py-0.5 rounded text-content-secondary border border-line">
                                                                    {moto.chassi}
                                                                </span>
                                                            </div>

                                                            {moto.estorno_pendente ? (
                                                                <span className="text-[10px] font-bold bg-status-danger-bg text-status-danger-fg px-2 py-0.5 rounded">
                                                                    Corte Pendente
                                                                </span>
                                                            ) : modoAvarias ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleAvariaMoto(moto.id)}
                                                                    className={`text-xs px-2.5 py-1 rounded-md font-semibold transition ${
                                                                        temAvaria
                                                                            ? 'bg-status-danger-solid text-white'
                                                                            : 'bg-surface-sunken text-content-secondary hover:bg-surface-card border border-line'
                                                                    }`}
                                                                >
                                                                    {temAvaria ? 'Avariada ✕' : '+ Avaria'}
                                                                </button>
                                                            ) : (
                                                                <span className="text-xs text-status-success-fg flex items-center gap-1 font-medium">
                                                                    <CheckCircleIcon className="w-4 h-4" /> OK
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Campos de Exceção por Moto */}
                                                        {modoAvarias && temAvaria && (
                                                            <div className="mt-2 p-3 rounded-lg bg-status-danger-bg/20 border border-status-danger-border space-y-2">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Descreva a avaria (ex: arranhão na carenagem, espelho quebrado)..."
                                                                    value={avariasPorMoto[moto.id]?.texto || ''}
                                                                    onChange={(e) => atualizarTextoAvaria(moto.id, e.target.value)}
                                                                    className="w-full text-xs rounded-md border-line bg-surface-card text-content-primary focus:ring-status-danger-solid focus:border-status-danger-solid"
                                                                />

                                                                <div className="flex items-center gap-2">
                                                                    {avariasPorMoto[moto.id]?.preview ? (
                                                                        <div className="relative inline-block">
                                                                            <img
                                                                                src={avariasPorMoto[moto.id].preview}
                                                                                alt="Foto avaria"
                                                                                className="h-12 w-12 rounded object-cover border border-line"
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => removerFotoAvaria(moto.id)}
                                                                                className="absolute -top-1 -right-1 bg-status-danger-solid text-white rounded-full p-0.5"
                                                                            >
                                                                                <XMarkIcon className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-card border border-line text-xs font-semibold text-content-secondary cursor-pointer hover:bg-surface-sunken transition">
                                                                            <CameraIcon className="w-4 h-4 text-content-muted" />
                                                                            <span>Foto da Avaria</span>
                                                                            <input
                                                                                type="file"
                                                                                accept="image/*"
                                                                                capture="environment"
                                                                                className="hidden"
                                                                                onChange={(e) => handleFotoAvariaChange(moto.id, e.target.files?.[0])}
                                                                            />
                                                                        </label>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* UPLOAD HERO: CANHOTO / ROMANEIO ASSINADO */}
                                    <div className="rounded-xl border border-line bg-surface-sunken/40 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-xs font-extrabold uppercase tracking-wide text-content-primary">
                                                📄 Foto do Romaneio / Canhoto Assinado <span className="text-brand-600">*</span>
                                            </label>
                                            <span className="text-[11px] text-content-muted">Obrigatório (Foto ou PDF)</span>
                                        </div>

                                        {!arquivoRomaneio ? (
                                            <div
                                                onClick={() => romaneioInputRef.current?.click()}
                                                className="border-2 border-dashed border-line-strong hover:border-brand-600 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-surface-card hover:bg-surface-raised transition text-center group"
                                            >
                                                <div className="h-12 w-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 group-hover:scale-110 transition">
                                                    <CameraIcon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-content-primary">
                                                        Fotografar ou Anexar Canhoto
                                                    </p>
                                                    <p className="text-xs text-content-secondary mt-0.5">
                                                        Toque para abrir a câmera ou escolher o arquivo
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-4 p-3 bg-surface-card rounded-xl border border-line">
                                                {previewRomaneio ? (
                                                    <img
                                                        src={previewRomaneio}
                                                        alt="Canhoto"
                                                        className="h-16 w-16 object-cover rounded-lg border border-line shrink-0"
                                                    />
                                                ) : (
                                                    <div className="h-16 w-16 bg-surface-sunken rounded-lg flex items-center justify-center text-content-muted shrink-0">
                                                        <DocumentTextIcon className="w-8 h-8" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-content-primary truncate">
                                                        {arquivoRomaneio.name}
                                                    </p>
                                                    <p className="text-[11px] text-content-muted">
                                                        {(arquivoRomaneio.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-status-success-fg font-medium mt-1">
                                                        <CheckCircleIcon className="w-3.5 h-3.5" /> Arquivo pronto
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={removerRomaneio}
                                                    className="p-2 text-content-muted hover:text-status-danger-fg transition"
                                                    title="Remover arquivo"
                                                >
                                                    <XMarkIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}

                                        <input
                                            ref={romaneioInputRef}
                                            type="file"
                                            accept="image/*,application/pdf"
                                            capture="environment"
                                            className="hidden"
                                            onChange={handleRomaneioChange}
                                        />
                                    </div>

                                    {/* Indicador de progresso durante envio */}
                                    {enviando && statusProgresso && (
                                        <div className="p-3 bg-status-info-bg text-status-info-fg rounded-xl text-xs flex items-center gap-2">
                                            <ArrowPathIcon className="w-4 h-4 animate-spin shrink-0" />
                                            <span>{statusProgresso}</span>
                                        </div>
                                    )}
                                </form>

                                {/* Rodapé Fixo */}
                                <div className="border-t border-line px-6 py-4 bg-surface-raised flex items-center justify-end gap-3">
                                    <Button
                                        variant="secondary"
                                        size="md"
                                        disabled={enviando}
                                        onClick={() => setModalAberto(false)}
                                    >
                                        Cancelar
                                    </Button>

                                    <Button
                                        variant={modoAvarias && qtdAvariasRegistradas > 0 ? 'danger' : 'success'}
                                        size="md"
                                        loading={enviando}
                                        disabled={!arquivoRomaneio || enviando}
                                        onClick={handleSubmit}
                                        icon={modoAvarias && qtdAvariasRegistradas > 0 ? ExclamationTriangleIcon : CheckCircleIcon}
                                    >
                                        {modoAvarias && qtdAvariasRegistradas > 0
                                            ? `Finalizar com ${qtdAvariasRegistradas} Avaria(s)`
                                            : 'Confirmar Recebimento Rápido'}
                                    </Button>
                                </div>
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </Dialog>
            </Transition>
        </>
    );
}
