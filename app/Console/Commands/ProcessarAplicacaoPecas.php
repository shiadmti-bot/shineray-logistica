<?php

namespace App\Console\Commands;

use App\Models\Peca;
use App\Services\Pecas\AplicacaoParser;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Normaliza a aplicação das peças em vínculos (peça, modelo) pesquisáveis.
 *
 * Roda depois de pecas:sync-estoque. É idempotente: recalcula tudo que é
 * derivado e preserva o que foi confirmado à mão.
 *
 * ORDEM DE CONFIANÇA
 *   1. campo `aplicacao` do Microwork  -> alta   (cadastro oficial)
 *   2. modelo citado na descrição      -> média  (pista, precisa conferência)
 *   3. vínculo manual do CD            -> alta   (nunca sobrescrito)
 *
 * Vínculos manuais são preservados porque representam conhecimento que o
 * sistema não tem como derivar — alguém abriu a caixa e conferiu.
 */
class ProcessarAplicacaoPecas extends Command
{
    protected $signature = 'pecas:processar-aplicacao
                            {--força : Recalcula inclusive o que já foi processado}';

    protected $description = 'Extrai de quais modelos cada peça serve e grava em peca_aplicacoes.';

    public function handle(AplicacaoParser $parser): int
    {
        $this->info('Processando aplicação das peças...');

        $stats = [
            'pecas'          => 0,
            'universais'     => 0,
            'especificas'    => 0,
            'indefinidas'    => 0,
            'vinc_microwork' => 0,
            'vinc_descricao' => 0,
        ];

        // Vínculos manuais não são tocados: representam conferência humana.
        DB::table('peca_aplicacoes')->whereIn('origem', ['microwork', 'descricao', 'inferido'])->delete();

        /*
         * Peças que já têm confirmação manual.
         *
         * Precisa ser lido ANTES de reclassificar: sem isso, uma peça cuja
         * aplicação alguém confirmou à mão volta a 'indefinido' no próximo
         * reprocessamento, reaparece como "a confirmar" na tela e o CD é
         * perguntado de novo sobre o que já respondeu — descartando na prática
         * o trabalho de quem conferiu.
         */
        $comVinculoManual = DB::table('peca_aplicacoes')
            ->where('origem', 'manual')
            ->distinct()
            ->pluck('peca_id')
            ->flip();

        $barra = $this->output->createProgressBar(Peca::count());
        $barra->start();

        Peca::chunkById(500, function ($pecas) use ($parser, &$stats, $barra, $comVinculoManual) {
            $vinculos = [];
            $agora = now();

            // Tipos acumulados para gravar em lote no fim do chunk.
            // saveQuietly() por peça seriam ~2.400 UPDATEs e a execução não
            // termina dentro do timeout de um cron.
            $porTipo = ['especifica' => [], 'universal' => [], 'indefinido' => []];

            foreach ($pecas as $peca) {
                $stats['pecas']++;

                $aplicacoes = $parser->parse($peca->aplicacao);
                $origem = 'microwork';
                $confianca = 'alta';

                // Sem aplicação oficial: tenta o nome da peça, com confiança menor.
                if (empty($aplicacoes)) {
                    $aplicacoes = $parser->parseDescricao($peca->descricao);
                    $origem = 'descricao';
                    $confianca = 'media';
                }

                // Confirmação manual é prova de que a peça é específica, mesmo
                // que nem o campo `aplicacao` nem a descrição digam isso.
                $confirmadaManualmente = isset($comVinculoManual[$peca->id]);

                $tipo = $parser->classificarTipo(
                    $peca->descricao,
                    $peca->marca,
                    ! empty($aplicacoes) || $confirmadaManualmente
                );

                if ($confirmadaManualmente) {
                    $tipo = 'especifica';
                }

                // Item universal não recebe vínculo de modelo: serve em qualquer
                // moto, e amarrá-lo a um modelo específico seria informação falsa.
                if ($tipo === 'universal') {
                    $aplicacoes = [];
                }

                $porTipo[$tipo][] = $peca->id;

                $stats[match ($tipo) {
                    'universal'  => 'universais',
                    'especifica' => 'especificas',
                    default      => 'indefinidas',
                }]++;

                foreach ($aplicacoes as $a) {
                    $vinculos[] = [
                        'peca_id'      => $peca->id,
                        'familia'      => $a['familia'],
                        'modelo'       => $a['modelo'],
                        'cilindrada'   => $a['cilindrada'],
                        'variante'     => $a['variante'],
                        'origem'       => $origem,
                        'confianca'    => $confianca,
                        'texto_origem' => $origem === 'microwork' ? $peca->aplicacao : $peca->descricao,
                        'created_at'   => $agora,
                        'updated_at'   => $agora,
                    ];

                    $stats[$origem === 'microwork' ? 'vinc_microwork' : 'vinc_descricao']++;
                }

                $barra->advance();
            }

            // Um UPDATE por tipo, em vez de um por peça.
            foreach ($porTipo as $tipo => $ids) {
                if ($ids) {
                    DB::table('pecas')->whereIn('id', $ids)->update(['tipo_item' => $tipo]);
                }
            }

            if ($vinculos) {
                // insertOrIgnore: o UNIQUE (peca, familia, modelo, variante) já
                // barra duplicatas; ignorar é mais barato que verificar antes.
                foreach (array_chunk($vinculos, 500) as $bloco) {
                    DB::table('peca_aplicacoes')->insertOrIgnore($bloco);
                }
            }
        });

        $barra->finish();
        $this->newLine(2);

        $this->info('Concluído.');
        $this->table(
            ['Métrica', 'Valor'],
            [
                ['Peças processadas',        $stats['pecas']],
                ['  específicas',            $stats['especificas']],
                ['  universais',             $stats['universais']],
                ['  indefinidas',            $stats['indefinidas']],
                ['Vínculos (Microwork)',     $stats['vinc_microwork']],
                ['Vínculos (descrição)',     $stats['vinc_descricao']],
                ['Total de vínculos',        DB::table('peca_aplicacoes')->count()],
            ]
        );

        $semAplicacao = Peca::where('tipo_item', 'indefinido')->count();

        if ($semAplicacao > 0) {
            $this->newLine();
            $this->warn("{$semAplicacao} peças específicas ainda sem modelo identificado.");
            $this->line('São peças reais (carenagem, paralama, rabeta) cuja aplicação não está');
            $this->line('preenchida no Microwork. Precisam de conferência manual — o sistema não');
            $this->line('tem como deduzir com segurança em qual modelo cada uma serve.');
        }

        return self::SUCCESS;
    }
}
