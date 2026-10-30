import { useMemo } from 'react';
import {
    BuildingOffice2Icon,
    CheckCircleIcon,
    MapPinIcon,
    TruckIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';

/**
 * Linha do Tempo Visual de Paradas da Rota (Timeline de Rastreio da Viagem).
 *
 * Renderiza o trajeto sequencial:
 * [CD Matriz (Origem)] ────► [1ª: Castanhal] ────► [2ª: Capanema 🚚] ────► [3ª: Bragança]
 *
 * - Lê `romaneio.ordem_paradas` ou calcula a partir dos destinos informados.
 * - Identifica e destaca a filial atual do usuário ou do pedido em questão.
 * - Destaca visualmente o status da carga (em doca/aberto, em trânsito com caminhão animado, ou concluída).
 */
export default function TimelineParadas({
    romaneio = {},
    destinos = [],
    filialAtual = null,
    origemPadrao = 'CD Matriz (Origem)',
    compacto = false,
    titulo = 'Trajeto da Rota & Paradas',
    className = '',
}) {
    // Normalização da lista de paradas
    const paradas = useMemo(() => {
        let lista = [];

        if (Array.isArray(romaneio?.ordem_paradas) && romaneio.ordem_paradas.length > 0) {
            lista = romaneio.ordem_paradas.map((item) => (typeof item === 'string' ? item : item.nome || String(item)));
        } else if (Array.isArray(destinos) && destinos.length > 0) {
            lista = destinos.map((d) => (typeof d === 'string' ? d : d.nome || 'DESTINO'));
        } else if (romaneio?.rota) {
            // Se rota contiver "Rota Castanhal / Bragança"
            const partes = romaneio.rota.replace(/rota\s+/i, '').split(/[/➔-]/).map((s) => s.trim()).filter(Boolean);
            if (partes.length > 0) {
                lista = partes;
            }
        }

        if (lista.length === 0 && filialAtual) {
            lista = [filialAtual];
        }

        // Remove duplicidades consecutivas e filtra vazios
        return lista.filter((p, i, arr) => p && arr.indexOf(p) === i);
    }, [romaneio, destinos, filialAtual]);

    // Origem da viagem
    const nomeOrigem = romaneio?.origem || origemPadrao;

    // Status da carga
    const statusCarga = romaneio?.status || 'aberto';
    const isConcluido = statusCarga === 'concluido';
    const isEmTransito = ['em_transito', 'em_transito_cd'].includes(statusCarga);

    // Normalização para comparar a filial atual
    const filialAtualNormalizada = filialAtual ? String(filialAtual).toUpperCase().trim() : '';

    const ehFilialDoUsuario = (nomeParada) => {
        if (!filialAtualNormalizada || !nomeParada) return false;
        const norm = String(nomeParada).toUpperCase().trim();
        return norm.includes(filialAtualNormalizada) || filialAtualNormalizada.includes(norm);
    };

    // Mapeamento de contagens se fornecido destinos com objetos
    const mapaDestinosInfo = useMemo(() => {
        const mapa = {};
        if (Array.isArray(destinos)) {
            destinos.forEach((d) => {
                if (typeof d === 'object' && d?.nome) {
                    mapa[d.nome.toUpperCase().trim()] = {
                        motos: d.motos?.length || 0,
                        pecas: d.pecas?.length || 0,
                    };
                }
            });
        }
        return mapa;
    }, [destinos]);

    // Se não há paradas registradas e nem origem, renderiza aviso amigável
    if (paradas.length === 0) {
        return (
            <div className={`rounded-xl border border-line bg-surface-card p-4 text-center ${className}`}>
                <p className="text-xs text-content-muted">
                    Trajeto não definido para esta carga.
                </p>
            </div>
        );
    }

    return (
        <div
            className={`rounded-xl border border-line bg-surface-card ${
                compacto ? 'p-3 sm:p-4' : 'p-5 sm:p-6'
            } shadow-xs ${className}`}
        >
            {/* Cabeçalho do Trajeto */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3 mb-4">
                <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                        <MapPinIcon className="h-4 w-4" />
                    </span>
                    <div>
                        <h4 className="text-sm font-extrabold text-content-primary">
                            {titulo}
                        </h4>
                        <p className="text-[11px] text-content-secondary">
                            {isConcluido
                                ? '✓ Rota Finalizada · Todas as entregas confirmadas'
                                : isEmTransito
                                ? '🚚 Carga em Trânsito · Caminhão em rota de entrega'
                                : '📦 Em Preparação · Carregamento em doca no CD'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {romaneio?.placa && (
                        <span className="rounded border border-line bg-surface-sunken px-2 py-0.5 font-mono text-[11px] font-bold uppercase text-content-primary">
                            {romaneio.placa}
                        </span>
                    )}
                    <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            isConcluido
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : isEmTransito
                                ? 'bg-blue-50 text-blue-800 border border-blue-300 animate-pulse dark:bg-blue-950/40 dark:text-blue-300'
                                : 'bg-surface-sunken text-content-secondary border border-line'
                        }`}
                    >
                        {isConcluido ? 'Viagem Concluída' : isEmTransito ? 'Em Trânsito' : 'Na Doca'}
                    </span>
                </div>
            </div>

            {/* Linha do Tempo / Visual Trajectory Scrollável Horizontalmente */}
            <div className="overflow-x-auto pb-2 pt-1 scrollbar-thin">
                <div className="inline-flex min-w-full items-center justify-start gap-0 sm:gap-1 px-1">
                    {/* --- NÓ DE ORIGEM (CD MATRIZ) --- */}
                    <div className="flex-shrink-0 flex flex-col items-center text-center">
                        <div
                            className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 transition-all shadow-xs ${
                                isConcluido || isEmTransito
                                    ? 'border-emerald-500 bg-emerald-500 text-white shadow-emerald-500/20'
                                    : 'border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-500/20'
                            }`}
                            title="Ponto de Saída da Carga"
                        >
                            {isConcluido || isEmTransito ? (
                                <CheckIcon className="h-6 w-6 stroke-[3]" />
                            ) : (
                                <BuildingOffice2Icon className="h-6 w-6" />
                            )}
                        </div>

                        <div className="mt-2 max-w-[130px]">
                            <span className="block text-[10px] font-black uppercase tracking-wider text-content-muted">
                                Ponto de Partida
                            </span>
                            <span className="block text-xs font-black text-content-primary truncate" title={nomeOrigem}>
                                {nomeOrigem}
                            </span>
                            <span className="block text-[10px] text-content-secondary">
                                {isConcluido || isEmTransito ? 'Saída Liberada' : 'Em Doca'}
                            </span>
                        </div>
                    </div>

                    {/* --- PARADAS SEQUENCIAIS --- */}
                    {paradas.map((parada, idx) => {
                        const ehLojaUsuario = ehFilialDoUsuario(parada);
                        const numeroParada = `${idx + 1}ª Parada`;
                        const info = mapaDestinosInfo[parada.toUpperCase().trim()];

                        // Se toda a carga foi concluída, a parada está entregue.
                        // Se está em trânsito, a 1ª parada ou todas estão ativas na rota
                        const paradaConcluida = isConcluido;
                        const emRotaAtual = isEmTransito && !isConcluido;

                        return (
                            <div key={`${parada}-${idx}`} className="inline-flex items-center">
                                {/* Conector / Trilha Animada com Flecha e Caminhão */}
                                <div className="flex-shrink-0 flex flex-col items-center px-1 sm:px-2 min-w-[70px] sm:min-w-[100px]">
                                    {/* Indicador do Caminhão na Estrada se em trânsito */}
                                    <div className="h-5 flex items-center justify-center">
                                        {emRotaAtual && idx === 0 && (
                                            <span
                                                className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-black text-white shadow-xs animate-bounce"
                                                title="Caminhão em Trânsito"
                                            >
                                                <span>🚚</span>
                                                <span className="hidden sm:inline">Na Rota</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Linha e Flecha */}
                                    <div className="relative flex w-full items-center">
                                        <div
                                            className={`h-1 w-full rounded-full transition-all ${
                                                paradaConcluida
                                                    ? 'bg-emerald-500'
                                                    : emRotaAtual
                                                    ? 'bg-gradient-to-r from-blue-500 to-brand-500 animate-pulse'
                                                    : 'bg-line-strong'
                                            }`}
                                        />
                                        <span
                                            className={`-ml-2 text-sm font-black transition-colors ${
                                                paradaConcluida
                                                    ? 'text-emerald-600'
                                                    : emRotaAtual
                                                    ? 'text-brand-600'
                                                    : 'text-content-muted'
                                            }`}
                                        >
                                            ➔
                                        </span>
                                    </div>

                                    <span className="mt-1 text-[9px] font-bold text-content-muted">
                                        Trajeto
                                    </span>
                                </div>

                                {/* Cartão da Parada */}
                                <div className="flex-shrink-0 flex flex-col items-center text-center">
                                    <div
                                        className={`relative flex h-11 w-11 items-center justify-center rounded-xl border-2 transition-all shadow-xs ${
                                            ehLojaUsuario
                                                ? 'border-brand-600 bg-brand-600 text-white shadow-brand-600/30 ring-4 ring-brand-500/30'
                                                : paradaConcluida
                                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                : emRotaAtual
                                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                                : 'border-line bg-surface-sunken text-content-muted'
                                        }`}
                                    >
                                        {paradaConcluida ? (
                                            <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
                                        ) : ehLojaUsuario ? (
                                            <MapPinIcon className="h-6 w-6 text-white animate-pulse" />
                                        ) : (
                                            <span className="text-xs font-black">
                                                {idx + 1}º
                                            </span>
                                        )}

                                        {/* Badge de "Sua Loja" sobreposta */}
                                        {ehLojaUsuario && (
                                            <span className="absolute -top-2.5 rounded-full bg-amber-400 px-1.5 py-0.2 text-[8px] font-black uppercase text-amber-950 shadow-xs ring-1 ring-white">
                                                Sua Loja
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-2 max-w-[130px]">
                                        <span className="block text-[10px] font-black uppercase tracking-wider text-content-muted">
                                            {numeroParada}
                                        </span>
                                        <span
                                            className={`block text-xs font-black truncate ${
                                                ehLojaUsuario
                                                    ? 'text-brand-600 dark:text-brand-400 underline underline-offset-2'
                                                    : 'text-content-primary'
                                            }`}
                                            title={parada}
                                        >
                                            {parada}
                                        </span>

                                        {info && (info.motos > 0 || info.pecas > 0) && (
                                            <span className="mt-0.5 inline-block rounded bg-surface-sunken px-1.5 py-0.2 text-[9px] font-bold text-content-secondary">
                                                {info.motos > 0 && `${info.motos} moto(s)`}
                                                {info.motos > 0 && info.pecas > 0 && ' · '}
                                                {info.pecas > 0 && `${info.pecas} cx(s)`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Rodapé explicativo do fluxo LIFO e status do motorista */}
            {!compacto && (
                <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2 text-xs text-content-secondary">
                    <div className="flex items-center gap-1.5">
                        <span className="font-bold text-content-primary">Sequência de Descarregamento:</span>
                        <span>As entregas seguem a ordem da esquerda para a direita (LIFO no caminhão).</span>
                    </div>
                    {romaneio?.motorista && (
                        <div className="flex items-center gap-1.5 text-content-muted">
                            <TruckIcon className="h-4 w-4" />
                            <span>Motorista: <strong className="text-content-primary uppercase">{romaneio.motorista}</strong></span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
