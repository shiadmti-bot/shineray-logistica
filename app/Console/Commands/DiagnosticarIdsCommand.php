<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Por que os números de pedido e de romaneio ficaram enormes.
 *
 * SOMENTE LEITURA. Só faz SELECT e SHOW CREATE TABLE — nenhum INSERT, UPDATE,
 * DELETE ou DDL. Imprime a conexão resolvida antes de qualquer consulta e, se o
 * host não for local, exige `--confirmar` para seguir: rodar às cegas contra o
 * banco errado foi como um migrate:fresh chegou na produção em 11/09/2026.
 *
 * O QUE ELE RESPONDE. O número do pedido é `pedidos.id`, um auto-increment
 * comum — não existe coluna `numero_pedido` no sistema. No TiDB cada instância
 * reserva um BLOCO de ids (AUTO_ID_CACHE, 30.000 por padrão) e o que sobra do
 * bloco é descartado quando a instância reinicia ou é rebalanceada. Em
 * Serverless isso acontece com frequência. O efeito é que o id cresce em
 * saltos, sem relação com quantas linhas foram gravadas.
 *
 * A coluna "gasto por linha" é o diagnóstico: perto de 1 significa sequência
 * saudável; na casa dos milhares significa bloco descartado.
 */
class DiagnosticarIdsCommand extends Command
{
    protected $signature = 'ids:diagnosticar
                            {--confirmar : Autoriza a leitura quando o banco não é local}';

    protected $description = 'Mede o quanto os IDs (pedidos, romaneios, motos...) escalaram além do número real de linhas. Somente leitura.';

    /** BIGINT UNSIGNED, que é o que `$table->id()` cria. */
    private const TETO_BIGINT_UNSIGNED = '18446744073709551615';

    /** @var list<string> */
    private const TABELAS = [
        'pedidos',
        'romaneios',
        'motos',
        'pedido_itens',
        'pedido_logs',
        'basquetas',
        'users',
    ];

    private const HOSTS_LOCAIS = ['127.0.0.1', 'localhost', '::1'];

    /** AUTO_ID_CACHE é conceito de TiDB; no MySQL/MariaDB não existe. */
    private bool $ehTidb = false;

    public function handle(): int
    {
        $conexao = config('database.default');
        $host = (string) config("database.connections.{$conexao}.host");
        $banco = (string) config("database.connections.{$conexao}.database");

        $this->newLine();
        $this->info('=====================================================');
        $this->info('  DIAGNÓSTICO DE ESCALA DOS IDS — SOMENTE LEITURA');
        $this->info('=====================================================');
        $this->line("Conexão:  {$conexao}");
        $this->line("Host:     {$host}");
        $this->line("Database: {$banco}");
        $this->newLine();

        $ehLocal = in_array($host, self::HOSTS_LOCAIS, true);

        if (! $ehLocal && ! $this->option('confirmar')) {
            $this->error('Este banco NÃO é local. Nada foi consultado.');
            $this->line('Confira o host acima e, se for o banco que você quer medir,');
            $this->line('rode de novo com --confirmar. O comando só faz SELECT.');

            return self::FAILURE;
        }

        $this->mostrarVersao();
        $this->mostrarTabelas();

        return self::SUCCESS;
    }

    private function mostrarVersao(): void
    {
        try {
            $versao = DB::selectOne('SELECT VERSION() AS v')->v ?? 'desconhecida';
            $this->line("Servidor: {$versao}");

            $this->ehTidb = str_contains(strtolower($versao), 'tidb');

            if ($this->ehTidb) {
                $this->comment('  → TiDB: ids são alocados em blocos por instância (AUTO_ID_CACHE).');
            }
        } catch (\Throwable $e) {
            $this->warn('Não foi possível ler a versão do servidor: ' . $e->getMessage());
        }

        $this->newLine();
    }

    private function mostrarTabelas(): void
    {
        $linhas = [];

        foreach (self::TABELAS as $tabela) {
            try {
                $resumo = DB::selectOne(
                    "SELECT COUNT(*) AS total, MIN(id) AS menor, MAX(id) AS maior FROM `{$tabela}`"
                );
            } catch (\Throwable $e) {
                $linhas[] = [$tabela, 'erro', '—', '—', '—', '—'];
                continue;
            }

            $total = (int) ($resumo->total ?? 0);
            $maior = (int) ($resumo->maior ?? 0);

            // Quantos ids foram QUEIMADOS por cada linha que de fato existe.
            // 1,0 = sequência limpa. 3.000 = quase todo bloco descartado.
            $gasto = $total > 0 ? $maior / $total : 0;

            $linhas[] = [
                $tabela,
                number_format($total, 0, ',', '.'),
                number_format((int) ($resumo->menor ?? 0), 0, ',', '.'),
                number_format($maior, 0, ',', '.'),
                $total > 0 ? number_format($gasto, 1, ',', '.') : '—',
                $this->cacheDeIds($tabela),
            ];
        }

        $this->table(
            ['Tabela', 'Linhas', 'Menor id', 'Maior id', 'Ids gastos/linha', 'AUTO_ID_CACHE'],
            $linhas,
        );

        $this->mostrarFolga();
    }

    /**
     * O AUTO_ID_CACHE declarado na tabela, se houver.
     *
     * O TiDB o expõe como atributo dentro de um comentário-feature no
     * SHOW CREATE TABLE, na forma `AUTO_ID_CACHE=<n>`. Ausente significa o
     * padrão de 30.000. No MySQL/MariaDB o conceito não existe: devolve "n/a".
     */
    private function cacheDeIds(string $tabela): string
    {
        if (! $this->ehTidb) {
            return 'n/a (não é TiDB)';
        }

        try {
            $ddl = (array) DB::selectOne("SHOW CREATE TABLE `{$tabela}`");
            $sql = (string) (array_values($ddl)[1] ?? '');

            if (preg_match('/AUTO_ID_CACHE=(\d+)/i', $sql, $m) === 1) {
                return $m[1];
            }

            return str_contains($sql, 'AUTO_INCREMENT') ? 'padrão (30000)' : 'sem auto-increment';
        } catch (\Throwable $e) {
            return '—';
        }
    }

    /**
     * Quanto ainda cabe. Serve para separar dois problemas que parecem um só:
     * "o número é feio" (verdade) e "o número vai estourar" (não vai).
     */
    private function mostrarFolga(): void
    {
        try {
            $maior = (int) (DB::selectOne('SELECT MAX(id) AS m FROM `pedidos`')->m ?? 0);
        } catch (\Throwable $e) {
            return;
        }

        if ($maior <= 0) {
            return;
        }

        $teto = self::TETO_BIGINT_UNSIGNED;
        $percentual = $maior / (float) $teto * 100;

        // O teto é impresso como STRING agrupada à mão: passar por float
        // arredondava o último dígito e mostrava ...616 em vez de ...615 —
        // um número errado numa linha cuja função é dar confiança.
        $tetoLegivel = strrev(implode('.', str_split(strrev($teto), 3)));

        $this->newLine();
        $this->line('Maior id de pedido: ' . number_format($maior, 0, ',', '.'));
        $this->line('Teto do BIGINT UNSIGNED: ' . $tetoLegivel);
        $this->info(sprintf(
            'Consumo do intervalo: %.12f%% — a coluna não corre risco de esgotar.',
            $percentual,
        ));
        $this->comment('O problema dos ids grandes é de legibilidade (número de 8 dígitos');
        $this->comment('ditado por telefone, impresso no romaneio), não de capacidade.');
    }
}
