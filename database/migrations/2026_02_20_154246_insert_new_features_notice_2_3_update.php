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
            /*
             * Autor do aviso: o usuário 1 SE ele existir.
             *
             * Era `1` fixo. No TiDB Serverless a foreign key não barrava o
             * insert com a tabela users vazia, então passava despercebido; num
             * engine que valida FK de verdade, `migrate:fresh` quebra aqui — e
             * o schema não sobe do zero. Resolver a referência em vez de
             * assumi-la faz a migration valer em qualquer engine.
             */
            'created_by' => \Illuminate\Support\Facades\DB::table('users')->where('id', 1)->value('id'),
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
