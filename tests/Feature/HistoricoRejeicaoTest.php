<?php

namespace Tests\Feature;

use App\Enums\EventoPedido;
use App\Models\Moto;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\PedidoLog;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * O histórico de uma recusa: por quê, por quem, quando e o que se perdeu.
 *
 * O QUE ESTA SUÍTE FIXA. Até a v3.6 o sistema apagava o rastro da recusa por
 * quatro caminhos independentes, e nenhum deles era erro visível — cada um
 * devolvia uma tela plausível com a informação ausente:
 *
 *   1. `pedidos.motivo_rejeicao` era gravado em toda recusa e lido por NENHUMA
 *      tela do sistema. Coluna fantasma desde 26/12/2025.
 *   2. O pedido recusado é soft-deleted, e a listagem não usava `withTrashed`.
 *      O filtro "Cancelado" da tela existia e sempre devolvia zero linhas.
 *   3. `show` fazia `findOrFail` e dava 404 num pedido recusado — então o link
 *      da notificação "Pedido #X rejeitado: <motivo>" levava a uma tela de erro.
 *   4. O histórico de auditoria filtrava `titulo LIKE 'Auditoria Comercial%'`,
 *      e o título de uma rejeição TOTAL é "Rejeitado ❌": a tela de auditoria
 *      nunca mostrou uma rejeição total em toda a sua existência.
 *
 * Cada teste aqui morre se um desses caminhos for reaberto.
 */
class HistoricoRejeicaoTest extends TestCase
{
    use DatabaseTransactions;

    private User $gestor;
    private User $loja;
    private User $outraLoja;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Http::fake();

        $this->gestor    = $this->usuario('gestor', ['valida_motos' => true]);
        $this->loja      = $this->usuario('loja', ['filial' => 'Loja Recusa Destino']);
        $this->outraLoja = $this->usuario('loja', ['filial' => 'Loja Recusa Alheia']);
    }

    // ------------------------------------------------------------------
    // O REGISTRO
    // ------------------------------------------------------------------

    /** Autor, motivo e data ficam em COLUNA, não dentro de uma frase. */
    public function test_rejeicao_grava_autor_motivo_e_data_no_pedido()
    {
        $pedido = $this->pedidoEmAnalise();

        $this->actingAs($this->gestor)
            ->post(route('gestor.rejeitar', $pedido->id), ['justificativa' => 'Crédito da filial suspenso'])
            ->assertRedirect(route('gestor.index'));

        $recusado = Pedido::withTrashed()->findOrFail($pedido->id);

        $this->assertSame('rejeitado', $recusado->status);
        $this->assertSame('Crédito da filial suspenso', $recusado->motivo_rejeicao);
        $this->assertSame($this->gestor->id, (int) $recusado->rejeitado_por);
        $this->assertNotNull($recusado->rejeitado_em);
        $this->assertNotNull($recusado->deleted_at);
    }

    /** O log de recusa é consultável por evento e por autor, não por título. */
    public function test_rejeicao_grava_log_consultavel_por_evento_e_por_autor()
    {
        $pedido = $this->pedidoEmAnalise();

        $this->actingAs($this->gestor)
            ->post(route('gestor.rejeitar', $pedido->id), ['justificativa' => 'Sem crédito']);

        $log = PedidoLog::where('pedido_id', $pedido->id)
            ->where('evento', EventoPedido::Rejeitado->value)
            ->sole();

        $this->assertSame($this->gestor->id, (int) $log->user_id);
        $this->assertSame($this->gestor->name, $log->autor->name);
        $this->assertSame('Sem crédito', $log->dados['motivo']);
    }

    /**
     * O inventário do que havia no pedido é fotografado no log.
     *
     * Precisa ser fotografia e não JOIN: no corte, a moto sem outro pedido tem
     * o cadastro APAGADO (regra confirmada com a operação em 14/09/2026), então
     * uma consulta feita depois não encontra mais a linha.
     */
    public function test_log_de_recusa_guarda_o_inventario_do_que_havia_no_pedido()
    {
        $pedido = $this->pedidoEmAnalise();
        $moto   = $this->moto();
        $pedido->motos()->attach($moto->id, ['destino' => 'LOJA RECUSA DESTINO']);

        $this->actingAs($this->gestor)
            ->post(route('gestor.rejeitar', $pedido->id), ['justificativa' => 'Modelo errado']);

        $dados = PedidoLog::where('pedido_id', $pedido->id)
            ->where('evento', EventoPedido::Rejeitado->value)
            ->sole()
            ->dados;

        $this->assertSame('moto', $dados['tipo_carga']);
        $this->assertCount(2, $dados['conteudo'], 'a moto anexada e a cota genérica pendente');

        $chassis = array_column($dados['conteudo'], 'chassi');
        $this->assertContains($moto->chassi, $chassis);
    }

    // ------------------------------------------------------------------
    // A VISIBILIDADE
    // ------------------------------------------------------------------

    /**
     * O pedido recusado não desaparece da listagem.
     *
     * O filtro de status da tela oferecia "Cancelado" desde sempre e SEMPRE
     * devolvia lista vazia, porque a query não tinha withTrashed.
     */
    public function test_pedido_rejeitado_continua_na_listagem_e_o_filtro_o_encontra()
    {
        $pedido = $this->pedidoEmAnalise();

        $this->actingAs($this->gestor)
            ->post(route('gestor.rejeitar', $pedido->id), ['justificativa' => 'Fora de política']);

        $this->actingAs($this->loja)
            ->get(route('pedidos.index', ['status' => 'rejeitado']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('pedidos.data.0.id', $pedido->id)
                ->where('pedidos.data.0.status', 'rejeitado')
                ->where('pedidos.data.0.motivo_rejeicao', 'Fora de política')
            );
    }

    /** O link da notificação de rejeição abre o pedido, em vez de 404. */
    public function test_pedido_rejeitado_abre_com_o_dossie_da_recusa()
    {
        $pedido = $this->pedidoEmAnalise();

        $this->actingAs($this->gestor)
            ->post(route('gestor.rejeitar', $pedido->id), ['justificativa' => 'Duplicidade de pedido']);

        $this->actingAs($this->loja)
            ->get(route('pedidos.show', $pedido->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('recusa.tipo', 'rejeitado')
                ->where('recusa.motivo', 'Duplicidade de pedido')
                ->where('recusa.autor', $this->gestor->name)
            );
    }

    /** Pedido ativo não recebe dossiê nenhum: a tela não muda. */
    public function test_pedido_ativo_nao_tem_dossie_de_recusa()
    {
        $pedido = $this->pedidoEmAnalise();

        $this->actingAs($this->loja)
            ->get(route('pedidos.show', $pedido->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->where('recusa', null));
    }

    /**
     * A policy continua valendo depois do soft delete.
     *
     * withTrashed alarga o que a query encontra, não quem pode ver: sem esta
     * garantia, abrir a consulta de recusas teria aberto o pedido de outra
     * filial junto.
     */
    public function test_loja_de_outra_filial_nao_abre_pedido_rejeitado()
    {
        $pedido = $this->pedidoEmAnalise();

        $this->actingAs($this->gestor)
            ->post(route('gestor.rejeitar', $pedido->id), ['justificativa' => 'Qualquer motivo']);

        $this->actingAs($this->outraLoja)
            ->get(route('pedidos.show', $pedido->id))
            ->assertForbidden();
    }

    // ------------------------------------------------------------------
    // O HISTÓRICO DE AUDITORIA
    // ------------------------------------------------------------------

    /**
     * O BUG PRINCIPAL. A tela de auditoria filtrava por título, e o título de
     * uma rejeição total ("Rejeitado ❌") nunca casava com 'Auditoria
     * Comercial%'. Um gestor podia rejeitar o pedido inteiro e isso não
     * aparecia em relatório algum.
     */
    public function test_historico_do_gestor_mostra_rejeicao_total()
    {
        $pedido = $this->pedidoEmAnalise();

        $this->actingAs($this->gestor)
            ->post(route('gestor.rejeitar', $pedido->id), ['justificativa' => 'Limite de crédito']);

        $this->actingAs($this->gestor)
            ->get(route('gestor.historico'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('logs.data.0.pedido_id', $pedido->id)
                ->where('logs.data.0.evento', EventoPedido::Rejeitado->value)
                ->where('logs.data.0.autor.name', $this->gestor->name)
            );
    }

    /** O filtro por tipo separa rejeição total de corte parcial. */
    public function test_historico_filtra_por_tipo_de_recusa()
    {
        $rejeitado = $this->pedidoEmAnalise();

        $this->actingAs($this->gestor)
            ->post(route('gestor.rejeitar', $rejeitado->id), ['justificativa' => 'Recusa integral']);

        $this->actingAs($this->gestor)
            ->get(route('gestor.historico', ['evento' => EventoPedido::CortouItens->value]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->count('logs.data', 0));

        $this->actingAs($this->gestor)
            ->get(route('gestor.historico', ['evento' => EventoPedido::Rejeitado->value]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page->count('logs.data', 1));
    }

    /**
     * Log anterior à v3.6 (evento NULL) continua no histórico.
     *
     * Sem isto, ligar a coluna nova teria esvaziado o relatório de tudo que
     * aconteceu antes da migration.
     */
    public function test_historico_ainda_encontra_log_legado_sem_evento()
    {
        $pedido = $this->pedidoEmAnalise();

        PedidoLog::create([
            'pedido_id' => $pedido->id,
            'titulo'    => 'Auditoria Comercial (Gestor)',
            'descricao' => '❌ Pedido totalmente cancelado por Gestor Antigo.',
            // 'evento' ausente de propósito: é o formato pré-v3.6.
        ]);

        $this->actingAs($this->gestor)
            ->get(route('gestor.historico'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('logs.data.0.pedido_id', $pedido->id)
                ->where('logs.data.0.evento', null)
            );
    }

    // ------------------------------------------------------------------
    // O CORTE PARCIAL
    // ------------------------------------------------------------------

    /**
     * A cota cortada sobrevive, com o motivo ao lado.
     *
     * Antes o corte fazia hard delete numa tabela sem soft delete: a linha
     * "5x JET 50 PRETA" deixava de existir e o que a loja pediu só sobrava como
     * frase no log. Pior: `pedido_moto.pedido_item_id` é nullOnDelete, então o
     * apagamento arrancava o vínculo dos chassis já atribuídos àquela cota.
     */
    public function test_corte_parcial_preserva_a_cota_cortada_com_o_motivo()
    {
        $pedido = $this->pedidoEmAnalise();
        $cortada = $pedido->itensPedido()->sole();

        // Uma segunda cota, para o pedido não ficar vazio e ser cancelado.
        $sobrevivente = PedidoItem::create([
            'pedido_id'  => $pedido->id,
            'tipo'       => 'moto',
            'modelo'     => 'JEF 170',
            'cor'        => 'AZUL',
            'quantidade' => 1,
        ]);

        $this->actingAs($this->gestor)
            ->post(route('gestor.aprovar', $pedido->id), [
                'itens_rejeitados' => [$cortada->id],
                'motivos'          => ['item_' . $cortada->id => 'Modelo descontinuado'],
            ])
            ->assertSessionHasNoErrors();

        // Fora das consultas normais, exatamente como o hard delete fazia.
        $this->assertFalse($pedido->itensPedido()->whereKey($cortada->id)->exists());

        // Mas recuperável, e agora com o motivo em coluna.
        $preservada = PedidoItem::withTrashed()->findOrFail($cortada->id);

        $this->assertNotNull($preservada->deleted_at);
        $this->assertSame('Modelo descontinuado', $preservada->motivo_cancelamento);
        $this->assertSame($this->gestor->id, (int) $preservada->cancelado_por);
        $this->assertNotNull($preservada->cancelado_em);

        $this->assertTrue($pedido->itensPedido()->whereKey($sobrevivente->id)->exists());
    }

    /** O corte parcial entra no histórico como corte, não como rejeição. */
    public function test_corte_parcial_registra_evento_proprio_com_os_itens_em_dados()
    {
        $pedido = $this->pedidoEmAnalise();
        $cortada = $pedido->itensPedido()->sole();

        PedidoItem::create([
            'pedido_id'  => $pedido->id,
            'tipo'       => 'moto',
            'modelo'     => 'JEF 170',
            'cor'        => 'AZUL',
            'quantidade' => 1,
        ]);

        $this->actingAs($this->gestor)
            ->post(route('gestor.aprovar', $pedido->id), [
                'itens_rejeitados' => [$cortada->id],
                'motivos'          => ['item_' . $cortada->id => 'Sem estoque na fábrica'],
                'justificativa'    => 'Reduzido conforme disponibilidade',
            ])
            ->assertSessionHasNoErrors();

        $log = PedidoLog::where('pedido_id', $pedido->id)
            ->where('evento', EventoPedido::CortouItens->value)
            ->sole();

        $this->assertSame($this->gestor->id, (int) $log->user_id);
        $this->assertSame('Reduzido conforme disponibilidade', $log->dados['justificativa']);
        $this->assertFalse($log->dados['integral']);
        $this->assertCount(1, $log->dados['cortes']);
        $this->assertSame('Sem estoque na fábrica', $log->dados['cortes'][0]['motivo']);
        $this->assertSame('cota', $log->dados['cortes'][0]['tipo']);

        // O texto que a tela mostra sai dos MESMOS registros.
        $this->assertStringContainsString('Sem estoque na fábrica', $log->descricao);
    }

    /** A cota cortada aparece no dossiê do pedido recusado por inteiro. */
    public function test_dossie_lista_as_cotas_cortadas_quando_o_corte_esvazia_o_pedido()
    {
        $pedido = $this->pedidoEmAnalise();
        $cortada = $pedido->itensPedido()->sole();

        $this->actingAs($this->gestor)
            ->post(route('gestor.aprovar', $pedido->id), [
                'itens_rejeitados' => [$cortada->id],
                'motivos'          => ['item_' . $cortada->id => 'Linha encerrada'],
            ]);

        $this->assertSame('cancelado', Pedido::withTrashed()->findOrFail($pedido->id)->status);

        $this->actingAs($this->loja)
            ->get(route('pedidos.show', $pedido->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('recusa.tipo', 'cancelado')
                ->where('recusa.cortes.0.motivo', 'Linha encerrada')
                ->where('recusa.cortes.0.quantidade', 2)
            );
    }

    // ------------------------------------------------------------------
    // HELPERS
    // ------------------------------------------------------------------

    private function pedidoEmAnalise(): Pedido
    {
        $pedido = Pedido::create([
            'user_id'    => $this->loja->id,
            'status'     => 'em_analise',
            'tipo_carga' => 'moto',
        ]);

        PedidoItem::create([
            'pedido_id'  => $pedido->id,
            'tipo'       => 'moto',
            'modelo'     => 'JET 50',
            'cor'        => 'PRETA',
            'quantidade' => 2,
        ]);

        return $pedido->fresh();
    }

    private function moto(): Moto
    {
        return Moto::create([
            'chassi' => '9C2RECUSA' . random_int(100000, 999999),
            'modelo' => 'JET 50',
            'cor'    => 'PRETA',
            'status' => 'estoque_fabrica',
        ]);
    }

    private function usuario(string $perfil, array $extra = []): User
    {
        return User::factory()->create([
            'email'  => "recusa_{$perfil}_" . uniqid() . '@shineray.com.br',
            'perfil' => $perfil,
            ...$extra,
        ]);
    }
}
