<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * FASE 0 — RENOMEIA A TERCEIRA LOJA DE FORTALEZA
 *
 * O cadastro registra "Fortaleza (Demócrito Rocha)"; o nome correto é
 * "Fortaleza (José Bastos)". Mesma loja, nome atualizado.
 *
 * PRECISA RODAR ANTES DE 2026_08_26_100000: aquela migration marca as 18
 * filiais habilitadas para peças procurando "José Bastos" no nome do local.
 * Com o nome antigo no banco, a loja ficaria de fora da operação de peças e o
 * relatório acusaria 17 de 18.
 *
 * Corrigir só o FilialSeeder não bastaria: seeder usa firstOrCreate e não
 * reescreve registro existente, então o banco em produção continuaria com o
 * nome antigo.
 *
 * O nome aparece em três lugares independentes — não há FK entre eles:
 *   filials.nome / filials.cidade  -> cadastro de referência
 *   estoque_locais.nome            -> semeado de users.filial na v3
 *   users.filial                   -> texto digitado no cadastro do usuário
 */
return new class extends Migration
{
    /** Variantes aceitas na busca — o cadastro pode ter sido digitado sem acento. */
    private const DE   = ['Demócrito Rocha', 'Democrito Rocha'];
    private const PARA = 'José Bastos';

    /** Para o rollback, as variantes do nome novo. */
    private const DE_VOLTA = ['José Bastos', 'Jose Bastos'];
    private const PARA_VOLTA = 'Demócrito Rocha';

    public function up(): void
    {
        $total = 0;

        $total += $this->substituir('filials', 'nome', self::DE, self::PARA);
        $total += $this->substituir('filials', 'cidade', self::DE, self::PARA);
        $total += $this->substituir('estoque_locais', 'nome', self::DE, self::PARA);
        $total += $this->substituir('users', 'filial', self::DE, self::PARA);

        echo "  → Registros renomeados para '" . self::PARA . "': {$total}" . PHP_EOL;

        if ($total === 0) {
            echo '  → Nenhum registro com o nome antigo. Confirme se a loja já foi renomeada' . PHP_EOL;
            echo '    ou se ela ainda não existe no cadastro.' . PHP_EOL;
        }
    }

    public function down(): void
    {
        $this->substituir('filials', 'nome', self::DE_VOLTA, self::PARA_VOLTA);
        $this->substituir('filials', 'cidade', self::DE_VOLTA, self::PARA_VOLTA);
        $this->substituir('estoque_locais', 'nome', self::DE_VOLTA, self::PARA_VOLTA);
        $this->substituir('users', 'filial', self::DE_VOLTA, self::PARA_VOLTA);
    }

    /**
     * Troca em PHP, não em SQL.
     *
     * REPLACE do MySQL depende do collation da coluna para casar "Demócrito"
     * com "Democrito". Em PHP a lista de variantes torna isso explícito, e
     * str_ireplace preserva o texto ao redor — "Fortaleza (…)" fica intacto.
     *
     * @param  array<int, string>  $de  variantes a procurar
     */
    private function substituir(string $tabela, string $coluna, array $de, string $para): int
    {
        $alterados = 0;

        foreach (DB::table($tabela)->whereNotNull($coluna)->get(['id', $coluna]) as $linha) {
            $valor = $linha->{$coluna};
            $novo = str_ireplace($de, $para, $valor);

            if ($novo === $valor) {
                continue;
            }

            DB::table($tabela)->where('id', $linha->id)->update([$coluna => $novo]);
            $alterados++;
        }

        return $alterados;
    }
};
