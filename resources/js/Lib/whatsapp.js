/**
 * Utilitário para links e formatação de WhatsApp do motorista
 * Shineray Logística - Sequenciamento LIFO & Contato Direto
 */

export function limparTelefone(telefone) {
    if (!telefone) return '';
    return String(telefone).replace(/\D/g, '');
}

export function formatarTelefone(valor) {
    if (!valor) return '';
    const numeros = valor.replace(/\D/g, '').slice(0, 11);
    if (numeros.length <= 2) return numeros ? `(${numeros}` : '';
    if (numeros.length <= 6) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    if (numeros.length <= 10) return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
}

export function gerarLinkWhatsapp(telefone, { mensagem = '', ddiPadrao = '55' } = {}) {
    const limpo = limparTelefone(telefone);
    if (!limpo) return null;

    // Se o número tem até 11 dígitos (DDD + número), prefixa com 55 (Brasil)
    const numeroFinal = limpo.length <= 11 ? `${ddiPadrao}${limpo}` : limpo;
    const textoCodificado = encodeURIComponent(mensagem);

    return `https://wa.me/${numeroFinal}${textoCodificado ? `?text=${textoCodificado}` : ''}`;
}
