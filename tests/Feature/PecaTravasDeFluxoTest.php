<?php

namespace Tests\Feature;

use App\Models\Basqueta;
use App\Models\EstoqueLocal;
use App\Models\Peca;
use App\Models\PecaMovimento;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\Romaneio;
use App\Models\RomaneioItem;
use App\Models\User;
use App\Services\Estoque\EstoquePecaService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * As travas do fluxo de peça — os DESVIOS do manual, não o caminho feliz.
 *
 * PecaFluxoCompletoTest percorre o roteiro do manual do começo ao fim, e é por
 * isso que passava verde enquanto três buracos sérios estavam abertos: os
 * problemas não estavam no caminho, estavam nas saídas laterais dele.
 *
 * Cada teste aqui fixa uma trava introduzida na v3.2, e existe para que ela não
 * seja reaberta por conveniência mais adiante. Quando um destes falhar, a
 * pergunta certa é "que regra de negócio mudou?", não "como faço passar?".
 */
class PecaTravasDeFluxoTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private User $validadorPecas;
    private User $operadorCd;
    private User $lojaUser;
    private User $gestor;
    private EstoqueLocal $localCd;
    private EstoqueLocal $localLoja;
    private Peca $peca;

    protected function setUp(): void
    {
        parent::setUp();

        // A conferência do Gate 2 exige a foto do romaneio assinado.
        Storage::fake('public');

        $this->localCd = EstoqueLocal::firstOrCreate(
            ['tipo' => EstoqueLocal::TIPO_CD],
            ['nome' => 'CD Travas', 'slug' => 'cd-travas', 'ativo' => true, 'participa_pecas' => true]
        );

        $this->localLoja = EstoqueLocal::create([
            'nome'            => 'Loja Travas',
            'slug'            => 'loja-travas-' . uniqid(),
            'tipo'            => EstoqueLocal::TIPO_LOJA,
            'participa_pecas' => true,
            'ativo'           => true,
        ]);

        $this->admin = User::factory()->create([
            'email'        => 'admin_travas_' . uniqid() . '@shineray.com.br',
            'perfil'       => 'admin',
            'valida_pecas' => true,
        ]);

        $this->validadorPecas = User::factory()->create([
            'email'        => 'validador_travas_' . uniqid() . '@shineray.com.br',
            'perfil'       => 'gestor',
            'valida_pecas' => true,
        ]);

        $this->gestor = User::factory()->create([
            'email'        => 'gestor_travas_' . uniqid() . '@shineray.com.br',
            'perfil'       => 'gestor',
            'valida_pecas' => false,
        ]);

        $this->operadorCd = User::factory()->create([
            'email'            => 'cd_travas_' . uniqid() . '@shineray.com.br',
            'perfil'           => 'cd',
            'estoque_local_id' => $this->localCd->id,
        ]);

        $this->lojaUser = User::factory()->create([
            'email'            => 'loja_travas_' . uniqid() . '@shineray.com.br',
            'perfil'           => 'loja',
            'filial'           => 'Loja Travas',
            'estoque_local_id' => $this->localLoja->id,
        ]);

        $this->peca = Peca::create([
            'codigo'           => 'SKU-TRAVA-' . uniqid(),
            'descricao'        => 'CORRENTE TRANSMISSAO JET',
            'unidade'          => 'UN',
            'preco_referencia' => 80.00,
            'ativo'            => true,
        ]);
    }

    // ==================================================================
    // ACHADO 01 — a segunda porta para a carga
    // ==================================================================

    /**
     * A tela do pedido não pode despachar peça por fora do Gate 2.
     *
     * Este era o buraco mais grave: `pecas.carga` montava as linhas do romaneio
     * direto do pedido, sem olhar a basqueta. Dava para despachar sem NF e sem
     * a filial ter conferido, e a caixa ficava órfã segurando saldo reservado.
     */
    public function test_embarque_pela_tela_do_pedido_e_recusado_sem_conferencia_da_filial()
    {
        [$pedido, $basqueta] = $this->pedidoSeparadoNaBasqueta();

        // A caixa está separada mas ainda NÃO foi faturada nem conferida.
        $this->assertTrue($basqueta->estaAberta());

        $romaneio = $this->cargaAberta();

        $resposta = $this->actingAs($this->operadorCd)
            ->post(route('pecas.carga', $pedido->id), ['romaneio_id' => $romaneio->id]);

        $resposta->assertSessionHasErrors('geral');

        // Nada entrou na carga, e o pedido não avançou.
        $this->assertSame(0, RomaneioItem::where('romaneio_id', $romaneio->id)->pecas()->count());
        $this->assertSame('separado', $pedido->fresh()->status);
        $this->assertNull($basqueta->fresh()->romaneio_id);
    }

    /**
     * Depois do Gate 2, o mesmo botão funciona — e despacha a caixa inteira.
     *
     * A trava não pode ter virado um bloqueio permanente: o caminho continua
     * existindo, só que agora atrás do portão.
     */
    public function test_embarque_pela_tela_do_pedido_funciona_depois_da_conferencia()
    {
        [$pedido, $basqueta] = $this->pedidoSeparadoNaBasqueta();

        $this->faturarEConferir($basqueta);

        $romaneio = $this->cargaAberta();

        $resposta = $this->actingAs($this->operadorCd)
            ->post(route('pecas.carga', $pedido->id), ['romaneio_id' => $romaneio->id]);

        $resposta->assertSessionHasNoErrors();

        $this->assertSame(1, RomaneioItem::where('romaneio_id', $romaneio->id)->pecas()->count());
        $this->assertSame('aguardando_coleta', $pedido->fresh()->status);

        // A basqueta foi marcada como despachada — não fica órfã.
        $basqueta->refresh();
        $this->assertSame(Basqueta::STATUS_DESPACHADA, $basqueta->status);
        $this->assertSame($romaneio->id, $basqueta->romaneio_id);
    }

    // ==================================================================
    // ACHADO 02 — recebimento duplo
    // ==================================================================

    /**
     * Receber duas vezes não pode transferir o saldo duas vezes.
     *
     * Duplo clique ou retry de rede bastavam para a peça entrar em dobro na
     * loja, com duas pernas de ledger que pareciam legítimas.
     */
    public function test_recebimento_repetido_nao_transfere_saldo_em_dobro()
    {
        [$pedido, $itemCarga] = $this->pedidoEmTransito(quantidade: 4);

        $payload = ['itens' => [['item_id' => $itemCarga->id, 'quantidade' => 4]]];

        $primeira = $this->actingAs($this->lojaUser)->post(route('pecas.receber', $pedido->id), $payload);
        $primeira->assertSessionHasNoErrors();

        $saldoLojaDepoisDaPrimeira = $this->peca->estoqueEm($this->localLoja->id)?->saldo;
        $saldoCdDepoisDaPrimeira   = $this->peca->estoqueEm($this->localCd->id)?->saldo;

        $this->assertSame(4, $saldoLojaDepoisDaPrimeira);

        // Segunda tentativa: o item já está baixado.
        $segunda = $this->actingAs($this->lojaUser)->post(route('pecas.receber', $pedido->id), $payload);
        $segunda->assertSessionHasErrors('geral');

        $this->assertSame(
            $saldoLojaDepoisDaPrimeira,
            $this->peca->estoqueEm($this->localLoja->id)?->saldo,
            'O segundo recebimento não pode ter movido saldo.'
        );
        $this->assertSame(
            $saldoCdDepoisDaPrimeira,
            $this->peca->estoqueEm($this->localCd->id)?->saldo,
            'O CD não pode ter sido baixado duas vezes.'
        );

        // O ledger também não pode ter ganhado uma segunda perna de transferência.
        $transferencias = PecaMovimento::where('peca_id', $this->peca->id)
            ->where('pedido_id', $pedido->id)
            ->where('tipo', PecaMovimento::TIPO_TRANSFERENCIA)
            ->count();

        $this->assertSame(2, $transferencias, 'Esperado exatamente um par saída/entrada no ledger.');
    }

    /**
     * Peça que ainda está no galpão não se recebe.
     *
     * 'carregado' é item na carga mas ainda no CD. Receber aí baixaria
     * mercadoria que nunca foi embarcada.
     */
    public function test_nao_recebe_item_que_ainda_nao_saiu_do_cd()
    {
        [$pedido, $itemCarga] = $this->pedidoEmTransito(quantidade: 3);

        $itemCarga->update(['status' => RomaneioItem::STATUS_CARREGADO]);

        $resposta = $this->actingAs($this->lojaUser)->post(route('pecas.receber', $pedido->id), [
            'itens' => [['item_id' => $itemCarga->id, 'quantidade' => 3]],
        ]);

        $resposta->assertSessionHasErrors('geral');
        $this->assertNull($this->peca->estoqueEm($this->localLoja->id)?->saldo);
        $this->assertNotSame('concluido', $pedido->fresh()->status);
    }

    // ==================================================================
    // ACHADO 03 — conclusão sem recebimento
    // ==================================================================

    /**
     * Um envio que não casa nenhum item não pode encerrar o pedido.
     *
     * A linha de conclusão ficava fora de qualquer condição: bastava postar
     * ids de outro pedido para o pedido sumir das filas de acompanhamento com
     * zero recebimento.
     */
    public function test_recebimento_sem_itens_validos_nao_conclui_o_pedido()
    {
        [$pedido, $itemCarga] = $this->pedidoEmTransito(quantidade: 5);

        // Item de carga que pertence a OUTRO pedido.
        $outro = $this->pedidoEmTransito(quantidade: 2)[1];

        $resposta = $this->actingAs($this->lojaUser)->post(route('pecas.receber', $pedido->id), [
            'itens' => [['item_id' => $outro->id, 'quantidade' => 2]],
        ]);

        $resposta->assertSessionHasErrors('geral');
        $this->assertSame('em_transito', $pedido->fresh()->status);
        $this->assertSame(RomaneioItem::STATUS_EM_TRANSITO, $itemCarga->fresh()->status);
    }

    // ==================================================================
    // ACHADO 04 — as duas assinaturas do Gate 1
    // ==================================================================

    /**
     * Quem identifica o código não assina a própria identificação.
     *
     * O desenho sempre foi dois atos; o que faltava era a garantia de que
     * fossem duas pessoas.
     */
    public function test_validador_nao_libera_item_que_ele_mesmo_identificou()
    {
        $pedido = $this->pedidoSolicitado();
        $item = $pedido->itensPedido->first();

        // O próprio validador identifica o código.
        $this->actingAs($this->validadorPecas)->post(route('pecas.atender', $pedido->id), [
            'itens'  => [['item_id' => $item->id, 'peca_id' => $this->peca->id, 'preco_unitario' => 80.00]],
            'enviar' => true,
        ])->assertSessionHasNoErrors();

        $this->assertSame($this->validadorPecas->id, $item->fresh()->identificado_por);

        // E tenta assinar a própria escolha.
        $resposta = $this->actingAs($this->validadorPecas)
            ->post(route('pecas.liberar', $pedido->id), ['itens' => [$item->id]]);

        $resposta->assertSessionHasErrors('geral');
        $this->assertNull($item->fresh()->confirmado_em, 'O item não pode ter sido liberado.');
    }

    /** Outro validador assina normalmente — a trava é sobre a pessoa, não sobre o item. */
    public function test_outro_validador_libera_o_item_identificado_por_um_colega()
    {
        $pedido = $this->pedidoSolicitado();
        $item = $pedido->itensPedido->first();

        $this->actingAs($this->validadorPecas)->post(route('pecas.atender', $pedido->id), [
            'itens'  => [['item_id' => $item->id, 'peca_id' => $this->peca->id, 'preco_unitario' => 80.00]],
            'enviar' => true,
        ])->assertSessionHasNoErrors();

        $resposta = $this->actingAs($this->admin)
            ->post(route('pecas.liberar', $pedido->id), ['itens' => [$item->id]]);

        $resposta->assertSessionHasNoErrors();
        $this->assertNotNull($item->fresh()->confirmado_em);
    }

    // ==================================================================
    // ACHADO 05 e 06 — quem solicita, e com que destino
    // ==================================================================

    /** Só loja e admin abrem pedido de peça. */
    public function test_cd_e_gestor_nao_abrem_pedido_de_peca()
    {
        foreach ([$this->operadorCd, $this->gestor] as $usuario) {
            $this->actingAs($usuario)
                ->get(route('pecas.solicitar'))
                ->assertForbidden();

            $this->actingAs($usuario)
                ->post(route('pecas.solicitar.store'), [
                    'itens' => [['peca_id' => $this->peca->id, 'quantidade' => 1]],
                ])
                ->assertForbidden();
        }

        $this->actingAs($this->lojaUser)->get(route('pecas.solicitar'))->assertOk();
    }

    /** Loja sem local vinculado não gera pedido órfão: falha antes de gravar. */
    public function test_solicitacao_sem_local_de_estoque_nao_cria_pedido()
    {
        $lojaSemLocal = User::factory()->create([
            'email'            => 'orfa_' . uniqid() . '@shineray.com.br',
            'perfil'           => 'loja',
            'estoque_local_id' => null,
        ]);

        $antes = Pedido::where('tipo_carga', 'peca')->count();

        $resposta = $this->actingAs($lojaSemLocal)->post(route('pecas.solicitar.store'), [
            'itens' => [['peca_id' => $this->peca->id, 'quantidade' => 2]],
        ]);

        $resposta->assertSessionHasErrors('geral');
        $this->assertSame($antes, Pedido::where('tipo_carga', 'peca')->count());
    }

    /** Admin pode solicitar peças indicando a filial de destino. */
    public function test_admin_pode_abrir_pedido_de_pecas_para_filial()
    {
        $adminSemLocal = User::factory()->create([
            'email'            => 'admin_pecas_' . uniqid() . '@shineray.com.br',
            'perfil'           => 'admin',
            'estoque_local_id' => null,
        ]);

        $resposta = $this->actingAs($adminSemLocal)->post(route('pecas.solicitar.store'), [
            'local_destino_id' => $this->localLoja->id,
            'itens'            => [['peca_id' => $this->peca->id, 'quantidade' => 3]],
        ]);

        $resposta->assertSessionHasNoErrors();
        $pedido = Pedido::where('tipo_carga', 'peca')->latest('id')->first();
        $this->assertNotNull($pedido);
        $this->assertSame($this->localLoja->id, $pedido->local_destino_id);
    }

    /** Admin sem estoque_local_id e sem selecionar filial recebe erro descritivo. */
    public function test_admin_sem_selecionar_filial_recebe_erro()
    {
        $adminSemLocal = User::factory()->create([
            'email'            => 'admin_sem_local_' . uniqid() . '@shineray.com.br',
            'perfil'           => 'admin',
            'estoque_local_id' => null,
        ]);

        $resposta = $this->actingAs($adminSemLocal)->post(route('pecas.solicitar.store'), [
            'itens' => [['peca_id' => $this->peca->id, 'quantidade' => 3]],
        ]);

        $resposta->assertSessionHasErrors('geral');
    }

    // ==================================================================
    // ACHADO 09 — quem escreve estoque
    // ==================================================================

    /** Gestor aprova e audita; não movimenta o saldo que audita. */
    public function test_gestor_nao_movimenta_estoque_de_pecas()
    {
        $this->actingAs($this->gestor)
            ->post(route('pecas.estoque.entrada'), [
                'peca_id'    => $this->peca->id,
                'local_id'   => $this->localCd->id,
                'quantidade' => 10,
            ])
            ->assertForbidden();
    }

    /** Loja não empurra saldo para o local de outra filial. */
    public function test_loja_nao_transfere_para_local_de_outra_filial()
    {
        app(EstoquePecaService::class)->darEntrada($this->peca, $this->localLoja->id, 5, 'Entrada de teste');

        $this->actingAs($this->lojaUser)
            ->post(route('pecas.estoque.transferir'), [
                'peca_id'    => $this->peca->id,
                'origem_id'  => $this->localLoja->id,
                'destino_id' => $this->localCd->id,
                'quantidade' => 3,
            ])
            ->assertForbidden();

        $this->assertSame(5, $this->peca->estoqueEm($this->localLoja->id)?->saldo);
    }

    // ==================================================================
    // Apoio
    // ==================================================================

    /** Pedido de peça recém-aberto pela loja, sem código identificado. */
    private function pedidoSolicitado(): Pedido
    {
        $pedido = Pedido::create([
            'user_id'          => $this->lojaUser->id,
            'tipo_carga'       => 'peca',
            'status'           => 'solicitado',
            'local_origem_id'  => $this->localCd->id,
            'local_destino_id' => $this->localLoja->id,
        ]);

        PedidoItem::create([
            'pedido_id'            => $pedido->id,
            'tipo'                 => 'peca',
            'descricao_solicitada' => 'a corrente que arrebentou na JET',
            'quantidade'           => 2,
        ]);

        return $pedido->load('itensPedido');
    }

    /** Pedido já liberado no Gate 1 e separado numa basqueta aberta. */
    private function pedidoSeparadoNaBasqueta(): array
    {
        app(EstoquePecaService::class)->darEntrada($this->peca, $this->localCd->id, 20, 'Entrada de teste');

        $pedido = Pedido::create([
            'user_id'          => $this->lojaUser->id,
            'tipo_carga'       => 'peca',
            'status'           => 'aprovado',
            'local_origem_id'  => $this->localCd->id,
            'local_destino_id' => $this->localLoja->id,
        ]);

        $item = PedidoItem::create([
            'pedido_id'      => $pedido->id,
            'tipo'           => 'peca',
            'peca_id'        => $this->peca->id,
            'quantidade'     => 2,
            'preco_unitario' => 80.00,
            // Gate 1 já assinado por outra pessoa.
            'identificado_por' => $this->operadorCd->id,
            'identificado_em'  => now(),
            'confirmado_por'   => $this->validadorPecas->id,
            'confirmado_em'    => now(),
        ]);

        $this->actingAs($this->operadorCd)->post(route('pecas.separar', $pedido->id), [
            'itens' => [['item_id' => $item->id, 'quantidade' => 2]],
        ])->assertSessionHasNoErrors();

        $basqueta = Basqueta::where('estoque_local_id', $this->localLoja->id)
            ->whereIn('status', Basqueta::ABERTAS)
            ->latest('id')
            ->firstOrFail();

        return [$pedido->fresh()->load('itensPedido'), $basqueta];
    }

    /** Leva a basqueta pelos passos 6 e 7: faturamento e conferência da filial. */
    private function faturarEConferir(Basqueta $basqueta): void
    {
        $this->actingAs($this->operadorCd)
            ->post(route('pecas.basquetas.faturar', $basqueta->id), [
                'numero'  => '00' . random_int(1000, 9999),
                'volumes' => 1,
            ])->assertSessionHasNoErrors();

        $this->actingAs($this->lojaUser)
            ->post(route('pecas.basquetas.conferir', $basqueta->id), [
                'foto' => UploadedFile::fake()->image('romaneio.jpg'),
            ])->assertSessionHasNoErrors();

        $basqueta->refresh();
    }

    /**
     * Pedido cuja carga já saiu do CD: item de romaneio em trânsito e saldo
     * reservado na origem, que é o estado real depois de iniciarTransito.
     *
     * @return array{0: Pedido, 1: RomaneioItem}
     */
    private function pedidoEmTransito(int $quantidade): array
    {
        $servico = app(EstoquePecaService::class);
        $servico->darEntrada($this->peca, $this->localCd->id, $quantidade, 'Entrada de teste');

        $pedido = Pedido::create([
            'user_id'          => $this->lojaUser->id,
            'tipo_carga'       => 'peca',
            'status'           => 'em_transito',
            'local_origem_id'  => $this->localCd->id,
            'local_destino_id' => $this->localLoja->id,
        ]);

        $item = PedidoItem::create([
            'pedido_id'      => $pedido->id,
            'tipo'           => 'peca',
            'peca_id'        => $this->peca->id,
            'quantidade'     => $quantidade,
            'qtd_atribuida'  => $quantidade,
            'preco_unitario' => 80.00,
            'confirmado_em'  => now(),
        ]);

        $servico->reservar($this->peca, $this->localCd->id, $quantidade, $pedido, $item);

        $romaneio = Romaneio::create([
            'user_id'   => $this->admin->id,
            'status'    => 'em_transito',
            'motorista' => 'MOTORISTA TRAVAS',
            'placa'     => 'TRV0001',
            'rota'      => 'ROTA TRAVAS',
            'tipo'      => 'misto',
        ]);

        $itemCarga = RomaneioItem::create([
            'romaneio_id'      => $romaneio->id,
            'pedido_id'        => $pedido->id,
            'pedido_item_id'   => $item->id,
            'itemable_type'    => Peca::class,
            'itemable_id'      => $this->peca->id,
            'quantidade'       => $quantidade,
            'status'           => RomaneioItem::STATUS_EM_TRANSITO,
            'local_destino_id' => $this->localLoja->id,
        ]);

        return [$pedido, $itemCarga];
    }

    private function cargaAberta(): Romaneio
    {
        return Romaneio::create([
            'user_id'   => $this->admin->id,
            'status'    => 'aberto',
            'motorista' => 'MOTORISTA TRAVAS',
            'placa'     => 'TRV0002',
            'rota'      => 'ROTA TRAVAS',
            'tipo'      => 'misto',
        ]);
    }
}
