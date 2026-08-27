<?php

use App\Models\EstoqueLocal;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * FASE 0 — REDE HABILITADA PARA PEÇAS
 *
 * Nem toda loja do cadastro participa da distribuição de peças. O manual do
 * Call Center descreve uma operação de 15 filiais no Pará; a diretoria incluiu
 * as 3 de Fortaleza por precaução, totalizando 18.
 *
 * Sem esta marcação, a fila de peças e as basquetas apareceriam para as 22
 * lojas cadastradas, incluindo as 4 do Pará que não recebem peça — e o CD
 * separaria para quem nunca terá rota de peça.
 *
 * O CD também recebe a marca: ele participa como ORIGEM. Quem ganha basqueta
 * é `tipo = 'loja' AND participa_pecas`, nunca o CD.
 *
 * MARCAÇÃO POR NOME, COM CONFERÊNCIA
 * `estoque_locais.nome` foi semeado a partir de `users.filial` (ver migration
 * 2026_08_14_100000), que é texto digitado. Por isso a comparação é feita em
 * PHP, sem acento e sem caixa, em vez de um WHERE IN literal que falharia
 * silenciosamente em "Tomé-Açu" ou "Concórdia do Pará".
 *
 * O resultado é registrado no log: se não fechar 18, alguém precisa marcar o
 * que faltou à mão. Marcar de menos deixa uma filial de fora da operação;
 * marcar de mais coloca peça numa loja que não tem rota.
 */
return new class extends Migration
{
    /** As 15 do Pará descritas no manual, mais as 3 de Fortaleza. */
    private const HABILITADAS = [
        // Pará — operação do manual
        'Ananindeua',
        'Barcarena',
        'Belém',
        'Bragança',
        'Cametá',
        'Capanema',
        'Capitão Poço',
        'Castanhal',
        'Concórdia do Pará',
        'Curuçá',
        'Icoaraci',
        'Paragominas',
        'São Miguel do Guamá',
        'Tailândia',
        'Tomé-Açu',

        // Ceará — habilitadas por precaução
        'Aldeota',
        'José Bastos',
        'Parangaba',
    ];

    public function up(): void
    {
        Schema::table('estoque_locais', function (Blueprint $table) {
            $table->boolean('participa_pecas')
                  ->default(false)
                  ->after('ativo');
        });

        // O CD é a origem de toda peça: participa sempre.
        DB::table('estoque_locais')
            ->where('tipo', EstoqueLocal::TIPO_CD)
            ->update(['participa_pecas' => true]);

        $alvos = array_map([$this, 'normalizar'], self::HABILITADAS);

        $marcados = [];

        foreach (DB::table('estoque_locais')->where('tipo', EstoqueLocal::TIPO_LOJA)->get(['id', 'nome']) as $local) {
            $nome = $this->normalizar($local->nome);

            // `contains` e não igualdade: o cadastro traz variações como
            // "Fortaleza (Aldeota)" para a mesma loja que a lista chama de
            // "Aldeota".
            foreach ($alvos as $i => $alvo) {
                if (str_contains($nome, $alvo)) {
                    DB::table('estoque_locais')->where('id', $local->id)->update(['participa_pecas' => true]);
                    $marcados[$i] = $local->nome;
                    break;
                }
            }
        }

        $this->relatar($marcados);
    }

    public function down(): void
    {
        Schema::table('estoque_locais', function (Blueprint $table) {
            $table->dropColumn('participa_pecas');
        });
    }

    private function normalizar(string $valor): string
    {
        return Str::lower(Str::ascii($valor));
    }

    /**
     * Não falha a migration: um nome divergente no cadastro é problema de
     * dado, não de schema. Mas precisa aparecer, senão a filial some da
     * operação de peças sem ninguém notar.
     */
    private function relatar(array $marcados): void
    {
        $faltando = array_values(array_diff_key(self::HABILITADAS, $marcados));
        $total = count($marcados);

        echo "  → Locais de peça habilitados: {$total} de " . count(self::HABILITADAS) . PHP_EOL;

        if ($faltando) {
            echo '  → NÃO ENCONTRADOS no cadastro: ' . implode(', ', $faltando) . PHP_EOL;
            echo '    Marque participa_pecas à mão para estes, ou corrija o nome do local.' . PHP_EOL;
        }
    }
};
