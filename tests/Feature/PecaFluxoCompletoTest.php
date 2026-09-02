<?php

namespace Tests\Feature;

use App\Models\Basqueta;
use App\Models\EstoqueLocal;
use App\Models\Peca;
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

class PecaFluxoCompletoTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private User $validadorPecas;
    private User $gestorMotos;
    private User $operadorCd;
    private User $lojaUser;
    private EstoqueLocal $localCd;
    private EstoqueLocal $localLoja;
    private Peca $pecaA;
    private Peca $pecaB;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');

        // Locais de estoque
        $this->localCd = EstoqueLocal::firstOrCreate(
            ['tipo' => EstoqueLocal::TIPO_CD],
            ['nome' => 'CD Ananindeua Teste', 'slug' => 'cd-ananindeua-teste', 'ativo' => true, 'participa_pecas' => true]
        );

        $this->localLoja = EstoqueLocal::create([
            'nome'            => 'Loja Santarém/PA Teste',
            'slug'            => 'loja-santarem-teste-' . uniqid(),
            'tipo'            => EstoqueLocal::TIPO_LOJA,
            'participa_pecas' => true,
            'ativo'           => true,
        ]);

        // Usuários com papéis independentes
        $this->admin = User::factory()->create([
            'name'         => 'Admin Peças',
            'email'        => 'admin_pecas_' . uniqid() . '@shineray.com.br',
            'perfil'       => 'admin',
            'valida_pecas' => true,
            'valida_motos' => true,
        ]);

        $this->validadorPecas = User::factory()->create([
            'name'         => 'Validador Pós-Venda (Gate 1)',
            'email'        => 'posvenda_gate1_' . uniqid() . '@shineray.com.br',
            'perfil'       => 'gestor',
            'valida_pecas' => true,
            'valida_motos' => false,
        ]);

        $this->gestorMotos = User::factory()->create([
            'name'         => 'Gestor Comercial de Motos',
            'email'        => 'gestor_motos_' . uniqid() . '@shineray.com.br',
            'perfil'       => 'gestor',
            'valida_pecas' => false,
            'valida_motos' => true,
        ]);

        $this->operadorCd = User::factory()->create([
            'name'             => 'Operador CD Peças',
            'email'            => 'op_cd_' . uniqid() . '@shineray.com.br',
            'perfil'           => 'cd',
            'estoque_local_id' => $this->localCd->id,
            'valida_pecas'     => false,
            'valida_motos'     => false,
        ]);

        $this->lojaUser = User::factory()->create([
            'name'             => 'Loja Santarém',
            'email'            => 'loja_santarem_' . uniqid() . '@shineray.com.br',
            'perfil'           => 'loja',
            'filial'           => 'Loja Santarém/PA',
            'estoque_local_id' => $this->localLoja->id,
        ]);

        // Peças de teste
        $this->pecaA = Peca::create([
            'codigo'           => 'SKU-A-' . uniqid(),
            'descricao'        => 'PASTILHA FREIO DIANT JET',
            'unidade'          => 'UN',
            'preco_referencia' => 50.00,
            'ativo'            => true,
        ]);

        $this->pecaB = Peca::create([
            'codigo'           => 'SKU-B-' . uniqid(),
            'descricao'        => 'FILTRO OLEO SHI 175',
            'unidade'          => 'UN',
            'preco_referencia' => 25.00,
            'ativo'            => true,
        ]);
    }

    /**
     * Teste End-to-End: Ciclo completo do pedido de peças
     * Solicitação -> Atendimento -> Gate 1 -> Separação -> Basqueta -> Faturamento -> Gate 2 -> Romaneio -> Recebimento
     */
    public function test_ciclo_completo_pedido_pecas_solicitacao_ate_recebimento()
    {
        // 1. SOLICITAÇÃO (Pela Loja)
        // 1 item com código direto e 1 item sem código (descrição solicitada de balcão)
        $responseSolicitar = $this->actingAs($this->lojaUser)->post(route('pecas.solicitar.store'), [
            'itens' => [
                [
                    'peca_id'              => $this->pecaA->id,
                    'quantidade'           => 4,
                    'motivo'               => 'Reposição balcão',
                ],
                [
                    'descricao_solicitada' => 'Filtro de óleo para motor 175cc',
                    'quantidade'           => 2,
                    'motivo'               => 'Cliente aguardando na oficina',
                ],
            ],
            'observacao' => 'Pedido urgente para o próximo caminhão',
        ]);

        $responseSolicitar->assertSessionHasNoErrors();
        $pedido = Pedido::where('user_id', $this->lojaUser->id)->latest()->first();

        $this->assertNotNull($pedido);
        $this->assertEquals('peca', $pedido->tipo_carga);
        $this->assertEquals('solicitado', $pedido->status);
        $this->assertEquals(2, $pedido->itensPedido()->count());

        $itemSemCodigo = $pedido->itensPedido()->whereNull('peca_id')->first();
        $this->assertNotNull($itemSemCodigo);
        $this->assertFalse($itemSemCodigo->isIdentificada());

        // 2. ATENDIMENTO NO CALL CENTER (Operador CD identifica SKU e preço)
        $responseAtender = $this->actingAs($this->operadorCd)->post(route('pecas.atender', $pedido->id), [
            'itens' => [
                [
                    'item_id'        => $itemSemCodigo->id,
                    'peca_id'        => $this->pecaB->id,
                    'preco_unitario' => 25.00,
                    'quantidade'     => 2,
                ],
            ],
            'enviar' => true, // Envia para liberação do Pós-Venda
        ]);

        $responseAtender->assertSessionHasNoErrors();
        $pedido->refresh();
        $itemSemCodigo->refresh();

        $this->assertEquals('aguardando_confirmacao', $pedido->status);
        $this->assertTrue($itemSemCodigo->isIdentificada());
        $this->assertEquals($this->pecaB->id, $itemSemCodigo->peca_id);

        // 3. TRAVA GATE 1: Gestor de motos NÃO pode liberar peças (403)
        $responseBloqueio = $this->actingAs($this->gestorMotos)->post(route('pecas.liberar', $pedido->id), [
            'itens' => [$itemSemCodigo->id],
        ]);
        $responseBloqueio->assertStatus(403);

        // Trava de separação: CD NÃO pode separar itens ainda não liberados pelo Gate 1
        $responseSepararBloqueado = $this->actingAs($this->operadorCd)->post(route('pecas.separar', $pedido->id), [
            'itens' => [
                ['item_id' => $itemSemCodigo->id, 'quantidade' => 2],
            ],
        ]);
        $responseSepararBloqueado->assertSessionHasErrors('geral');

        // 4. APROVAÇÃO GATE 1: Validador de Pós-Venda assina e aprova
        $todosItensIds = $pedido->itensPedido()->pluck('id')->all();
        $responseLiberar = $this->actingAs($this->validadorPecas)->post(route('pecas.liberar', $pedido->id), [
            'itens' => $todosItensIds,
        ]);

        $responseLiberar->assertSessionHasNoErrors();
        $pedido->refresh();
        $this->assertEquals('aprovado', $pedido->status);

        // 5. SEPARAÇÃO NO CD E ALOCAÇÃO NA BASQUETA
        // Dá entrada inicial de estoque no CD para permitir a reserva
        $servicoEstoque = app(EstoquePecaService::class);
        $servicoEstoque->darEntrada($this->pecaA, $this->localCd->id, 10, 'Entrada de fornecedor');
        $servicoEstoque->darEntrada($this->pecaB, $this->localCd->id, 10, 'Entrada de fornecedor');

        $itensSeparacao = $pedido->itensPedido->map(fn ($it) => [
            'item_id'    => $it->id,
            'quantidade' => $it->quantidade,
        ])->all();

        $responseSeparar = $this->actingAs($this->operadorCd)->post(route('pecas.separar', $pedido->id), [
            'itens' => $itensSeparacao,
        ]);

        $responseSeparar->assertSessionHasNoErrors();
        $pedido->refresh();
        $this->assertEquals('separado', $pedido->status);

        // Verifica saldo reservado no CD
        $this->assertEquals(4, $this->pecaA->estoqueEm($this->localCd->id)?->saldo_reservado);
        $this->assertEquals(2, $this->pecaB->estoqueEm($this->localCd->id)?->saldo_reservado);

        // Verifica basqueta aberta vinculada
        $basqueta = Basqueta::where('estoque_local_id', $this->localLoja->id)
            ->where('status', Basqueta::STATUS_ABERTA)
            ->first();

        $this->assertNotNull($basqueta);
        $this->assertEquals(6, $basqueta->totalUnidades());

        // 6. FATURAMENTO DA BASQUETA (CD emite NF e anexa volumes)
        $responseFaturar = $this->actingAs($this->operadorCd)->post(route('pecas.basquetas.faturar', $basqueta->id), [
            'numero'      => 'NF-998877',
            'serie'       => '1',
            'chave'       => str_repeat('3', 44),
            'volumes'     => 1,
            'valor_total' => 250.00,
        ]);

        $responseFaturar->assertSessionHasNoErrors();
        $basqueta->refresh();
        $this->assertEquals(Basqueta::STATUS_FATURADA, $basqueta->status);

        // 7. TRAVA DO GATE 2 NO EMBARQUE
        // Tentar embarcar basqueta faturada (mas ainda não liberada no Gate 2)
        $responseEmbarqueBloqueado = $this->actingAs($this->operadorCd)->post(route('romaneios.store'), [
            'motorista'     => 'Carlos Motorista',
            'placa'         => 'ABC1D23',
            'rota_nome'     => 'ROTA OESTE',
            'basquetas_ids' => [$basqueta->id],
        ]);

        // O romaneio é salvo mas a basqueta NÃO foi embarcada porque não está STATUS_LIBERADA
        $basqueta->refresh();
        $this->assertNull($basqueta->romaneio_id);
        $this->assertEquals(Basqueta::STATUS_FATURADA, $basqueta->status);

        // 8. GATE 2: CONFERÊNCIA DA LOJA COM COMPROVANTE
        $fotoRomaneio = UploadedFile::fake()->image('romaneio_assinado.jpg', 600, 600);
        $responseConferir = $this->actingAs($this->lojaUser)->post(route('pecas.basquetas.conferir', $basqueta->id), [
            'foto'       => $fotoRomaneio,
            'observacao' => 'Conferido com sucesso na filial',
        ]);

        $responseConferir->assertSessionHasNoErrors();
        $basqueta->refresh();
        $this->assertEquals(Basqueta::STATUS_LIBERADA, $basqueta->status);
        $this->assertNotNull($basqueta->conferida_em);

        // 9. EMBARQUE NA CARGA APÓS LIBERAÇÃO DO GATE 2
        $responseCarga = $this->actingAs($this->operadorCd)->post(route('romaneios.store'), [
            'motorista'     => 'Carlos Motorista',
            'placa'         => 'ABC1D23',
            'rota_nome'     => 'ROTA OESTE',
            'basquetas_ids' => [$basqueta->id],
        ]);

        $responseCarga->assertSessionHasNoErrors();
        $basqueta->refresh();
        $this->assertEquals(Basqueta::STATUS_DESPACHADA, $basqueta->status);
        $this->assertNotNull($basqueta->romaneio_id);

        $romaneio = $basqueta->romaneio;
        $this->assertNotNull($romaneio);

        // Inicia saída para entrega (Carga em Trânsito)
        $responseSaida = $this->actingAs($this->operadorCd)->post(route('romaneios.saida', $romaneio->id));
        $responseSaida->assertSessionHasNoErrors();

        $pedido->refresh();
        $this->assertEquals('em_transito', $pedido->status);

        // 10. RECEBIMENTO PELA LOJA
        $itensCarga = RomaneioItem::where('romaneio_id', $romaneio->id)
            ->where('itemable_type', Peca::class)
            ->get();

        $this->assertNotEmpty($itensCarga);

        $itensRecebimento = $itensCarga->map(fn ($ic) => [
            'item_id'    => $ic->id,
            'quantidade' => $ic->quantidade,
        ])->all();

        $responseReceber = $this->actingAs($this->lojaUser)->post(route('pecas.receber', $pedido->id), [
            'itens'      => $itensRecebimento,
            'observacao' => 'Peças conferidas e estocadas no balcão da filial',
        ]);

        $responseReceber->assertSessionHasNoErrors();
        $pedido->refresh();

        // Pedido integralmente concluído
        $this->assertEquals('concluido', $pedido->status);

        // Reserva do CD foi consumida e baixada
        $this->assertEquals(0, $this->pecaA->estoqueEm($this->localCd->id)?->saldo_reservado);
        $this->assertEquals(0, $this->pecaB->estoqueEm($this->localCd->id)?->saldo_reservado);

        // Saldo físico foi transferido para a Loja
        $this->assertEquals(4, $this->pecaA->estoqueEm($this->localLoja->id)?->saldo);
        $this->assertEquals(2, $this->pecaB->estoqueEm($this->localLoja->id)?->saldo);

        // Saldo físico do CD foi reduzido de 10 para 6 e 8
        $this->assertEquals(6, $this->pecaA->estoqueEm($this->localCd->id)?->saldo);
        $this->assertEquals(8, $this->pecaB->estoqueEm($this->localCd->id)?->saldo);
    }

    /**
     * Teste: Gate 1 pode recusar item com motivo, devolvendo para nova identificação
     */
    public function test_gate1_recusa_item_com_motivo()
    {
        $pedido = Pedido::create([
            'user_id'          => $this->lojaUser->id,
            'tipo_carga'       => 'peca',
            'status'           => 'aguardando_confirmacao',
            'local_origem_id'  => $this->localCd->id,
            'local_destino_id' => $this->localLoja->id,
        ]);

        $item = PedidoItem::create([
            'pedido_id'            => $pedido->id,
            'tipo'                 => 'peca',
            'peca_id'              => $this->pecaA->id,
            'quantidade'           => 1,
            'preco_unitario'       => 50.00,
            'descricao_solicitada' => 'Pastilha dianteira',
            'identificado_por'     => $this->operadorCd->id,
            'identificado_em'      => now(),
        ]);

        $motivoRecusa = 'Código incompatível com o modelo JET 50 2024 solicitado pela loja';

        $responseRecusar = $this->actingAs($this->validadorPecas)->post(route('pecas.recusar', $pedido->id), [
            'item_id' => $item->id,
            'motivo'  => $motivoRecusa,
        ]);

        $responseRecusar->assertSessionHasNoErrors();
        $item->refresh();
        $pedido->refresh();

        // O item perdeu o SKU incorreto e ganhou o motivo de recusa
        $this->assertNull($item->peca_id);
        $this->assertEquals($motivoRecusa, $item->recusa_motivo);
        // Pedido voltou para atendimento
        $this->assertEquals('em_atendimento', $pedido->status);
    }

    /**
     * Teste: Recebimento com divergência transfere a quantidade recebida e libera a reserva do que faltou
     */
    public function test_recebimento_com_divergencia_libera_reserva_excedente()
    {
        $servicoEstoque = app(EstoquePecaService::class);
        $servicoEstoque->darEntrada($this->pecaA, $this->localCd->id, 10, 'Entrada de teste');

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
            'peca_id'        => $this->pecaA->id,
            'quantidade'     => 5,
            'qtd_atribuida'  => 5,
            'preco_unitario' => 50.00,
            'confirmado_em'  => now(),
        ]);

        // Reserva 5 no CD
        $servicoEstoque->reservar($this->pecaA, $this->localCd->id, 5, $pedido, $item);

        $romaneio = Romaneio::create([
            'user_id'   => $this->admin->id,
            'status'    => 'em_transito',
            'motorista' => 'TESTE MOTORISTA',
            'placa'     => 'XYZ9999',
            'rota'      => 'ROTA SUL',
            'tipo'      => 'misto',
        ]);

        $itemCarga = RomaneioItem::create([
            'romaneio_id'      => $romaneio->id,
            'pedido_id'        => $pedido->id,
            'pedido_item_id'   => $item->id,
            'itemable_type'    => Peca::class,
            'itemable_id'      => $this->pecaA->id,
            'quantidade'       => 5,
            'status'           => RomaneioItem::STATUS_EM_TRANSITO,
            'local_destino_id' => $this->localLoja->id,
        ]);

        // Loja recebe apenas 3 (faltaram 2)
        $responseReceber = $this->actingAs($this->lojaUser)->post(route('pecas.receber', $pedido->id), [
            'itens' => [
                [
                    'item_id'    => $itemCarga->id,
                    'quantidade' => 3,
                ],
            ],
            'observacao' => 'Caixa danificada, vieram apenas 3 peças',
        ]);

        $responseReceber->assertSessionHasNoErrors();
        $itemCarga->refresh();
        $pedido->refresh();

        // Romaneio item tem status divergencia
        $this->assertEquals(RomaneioItem::STATUS_DIVERGENCIA, $itemCarga->status);
        $this->assertEquals(3, $itemCarga->quantidade_recebida);

        // Reserva do CD foi completamente zerada (3 consumidas pela transferência + 2 liberadas pela divergência)
        $this->assertEquals(0, $this->pecaA->estoqueEm($this->localCd->id)?->saldo_reservado);

        // Saldo físico na loja aumentou em 3
        $this->assertEquals(3, $this->pecaA->estoqueEm($this->localLoja->id)?->saldo);

        // Saldo físico no CD diminuiu em 3 (de 10 para 7)
        $this->assertEquals(7, $this->pecaA->estoqueEm($this->localCd->id)?->saldo);

        // Pedido concluído
        $this->assertEquals('concluido', $pedido->status);
    }
}
