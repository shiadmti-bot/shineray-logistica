<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * V3.7 — O CATÁLOGO DE MODELOS DEIXA DE DEPENDER DE TER ESTOQUE.
 *
 * O QUE ACONTECIA. A tela de criação de pedido montava a lista de modelos assim
 * (PedidoController::create, antes desta versão):
 *
 *     $modelosMicrowork = modelos distintos vistos em getEstoqueCD()
 *     $listaModelos = $modelosMicrowork ?: Modelo::pluck('nome')
 *
 * Os dois problemas estão nessa segunda linha. `getEstoqueCD()` devolve o cache
 * de um relatório de CHASSIS — um modelo sem unidade em pátio não aparece nele.
 * E o `?:` não é união: assim que o Microwork respondia qualquer coisa, o
 * catálogo de 48 modelos da tabela `modelos` (com os nomes exatos, do
 * ModeloSeeder) era JOGADO FORA. A loja só conseguia pedir o que já existia
 * fisicamente no CD, que é o oposto da função de um pedido de reposição.
 *
 * AS CORES ERAM PIORES. Sem saldo para o modelo, Create.jsx caía numa lista de
 * sete cores INVENTADAS no código ('VERMELHA', 'PRETA', 'BRANCA', 'CINZA',
 * 'AZUL', 'AMARELA', 'BEGE'). A loja escolhia uma cor que talvez não exista
 * para aquele modelo, e o pedido nascia com um nome que não casa com nenhuma
 * variante real do Microwork.
 *
 * O QUE ESTA MIGRATION MONTA. Duas tabelas de CATÁLOGO, que só crescem e não
 * dependem de saldo:
 *
 *   `modelos`      — ganha origem/visto_em/ativo. Continua a lista de nomes.
 *   `modelo_cores` — as cores que o Microwork já mostrou para cada modelo.
 *
 * A sincronia alimenta as duas a partir da resposta CRUA da API, antes do filtro
 * de pátios do CD: o catálogo enxerga o inventário do grupo inteiro, enquanto os
 * números de disponibilidade continuam restritos aos pátios do CD.
 *
 * `visto_em` é a data da última vez que o modelo apareceu numa sincronia. Não
 * apaga nada: um modelo que sai de linha continua pedível (e auditável), e quem
 * decide tirá-lo da lista é uma pessoa, marcando `ativo = false`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('modelos', function (Blueprint $table) {
            // 'seed' = veio do ModeloSeeder; 'microwork' = apareceu numa
            // sincronia; 'manual' = alguém cadastrou pelo sistema.
            $table->string('origem', 20)->default('seed')->after('nome');

            // Última sincronia em que este nome apareceu. NULL = nunca apareceu
            // (nome do seed que o Microwork ainda não confirmou).
            $table->timestamp('visto_em')->nullable()->after('origem');

            // Saiu de linha? Decisão humana. A sincronia nunca desativa nada:
            // um modelo pode faltar numa resposta por filtro, erro ou pátio
            // vazio, e desativar por ausência apagaria a lista no primeiro
            // soluço da API.
            $table->boolean('ativo')->default(true)->after('visto_em');

            $table->index(['ativo', 'nome']);
        });

        Schema::create('modelo_cores', function (Blueprint $table) {
            $table->id();

            $table->foreignId('modelo_id')->constrained('modelos')->cascadeOnDelete();

            // Exatamente como o Microwork escreve, em caixa alta.
            $table->string('cor');

            $table->string('origem', 20)->default('microwork');
            $table->timestamp('visto_em')->nullable();
            $table->boolean('ativo')->default(true);

            $table->timestamps();

            // A mesma cor não entra duas vezes para o mesmo modelo — é o que
            // permite a sincronia ser idempotente com um upsert.
            $table->unique(['modelo_id', 'cor']);
        });

        // Os 48 nomes que já estavam na tabela vieram do seeder.
        DB::table('modelos')->update(['origem' => 'seed']);
    }

    public function down(): void
    {
        Schema::dropIfExists('modelo_cores');

        Schema::table('modelos', function (Blueprint $table) {
            $table->dropIndex(['ativo', 'nome']);
            $table->dropColumn(['origem', 'visto_em', 'ativo']);
        });
    }
};
