<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Acrescenta ao aviso da v2.6 a orientação sobre quando usar o botão "Solicitar"
 * da tela de Estoque e quando usar "Nova Solicitação".
 *
 * Atualiza o aviso existente em vez de criar um novo, para não deixar dois
 * banners da mesma versão no mural.
 */
return new class extends Migration
{
    private const MARCADOR = 'Quando usar cada caminho';

    public function up(): void
    {
        $notice = DB::table('notices')
            ->where('title', 'LIKE', '%Atualização v2.6%')
            ->first();

        if (!$notice || str_contains($notice->content, self::MARCADOR)) {
            return; // Aviso ausente ou já atualizado
        }

        $extra = '<p><b>🧭 ' . self::MARCADOR . ':</b></p>' .
                 '<ul>' .
                 '<li><b>Botão "Solicitar" na tela de Estoque:</b> use quando a venda já está fechada e você precisa de <b>um chassi específico</b>. O formulário abre com o motivo travado em <b>"Venda Confirmada (Cliente)"</b>, que é o único motivo que autoriza a loja a reservar um chassi do CD.</li>' .
                 '<li><b>Menu "Nova Solicitação":</b> use para <b>giro e reposição de estoque</b>. Informe apenas <b>modelo + cor + quantidade</b> (ex: 5x NEW JEF VERMELHA) e deixe a escolha dos chassis com a equipe do CD.</li>' .
                 '</ul>';

        DB::table('notices')
            ->where('id', $notice->id)
            ->update([
                'content'    => $notice->content . $extra,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        $notice = DB::table('notices')
            ->where('title', 'LIKE', '%Atualização v2.6%')
            ->first();

        if (!$notice) {
            return;
        }

        $pos = strpos($notice->content, '<p><b>🧭 ' . self::MARCADOR);

        if ($pos !== false) {
            DB::table('notices')
                ->where('id', $notice->id)
                ->update([
                    'content'    => substr($notice->content, 0, $pos),
                    'updated_at' => now(),
                ]);
        }
    }
};
