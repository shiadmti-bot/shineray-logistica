<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * V3 — LOCAIS DE ESTOQUE
 *
 * Hoje "onde a coisa está" é representado de duas formas frouxas:
 *   - motos.loja_atual_id  -> users.id, com NULL significando "está no CD"
 *   - motos.localizacao_atual -> texto livre ("Estoque CD", "Loja Belém"...)
 *
 * Isso funciona para moto porque a moto é única (o chassi carrega a identidade).
 * Para PEÇA não funciona: peça é fungível e o saldo precisa de uma chave estável
 * por local. Com loja_id NULL representando o CD, o índice UNIQUE do MySQL não
 * bloqueia duplicatas (NULL nunca é igual a NULL), e duas linhas de saldo para o
 * mesmo SKU no CD corromperiam o estoque silenciosamente.
 *
 * Esta tabela dá identidade real a cada local. O CD vira uma linha como qualquer
 * outra, e peca_estoques pode ter UNIQUE(peca_id, local_id) de verdade.
 *
 * NÃO altera nada de motos: o fluxo atual continua idêntico. A coluna
 * users.estoque_local_id apenas cria a ponte para a migração futura.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('estoque_locais', function (Blueprint $table) {
            $table->id();
            $table->string('nome');
            $table->string('slug')->unique();

            // cd    = centro de distribuição (origem das cargas)
            // loja  = ponto de venda
            $table->enum('tipo', ['cd', 'loja'])->default('loja');

            // Loja correspondente no cadastro de usuários (NULL para o CD).
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->boolean('ativo')->default(true);
            $table->timestamps();

            $table->index(['tipo', 'ativo']);
        });

        // Ponte users -> estoque_locais, para resolver o local de uma loja logada.
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('estoque_local_id')
                  ->nullable()
                  ->after('default_route_id')
                  ->constrained('estoque_locais')
                  ->nullOnDelete();
        });

        // --- SEED: o CD ---
        $cdId = DB::table('estoque_locais')->insertGetId([
            'nome'       => 'Centro de Distribuição',
            'slug'       => 'cd',
            'tipo'       => 'cd',
            'user_id'    => null,
            'ativo'      => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // --- SEED: um local para cada loja já cadastrada ---
        $lojas = DB::table('users')
            ->whereNull('deleted_at')
            ->where('perfil', 'loja')
            ->get(['id', 'name', 'filial']);

        foreach ($lojas as $loja) {
            $base = $loja->filial ?: $loja->name;
            $slug = Str::slug($base . '-' . $loja->id);

            $localId = DB::table('estoque_locais')->insertGetId([
                'nome'       => $base,
                'slug'       => $slug,
                'tipo'       => 'loja',
                'user_id'    => $loja->id,
                'ativo'      => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('users')->where('id', $loja->id)->update(['estoque_local_id' => $localId]);
        }

        // Usuários do CD apontam para o local do CD.
        DB::table('users')->where('perfil', 'cd')->update(['estoque_local_id' => $cdId]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['estoque_local_id']);
            $table->dropColumn('estoque_local_id');
        });

        Schema::dropIfExists('estoque_locais');
    }
};
