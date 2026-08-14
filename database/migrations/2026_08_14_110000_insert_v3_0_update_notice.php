<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Desativa avisos antigos para manter o mural focado no lançamento da v3.0
        DB::table('notices')->where('is_active', true)->update(['is_active' => false]);

        DB::table('notices')->insert([
            'title' => '🚧 Em Desenvolvimento: BySabel Logística v3.0 — Lançamento em Breve!',
            'content' => '<p><strong>A versão 3.0 do BySabel Logística está em fase final de desenvolvimento e será lançada em breve para toda a rede!</strong></p>' .
                         '<p>Confira uma prévia das novidades e recursos que estão chegando:</p>' .
                         '<ul>' .
                         '<li><b>📦 Novo Módulo de Gestão de Peças:</b> Catálogo completo com mais de 2.380 SKUs sincronizados com o Microwork, classificação de compatibilidade por modelo de moto (JET, JEF, SHI, STORM, FLASH, etc.), pedidos de reposição para lojas e controle de estoque gerenciado no CD.</li>' .
                         '<li><b>📍 Onde Encontrar & Saldos Externos por Empresa:</b> Consulta em tempo real da disponibilidade de peças por empresa do Microwork (CD + Ananindeua, Capanema, Soure, Cametá, etc.) diretamente no catálogo, facilitando remanejamentos e transferências rápidas.</li>' .
                         '<li><b>🚚 Fluxo Operacional Integrado:</b> Solicitação de peças pelas lojas, separação inteligente pelo CD com reserva automática, inclusão de itens em romaneios de carga e conferência cega/assistida no recebimento.</li>' .
                         '<li><b>🎨 Nova Interface & Atalhos na Top Bar:</b> Atalhos diretos no menu superior e no Dashboard para solicitar peças e consultar estoques com apenas um clique, tanto no computador quanto no celular.</li>' .
                         '<li><b>🔒 Livro-Razão (Ledger) de Auditoria:</b> Todas as movimentações de peças (entradas, transferências, reservas e inventário) são registradas em log auditável com garantia de integridade.</li>' .
                         '</ul>' .
                         '<p>Fique atento ao mural para o anúncio da data oficial de liberação da versão 3.0! 🚀</p>',
            'type' => 'info',
            'is_active' => true,
            'created_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('notices')
            ->where('title', 'LIKE', '%BySabel Logística v3.0%')
            ->delete();
    }
};
