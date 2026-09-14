import { useState } from 'react';
import { idsDasMotos } from './agrupar';

const alternarUm = (setIds, id) =>
    setIds((atuais) => (atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id]));

/** Se todos os ids já estão marcados, desmarca todos; senão, marca os que faltam. */
const alternarTodos = (setIds, ids) =>
    setIds((atuais) => {
        const todos = ids.length > 0 && ids.every((id) => atuais.includes(id));

        return todos ? atuais.filter((id) => !ids.includes(id)) : [...atuais, ...ids.filter((id) => !atuais.includes(id))];
    });

/**
 * O que vai subir no caminhão: motos (por chassi) e basquetas de peças.
 *
 * As atualizações são funcionais. A versão anterior lia a seleção do closure
 * do render, e dois cliques rápidos podiam partir do mesmo estado antigo.
 */
export default function useSelecaoCarga() {
    const [motoIds, setMotoIds] = useState([]);
    const [basquetaIds, setBasquetaIds] = useState([]);

    return {
        motoIds,
        basquetaIds,
        total: motoIds.length + basquetaIds.length,

        alternarMoto: (id) => alternarUm(setMotoIds, id),
        alternarBasqueta: (id) => alternarUm(setBasquetaIds, id),

        /** Um pedido inteiro ou um grupo de pedidos. */
        alternarMotos: (ids) => alternarTodos(setMotoIds, ids),
        alternarBasquetas: (ids) => alternarTodos(setBasquetaIds, ids),

        /** Carga mista: motos e basquetas do mesmo destino, marcadas ou desmarcadas juntas. */
        alternarDestino: (pedidos, basquetas) => {
            const motos = idsDasMotos(pedidos);
            const caixas = basquetas.map((b) => b.id);

            const motosMarcadas = motos.length > 0 && motos.every((id) => motoIds.includes(id));
            const caixasMarcadas = caixas.length > 0 && caixas.every((id) => basquetaIds.includes(id));
            const tudoMarcado = (motos.length === 0 || motosMarcadas) && (caixas.length === 0 || caixasMarcadas);

            if (tudoMarcado) {
                setMotoIds((atuais) => atuais.filter((id) => !motos.includes(id)));
                setBasquetaIds((atuais) => atuais.filter((id) => !caixas.includes(id)));
            } else {
                setMotoIds((atuais) => [...atuais, ...motos.filter((id) => !atuais.includes(id))]);
                setBasquetaIds((atuais) => [...atuais, ...caixas.filter((id) => !atuais.includes(id))]);
            }
        },

        limpar: () => {
            setMotoIds([]);
            setBasquetaIds([]);
        },
    };
}

/** Lista de ids abertos/fechados (pedidos ou basquetas expandidos). */
export function useIdsAlternaveis() {
    const [ids, setIds] = useState([]);

    return [ids, (id) => alternarUm(setIds, id)];
}
