import { useMemo, useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import {
    ArrowPathIcon,
    MagnifyingGlassIcon,
    QrCodeIcon,
    TruckIcon,
    WrenchScrewdriverIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

import { Button, EmptyState, PageHeader, StatCard } from '@/Components/UI';
import { avisar, avisarErro, dialogo } from '@/Lib/alertas';

import AbaBiparChassi from '@/Components/Romaneios/AbaBiparChassi';
import AbaComposicaoCarga from '@/Components/Romaneios/AbaComposicaoCarga';
import AbasMontagem from '@/Components/Romaneios/AbasMontagem';
import BarraResumoCarga from '@/Components/Romaneios/BarraResumoCarga';
import ConfiguracaoViagem from '@/Components/Romaneios/ConfiguracaoViagem';
import GrupoBasquetas from '@/Components/Romaneios/GrupoBasquetas';
import GrupoColeta from '@/Components/Romaneios/GrupoColeta';
import GrupoExpedicao from '@/Components/Romaneios/GrupoExpedicao';
import useSelecaoCarga, { useIdsAlternaveis } from '@/Components/Romaneios/useSelecaoCarga';
import { agruparPor, contarMotos, contem, filtrarGrupos } from '@/Components/Romaneios/agrupar';

const motoCasa = (m, termo) => contem(m.chassi, termo) || contem(m.modelo, termo);

const destinoDoPedido = (p) => p.user?.filial || p.user?.name || 'DESTINO NÃO INFORMADO';

/**
 * Mesa de montagem de carga: motos do CD, basquetas de peças e coletas nas
 * lojas no mesmo caminhão.
 *
 * Até a v3.4 era um arquivo de 1.900 linhas. A página agora cuida do que é
 * dela — o formulário, a busca, os agrupamentos e o resumo — e cada aba é um
 * componente em Components/Romaneios.
 */
export default function RomaneioCreate({
    expedicao = [],
    coletas = [],
    cargasEmAberto = [],
    aguardandoChassi = [],
    pecasProntas = [],
    rotas = [],
}) {
    const selecao = useSelecaoCarga();
    const [pedidosAbertos, alternarPedidoAberto] = useIdsAlternaveis();
    const [basquetasAbertas, alternarBasquetaAberta] = useIdsAlternaveis();
    const [abaAtiva, setAbaAtiva] = useState('expedicao');
    const [filtroTexto, setFiltroTexto] = useState('');

    const { data, setData, post, transform, processing, errors } = useForm({
        motorista: '',
        placa: '',
        rota_nome: '',
        romaneio_id: '',
    });

    // --- AGRUPAMENTO POR FILIAL / DESTINO ---
    const agrupadosExpedicao = useMemo(() => agruparPor(expedicao, destinoDoPedido), [expedicao]);
    const agrupadosColeta = useMemo(() => agruparPor(coletas, (p) => p.origem?.filial || 'ORIGEM NÃO INFORMADA'), [coletas]);
    const agrupadosPecas = useMemo(() => agruparPor(pecasProntas, (b) => b.loja || 'DESTINO NÃO INFORMADO'), [pecasProntas]);

    // --- BUSCA ---
    const termo = filtroTexto.trim().toLowerCase();

    const expedicaoFiltrada = useMemo(
        () =>
            filtrarGrupos(agrupadosExpedicao, termo, (p, t) =>
                String(p.id).includes(t) || contem(p.user?.name, t) || (p.motos || []).some((m) => motoCasa(m, t))
            ),
        [agrupadosExpedicao, termo]
    );

    const pecasFiltradas = useMemo(
        () =>
            filtrarGrupos(agrupadosPecas, termo, (b, t) =>
                String(b.id).includes(t) ||
                contem(b.nota, t) ||
                (b.itens || []).some((i) => contem(i.codigo, t) || contem(i.descricao, t))
            ),
        [agrupadosPecas, termo]
    );

    const coletasFiltradas = useMemo(
        () =>
            filtrarGrupos(agrupadosColeta, termo, (p, t) =>
                String(p.id).includes(t) || contem(p.user?.filial, t) || (p.motos || []).some((m) => motoCasa(m, t))
            ),
        [agrupadosColeta, termo]
    );

    const filaChassiFiltrada = useMemo(
        () =>
            !termo
                ? aguardandoChassi
                : aguardandoChassi.filter(
                      (p) =>
                          String(p.id).includes(termo) ||
                          contem(p.loja, termo) ||
                          p.itens.some((i) => contem(i.modelo, termo) || contem(i.cor, termo))
                  ),
        [aguardandoChassi, termo]
    );

    // --- TOTAIS DISPONÍVEIS ---
    const totalChassisPendentes = aguardandoChassi.reduce(
        (acc, p) => acc + p.itens.reduce((s, i) => s + (i.qtd_pendente || 0), 0),
        0
    );

    const contagens = {
        expedicao: Object.values(expedicaoFiltrada).reduce((acc, pedidos) => acc + contarMotos(pedidos), 0),
        pecas: Object.values(pecasFiltradas).reduce((acc, basquetas) => acc + basquetas.length, 0),
        coleta: Object.values(coletasFiltradas).reduce((acc, pedidos) => acc + contarMotos(pedidos), 0),
        chassi: totalChassisPendentes,
        composicao: selecao.total,
    };

    // --- O QUE JÁ ESTÁ NA CARGA ---
    const basquetasSelecionadas = useMemo(
        () => pecasProntas.filter((b) => selecao.basquetaIds.includes(b.id)),
        [pecasProntas, selecao.basquetaIds]
    );

    const paradas = useMemo(() => {
        const mapa = {};
        const parada = (nome) => (mapa[nome] ??= { motos: [], basquetas: [], coletas: [] });

        expedicao.forEach((p) => {
            (p.motos || [])
                .filter((m) => selecao.motoIds.includes(m.id))
                .forEach((m) => parada(destinoDoPedido(p)).motos.push({ ...m, pedidoId: p.id }));
        });

        basquetasSelecionadas.forEach((b) => parada(b.loja || 'DESTINO NÃO INFORMADO').basquetas.push(b));

        coletas.forEach((p) => {
            const destino = p.user?.filial || 'CD Matriz';
            const origem = p.origem?.filial || 'Origem';

            (p.motos || [])
                .filter((m) => selecao.motoIds.includes(m.id))
                .forEach((m) => parada(`${origem} ➔ ${destino}`).coletas.push({ ...m, pedidoId: p.id, origem, destino }));
        });

        return mapa;
    }, [expedicao, coletas, selecao.motoIds, basquetasSelecionadas]);

    const resumo = {
        motos: selecao.motoIds.length,
        basquetas: selecao.basquetaIds.length,
        pecasUn: basquetasSelecionadas.reduce((t, b) => t + (b.total_un || 0), 0),
        volumes: basquetasSelecionadas.reduce((t, b) => t + (b.volumes || 1), 0),
        destinos: Object.keys(paradas).length,
        total: selecao.total,
    };

    const destinoCompleto = (local) => ({
        pedidos: agrupadosExpedicao[local] || [],
        basquetas: agrupadosPecas[local] || [],
    });

    // --- ENVIO ---
    const gerarCarga = (e) => {
        e.preventDefault();

        if (selecao.total === 0) {
            avisar('Nenhum item selecionado', 'Selecione ao menos uma moto ou uma basqueta de peças para montar a carga.', 'warning');
            return;
        }

        if (!data.romaneio_id && (!data.rota_nome || !data.motorista || !data.placa)) {
            avisar(
                'Dados da Viagem Incompletos',
                'Informe a Rota/Região, o Motorista e a Placa do veículo para criar uma nova carga.',
                'warning'
            );
            return;
        }

        transform((dados) => ({ ...dados, motos_ids: selecao.motoIds, basquetas_ids: selecao.basquetaIds }));

        post(route('romaneios.store'), {
            onSuccess: () =>
                dialogo().fire({
                    icon: 'success',
                    title: 'Carga Criada com Sucesso!',
                    text: 'Redirecionando para o romaneio...',
                    timer: 2000,
                    showConfirmButton: false,
                }),
            onError: (erros) => avisarErro(erros, 'Erro ao Salvar Carga', 'Verifique os dados obrigatórios.'),
        });
    };

    return (
        <>
            <Head title="Montagem de Carga" />

            <div className="space-y-6 pb-44">
                <PageHeader
                    title="Montagem de Carga"
                    description="Mesa de expedição unificada para montagem de cargas mistas com motos e peças ou coletas Milk Run."
                    breadcrumbs={[
                        { label: 'Logística' },
                        { label: 'Cargas', href: route('romaneios.index') },
                        { label: 'Nova Carga' },
                    ]}
                />

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <StatCard
                        label="Motos no CD"
                        value={contarMotos(expedicao)}
                        hint={`${expedicao.length} pedido(s) de saída`}
                        icon={TruckIcon}
                        tone="brand"
                    />
                    <StatCard
                        label="Basquetas Prontas"
                        value={pecasProntas.length}
                        hint={`${pecasProntas.reduce((acc, b) => acc + (b.total_un || 0), 0)} peça(s) faturada(s)`}
                        icon={WrenchScrewdriverIcon}
                        tone="info"
                    />
                    <StatCard
                        label="Coletas Milk Run"
                        value={contarMotos(coletas)}
                        hint={`${coletas.length} pedido(s) em lojas`}
                        icon={ArrowPathIcon}
                        tone="warning"
                    />
                    <StatCard
                        label="Chassis Pendentes"
                        value={totalChassisPendentes}
                        hint={`${aguardandoChassi.length} pedido(s) a bipar`}
                        icon={QrCodeIcon}
                        tone={totalChassisPendentes > 0 ? 'danger' : 'success'}
                    />
                </div>

                <form onSubmit={gerarCarga} className="space-y-6">
                    <ConfiguracaoViagem data={data} setData={setData} errors={errors} rotas={rotas} cargasEmAberto={cargasEmAberto} />

                    {/* Busca e atalhos */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative flex-1">
                            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                            <input
                                type="search"
                                aria-label="Filtrar itens da carga"
                                placeholder="Filtrar por cidade, filial, cliente, pedido ou chassi..."
                                value={filtroTexto}
                                onChange={(e) => setFiltroTexto(e.target.value)}
                                className="w-full rounded-lg border-line-strong bg-surface-card py-2 pl-9 pr-9 text-sm text-content-primary placeholder-content-muted focus:border-brand-500 focus:ring-brand-500"
                            />
                            {filtroTexto && (
                                <button
                                    type="button"
                                    onClick={() => setFiltroTexto('')}
                                    aria-label="Limpar busca"
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-content-muted hover:text-content-primary"
                                >
                                    <XMarkIcon className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {selecao.total > 0 && (
                            <Button variant="secondary" size="sm" onClick={selecao.limpar} icon={XMarkIcon}>
                                Limpar Seleção ({selecao.total})
                            </Button>
                        )}
                    </div>

                    <AbasMontagem ativa={abaAtiva} onMudar={setAbaAtiva} contagens={contagens} />

                    {abaAtiva === 'expedicao' && (
                        <div className="space-y-6">
                            {Object.keys(expedicaoFiltrada).length === 0 ? (
                                <EmptyState
                                    icon={TruckIcon}
                                    title="Nenhuma moto disponível para expedição"
                                    description={
                                        filtroTexto
                                            ? 'Nenhum pedido ou moto encontrado para os termos da busca.'
                                            : 'Todos os pedidos de motos aprovados já foram embarcados ou aguardam faturamento/chassi.'
                                    }
                                />
                            ) : (
                                Object.entries(expedicaoFiltrada).map(([local, pedidos]) => (
                                    <GrupoExpedicao
                                        key={local}
                                        local={local}
                                        pedidos={pedidos}
                                        destinoCompleto={destinoCompleto(local)}
                                        selecao={selecao}
                                        pedidosAbertos={pedidosAbertos}
                                        alternarPedidoAberto={alternarPedidoAberto}
                                    />
                                ))
                            )}
                        </div>
                    )}

                    {abaAtiva === 'pecas' && (
                        <div className="space-y-6">
                            <div className="rounded-card border border-status-info-solid/30 bg-status-info-bg/40 p-4">
                                <div className="flex items-start gap-3">
                                    <span className="rounded-md bg-status-info-solid/20 p-2 text-status-info-fg">
                                        <WrenchScrewdriverIcon className="h-5 w-5" />
                                    </span>
                                    <div>
                                        <h4 className="text-sm font-bold text-status-info-fg">
                                            Gate 2 de Logística de Peças (Conferência e Faturamento)
                                        </h4>
                                        <p className="mt-0.5 text-xs text-content-secondary leading-relaxed">
                                            A unidade de embarque oficial é a <strong>basqueta lacrada</strong>. Apenas basquetas
                                            faturadas e liberadas pelo Pós-Venda aparecem para embarque, garantindo que a nota
                                            fiscal bata com a mercadoria em trânsito. O estoque segue sob responsabilidade do CD
                                            até a conferência pela filial receptora.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {Object.keys(pecasFiltradas).length === 0 ? (
                                <EmptyState
                                    icon={WrenchScrewdriverIcon}
                                    title="Nenhuma basqueta pronta para embarcar"
                                    description={
                                        filtroTexto
                                            ? 'Nenhuma basqueta de peças corresponde aos filtros da busca.'
                                            : 'Assim que as caixas forem faturadas e liberadas na tela de Basquetas, elas aparecerão automaticamente aqui.'
                                    }
                                />
                            ) : (
                                Object.entries(pecasFiltradas).map(([local, basquetas]) => (
                                    <GrupoBasquetas
                                        key={local}
                                        local={local}
                                        basquetas={basquetas}
                                        destinoCompleto={destinoCompleto(local)}
                                        selecao={selecao}
                                        basquetasAbertas={basquetasAbertas}
                                        alternarBasquetaAberta={alternarBasquetaAberta}
                                    />
                                ))
                            )}
                        </div>
                    )}

                    {abaAtiva === 'coleta' && (
                        <div className="space-y-6">
                            {Object.keys(coletasFiltradas).length === 0 ? (
                                <EmptyState
                                    icon={ArrowPathIcon}
                                    title="Nenhuma coleta solicitada"
                                    description={
                                        filtroTexto
                                            ? 'Nenhuma coleta corresponde aos termos da busca.'
                                            : 'Não há transferências ou devoluções de motos pendentes de coleta nas lojas.'
                                    }
                                />
                            ) : (
                                Object.entries(coletasFiltradas).map(([origem, pedidos]) => (
                                    <GrupoColeta
                                        key={origem}
                                        origem={origem}
                                        pedidos={pedidos}
                                        selecao={selecao}
                                        pedidosAbertos={pedidosAbertos}
                                        alternarPedidoAberto={alternarPedidoAberto}
                                    />
                                ))
                            )}
                        </div>
                    )}

                    {abaAtiva === 'chassi' && (
                        <AbaBiparChassi aguardandoChassi={aguardandoChassi} filaFiltrada={filaChassiFiltrada} />
                    )}

                    {abaAtiva === 'composicao' && (
                        <AbaComposicaoCarga
                            paradas={paradas}
                            resumo={resumo}
                            selecao={selecao}
                            onIrParaMotos={() => setAbaAtiva('expedicao')}
                        />
                    )}

                    <BarraResumoCarga
                        resumo={resumo}
                        processando={processing}
                        romaneioId={data.romaneio_id}
                        onVerComposicao={() => setAbaAtiva('composicao')}
                    />
                </form>
            </div>
        </>
    );
}
