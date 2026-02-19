<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('notices')->insert([
            'title' => '🚀 Sistema Atualizado v2.2',
            'content' => '
                <ul class="list-disc pl-5">
                    <li><strong>Mural de Avisos Renovado:</strong> Agora recolhido por padrão com notificações de novidades.</li>
                    <li><strong>Logística Reversa (Devolução ao CD):</strong> Novo fluxo para devolução de motos ao Centro de Distribuição.</li>
                    <li><strong>Visual Polido:</strong> Ícones padronizados e interface mais limpa.</li>
                    <li><strong>Melhorias de Performance:</strong> Otimizações no carregamento do dashboard.</li>
                </ul>
                <p class="mt-2 text-sm">Para dúvidas, consulte o Manual ou entre em contato com o suporte.</p>
            ',
            'type' => 'success',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('notices')->where('title', '🚀 Sistema Atualizado v2.2')->delete();
    }
};
