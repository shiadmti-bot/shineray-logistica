import { useEffect } from 'react';
import {
    IdentificationIcon,
    MapPinIcon,
    PhoneIcon,
    SparklesIcon,
    TruckIcon,
    UserIcon,
} from '@heroicons/react/24/outline';
import { Card } from '@/Components/UI';
import { comZeros } from './agrupar';
import { formatarTelefone } from '@/Lib/whatsapp';
import { PRESETS_VEICULOS } from '@/Lib/veiculos';

function ErroCampo({ mensagem }) {
    return mensagem ? <p className="mt-1 text-xs font-semibold text-status-danger-fg">{mensagem}</p> : null;
}

/** Nova carga (rota, motorista, placa, veículo) ou itens adicionados a uma carga já aberta. */
export default function ConfiguracaoViagem({ data, setData, errors, rotas, cargasEmAberto }) {
    const cargaSelecionada = data.romaneio_id
        ? cargasEmAberto.find((c) => String(c.id) === String(data.romaneio_id))
        : null;

    // Sincroniza capacidade e tipo de veículo se uma carga aberta for selecionada
    useEffect(() => {
        if (cargaSelecionada) {
            setData((prev) => ({
                ...prev,
                tipo_veiculo: cargaSelecionada.tipo_veiculo || prev.tipo_veiculo || '3_4',
                capacidade_veiculo: cargaSelecionada.capacidade_veiculo || prev.capacidade_veiculo || 16,
            }));
        }
    }, [data.romaneio_id, cargaSelecionada, setData]);

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

    const handleSelectPreset = (preset) => {
        setData((prev) => ({
            ...prev,
            tipo_veiculo: preset.id,
            capacidade_veiculo: preset.capacidade !== null ? preset.capacidade : (prev.capacidade_veiculo || 16),
        }));
    };

    const presetAtual = PRESETS_VEICULOS.find((p) => p.id === (data.tipo_veiculo || '3_4')) || PRESETS_VEICULOS[1];

    return (
        <Card
            title="Configuração da Viagem"
            subtitle="Defina o destino, veículo, capacidade da frota e motorista ou vincule os itens a uma carga aberta existente."
            actions={alternador}
        >
            {!data.romaneio_id ? (
                <div className="space-y-5">
                    {/* Linha 1: Dados da Rota e Motorista */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                                    {rotas.slice(0, 3).map((r) => (
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
                            <label htmlFor="telefone_motorista" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-content-secondary">
                                <PhoneIcon className="h-4 w-4 text-emerald-600" />
                                WhatsApp / Celular
                            </label>
                            <input
                                id="telefone_motorista"
                                type="tel"
                                placeholder="(91) 98765-4321"
                                maxLength={15}
                                className="w-full rounded-lg border-line-strong bg-surface-card text-sm text-content-primary placeholder-content-muted focus:border-brand-500 focus:ring-brand-500"
                                value={data.telefone_motorista || ''}
                                onChange={(e) => setData('telefone_motorista', formatarTelefone(e.target.value))}
                            />
                            <ErroCampo mensagem={errors.telefone_motorista} />
                            <span className="mt-1 block text-[10px] text-content-muted">
                                Para contato direto das lojas na rota
                            </span>
                        </div>

                        <div>
                            <label htmlFor="placa" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-content-secondary">
                                <IdentificationIcon className="h-4 w-4 text-brand-600" />
                                Placa do Veículo
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

                    {/* Linha 2: Seletor de Tipo de Veículo e Presets de Capacidade */}
                    <div className="rounded-xl border border-line bg-surface-sunken p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-content-primary">
                                    <TruckIcon className="h-4 w-4 text-brand-600" />
                                    Tipo de Veículo & Capacidade da Frota
                                </label>
                                <p className="text-[11px] text-content-secondary">
                                    Selecione o porte do caminhão para cálculo dinâmico da ocupação volumétrica.
                                </p>
                            </div>

                            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-black text-brand-800 ring-1 ring-brand-600/20">
                                <span>{presetAtual?.icone || '🚚'}</span>
                                <span>Capacidade: {data.capacidade_veiculo || 16} motos</span>
                            </span>
                        </div>

                        {/* Grid de Presets */}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                            {PRESETS_VEICULOS.map((p) => {
                                const selecionado = (data.tipo_veiculo || '3_4') === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handleSelectPreset(p)}
                                        className={`flex flex-col items-center justify-center rounded-lg p-2.5 text-center transition ring-1 ${
                                            selecionado
                                                ? 'bg-brand-600 text-white shadow-sm ring-brand-600'
                                                : 'bg-surface-card text-content-primary ring-line hover:bg-surface-sunken'
                                        }`}
                                    >
                                        <span className="text-xl leading-none">{p.icone}</span>
                                        <span className="mt-1 text-xs font-black leading-tight">{p.nome}</span>
                                        <span
                                            className={`text-[10px] mt-0.5 ${
                                                selecionado ? 'text-white/80 font-bold' : 'text-content-muted'
                                            }`}
                                        >
                                            {p.capacidade !== null ? `${p.capacidade} motos` : 'Manual'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Campo de capacidade manual caso selecione "outro" */}
                        {data.tipo_veiculo === 'outro' && (
                            <div className="mt-3 flex items-center gap-3 pt-3 border-t border-line">
                                <label htmlFor="capacidade_veiculo" className="text-xs font-bold text-content-primary whitespace-nowrap">
                                    Capacidade Personalizada (unidades de moto):
                                </label>
                                <input
                                    id="capacidade_veiculo"
                                    type="number"
                                    min="1"
                                    max="200"
                                    className="w-28 rounded-lg border-line-strong bg-surface-card text-sm font-bold text-content-primary focus:border-brand-500 focus:ring-brand-500"
                                    value={data.capacidade_veiculo || ''}
                                    onChange={(e) => setData('capacidade_veiculo', Math.max(1, parseInt(e.target.value, 10) || 1))}
                                />
                                <span className="text-[11px] text-content-muted">
                                    Informe a quantidade máxima de motos que o veículo comporta.
                                </span>
                            </div>
                        )}
                        <ErroCampo mensagem={errors.tipo_veiculo || errors.capacidade_veiculo} />
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
                                    {r.itens_pecas_count || 0} peça(s) · Cap: {r.capacidade_veiculo || 16} motos
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
                                            {cargaSelecionada.telefone_motorista && (
                                                <> · WhatsApp: <strong className="text-emerald-700 font-bold">{cargaSelecionada.telefone_motorista}</strong></>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-surface-card px-2.5 py-1 text-xs font-bold text-content-secondary ring-1 ring-line">
                                        🚛 Veículo: {cargaSelecionada.tipo_veiculo || '3/4'} ({cargaSelecionada.capacidade_veiculo || 16} motos)
                                    </span>
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
