import { IdentificationIcon, MapPinIcon, SparklesIcon, TruckIcon, UserIcon } from '@heroicons/react/24/outline';
import { Card } from '@/Components/UI';
import { comZeros } from './agrupar';

function ErroCampo({ mensagem }) {
    return mensagem ? <p className="mt-1 text-xs font-semibold text-status-danger-fg">{mensagem}</p> : null;
}

/** Nova carga (rota, motorista, placa) ou itens adicionados a uma carga já aberta. */
export default function ConfiguracaoViagem({ data, setData, errors, rotas, cargasEmAberto }) {
    const cargaSelecionada = data.romaneio_id
        ? cargasEmAberto.find((c) => String(c.id) === String(data.romaneio_id))
        : null;

    const alternador = (
        <div className="inline-flex rounded-lg bg-surface-sunken p-1 ring-1 ring-line">
            <button
                type="button"
                onClick={() => setData('romaneio_id', '')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                    !data.romaneio_id ? 'bg-surface-card text-content-primary shadow-sm' : 'text-content-secondary hover:text-content-primary'
                }`}
            >
                <SparklesIcon className="h-3.5 w-3.5 text-brand-600" />
                Nova Carga
            </button>
            <button
                type="button"
                disabled={cargasEmAberto.length === 0}
                onClick={() => {
                    if (cargasEmAberto.length > 0 && !data.romaneio_id) {
                        setData('romaneio_id', String(cargasEmAberto[0].id));
                    }
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${
                    data.romaneio_id ? 'bg-brand-600 text-white shadow-sm' : 'text-content-secondary hover:text-content-primary'
                } ${cargasEmAberto.length === 0 ? 'cursor-not-allowed opacity-40' : ''}`}
            >
                <span>➕ Adicionar à Carga Aberta</span>
                {cargasEmAberto.length > 0 && (
                    <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                            data.romaneio_id ? 'bg-brand-700 text-white' : 'bg-surface-card text-content-secondary'
                        }`}
                    >
                        {cargasEmAberto.length}
                    </span>
                )}
            </button>
        </div>
    );

    return (
        <Card
            title="Configuração da Viagem"
            subtitle="Defina o destino, veículo e motorista ou vincule os itens a uma carga aberta existente."
            actions={alternador}
        >
            {!data.romaneio_id ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                        <label htmlFor="rota_nome" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-content-secondary">
                            <MapPinIcon className="h-4 w-4 text-brand-600" />
                            Rota / Região Destino
                        </label>
                        <input
                            id="rota_nome"
                            type="text"
                            list="rotas-sugeridas"
                            placeholder="Ex: Rota Castanhal / Bragança"
                            className="w-full rounded-lg border-line-strong bg-surface-card text-sm text-content-primary placeholder-content-muted focus:border-brand-500 focus:ring-brand-500"
                            value={data.rota_nome}
                            onChange={(e) => setData('rota_nome', e.target.value)}
                        />
                        <datalist id="rotas-sugeridas">
                            {rotas.map((r) => (
                                <option key={r.id} value={r.name}>
                                    {r.code} - {r.name}
                                </option>
                            ))}
                        </datalist>
                        <ErroCampo mensagem={errors.rota_nome} />
                        {rotas.length > 0 && !data.rota_nome && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className="text-[10px] font-semibold text-content-muted">Sugestões:</span>
                                {rotas.slice(0, 4).map((r) => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => setData('rota_nome', r.name)}
                                        className="rounded bg-surface-sunken px-2 py-0.5 text-[10px] font-bold text-content-secondary transition hover:bg-brand-50 hover:text-brand-700"
                                    >
                                        {r.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="motorista" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-content-secondary">
                            <UserIcon className="h-4 w-4 text-brand-600" />
                            Motorista Responsável
                        </label>
                        <input
                            id="motorista"
                            type="text"
                            placeholder="Nome Completo do Motorista"
                            className="w-full rounded-lg border-line-strong bg-surface-card text-sm uppercase text-content-primary placeholder-content-muted focus:border-brand-500 focus:ring-brand-500"
                            value={data.motorista}
                            onChange={(e) => setData('motorista', e.target.value)}
                        />
                        <ErroCampo mensagem={errors.motorista} />
                    </div>

                    <div>
                        <label htmlFor="placa" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-content-secondary">
                            <IdentificationIcon className="h-4 w-4 text-brand-600" />
                            Placa do Caminhão
                        </label>
                        <input
                            id="placa"
                            type="text"
                            placeholder="ABC-1234"
                            maxLength={8}
                            className="w-full rounded-lg border-line-strong bg-surface-card text-center font-mono text-sm font-bold uppercase tracking-widest text-content-primary placeholder-content-muted focus:border-brand-500 focus:ring-brand-500"
                            value={data.placa}
                            onChange={(e) => setData('placa', e.target.value.toUpperCase())}
                        />
                        <ErroCampo mensagem={errors.placa} />
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div>
                        <label htmlFor="romaneio_id" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-content-secondary">
                            Selecione a Carga em Aberto:
                        </label>
                        <select
                            id="romaneio_id"
                            value={data.romaneio_id}
                            onChange={(e) => setData('romaneio_id', e.target.value)}
                            className="w-full rounded-lg border-line-strong bg-surface-card text-sm font-bold text-content-primary focus:border-brand-500 focus:ring-brand-500"
                        >
                            <option value="">-- Selecione a Carga Aberta --</option>
                            {cargasEmAberto.map((r) => (
                                <option key={r.id} value={r.id}>
                                    Carga #{comZeros(r.id)} — {r.rota || 'Rota não informada'} ({r.motorista}) · {r.motos_count || 0} moto(s) ·{' '}
                                    {r.itens_pecas_count || 0} peça(s)
                                </option>
                            ))}
                        </select>
                        <ErroCampo mensagem={errors.romaneio_id} />
                    </div>

                    {cargaSelecionada && (
                        <div className="rounded-card bg-surface-sunken p-4 ring-1 ring-line">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="rounded-lg bg-brand-50 p-2 text-brand-700">
                                        <TruckIcon className="h-5 w-5" />
                                    </span>
                                    <div>
                                        <h4 className="text-sm font-bold text-content-primary">Carga #{comZeros(cargaSelecionada.id)}</h4>
                                        <p className="text-xs text-content-secondary">
                                            Rota: <strong>{cargaSelecionada.rota || 'Livre'}</strong> · Motorista:{' '}
                                            <strong>{cargaSelecionada.motorista}</strong> · Placa:{' '}
                                            <strong className="font-mono">{cargaSelecionada.placa}</strong>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-surface-card px-2.5 py-1 text-xs font-bold text-content-secondary ring-1 ring-line">
                                        🏍️ {cargaSelecionada.motos_count || 0} motos
                                    </span>
                                    <span className="rounded-full bg-surface-card px-2.5 py-1 text-xs font-bold text-content-secondary ring-1 ring-line">
                                        📦 {cargaSelecionada.itens_pecas_count || 0} peças
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}
