<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Desativa avisos antigos para não poluir o mural
        DB::table('notices')->where('is_active', true)->update(['is_active' => false]);

        DB::table('notices')->insert([
            'title' => '🔄 Atualização v2.5 — Pátio em Tempo Real, Solicitação Direta e Correções de Cargas',
            'content' => '<p>Confira as novidades desta atualização:</p>' .
                         '<ul>' .
                         '<li><b>📍 Pátio Microwork na Aprovação:</b> Ao analisar um pedido, o Gestor agora visualiza automaticamente o <b>pátio físico de cada moto no CD</b> (Montadas, Desmontadas, Expedição, Avaria, etc.), consultado em tempo real do Microwork. Se o chassi informado pela loja não existir na plataforma, um alerta vermelho aparecerá imediatamente.</li>' .
                         '<li><b>🛒 Solicitação Direta pelo Estoque:</b> As lojas agora podem <b>selecionar motos diretamente na aba de Estoque</b> (Microwork) e prosseguir para a criação do pedido automaticamente, sem precisar digitar manualmente modelo, cor e chassi.</li>' .
                         '<li><b>🔒 CD Bloqueado de Finalizar Pedidos:</b> A equipe do CD <b>não tem mais permissão</b> para finalizar entregas. Apenas a loja de destino pode confirmar o recebimento oficial.</li>' .
                         '<li><b>🐛 Correção de Status de Cargas:</b> Corrigido bug onde cargas apareciam como "Concluídas" na listagem mas permaneciam "Em Trânsito" ao inspecionar. O sistema agora sincroniza corretamente o status do romaneio ao finalizar cada pedido vinculado.</li>' .
                         '<li><b>👁️ Visão de Estoque para Lojas:</b> O estoque exibido no site para as lojas mostra <b>apenas motos montadas e disponíveis</b>. Motos desmontadas, em avaria ou inativadas são visíveis somente para o CD e Administração.</li>' .
                         '</ul>' .
                         '<p>Dúvidas? Use o chat interno ou procure o suporte de TI.</p>',
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
            ->where('title', 'LIKE', '%Atualização v2.5%')
            ->delete();
    }
};
