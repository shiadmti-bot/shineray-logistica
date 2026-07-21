<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sincroniza no mural a alteração de texto feita no commit b342a54.
 *
 * Aquele commit editou a migration 2026_07_21_100100, que já havia rodado —
 * então o texto novo nunca chegou ao aviso publicado. Migrations executadas
 * não rodam de novo; alterar o conteúdo exige um UPDATE explícito como este.
 */
return new class extends Migration
{
    private const TEXTO_ANTIGO = 'Mudança importante solicitada pela diretoria e pelo pós-vendas:';
    private const TEXTO_NOVO   = 'Mudança importante por ordem da diretoria, gerência comercial e pós-vendas:';

    public function up(): void
    {
        $notice = DB::table('notices')
            ->where('title', 'LIKE', '%Atualização v2.6%')
            ->first();

        if (!$notice || !str_contains($notice->content, self::TEXTO_ANTIGO)) {
            return; // Aviso ausente ou já sincronizado
        }

        DB::table('notices')
            ->where('id', $notice->id)
            ->update([
                'content'    => str_replace(self::TEXTO_ANTIGO, self::TEXTO_NOVO, $notice->content),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        $notice = DB::table('notices')
            ->where('title', 'LIKE', '%Atualização v2.6%')
            ->first();

        if (!$notice || !str_contains($notice->content, self::TEXTO_NOVO)) {
            return;
        }

        DB::table('notices')
            ->where('id', $notice->id)
            ->update([
                'content'    => str_replace(self::TEXTO_NOVO, self::TEXTO_ANTIGO, $notice->content),
                'updated_at' => now(),
            ]);
    }
};
