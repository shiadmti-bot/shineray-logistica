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
            'title' => '🔢 Atualização v2.6 — Pedido por Modelo/Cor e Atribuição de Chassis pelo CD',
            'content' => '<p>Mudança importante por ordem da diretoria, gerência comercial e pós-vendas: <b>as lojas não escolhem mais os chassis do estoque do CD</b>. Essa responsabilidade passa a ser inteiramente da equipe do CD.</p>' .
                         '<ul>' .
                         '<li><b>📦 Pedido por Modelo, Cor e Quantidade:</b> Ao solicitar reposição ao CD, a loja agora escolhe apenas o <b>modelo</b> e a <b>cor</b> (carregados do estoque real do Microwork, com a quantidade disponível ao lado) e informa <b>quantas unidades</b> deseja. Não é mais preciso criar uma linha por moto nem digitar chassi.</li>' .
                         '<li><b>🔗 Chassi ainda obrigatório em dois casos:</b> nas <b>Transferências</b> (a loja já tem a moto fisicamente em mãos) e quando o motivo for <b>"Venda Confirmada (Cliente)"</b>.</li>' .
                         '<li><b>↩️ Devolução foi desativada:</b> O botão "Devolução CD" saiu do sistema. Para devolver uma moto ao CD, use <b>Transferência</b> e escolha <b>"Para a Matriz / CD"</b> no campo de destino. O fluxo e as permissões continuam os mesmos.</li>' .
                         '<li><b>🏭 Atribuição de Chassis (equipe do CD):</b> O pedido chega ao CD como "5x NEW JEF VERMELHA". O CD informa quais chassis físicos está separando, <b>de dois jeitos</b>: (1) dentro da tela do <b>Pedido</b>, na seção "Aguardando definição de chassi"; ou (2) na aba <b>"Atribuir Chassis"</b> da tela de <b>Montagem de Carga</b>, bipando o chassi — o sistema descobre sozinho a qual pedido ele pertence (mesmo modelo e cor, pedido mais antigo primeiro).</li>' .
                         '<li><b>✂️ Saldo em falta:</b> Se a loja pediu 5 e o CD só tem 3, o CD atribui as 3 e <b>encerra o saldo</b> das 2 restantes informando a justificativa. A loja é notificada automaticamente e o pedido segue normalmente com as 3.</li>' .
                         '<li><b>🔒 Novas travas de segurança:</b> Um pedido não pode ser <b>separado</b> nem <b>recebido pela loja</b> enquanto houver motos sem chassi definido. Ou o CD bipa os chassis, ou encerra o saldo em falta.</li>' .
                         '<li><b>📁 Pedidos antigos continuam iguais:</b> Todos os pedidos criados antes desta atualização seguem funcionando exatamente como antes, com os chassis que já foram informados. Nada muda para eles.</li>' .
                         '</ul>' .
                         '<p><b>Dica para o CD:</b> os campos de bipagem aceitam leitor de código de barras — basta clicar no campo e bipar, que o Enter do leitor já confirma.</p>' .
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
            ->where('title', 'LIKE', '%Atualização v2.6%')
            ->delete();
    }
};
