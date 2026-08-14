<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * V3.3 — ESPELHO DE SALDO DO MICROWORK, POR EMPRESA.
 *
 * CONTEXTO
 * O relatório 151/67 devolve saldo por empresa, e uma empresa NÃO equivale a um
 * ponto físico: a empresa 3 agrupa CD e Ananindeua, e outras juntam Capanema,
 * Soure e Cametá. Por isso esse saldo não pode alimentar peca_estoques, que é
 * saldo por local e sustenta reserva e baixa.
 *
 * MAS ELE NÃO É INÚTIL.
 * Para quem separa e transfere peça, saber "existem 56 velas no grupo CD+
 * Ananindeua" já resolve a pergunta prática de onde buscar — mesmo sem saber
 * em qual das duas prateleiras está.
 *
 * DUAS TABELAS, DUAS VERDADES SEPARADAS
 *   peca_estoques        -> saldo gerenciado por nós, por local real.
 *                           É o que reserva, baixa e responde por disponibilidade.
 *   peca_saldos_externos -> espelho informativo do Microwork, por empresa.
 *                           Somente leitura. Nunca participa de reserva ou baixa.
 *
 * Mantê-las separadas é o que impede que um número aproximado (agregado de dois
 * locais) seja usado como se fosse saldo exato de um local — que foi exatamente
 * o risco identificado ao recusar o import de saldo.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Identidade e rótulo de cada empresa do Microwork.
        Schema::create('empresas_microwork', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('codigo')->unique();

            // Nome operacional. Deve descrever o que a empresa REALMENTE agrupa,
            // não fingir que é um local só.
            $table->string('rotulo');

            // Locais físicos que esta empresa mistura, em texto livre.
            // Serve de aviso na tela para quem for buscar a peça.
            $table->string('agrupa')->nullable();

            $table->boolean('ativo')->default(true);
            $table->timestamps();
        });

        Schema::create('peca_saldos_externos', function (Blueprint $table) {
            $table->id();

            $table->foreignId('peca_id')->constrained('pecas')->cascadeOnDelete();
            $table->unsignedInteger('codigo_empresa');

            $table->integer('saldo')->default(0);
            $table->timestamp('sincronizado_em')->nullable();

            $table->timestamps();

            $table->unique(['peca_id', 'codigo_empresa']);
            $table->index('codigo_empresa');
        });

        /*
         * SEED — empresas observadas na resposta real da API.
         *
         * Só a 3 tem composição confirmada. As demais ficam com rótulo neutro
         * até alguém identificá-las: inventar nome de loja aqui mandaria o
         * separador ao lugar errado, que é pior que admitir o desconhecido.
         */
        $empresas = [
            3  => ['rotulo' => 'CD + Ananindeua', 'agrupa' => 'Centro de Distribuição e Loja Ananindeua'],
            5  => ['rotulo' => 'Empresa 5',  'agrupa' => null],
            6  => ['rotulo' => 'Empresa 6',  'agrupa' => null],
            7  => ['rotulo' => 'Empresa 7',  'agrupa' => null],
            8  => ['rotulo' => 'Empresa 8',  'agrupa' => null],
            9  => ['rotulo' => 'Empresa 9',  'agrupa' => null],
            10 => ['rotulo' => 'Empresa 10', 'agrupa' => null],
            11 => ['rotulo' => 'Empresa 11', 'agrupa' => null],
            12 => ['rotulo' => 'Empresa 12', 'agrupa' => null],
            15 => ['rotulo' => 'Empresa 15', 'agrupa' => null],
            16 => ['rotulo' => 'Empresa 16', 'agrupa' => null],
            17 => ['rotulo' => 'Empresa 17', 'agrupa' => null],
            18 => ['rotulo' => 'Empresa 18', 'agrupa' => null],
            19 => ['rotulo' => 'Empresa 19', 'agrupa' => null],
            20 => ['rotulo' => 'Empresa 20', 'agrupa' => null],
        ];

        $agora = now();
        $linhas = [];

        foreach ($empresas as $codigo => $dados) {
            $linhas[] = [
                'codigo'     => $codigo,
                'rotulo'     => $dados['rotulo'],
                'agrupa'     => $dados['agrupa'],
                'ativo'      => true,
                'created_at' => $agora,
                'updated_at' => $agora,
            ];
        }

        DB::table('empresas_microwork')->insert($linhas);
    }

    public function down(): void
    {
        Schema::dropIfExists('peca_saldos_externos');
        Schema::dropIfExists('empresas_microwork');
    }
};
