<?php

namespace App\Services\Estoque;

use App\Models\EstoqueLocal;
use App\Models\Peca;
use App\Models\PecaEstoque;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Sincronização do estoque de peças com o Microwork (relatório 151/67).
 *
 * FORMATO DA FONTE
 * O relatório devolve uma linha por (mercadoria, empresa) — não um saldo
 * consolidado. Verificado em produção: 4.689 linhas para 2.385 códigos
 * distintos, sendo que 885 códigos aparecem em mais de uma empresa.
 *
 * Consequência: o sync separa duas coisas que são naturalmente diferentes.
 *   - CATÁLOGO (código, descrição, marca, NCM, preço): global, uma peça só.
 *   - SALDO: por local, traduzido de `codigoempresa` via
 *     estoque_locais.codigo_empresa_microwork.
 *
 * Linhas de empresas sem local mapeado são contadas e ignoradas. Importar
 * saldo no local errado é pior que não importar: some estoque de uma loja e
 * aparece em outra, e o erro só é descoberto no inventário físico.
 *
 * IDEMPOTÊNCIA
 * O saldo externo é a verdade para peça sincronizada. Cada execução ajusta o
 * saldo local ao valor do relatório e grava um movimento tipo 'ajuste' no
 * ledger apenas quando há diferença — rodar duas vezes seguidas não gera
 * movimento duplicado.
 */
class PecaMicroworkProvider implements StockProviderInterface
{
    private const ENDPOINT  = 'https://microworkcloud.com.br/api/integracao/terceiro';

    public function __construct(
        private readonly PecaLocalProvider $local,
        private readonly EstoquePecaService $estoque,
    ) {
    }

    public function tipo(): string
    {
        return 'peca';
    }

    /** Leitura sai do estoque local, que o sync mantém atualizado. */
    public function disponivel(?int $localId = null): array
    {
        return $this->local->disponivel($localId);
    }

    public function disponivelDe(string $identificador, ?int $localId = null): int
    {
        return $this->local->disponivelDe($identificador, $localId);
    }

    public function suportaSincronizacao(): bool
    {
        return ! empty(config('services.microwork.token'))
            && ! empty(config('services.microwork.pecas.relatorio_configuracao'));
    }

    /**
     * Sincronização padrão: SOMENTE CATÁLOGO.
     *
     * O saldo fica de fora por decisão de arquitetura, não por limitação de
     * implementação. Verificado contra os dados reais:
     *
     *   CATÁLOGO — confiável. 2.385 códigos, zero divergência de descrição ou
     *   preço entre empresas. É um cadastro global e pode ser importado.
     *
     *   SALDO — não atribuível a local. Uma empresa do Microwork não equivale a
     *   um ponto físico: a empresa 3 mistura CD e Ananindeua, e outras agrupam
     *   Capanema, Soure e Cametá. O relatório tem filtro de localização, mas o
     *   campo está preenchido em apenas 6 das 2.188 linhas do CD, e o leiaute
     *   172 sequer devolve essa coluna.
     *
     * Importar esse saldo faria peça de Ananindeua aparecer como disponível no
     * CD — e o erro só apareceria quando alguém fosse buscar a peça na
     * prateleira. O saldo por local passa a ser mantido pelo nosso sistema, que
     * é organizado por local desde o início.
     *
     * Para importar saldo assim que houver mapeamento confiável:
     * sincronizarComSaldo().
     */
    public function sincronizar(): SyncResult
    {
        return $this->executar(comSaldo: false);
    }

    /**
     * Sincroniza catálogo E saldo. Exige estoque_locais.codigo_empresa_microwork
     * preenchido e só deve ser usado quando cada empresa corresponder de fato a
     * um único local físico.
     */
    public function sincronizarComSaldo(): SyncResult
    {
        return $this->executar(comSaldo: true);
    }

    private function executar(bool $comSaldo): SyncResult
    {
        if (! $this->suportaSincronizacao()) {
            return SyncResult::naoSuportado(
                'Relatório de peças não configurado. Defina MICROWORK_TOKEN e MICROWORK_PECAS_CONFIG no .env.'
            );
        }

        $dados = $this->buscarDaApi();

        if (empty($dados)) {
            // Mesma política do sync de motos: não sobrescrever dado válido com vazio.
            return SyncResult::falha('A API retornou vazio; catálogo anterior preservado.');
        }

        /*
         * O payload bruto NÃO é cacheado.
         *
         * Diferente das motos — onde o cache serve as telas em tempo real —, o
         * de peças é consumido só aqui: a leitura sai do banco, já reconciliado.
         * Guardar ~42.000 linhas seria dezenas de MB serializados a cada sync,
         * sem nenhum leitor.
         */
        return $this->reconciliar($dados, $comSaldo);
    }

    /**
     * Mapa codigoempresa -> estoque_locais.id.
     * Só entram locais explicitamente mapeados.
     *
     * @return array<int, int>
     */
    private function mapaEmpresas(): array
    {
        return EstoqueLocal::whereNotNull('codigo_empresa_microwork')
            ->pluck('id', 'codigo_empresa_microwork')
            ->all();
    }

    private function reconciliar(array $dados, bool $comSaldo): SyncResult
    {
        $mapa = $comSaldo ? $this->mapaEmpresas() : [];

        if ($comSaldo && empty($mapa)) {
            return SyncResult::falha(
                'Nenhum local tem codigo_empresa_microwork definido. '
                . 'Sem esse mapeamento não é possível saber a qual loja/CD cada saldo pertence.'
            );
        }

        $ignorados = 0;
        $empresasSemLocal = [];
        $saldosAplicados = 0;

        /*
         * PASSO 1 — normaliza e deduplica por código.
         *
         * O relatório traz uma linha por (mercadoria, empresa), mas o catálogo é
         * global: verificado em 2.804 códigos, zero divergência de descrição ou
         * preço entre empresas. Então a primeira ocorrência já descreve a peça.
         *
         * MEMÓRIA: sem o filtro de saldo são ~42.000 linhas. Guardar cada
         * ocorrência (array por linha) estoura o limite do PHP, então o saldo é
         * agregado aqui mesmo, em inteiros: `$saldos[codigo][empresa] = int`.
         * O array de entrada é liberado logo em seguida.
         */
        $catalogo = [];
        $saldos = [];

        foreach ($dados as $bruto) {
            $item = $this->mapearItem((array) $bruto);

            if ($item['codigo'] === '') {
                $ignorados++;
                continue;
            }

            $catalogo[$item['codigo']] ??= $item;

            if ($item['saldo'] > 0) {
                $codigo = $item['codigo'];
                $empresa = $item['empresa'];
                $saldos[$codigo][$empresa] = ($saldos[$codigo][$empresa] ?? 0) + $item['saldo'];
            }
        }

        // Libera o payload bruto antes das gravações, que também consomem memória.
        unset($dados);

        // Cadastro manual do CD nunca é sobrescrito pelo sync.
        $manuais = Peca::withTrashed()
            ->whereIn('codigo', array_keys($catalogo))
            ->where('origem', '!=', Peca::ORIGEM_MICROWORK)
            ->pluck('codigo')
            ->all();

        foreach ($manuais as $codigo) {
            unset($catalogo[$codigo]);
            $ignorados++;
        }

        $existentes = Peca::withTrashed()
            ->whereIn('codigo', array_keys($catalogo))
            ->pluck('codigo')
            ->all();

        $jaExiste = array_flip($existentes);
        $criados = count(array_diff_key($catalogo, $jaExiste));
        $atualizados = count($catalogo) - $criados;

        /*
         * PASSO 2 — grava em lote.
         *
         * upsert em blocos, não save() por peça: são ~2.400 registros e o laço
         * individual não termina dentro do timeout de uma execução de cron.
         */
        $agora = now();

        foreach (array_chunk($catalogo, 500) as $bloco) {
            Peca::upsert(
                array_map(fn (array $i) => [
                    'codigo'           => $i['codigo'],
                    'descricao'        => $i['descricao'] ?: $i['codigo'],
                    'unidade'          => 'UN',
                    'aplicacao'        => $i['aplicacao'] ?: null,
                    'marca'            => $i['marca'] ?: null,
                    'categoria'        => $i['marca'] ?: null,
                    'codigo_ncm'       => $i['ncm'] ?: null,
                    'preco_referencia' => $i['preco'],
                    'custo_aquisicao'  => $i['custo'],
                    'ultima_entrada'   => $i['ultima_entrada'],
                    'ultima_saida'     => $i['ultima_saida'],
                    'origem'           => Peca::ORIGEM_MICROWORK,
                    'sincronizado_em'  => $agora,
                    'ativo'            => true,
                    'deleted_at'       => null, // peça que voltou ao catálogo é reativada
                    'created_at'       => $agora,
                    'updated_at'       => $agora,
                ], $bloco),
                ['codigo'],
                [
                    'descricao', 'aplicacao', 'marca', 'categoria', 'codigo_ncm',
                    'preco_referencia', 'custo_aquisicao', 'ultima_entrada', 'ultima_saida',
                    'origem', 'sincronizado_em', 'ativo', 'deleted_at', 'updated_at',
                ]
            );
        }

        /*
         * PASSO 3 — ESPELHO DE SALDO POR EMPRESA (sempre).
         *
         * Diferente do saldo gerenciado, este é gravado em toda sincronização
         * porque é declaradamente informativo: responde "onde tem essa peça"
         * para quem vai separar e transferir, sem nunca participar de reserva
         * ou baixa. Ver migration 2026_08_14_100800.
         */
        $this->espelharSaldos($saldos, $catalogo);

        // --- PASSO 4 — SALDO GERENCIADO (somente no modo explícito) ---
        if ($comSaldo) {
            $idsPorCodigo = Peca::whereIn('codigo', array_keys($catalogo))
                ->pluck('id', 'codigo');

            foreach ($saldos as $codigo => $porEmpresa) {
                $pecaId = $idsPorCodigo[$codigo] ?? null;

                if ($pecaId === null) {
                    continue; // peça manual preservada
                }

                $peca = Peca::find($pecaId);

                foreach ($porEmpresa as $empresa => $saldo) {
                    $localId = $mapa[$empresa] ?? null;

                    if ($localId === null) {
                        $empresasSemLocal[$empresa] = ($empresasSemLocal[$empresa] ?? 0) + 1;
                        continue;
                    }

                    if ($this->aplicarSaldo($peca, $localId, $saldo)) {
                        $saldosAplicados++;
                    }
                }
            }
        }

        if ($empresasSemLocal) {
            ksort($empresasSemLocal);
            $resumo = collect($empresasSemLocal)
                ->map(fn ($n, $e) => "empresa {$e} ({$n} linhas)")
                ->implode(', ');

            Log::warning("PecaMicroworkProvider: saldo ignorado por falta de mapeamento — {$resumo}");
        }

        $modo = $comSaldo ? "catálogo + saldo ({$saldosAplicados} saldos aplicados)" : 'somente catálogo';

        Log::info(
            "PecaMicroworkProvider [{$modo}]: {$criados} peças criadas, "
            . "{$atualizados} atualizadas, {$ignorados} linhas ignoradas."
        );

        return SyncResult::ok($criados, $atualizados, $ignorados);
    }

    /**
     * Grava o espelho informativo de saldo por empresa.
     *
     * Recebe o saldo já agregado (código => empresa => total) e só com valores
     * positivos: as linhas zeradas — maioria absoluta das ~42.000 devolvidas
     * sem filtro de saldo — são descartadas ainda na leitura, em reconciliar().
     * O que existia e zerou é tratado pelo update de sobra, no fim.
     *
     * @param  array<string, array<int, int>>  $saldos    código => [empresa => saldo]
     * @param  array<string, array>            $catalogo  códigos que o sync gerencia
     */
    private function espelharSaldos(array $saldos, array $catalogo): void
    {
        if (empty($catalogo)) {
            return;
        }

        $idsPorCodigo = Peca::whereIn('codigo', array_keys($catalogo))
            ->pluck('id', 'codigo');

        $agora = now();
        $linhas = [];

        foreach ($saldos as $codigo => $porEmpresa) {
            $pecaId = $idsPorCodigo[$codigo] ?? null;

            if ($pecaId === null) {
                continue; // peça de cadastro manual: não espelha
            }

            foreach ($porEmpresa as $empresa => $saldo) {
                $linhas[] = [
                    'peca_id'         => $pecaId,
                    'codigo_empresa'  => $empresa,
                    'saldo'           => $saldo,
                    'sincronizado_em' => $agora,
                    'created_at'      => $agora,
                    'updated_at'      => $agora,
                ];
            }
        }

        foreach (array_chunk($linhas, 500) as $bloco) {
            DB::table('peca_saldos_externos')->upsert(
                $bloco,
                ['peca_id', 'codigo_empresa'],
                ['saldo', 'sincronizado_em', 'updated_at']
            );
        }

        // Zera o que sumiu do relatório: peça que não veio mais não tem saldo,
        // e deixar o número antigo mandaria alguém buscar o que não existe.
        DB::table('peca_saldos_externos')
            ->where('sincronizado_em', '<', $agora)
            ->update(['saldo' => 0, 'sincronizado_em' => $agora]);
    }

    /**
     * Alinha o saldo local ao do relatório.
     *
     * Grava movimento apenas quando há diferença — é o que torna o sync
     * idempotente e mantém o ledger legível (sem ruído de execuções repetidas).
     *
     * @return bool true se houve ajuste
     */
    private function aplicarSaldo(Peca $peca, int $localId, int $saldoExterno): bool
    {
        $atual = PecaEstoque::where('peca_id', $peca->id)
            ->where('local_id', $localId)
            ->value('saldo');

        // Nada a fazer: sem linha local e sem saldo externo.
        if ($atual === null && $saldoExterno === 0) {
            return false;
        }

        if ((int) $atual === $saldoExterno) {
            return false;
        }

        $this->estoque->ajustar(
            peca: $peca,
            localId: $localId,
            saldoContado: max(0, $saldoExterno),
            observacao: 'Sincronização automática Microwork (relatório 151/67).',
        );

        return true;
    }

    /**
     * Normaliza um registro do relatório 151/67.
     * Nomes de campo confirmados contra a resposta real da API.
     */
    private function mapearItem(array $item): array
    {
        return [
            'codigo'         => mb_strtoupper(trim((string) ($item['codigomercadoria'] ?? '')), 'UTF-8'),
            'descricao'      => trim((string) ($item['descricaomercadoria'] ?? '')),
            'aplicacao'      => trim((string) ($item['aplicacao'] ?? '')),
            'marca'          => trim((string) ($item['marca'] ?? '')),
            'ncm'            => trim((string) ($item['codigoncm'] ?? '')),
            'saldo'          => (int) ($item['totalsaldodisponivel'] ?? 0),
            'empresa'        => (int) ($item['codigoempresa'] ?? 0),
            'preco'          => $this->decimalOuNulo($item['valorbasevenda'] ?? null),
            'custo'          => $this->decimalOuNulo($item['custoaquisicao'] ?? null),
            'ultima_entrada' => $this->dataOuNulo($item['datamovimentacaoultimaentrada'] ?? null),
            'ultima_saida'   => $this->dataOuNulo($item['datamovimentacaoultimasaida'] ?? null),
        ];
    }

    private function decimalOuNulo($valor): ?float
    {
        return ($valor === null || $valor === '') ? null : (float) $valor;
    }

    /**
     * O Microwork usa 1900-01-01 como "nunca movimentou". Guardar essa data
     * como se fosse real distorceria qualquer análise de giro.
     */
    private function dataOuNulo($valor): ?string
    {
        if (empty($valor)) {
            return null;
        }

        try {
            $data = \Carbon\Carbon::parse($valor);
        } catch (\Throwable) {
            return null;
        }

        return $data->year <= 1900 ? null : $data->toDateString();
    }

    private function buscarDaApi(): array
    {
        $cfg = config('services.microwork.pecas');

        $payload = [
            'idrelatorioconfiguracao'        => (int) $cfg['relatorio_configuracao'],
            'idrelatorioconsulta'            => (int) $cfg['relatorio_consulta'],
            'idrelatorioconfiguracaoleiaute' => (int) ($cfg['leiaute'] ?: $cfg['relatorio_configuracao']),
            'idrelatoriousuarioleiaute'      => (int) $cfg['usuario_leiaute'],
            'ididioma'                       => 1,
            'listaempresas'                  => $this->listaEmpresas($cfg),
            'filtros'                        => $this->filtros($cfg),
        ];

        try {
            $response = Http::withToken(config('services.microwork.token'))
                ->withHeaders(['Content-Type' => 'application/json'])
                ->timeout(120)
                ->post(self::ENDPOINT, $payload);

            if ($response->successful()) {
                return $response->json() ?? [];
            }

            Log::error('Erro Microwork (peças): ' . $response->status() . ' - ' . substr($response->body(), 0, 500));
        } catch (\Throwable $e) {
            Log::error('Exceção Microwork (peças): ' . $e->getMessage());
        }

        return [];
    }

    /**
     * Empresas consultadas. Por padrão, as que já têm local mapeado — não faz
     * sentido baixar saldo que será descartado.
     *
     * @return array<int, int>
     */
    private function listaEmpresas(array $cfg): array
    {
        if (! empty($cfg['empresas'])) {
            return array_map('intval', array_filter(explode(',', (string) $cfg['empresas'])));
        }

        $mapeadas = array_keys($this->mapaEmpresas());

        return $mapeadas ?: [3, 5, 6, 7, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20];
    }

    /**
     * A string de filtros do Microwork é sensível a espaços em branco:
     * quebras de linha entre os pares chave=valor invalidam o filtro.
     */
    private function filtros(array $cfg): string
    {
        $filtros = $cfg['filtros'] ?: self::FILTROS_PADRAO;

        return implode(';', array_map('trim', explode(';', $filtros)));
    }

    /**
     * CATÁLOGO COMPLETO — sem filtro de saldo.
     *
     * `ComSaldoContabil=True` (o padrão do exemplo da integração) devolve apenas
     * peças que têm saldo contábil em alguma empresa, e esconde as zeradas.
     * Medido contra a API: 2.385 códigos com o filtro ligado, 2.804 sem ele —
     * 419 peças do catálogo ficavam invisíveis para quem monta um pedido.
     *
     * Também não adianta somar "com saldo" + "sem saldo contábil": essa união dá
     * 2.614, porque 190 peças não caem em nenhum dos dois recortes. Só o filtro
     * desligado devolve o catálogo inteiro.
     *
     * O custo é volume: ~42.000 linhas em vez de ~4.700, porque passa a vir uma
     * linha por (peça × empresa) mesmo quando o saldo é zero. Isso é absorvido no
     * processamento — o catálogo é deduplicado por código, e o espelho de saldo
     * descarta as linhas zeradas antes de gravar.
     */
    private const FILTROS_PADRAO = 'CurvaXYZ=null;Coeficiente=null;CurvaABC=null;CodigoMercadoria=null;'
        . 'Especie=null;NaoUtilizamCoeficiente=False;ComSaldoMinimoAtingido=False;'
        . 'ComSaldoMaximoAtingido=False;TributacaoIPI=null;LocalizacaoInicial=;TipoMercadoria=null;'
        . 'Marca=null;LocalizacaoFinal=;ComSaldoDisponivel=False;TributacaoEstadual=null;'
        . 'RegimeMonofasico=null;ComSaldoContabil=False;BackOrder=False;SemSaldoContabil=False;'
        . 'SemSaldoDisponivel=False';
}
