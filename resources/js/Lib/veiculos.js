/**
 * Presets de Tipos de Veículos da Frota Shineray e Regras de Ocupação da Carga.
 */

export const PRESETS_VEICULOS = [
    {
        id: 'furgao',
        nome: 'Furgão / Van',
        capacidade: 4,
        icone: '🚐',
        descricao: 'Capacidade de 4 motos · Indicado para coletas rápidas ou entregas urbanas expressas',
    },
    {
        id: '3_4',
        nome: 'Caminhão 3/4',
        capacidade: 16,
        icone: '🚚',
        descricao: 'Capacidade padrão de 16 motos · Ideal para rotas regionais e distribuição regular',
    },
    {
        id: 'toco',
        nome: 'Toco Médio',
        capacidade: 22,
        icone: '🚛',
        descricao: 'Capacidade de 22 motos · Cargas intermediárias intermunicipais',
    },
    {
        id: 'truck',
        nome: 'Truck Grande',
        capacidade: 30,
        icone: '🚛',
        descricao: 'Capacidade de 30 motos · Rotas troncais de alto volume',
    },
    {
        id: 'carreta',
        nome: 'Carreta / Bi-trem',
        capacidade: 60,
        icone: '🚛',
        descricao: 'Capacidade de 60 motos · Transferências pesadas entre CDs e polos industriais',
    },
    {
        id: 'outro',
        nome: 'Outro / Personalizado',
        capacidade: null,
        icone: '⚙️',
        descricao: 'Capacidade customizada definida manualmente pelo operador de doca',
    },
];

/**
 * Calcula a ocupação da carga baseada na equivalência de volume:
 * - 1 moto = 1 unidade
 * - 2 basquetas de peças = 1 moto (ou seja, cada basqueta = 0.5 moto eq.)
 *
 * @param {number} motosCount Quantidade de motos selecionadas
 * @param {number} basquetasCount Quantidade de basquetas de peças selecionadas
 * @param {number} capacidade Capacidade total do caminhão em unidades de moto (padrão 16)
 * @returns {object} Métricas completas de ocupação
 */
export function calcularOcupacaoCarga(motosCount = 0, basquetasCount = 0, capacidade = 16) {
    const cap = Math.max(1, Number(capacidade) || 16);
    const volumeMotos = Number(motosCount) || 0;
    const qtdBasquetas = Number(basquetasCount) || 0;
    // Equivalência: cada 2 basquetas = 1 moto
    const volumeBasquetas = qtdBasquetas * 0.5;
    const totalEquivalente = volumeMotos + volumeBasquetas;

    const percentual = Math.round((totalEquivalente / cap) * 100);
    const sobrecarga = totalEquivalente > cap;
    const disponivel = Math.max(0, cap - totalEquivalente);
    const excesso = sobrecarga ? totalEquivalente - cap : 0;

    let status = 'verde'; // normal / seguro
    if (sobrecarga) {
        status = 'vermelho'; // sobrecarga
    } else if (percentual > 90) {
        status = 'ambar'; // atenção (> 90%)
    }

    const formatarNumero = (num) =>
        Number.isInteger(num) ? String(num) : num.toFixed(1).replace('.', ',');

    return {
        capacidade: cap,
        motos: volumeMotos,
        basquetas: qtdBasquetas,
        volumeMotos,
        volumeBasquetas,
        totalEquivalente,
        totalFormatado: formatarNumero(totalEquivalente),
        disponivelFormatado: formatarNumero(disponivel),
        excessoFormatado: formatarNumero(excesso),
        percentual,
        status,
        sobrecarga,
        disponivel,
        excesso,
    };
}
