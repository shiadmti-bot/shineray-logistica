<?php

namespace Tests\Feature\Devolucoes;

use App\Models\Devolucao;
use App\Models\DevolucaoItem;
use App\Models\User;
use App\Services\Devolucao\ChecklistMoto;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * Quem pode o quê em cada portão da devolução, pela rota.
 *
 * O ciclo feliz está em Tests\Feature\DevolucaoMotoTest; aqui fica o lado do
 * "não": a loja de fora não vê nem mexe, a loja não decide nem confere a
 * chegada, e o CD não abre devolução em nome de loja.
 */
class DevolucaoAcessoTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    private User $dona;
    private User $deFora;
    private User $gestor;
    private User $cd;
    private Devolucao $devolucao;
    private DevolucaoItem $item;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Storage::fake('public');

        $this->dona   = $this->usuario('loja', ['filial' => 'Loja Devolve/PA']);
        $this->deFora = $this->usuario('loja', ['filial' => 'Loja Vizinha/PA']);
        $this->gestor = $this->usuario('gestor', ['valida_motos' => true]);
        $this->cd     = $this->usuario('cd', ['filial' => 'CD Matriz']);

        [$this->devolucao, $this->item] = $this->devolucaoDe($this->dona, Devolucao::STATUS_AGUARDANDO);
    }

    public function test_loja_de_fora_nao_abre_nem_imprime_devolucao_alheia(): void
    {
        $this->actingAs($this->deFora)->get(route('devolucoes.show', $this->devolucao->id))->assertForbidden();
        $this->actingAs($this->deFora)->get(route('devolucoes.imprimir', $this->devolucao->id))->assertForbidden();
    }

    public function test_dona_e_operacao_central_abrem_a_devolucao(): void
    {
        foreach ([$this->dona, $this->gestor, $this->cd] as $quem) {
            $this->actingAs($quem)->get(route('devolucoes.show', $this->devolucao->id))->assertOk();
        }
    }

    public function test_loja_lista_so_as_proprias_devolucoes(): void
    {
        [$alheia] = $this->devolucaoDe($this->deFora, Devolucao::STATUS_RASCUNHO);

        $ids = collect($this->actingAs($this->dona)
            ->get(route('devolucoes.index'))
            ->viewData('page')['props']['devolucoes']['data'])
            ->pluck('id');

        $this->assertTrue($ids->contains($this->devolucao->id));
        $this->assertFalse($ids->contains($alheia->id), 'A loja via devolução de outra filial na listagem.');
    }

    public function test_cd_e_gestor_nao_abrem_devolucao_em_nome_de_loja(): void
    {
        foreach ([$this->cd, $this->gestor] as $quem) {
            $this->actingAs($quem)
                ->post(route('devolucoes.store'), ['loja_id' => $this->dona->id, 'motos' => [1], 'motivo' => 'outro'])
                ->assertForbidden();
        }
    }

    public function test_so_a_diretoria_aprova_e_recusa(): void
    {
        foreach ([$this->dona, $this->cd] as $quem) {
            $this->actingAs($quem)->post(route('devolucoes.aprovar', $this->devolucao->id))->assertForbidden();
            $this->actingAs($quem)
                ->post(route('devolucoes.recusar', $this->devolucao->id), ['motivo' => 'Não'])
                ->assertForbidden();
        }

        $this->assertSame(Devolucao::STATUS_AGUARDANDO, $this->devolucao->fresh()->status);
    }

    public function test_so_o_cd_recebe(): void
    {
        $this->devolucao->update(['status' => Devolucao::STATUS_APROVADA]);

        foreach ([$this->dona, $this->gestor] as $quem) {
            $this->actingAs($quem)->post(route('devolucoes.receber', $this->devolucao->id))->assertForbidden();
        }

        $this->assertSame(Devolucao::STATUS_APROVADA, $this->devolucao->fresh()->status);
    }

    public function test_loja_nao_assina_a_conferencia_de_chegada(): void
    {
        $this->devolucao->update(['status' => Devolucao::STATUS_APROVADA]);

        $this->actingAs($this->dona)
            ->post(route('devolucoes.conferir', [$this->devolucao->id, $this->item->id]), [
                'etapa'       => ChecklistMoto::ETAPA_DESTINO,
                'respostas'   => array_fill_keys(ChecklistMoto::chaves(), ChecklistMoto::CONFORME),
                'resultado'   => ChecklistMoto::RESULTADO_CONFORME,
                'responsavel' => 'Eu mesma',
            ])
            ->assertForbidden();

        $this->assertNull($this->item->fresh()->destino_assinado_em);
    }

    public function test_loja_de_fora_nao_envia_cancela_nem_anexa(): void
    {
        $this->devolucao->update(['status' => Devolucao::STATUS_RASCUNHO]);

        $this->actingAs($this->deFora)->post(route('devolucoes.enviar', $this->devolucao->id))->assertForbidden();
        $this->actingAs($this->deFora)->post(route('devolucoes.cancelar', $this->devolucao->id))->assertForbidden();
        $this->actingAs($this->deFora)
            ->post(route('devolucoes.anexos.store', $this->devolucao->id), [
                'etapa'   => ChecklistMoto::ETAPA_ORIGEM,
                'arquivo' => UploadedFile::fake()->image('foto.jpg'),
            ])
            ->assertForbidden();

        $this->assertSame(Devolucao::STATUS_RASCUNHO, $this->devolucao->fresh()->status);
        $this->assertSame(0, $this->devolucao->anexos()->count());
    }

    public function test_anexo_que_nao_e_imagem_nem_pdf_e_recusado(): void
    {
        $this->devolucao->update(['status' => Devolucao::STATUS_RASCUNHO]);

        $this->actingAs($this->dona)
            ->post(route('devolucoes.anexos.store', $this->devolucao->id), [
                'etapa'   => ChecklistMoto::ETAPA_ORIGEM,
                'arquivo' => UploadedFile::fake()->create('script.php', 10, 'application/x-php'),
            ])
            ->assertSessionHasErrors('arquivo');
    }

    /** @return array{0: Devolucao, 1: DevolucaoItem} */
    private function devolucaoDe(User $loja, string $status): array
    {
        $moto = $this->moto('estoque_loja', ['loja_atual_id' => $loja->id]);

        $devolucao = Devolucao::create([
            'user_id'         => $loja->id,
            'destino_user_id' => $this->cd->id,
            'status'          => $status,
            'motivo'          => 'defeito_fabrica',
        ]);

        $item = DevolucaoItem::create([
            'devolucao_id' => $devolucao->id,
            'moto_id'      => $moto->id,
            'chassi'       => $moto->chassi,
            'modelo'       => $moto->modelo,
            'cor'          => $moto->cor,
        ]);

        return [$devolucao, $item];
    }
}
