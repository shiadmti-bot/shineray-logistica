import { useState } from 'react';
import { router } from '@inertiajs/react';
import Swal from 'sweetalert2';
import imageCompression from 'browser-image-compression';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { avisar, avisarErro, carregando, dialogo, escaparHtml } from '@/Lib/alertas';

const COMPRESSAO = { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true };

const comprimirSeImagem = (arquivo) =>
    arquivo && arquivo.type.startsWith('image/') ? imageCompression(arquivo, COMPRESSAO) : Promise.resolve(arquivo);

/** HTML do formulário de conferência. Texto do banco sempre escapado. */
function formularioConferencia(motos) {
    const linhas = motos
        .map((m) => {
            const id = Number(m.id);
            const cabecalho = `
                <div class="flex justify-between items-center">
                    <span class="font-bold text-content-primary">🏍️ ${escaparHtml(m.modelo)}</span>
                    <span class="font-mono text-xs bg-surface-sunken px-2 py-1 rounded text-content-secondary">${escaparHtml(m.chassi)}</span>
                </div>`;

            const campos = m.estorno_pendente
                ? '<span class="text-xs text-status-danger-fg bg-status-danger-bg/50 px-2 py-1 rounded font-bold text-center">🚫 Em análise de corte/estorno</span>'
                : `
                <div class="grid grid-cols-1 gap-2">
                    <input type="text" id="avaria-texto-${id}" class="swal2-input w-full text-xs h-8 m-0 focus:ring-status-danger-solid" placeholder="Houve avaria? Descreva aqui...">
                    <label class="flex items-center justify-center w-full text-xs text-content-secondary border border-dashed border-line p-2 rounded cursor-pointer hover:bg-surface-sunken transition">
                        <span id="label-foto-${id}" class="flex items-center gap-2">📸 Anexar Foto da Avaria</span>
                        <input type="file" id="avaria-foto-${id}" class="hidden" accept="image/*">
                    </label>
                </div>`;

            return `<div class="mb-2 bg-surface-card p-3 rounded shadow-sm border border-line flex flex-col gap-2">${cabecalho}${campos}</div>`;
        })
        .join('');

    return `
        <div class="text-left text-sm">
            <div class="bg-status-info-bg/50 p-4 rounded-lg border border-status-info-solid/20 mb-4 text-status-info-fg">
                <strong>Instruções:</strong> Verifique fisicamente as motos. Se houver avaria, tire foto. Por fim, anexe o canhoto assinado.
            </div>
            <div class="bg-surface-sunken rounded-lg border border-line mb-4 max-h-[250px] overflow-y-auto p-2 scrollbar-slim">${linhas}</div>
            <div class="p-4 bg-status-success-bg rounded-lg border border-status-success-solid/20">
                <label class="block font-bold text-status-success-fg mb-2 text-xs uppercase tracking-wide">📄 Foto do Romaneio/Canhoto Assinado *</label>
                <input type="file" id="upload-comprovante" class="block w-full text-xs text-content-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-status-success-bg file:text-status-success-fg hover:file:brightness-95 cursor-pointer" accept="image/*,application/pdf">
            </div>
        </div>`;
}

/**
 * Botão flutuante de recebimento e o fluxo inteiro da conferência: avaria por
 * moto, canhoto assinado, compressão das fotos no navegador e envio.
 */
export default function ConferenciaEntrega({ pedido, papel }) {
    const { isEmbarqueParcial, motosEmTransito, totalItensSolicitados, totalNaoDespachado } = papel;
    const [enviando, setEnviando] = useState(false);

    const enviar = async ({ arquivo, avarias, fotos }) => {
        setEnviando(true);
        carregando('Comprimindo Arquivos...', 'Ajustando imagens para envio rápido...');

        try {
            const canhoto = await comprimirSeImagem(arquivo);

            const fotosComprimidas = {};
            for (const [motoId, foto] of Object.entries(fotos)) {
                fotosComprimidas[motoId] = await comprimirSeImagem(foto);
            }

            carregando('Enviando...', 'Salvando entrega no sistema...');

            router.post(
                route('pedidos.finalizar', pedido.id),
                { arquivo_romaneio: canhoto, avarias, fotos_avarias: fotosComprimidas },
                {
                    forceFormData: true,
                    onSuccess: () => avisar('Sucesso!', 'Recebimento confirmado.', 'success'),
                    // O motivo do servidor (trava de recebimento, falha no Drive)
                    // em vez de um genérico que esconde o que a loja precisa fazer.
                    onError: (erros) => avisarErro(erros, 'Erro', 'Falha ao enviar. Tente novamente.'),
                    onFinish: () => setEnviando(false),
                }
            );
        } catch (erro) {
            console.error('Erro ao comprimir imagem:', erro);
            setEnviando(false);
            avisar('Erro', 'Falha ao processar as fotos. Tente enviar uma imagem menor.', 'error');
        }
    };

    const abrirConferencia = async () => {
        if (totalNaoDespachado > 0) {
            dialogo().fire({
                title: 'Aguardando Despacho Integral',
                icon: 'info',
                confirmButtonText: 'Entendido',
                html: `
                    <div class="text-left text-sm space-y-3">
                        <div class="bg-status-warning-bg p-3 rounded-lg border border-status-warning-solid/30 text-status-warning-fg font-bold">
                            ⚠️ Este pedido possui ${Number(totalNaoDespachado)} unidade(s) pendente(s) no CD.
                        </div>
                        <p class="text-content-secondary leading-relaxed">
                            Por determinação da diretoria comercial e logística, a conferência com envio do comprovante só pode ser realizada quando <b>100% da carga</b> for despachada e entregue.
                        </p>
                        <p class="text-xs text-content-muted">
                            Aguarde a equipe do CD enviar as unidades restantes na próxima rota ou solicite o encerramento do saldo em falta se não houver envio.
                        </p>
                    </div>`,
            });
            return;
        }

        const motos = pedido.motos || [];

        const { isConfirmed, value } = await dialogo('sucesso').fire({
            title: 'Conferência de Entrega 📋',
            width: '650px',
            html: formularioConferencia(motos),
            showCancelButton: true,
            confirmButtonText: 'Confirmar Recebimento',
            didOpen: () => {
                // Marca visualmente a moto cuja foto de avaria foi escolhida.
                motos.forEach((m) => {
                    document.getElementById(`avaria-foto-${m.id}`)?.addEventListener('change', () => {
                        const rotulo = document.getElementById(`label-foto-${m.id}`);
                        if (!rotulo) return;
                        rotulo.textContent = '✅ Foto Selecionada';
                        rotulo.classList.add('text-status-success-fg', 'font-bold');
                    });
                });
            },
            preConfirm: () => {
                const arquivo = document.getElementById('upload-comprovante').files[0];

                if (!arquivo) {
                    Swal.showValidationMessage('O comprovante assinado é obrigatório!');
                    return false;
                }

                const avarias = {};
                const fotos = {};

                motos.forEach((m) => {
                    if (m.estorno_pendente) return;

                    const texto = document.getElementById(`avaria-texto-${m.id}`)?.value;
                    const foto = document.getElementById(`avaria-foto-${m.id}`)?.files[0];

                    if (texto) {
                        avarias[m.id] = texto;
                        if (foto) fotos[m.id] = foto;
                    }
                });

                return { arquivo, avarias, fotos };
            },
        });

        if (isConfirmed) enviar(value);
    };

    return (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-50 pointer-events-none">
            <button
                type="button"
                onClick={abrirConferencia}
                disabled={enviando}
                className={`pointer-events-auto flex items-center gap-3 rounded-full px-8 py-4 font-bold text-white shadow-overlay ring-4 transition disabled:opacity-70 ${
                    isEmbarqueParcial
                        ? 'bg-status-warning-solid ring-status-warning-solid/30 hover:brightness-95'
                        : 'bg-brand-600 ring-brand-600/20 hover:bg-brand-700'
                }`}
            >
                {enviando ? (
                    <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full"></span>
                ) : (
                    <DocumentTextIcon className="w-6 h-6" />
                )}{' '}
                <span className="uppercase tracking-wide text-sm">
                    {isEmbarqueParcial
                        ? `Recebimento Parcial (${motosEmTransito}/${totalItensSolicitados} em trânsito)`
                        : 'Conferir e Finalizar Entrega'}
                </span>
            </button>
        </div>
    );
}
