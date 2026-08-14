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
            'title' => '🚀 Atualização Oficial: BySabel Logística v3.0 — Módulo de Peças e Nova Interface',
            'content' => '<p><strong>A versão 3.0 do BySabel Logística acaba de ser lançada com uma grande evolução na plataforma:</strong></p>' .
                         '<ul>' .
                         '<li><b>📦 Novo Módulo de Gestão de Peças:</b> Catálogo completo com mais de 2.380 SKUs sincronizados com o Microwork, classificação de compatibilidade por modelo de moto (JET, JEF, SHI, STORM, FLASH, etc.), pedidos de reposição para lojas e controle de estoque gerenciado no CD.</li>' .
                         '<li><b>📍 Onde Encontrar & Saldos Externos por Empresa:</b> Consulta em tempo real da disponibilidade de peças por empresa do Microwork (CD + Ananindeua, Capanema / Soure / Cametá, etc.) diretamente na listagem do catálogo, facilitando remanejamentos e transferências rápidas.</li>' .
                         '<li><b>🚚 Fluxo Operacional Integrado:</b> Solicitação de peças pelas lojas, separação inteligente pelo CD com reserva automática, inclusão de itens em romaneios de carga e conferência cega/assistida no recebimento.</li>' .
                         '<li><b>🎨 Novo Design System & Navegação Lateral (v3):</b> Nova barra lateral com agrupamento por módulos (Geral, Motos, Peças, Logística, Cadastros), otimizada tanto para desktop quanto para tablets e celulares, além de novos componentes visuais modernos e padronizados.</li>' .
                         '<li><b>🔒 Livro-Razão (Ledger) de Auditoria:</b> Todas as movimentações de peças (entradas, transferências, reservas e ajustes de inventário) são registradas em log auditável com garantia de integridade atômica.</li>' .
                         '</ul>' .
                         '<p>Obrigado pelo empenho de toda a equipe e uma excelente operação a todos! 🚀</p>',
            'type' => 'success',
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
