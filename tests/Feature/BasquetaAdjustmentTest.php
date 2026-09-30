<?php

namespace Tests\Feature;

use App\Models\Basqueta;
use App\Models\BasquetaNota;
use App\Models\EstoqueLocal;
use App\Models\Peca;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BasquetaAdjustmentTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private User $loja;
    private EstoqueLocal $localLoja;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'perfil' => 'admin',
            'email' => 'admin@teste.com',
            'valida_pecas' => true,
        ]);

        $this->localLoja = EstoqueLocal::create([
            'nome' => 'Loja Castanhal/PA',
            'slug' => 'loja-castanhal-pa-teste',
            'tipo' => EstoqueLocal::TIPO_LOJA,
            'participa_pecas' => true,
            'ativo' => true,
        ]);

        $this->loja = User::factory()->create([
            'perfil' => 'loja',
            'filial' => 'Loja Castanhal/PA',
            'estoque_local_id' => $this->localLoja->id,
        ]);
    }

    public function test_ciclo_completo_faturamento_ajuste_reemissao_e_conferencia()
    {
        Storage::fake('public');

        // 1. Cria a basqueta aberta
        $basqueta = Basqueta::create([
            'estoque_local_id' => $this->localLoja->id,
            'local_aberto_id'  => $this->localLoja->id,
            'status'           => Basqueta::STATUS_ABERTA,
            'romaneio_versao'  => 1,
        ]);

        $pedido = Pedido::create([
            'user_id'    => $this->loja->id,
            'tipo_carga' => 'peca',
            'status'     => 'separado',
        ]);

        $cota = PedidoItem::create([
            'pedido_id'       => $pedido->id,
            'tipo'            => 'peca',
            'modelo'          => 'PASTILHA DE FREIO',
            'quantidade'      => 5,
            'qtd_atribuida'   => 5,
            'preco_unitario'  => 50.00,
            'confirmado_em'   => now(),
            'basqueta_id'     => $basqueta->id,
        ]);

        // 2. FATURAMENTO INICIAL (Passo 6)
        $responseFaturar = $this->actingAs($this->admin)->post(route('pecas.basquetas.faturar', $basqueta->id), [
            'numero'      => '123456',
            'serie'       => '1',
            'chave'       => str_repeat('1', 44),
            'volumes'     => 2,
            'valor_total' => 250.00,
        ]);

        $responseFaturar->assertSessionHasNoErrors();
        $basqueta->refresh();

        $this->assertEquals(Basqueta::STATUS_FATURADA, $basqueta->status);
        $this->assertNull($basqueta->local_aberto_id);
        $this->assertEquals(1, $basqueta->notas()->count());
        $this->assertEquals('123456', $basqueta->notaVigente()->numero);
        $this->assertEquals(1, $basqueta->romaneio_versao);

        // 3. PEDIDO DE AJUSTE NO GATE 2 (Passo 7)
        $motivoAjuste = 'Faltou incluir 2 pastilhas adicionais que a filial pediu';
        $responseAjustar = $this->actingAs($this->loja)->post(route('pecas.basquetas.ajustar', $basqueta->id), [
            'motivo' => $motivoAjuste,
        ]);

        $responseAjustar->assertSessionHasNoErrors();
        $basqueta->refresh();

        // Verifica cancelamento da NF e reabertura da basqueta
        $this->assertEquals(Basqueta::STATUS_AJUSTE, $basqueta->status);
        $this->assertEquals($this->localLoja->id, $basqueta->local_aberto_id);
        $this->assertEquals($motivoAjuste, $basqueta->ajuste_motivo);

        $notaCancelada = $basqueta->notas()->first();
        $this->assertNotNull($notaCancelada->cancelada_em);
        $this->assertStringContainsString($motivoAjuste, $notaCancelada->motivo_cancelamento);
        $this->assertNull($basqueta->notaVigente());

        // 4. REFATURAMENTO COM NOVA VERSÃO DO ROMANEIO
        $responseRefaturar = $this->actingAs($this->admin)->post(route('pecas.basquetas.faturar', $basqueta->id), [
            'numero'      => '123457',
            'serie'       => '1',
            'chave'       => str_repeat('2', 44),
            'volumes'     => 2,
            'valor_total' => 350.00,
        ]);

        $responseRefaturar->assertSessionHasNoErrors();
        $basqueta->refresh();

        $this->assertEquals(Basqueta::STATUS_FATURADA, $basqueta->status);
        $this->assertEquals(2, $basqueta->romaneio_versao);
        $this->assertEquals(2, $basqueta->notas()->count());
        $this->assertEquals('123457', $basqueta->notaVigente()->numero);

        // 5. CONFERÊNCIA E LIBERAÇÃO FINAL COM FOTO (Gate 2 aprovado)
        $fotoRomaneio = UploadedFile::fake()->image('romaneio_assinado.jpg', 800, 600);

        $responseConferir = $this->actingAs($this->loja)->post(route('pecas.basquetas.conferir', $basqueta->id), [
            'foto'       => $fotoRomaneio,
            'observacao' => 'Conferido e assinado pela gerência da loja',
        ]);

        $responseConferir->assertSessionHasNoErrors();
        $basqueta->refresh();

        $this->assertEquals(Basqueta::STATUS_LIBERADA, $basqueta->status);
        $this->assertNotNull($basqueta->conferida_em);
        $this->assertEquals($this->loja->id, $basqueta->conferida_por);
        $this->assertNotNull($basqueta->foto_romaneio_url);
    }
}
