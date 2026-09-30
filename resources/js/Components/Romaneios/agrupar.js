/** Agrupa uma lista por um rótulo (destino, origem, loja), na ordem de chegada. */
export function agruparPor(lista, rotuloDe) {
    return lista.reduce((grupos, item) => {
        const rotulo = rotuloDe(item);
        (grupos[rotulo] ??= []).push(item);
        return grupos;
    }, {});
}

/**
 * Filtra grupos pela busca: o grupo inteiro entra se o rótulo casa com o
 * termo; senão, entram só os itens que casam.
 */
export function filtrarGrupos(grupos, termo, itemCasa) {
    if (!termo) return grupos;

    const filtrado = {};

    Object.entries(grupos).forEach(([rotulo, itens]) => {
        if (rotulo.toLowerCase().includes(termo)) {
            filtrado[rotulo] = itens;
            return;
        }

        const casam = itens.filter((item) => itemCasa(item, termo));

        if (casam.length > 0) {
            filtrado[rotulo] = casam;
        }
    });

    return filtrado;
}

export const idsDasMotos = (pedidos) => pedidos.flatMap((p) => (p.motos || []).map((m) => m.id));

export const contarMotos = (pedidos) => pedidos.reduce((acc, p) => acc + (p.motos?.length || 0), 0);

/** Número de pedido, carga ou basqueta como aparece nos documentos: 000123. */
export const comZeros = (id) => String(id).padStart(6, '0');

export const contem = (texto, termo) => String(texto ?? '').toLowerCase().includes(termo);
