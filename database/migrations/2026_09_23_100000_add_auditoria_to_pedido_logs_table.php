<?php

use App\Enums\EventoPedido;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * V3.6 — A LINHA DO TEMPO PASSA A SER CONSULTÁVEL.
 *
 * `pedido_logs` nasceu com `titulo` + `descricao`: texto livre, montado por
 * interpolação. Serve para MOSTRAR, não para PERGUNTAR. As três perguntas que
 * a operação faz sobre uma rejeição não tinham resposta em SQL:
 *
 *   "quem rejeitou?"  — o nome ia costurado na frase, "... (Por: Fulano)".
 *   "o que foi cortado?" — só como linha de texto com emoji.
 *   "mostre as rejeições" — GestorController::historico filtrava
 *      `titulo LIKE 'Auditoria Comercial%'`, e o título de uma rejeição TOTAL
 *      é "Rejeitado ❌". Ou seja: a tela de histórico de auditoria nunca
 *      mostrou uma rejeição total. Só cortes parciais.
 *
 * Três colunas resolvem as três:
 *
 *   user_id — quem fez, como chave estrangeira e não como substring.
 *   evento  — o QUE aconteceu (App\Enums\EventoPedido). Título é texto de
 *             interface e vai mudar; evento é chave e não muda.
 *   dados   — o payload do que foi desfeito (itens, chassis, motivos), para a
 *             tela renderizar item por item em vez de imprimir um parágrafo.
 *
 * BACKFILL: só classifica os títulos que existiam de fato no código (ver
 * `ucfirst($tipo).' ❌'` em CancelarPedido e 'Auditoria Comercial (Gestor)' em
 * AprovarPedido). O resto fica NULL de propósito — NULL aqui significa "log
 * antigo, não classificado", e não "nada aconteceu". Os filtros novos tratam
 * NULL como legado e caem no título, para não sumir com o histórico.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedido_logs', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('pedido_id')
                  ->constrained('users')->nullOnDelete();

            $table->string('evento', 40)->nullable()->after('titulo');

            $table->json('dados')->nullable()->after('descricao');

            // O histórico do gestor pagina por evento e ordena por data.
            $table->index(['evento', 'created_at']);
        });

        $this->classificarLogsAntigos();
    }

    /**
     * Dá `evento` aos logs que já existiam, a partir dos títulos que o código
     * realmente gravou. Conservador por escolha: o que não casa fica NULL.
     */
    private function classificarLogsAntigos(): void
    {
        // Rejeição e cancelamento diretos: 'Rejeitado ❌' / 'Cancelado ❌'.
        DB::table('pedido_logs')->whereNull('evento')
            ->where('titulo', 'LIKE', 'Rejeitado%')
            ->update(['evento' => EventoPedido::Rejeitado->value]);

        DB::table('pedido_logs')->whereNull('evento')
            ->where(function ($q) {
                $q->where('titulo', 'LIKE', 'Cancelado%')
                  ->orWhere('titulo', 'Pedido Cancelado Automaticamente');
            })
            ->update(['evento' => EventoPedido::Cancelado->value]);

        // 'Auditoria Comercial (Gestor)' é corte parcial OU cancelamento total.
        // Quem decide é a abertura do texto, escrita em AprovarPedido.
        DB::table('pedido_logs')->whereNull('evento')
            ->where('titulo', 'LIKE', 'Auditoria Comercial%')
            ->where('descricao', 'LIKE', '%totalmente cancelado%')
            ->update(['evento' => EventoPedido::Cancelado->value]);

        DB::table('pedido_logs')->whereNull('evento')
            ->where('titulo', 'LIKE', 'Auditoria Comercial%')
            ->update(['evento' => EventoPedido::CortouItens->value]);

        DB::table('pedido_logs')->whereNull('evento')
            ->where('titulo', 'Aprovado')
            ->update(['evento' => EventoPedido::Aprovado->value]);

        DB::table('pedido_logs')->whereNull('evento')
            ->where(function ($q) {
                $q->where('titulo', 'Criado')->orWhere('titulo', 'Entrada no Sistema');
            })
            ->update(['evento' => EventoPedido::Criado->value]);
    }

    public function down(): void
    {
        Schema::table('pedido_logs', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropIndex(['evento', 'created_at']);
            $table->dropColumn(['user_id', 'evento', 'dados']);
        });
    }
};
