import { useState } from 'react';
import { router } from '@inertiajs/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { avisar, avisarErro, pedirTexto } from '@/Lib/alertas';

/**
 * V2.6: cotas aguardando chassi. O CD bipa o chassi físico de cada unidade
 * ou encerra o saldo que não será enviado.
 */
export default function PainelAtribuicaoChassi({ pedido, cotasPendentes, saldoPendente, podeAtribuir }) {
    const [bipando, setBipando] = useState({}); // { [cotaId]: chassiDigitado }

    const atribuir = (cota) => {
        const chassi = (bipando[cota.id] || '').trim().toUpperCase();

        if (chassi.length < 11) {
            avisar('Chassi inválido', 'Informe ao menos 11 caracteres.', 'warning');
            return;
        }

        router.post(
            route('pedidos.atribuir_chassi', pedido.id),
            { chassi, pedido_item_id: cota.id },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setBipando((b) => ({ ...b, [cota.id]: '' }));
                    new Audio('/plim.mp3').play().catch(() => {});
                },
                onError: (erros) => avisarErro(erros, 'Não foi possível atribuir', 'Erro desconhecido.'),
            }
        );
    };

    const encerrarSaldo = async (cota) => {
        const justificativa = await pedirTexto({
            titulo: 'Encerrar saldo em falta',
            texto: `Serão baixadas ${cota.qtd_pendente}x ${cota.modelo} ${cota.cor} que não serão enviadas.`,
            placeholder: 'Justificativa (ex: sem estoque no CD, modelo descontinuado...)',
            multilinha: true,
            minimo: 5,
            mensagemObrigatorio: 'Descreva o motivo (mínimo 5 caracteres).',
            textoConfirmar: 'Encerrar saldo',
            tom: 'perigo',
        });

        if (!justificativa) return;

        router.post(
            route('pedidos.encerrar_saldo', cota.id),
            { justificativa },
            {
                preserveScroll: true,
                onError: (erros) => avisarErro(erros, 'Erro', 'Não foi possível encerrar.'),
            }
        );
    };

    return (
        <div className="bg-surface-card rounded-card shadow-sm border-2 border-status-warning-solid/40 overflow-hidden">
            <div className="px-6 py-4 bg-status-warning-bg border-b border-status-warning-solid/20 flex flex-wrap justify-between items-center gap-2">
                <h3 className="font-black text-status-warning-fg text-sm uppercase tracking-wide flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5" />
                    Aguardando definição de chassi
                </h3>
                <span className="bg-status-warning-solid text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                    {saldoPendente} pendente(s)
                </span>
            </div>

            <div className="p-4 space-y-3">
                {!podeAtribuir && (
                    <p className="text-xs text-content-secondary bg-status-warning-bg/50 border border-status-warning-solid/20 rounded-lg p-3">
                        A equipe do CD ainda não informou quais motos serão enviadas.
                        {pedido.status === 'em_analise' && ' O pedido precisa ser aprovado pela diretoria antes disso.'}
                    </p>
                )}

                {cotasPendentes.map((cota) => (
                    <div key={cota.id} className="border border-line rounded-xl p-4 bg-surface-sunken">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                            <div>
                                <h4 className="font-extrabold text-content-primary">
                                    {cota.modelo} <span className="text-content-secondary font-bold">{cota.cor}</span>
                                </h4>
                                <p className="text-[11px] text-content-secondary uppercase font-bold tracking-wide">
                                    {cota.motivo} · Destino: {cota.local}
                                </p>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-black text-status-warning-fg leading-none">
                                    {cota.qtd_atribuida}/{cota.quantidade}
                                </span>
                                <p className="text-[10px] text-content-secondary uppercase font-bold">atribuídas</p>
                            </div>
                        </div>

                        {podeAtribuir && (
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    aria-label={`Chassi para ${cota.modelo} ${cota.cor}`}
                                    placeholder="Bipe ou digite o chassi..."
                                    value={bipando[cota.id] || ''}
                                    onChange={(e) =>
                                        setBipando((b) => ({
                                            ...b,
                                            [cota.id]: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                                        }))
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            atribuir(cota);
                                        }
                                    }}
                                    maxLength={17}
                                    className="flex-1 rounded-lg border-line bg-surface-card font-mono tracking-widest text-sm py-3 px-4 text-content-primary focus:border-brand-500 focus:ring-brand-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => atribuir(cota)}
                                    className="whitespace-nowrap rounded-lg bg-brand-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
                                >
                                    Atribuir
                                </button>
                                <button
                                    type="button"
                                    onClick={() => encerrarSaldo(cota)}
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
                        Dica: com um leitor de código de barras, basta clicar no campo e bipar — o Enter do leitor já
                        confirma a atribuição.
                    </p>
                )}
            </div>
        </div>
    );
}
