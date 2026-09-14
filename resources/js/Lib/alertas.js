import Swal from 'sweetalert2';

/**
 * Diálogos do sistema sobre o SweetAlert2 (v3.5).
 *
 * As telas chamavam `Swal.fire` direto, cada uma com a própria cor de botão
 * (#d33, #ef4444, #2563eb, #16a34a...) e o próprio "Cancelar". Aqui os botões
 * usam as classes dos tokens (`buttonsStyling: false`), então seguem o tema.
 *
 * Tons: 'primario' (ação normal), 'perigo' (destrutiva), 'sucesso'.
 */
const TONS = {
    primario: 'bg-brand-600 hover:bg-brand-700',
    perigo: 'bg-status-danger-solid hover:brightness-95',
    sucesso: 'bg-status-success-solid hover:brightness-95',
};

/** Texto vindo do banco que vai dentro de `html` de um diálogo. */
export function escaparHtml(texto) {
    return String(texto ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
}

/**
 * O mixin com o visual do sistema, para diálogos que fogem dos atalhos abaixo
 * (formulário próprio, `preConfirm`). Todo texto do banco em `html` passa por
 * `escaparHtml`.
 */
export const dialogo = (tom = 'primario') =>
    Swal.mixin({
        buttonsStyling: false,
        customClass: {
            confirmButton: `mx-1 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm transition ${TONS[tom] ?? TONS.primario}`,
            cancelButton:
                'mx-1 inline-flex items-center justify-center rounded-lg bg-surface-card px-4 py-2 text-sm font-bold text-content-primary ring-1 ring-inset ring-line-strong transition hover:bg-surface-sunken',
        },
        confirmButtonText: 'OK',
        cancelButtonText: 'Cancelar',
    });

/** Aviso simples, com um botão. */
export function avisar(titulo, texto, icone = 'info') {
    return dialogo().fire({ title: titulo, text: texto, icon: icone });
}

/** A primeira mensagem de erro devolvida pelo servidor (o `onError` do Inertia). */
export function avisarErro(erros, titulo = 'Erro', padrao = 'Não foi possível concluir a operação.') {
    return dialogo('perigo').fire({
        title: titulo,
        text: Object.values(erros ?? {})[0] || padrao,
        icon: 'error',
    });
}

/** Pergunta de sim/não. Resolve `true` se confirmou. */
export async function confirmar({ titulo, texto, html, icone = 'question', textoConfirmar = 'Confirmar', tom = 'primario' }) {
    const { isConfirmed } = await dialogo(tom).fire({
        title: titulo,
        text: texto,
        html,
        icon: icone,
        showCancelButton: true,
        confirmButtonText: textoConfirmar,
    });

    return isConfirmed;
}

/**
 * Pede um texto obrigatório (motivo, justificativa). Resolve o texto sem
 * espaços nas pontas, ou `null` se cancelou.
 */
export async function pedirTexto({
    titulo,
    texto,
    html,
    icone,
    placeholder,
    multilinha = false,
    minimo = 1,
    mensagemObrigatorio = 'Preencha este campo.',
    textoConfirmar = 'Enviar',
    tom = 'primario',
}) {
    const { isConfirmed, value } = await dialogo(tom).fire({
        title: titulo,
        text: texto,
        html,
        icon: icone,
        input: multilinha ? 'textarea' : 'text',
        inputPlaceholder: placeholder,
        showCancelButton: true,
        confirmButtonText: textoConfirmar,
        inputValidator: (valor) => (!valor || valor.trim().length < minimo) && mensagemObrigatorio,
    });

    return isConfirmed ? value.trim() : null;
}

/** Diálogo de carregamento que não fecha sozinho; feche com `Swal.close()` ou outro diálogo. */
export function carregando(titulo, texto) {
    return Swal.fire({
        title: titulo,
        html: texto,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
    });
}
