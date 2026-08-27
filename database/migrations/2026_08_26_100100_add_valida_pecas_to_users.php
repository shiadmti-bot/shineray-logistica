<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * FASE 0 — QUEM ASSINA A LIBERAÇÃO DE PEÇAS (GATE 1)
 *
 * O manual do Call Center exige confirmação do Pós-Venda antes de qualquer
 * movimentação física. Três pessoas, do lado que ENVIA, assinam essa liberação.
 *
 * POR QUE UMA COLUNA E NÃO UM PERFIL
 * `users.perfil` é um ENUM de valor único comparado por string literal em 166
 * pontos do backend e do frontend. Criar `pos_venda` tiraria estas três pessoas
 * do perfil que já usam — e com ele o acesso a separar, montar carga, dar
 * entrada e resolver pendência. Cada ponto esquecido viraria um 403 silencioso
 * em quem mais opera o sistema.
 *
 * A pergunta aqui também é outra. `perfil` responde "que parte do sistema você
 * opera"; esta coluna responde "a sua assinatura vale?". É um fato sobre a
 * pessoa, não uma categoria de trabalho, e por isso é ortogonal ao perfil:
 * funciona igual se amanhã o validador for cd, gestor ou admin.
 *
 * O Gate 2 — conferência do romaneio antes do despacho — NÃO usa esta coluna.
 * Ele é da loja que recebe, e o escopo por destino já existe em
 * PecaAtendimentoController::autorizarDestino().
 */
return new class extends Migration
{
    private const VALIDADORES = [
        'logistica@shineraybysabel.com.br',    // Gledson Caetano
        'miltonribeiro@shineraybysabel.com.br', // Milton Ribeiro
        'posvenda03@shineraybysabel.com.br',    // Darlan Chrystian
    ];

    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('valida_pecas')
                  ->default(false)
                  ->after('estoque_local_id');
        });

        $marcados = DB::table('users')
            ->whereIn('email', self::VALIDADORES)
            ->update(['valida_pecas' => true]);

        echo "  → Validadores de peça marcados: {$marcados} de " . count(self::VALIDADORES) . PHP_EOL;

        if ($marcados < count(self::VALIDADORES)) {
            $encontrados = DB::table('users')->whereIn('email', self::VALIDADORES)->pluck('email')->all();
            $faltando = array_diff(self::VALIDADORES, $encontrados);

            echo '  → CONTAS NÃO ENCONTRADAS: ' . implode(', ', $faltando) . PHP_EOL;
            echo '    Crie o usuário e marque valida_pecas na Gestão de Acessos.' . PHP_EOL;
            echo '    Sem ao menos um validador ativo, NENHUM pedido de peça pode ser separado.' . PHP_EOL;
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('valida_pecas');
        });
    }
};
