<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        \Illuminate\Support\Facades\DB::table('notices')->insert([
            'title' => '🚀 Atualização do Sistema: Novos Dashboards e Integração Microwork!',
            'content' => '<p>Confira as novas funcionalidades que adicionamos nesta atualização:</p>' .
                         '<ul>' .
                         '<li><b>Dashboard Executivo (BI):</b> Novo painel interativo de Logística focado no acompanhamento de SLAs e funil de etapas.</li>' .
                         '<li><b>Estoque em Tempo Real (Microwork):</b> Integração direta com a base do CD, mostrando disponibilidade real de motos montadas e desmontadas, separados por status e pátio físico.</li>' .
                         '<li><b>Relatórios de Conferência:</b> Adicionada a função de Impressão Direta na tela de Microwork para auxiliar o CD no processo de conferência com diferentes agrupamentos.</li>' .
                         '<li><b>Novos KPIs:</b> O Dashboard de Lojas/Admin e a tela de Moto receberam contadores fixos para as situações dos veículos em tempo real.</li>' .
                         '<li><b>Padronização Visual:</b> Identidade e ícones repaginados para os menus de Pedidos, Dashboard e Estoque.</li>' .
                         '</ul>' .
                         '<p>Aproveite as novas ferramentas para uma gestão de logística ainda mais apurada!</p>',
            'type' => 'info',
            'is_active' => true,
            'created_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        \Illuminate\Support\Facades\DB::table('notices')
            ->where('title', '🚀 Atualização do Sistema: Novos Dashboards e Integração Microwork!')
            ->delete();
    }
};
