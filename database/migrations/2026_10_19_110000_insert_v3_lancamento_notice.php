<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Aviso de lançamento da v3 no mural.
 *
 * Substitui o "🚧 Em Desenvolvimento: v3.0 — Lançamento em Breve!" (14/08),
 * que prometia a solicitação de peças pelas lojas: este diz o que está no ar
 * e deixa claro que os pedidos de peças ainda aguardam o Pós-Venda (módulo
 * desligado em Gestão > Módulos).
 *
 * Só aquele aviso é desativado. Diferente da migration da v3.0, que apagava o
 * mural inteiro, um aviso manual publicado nesse meio-tempo continua no ar.
 */
return new class extends Migration
{
    private const TITULO = '🚀 Chegou a versão 3 do BySabel Logística';

    public function up(): void
    {
        DB::table('notices')
            ->where('is_active', true)
            ->where('title', 'LIKE', '%BySabel Logística v3.0%Lançamento em Breve%')
            ->update(['is_active' => false, 'updated_at' => now()]);

        DB::table('notices')->insert([
            'title' => self::TITULO,
            'content' =>
                '<p><strong>A versão 3 já está no ar para toda a rede.</strong> Veja o que mudou no dia a dia:</p>'

                . '<p><b>🏍️ Pedidos de motos</b></p><ul>'
                . '<li><b>Catálogo completo no pedido:</b> todos os modelos e cores aparecem no formulário, com busca. Modelo sem estoque no CD continua na lista, marcado com saldo zero, e pode ser pedido.</li>'
                . '<li><b>Recusa explicada:</b> pedido rejeitado ou cancelado continua visível, com o motivo, quem recusou e o que foi cortado. A loja vê o aviso na tela inicial por 15 dias.</li>'
                . '<li><b>Corte na aprovação:</b> cortar uma moto ou um item tira exatamente aquela unidade. Se nada sobrar, o pedido é cancelado e a loja é avisada.</li>'
                . '<li><b>Embarque parcial:</b> o pedido mostra todas as cargas em que as motos seguiram.</li>'
                . '<li><b>Linha do tempo do chassi</b> reorganizada em 7 etapas.</li>'
                . '</ul>'

                . '<p><b>🔁 Devoluções de motos (novo)</b></p><ul>'
                . '<li>A loja abre a devolução com checklist e fotos, a diretoria aprova, o CD faz a coleta e confere na chegada. As duas conferências ficam registradas no dossiê da devolução.</li>'
                . '</ul>'

                . '<p><b>🚚 Logística e cargas</b></p><ul>'
                . '<li>Nova mesa de montagem de carga, no padrão visual novo e adaptada ao celular.</li>'
                . '<li>Entrada no CD de devoluções e transbordos direto pela tela da carga, moto a moto ou de uma vez.</li>'
                . '<li>A carga só fecha quando tudo dela foi entregue, e a lista de cargas guarda os filtros de status e data.</li>'
                . '<li>No calendário, viagem pré-agendada (amarela) não conta mais como rota confirmada.</li>'
                . '</ul>'

                . '<p><b>📦 Peças</b></p><ul>'
                . '<li><b>Já disponível:</b> catálogo de peças com compatibilidade por modelo de moto e a consulta "Onde encontrar", com o saldo de cada empresa no Microwork. O CD e as lojas também podem lançar entradas e inventário do estoque de peças.</li>'
                . '<li><b>Os pedidos de peças ainda não estão liberados.</b> O fluxo está pronto e aguarda o alinhamento final com o Pós-Venda. Avisaremos aqui no mural quando abrir.</li>'
                . '</ul>'

                . '<p><b>🧭 Uso e segurança</b></p><ul>'
                . '<li>Menu superior organizado por área: Motos, Peças, Logística e Gestão.</li>'
                . '<li>Cada loja vê apenas os próprios pedidos, conversas e estoque.</li>'
                . '<li>Quando algo não é permitido, o sistema mostra o motivo em vez de uma tela de erro técnica.</li>'
                . '<li>Se a sessão expirar por inatividade, o sistema volta para a tela com um aviso, e é só enviar de novo.</li>'
                . '<li>Tour guiado nas principais telas (botão "?") e manual atualizado em <b>Ajuda</b>.</li>'
                . '</ul>'

                . '<p><b>📊 Gestão</b></p><ul>'
                . '<li>BI com os números de cancelados e a taxa de sucesso corrigidos.</li>'
                . '<li>Cadastro de filiais e nova tela de usuários.</li>'
                . '</ul>'

                . '<p>Viu algo estranho ou ficou com dúvida? Fale com a TI.</p>',
            'type' => 'success',
            'is_active' => true,
            // Mesmo cuidado da migration da v3.0: resolver o autor em vez de
            // assumir um id fixo, para o schema subir do zero em qualquer engine.
            'created_by' => DB::table('users')->where('perfil', 'admin')->orderBy('id')->value('id'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('notices')->where('title', self::TITULO)->delete();

        DB::table('notices')
            ->where('title', 'LIKE', '%BySabel Logística v3.0%Lançamento em Breve%')
            ->update(['is_active' => true, 'updated_at' => now()]);
    }
};
