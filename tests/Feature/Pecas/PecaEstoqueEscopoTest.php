<?php

namespace Tests\Feature\Pecas;

use App\Models\EstoqueLocal;
use App\Models\Peca;
use App\Models\PecaEstoque;
use App\Models\PecaMovimento;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * Estoque de peças: quem lê e quem escreve saldo de qual local.
 *
 * Escrever: CD em qualquer local, loja só no próprio, gestor em nenhum
 * (segregação de funções — quem audita não mexe no saldo auditado).
 * Ler: a loja só o próprio saldo; `local_id` na query string não abre o de
 * outra filial.
 */
class PecaEstoqueEscopoTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    private EstoqueLocal $localA;
    private EstoqueLocal $localB;
    private User $lojaA;
    private User $cd;
    private Peca $peca;

    protected function setUp(): void
    {
        parent::setUp();

        $localCd = EstoqueLocal::firstOrCreate(
            ['tipo' => EstoqueLocal::TIPO_CD],
            ['nome' => 'CD Escopo', 'slug' => 'cd-escopo', 'ativo' => true, 'participa_pecas' => true]
        );

        $this->localA = $this->localDeLoja('Loja A Escopo');
        $this->localB = $this->localDeLoja('Loja B Escopo');

        $this->lojaA = $this->usuario('loja', ['filial' => 'Loja A Escopo/PA', 'estoque_local_id' => $this->localA->id]);
        $this->cd    = $this->usuario('cd', ['filial' => 'CD Matriz', 'estoque_local_id' => $localCd->id]);

        $this->peca = Peca::create([
            'codigo'    => 'SKU-ESCOPO-' . uniqid(),
            'descricao' => 'PASTILHA FREIO ESCOPO',
            'unidade'   => 'UN',
            'ativo'     => true,
        ]);

        PecaEstoque::create(['peca_id' => $this->peca->id, 'local_id' => $this->localA->id, 'saldo' => 5]);
        PecaEstoque::create(['peca_id' => $this->peca->id, 'local_id' => $this->localB->id, 'saldo' => 99]);
    }

    public function test_loja_busca_so_o_saldo_do_proprio_local(): void
    {
        $saldo = $this->actingAs($this->lojaA)
            ->getJson(route('pecas.estoque.buscar', ['termo' => $this->peca->codigo, 'local_id' => $this->localB->id]))
            ->assertOk()
            ->json('pecas.0.saldo');

        $this->assertSame(5, $saldo, 'O local_id da query string abria o saldo de outra filial.');
    }

    public function test_cd_consulta_o_local_que_escolher(): void
    {
        $saldo = $this->actingAs($this->cd)
            ->getJson(route('pecas.estoque.buscar', ['termo' => $this->peca->codigo, 'local_id' => $this->localB->id]))
            ->json('pecas.0.saldo');

        $this->assertSame(99, $saldo);
    }

    public function test_sugestao_de_minimo_da_loja_olha_so_o_proprio_consumo(): void
    {
        PecaMovimento::create([
            'peca_id' => $this->peca->id, 'local_id' => $this->localB->id,
            'tipo' => PecaMovimento::TIPO_SAIDA, 'quantidade' => -30,
            'saldo_anterior' => 129, 'saldo_posterior' => 99,
        ]);

        $daLoja = $this->actingAs($this->lojaA)
            ->getJson(route('pecas.pendencias.sugerir', ['local_id' => $this->localB->id]))
            ->json('sugestoes');

        $doCd = $this->actingAs($this->cd)
            ->getJson(route('pecas.pendencias.sugerir', ['local_id' => $this->localB->id]))
            ->json('sugestoes');

        $this->assertEmpty($daLoja, 'A loja via o consumo de outra filial.');
        $this->assertNotEmpty($doCd);
    }

    public function test_gestor_nao_escreve_saldo(): void
    {
        $this->actingAs($this->usuario('gestor'))
            ->post(route('pecas.estoque.entrada'), $this->entrada($this->localA, 10))
            ->assertForbidden();

        $this->assertSame(5, $this->saldo($this->localA));
    }

    public function test_loja_nao_lanca_entrada_em_outra_filial(): void
    {
        $this->actingAs($this->lojaA)
            ->post(route('pecas.estoque.entrada'), $this->entrada($this->localB, 10))
            ->assertForbidden();

        $this->assertSame(99, $this->saldo($this->localB));
    }

    /**
     * Sem `observacao` no payload — o campo é opcional. O controller lia
     * `$dados['observacao']` direto e a chave ausente derrubava a entrada com
     * erro 500 (achado desta suíte, v3.7). O mesmo valia para a transferência.
     */
    public function test_loja_lanca_entrada_no_proprio_local(): void
    {
        $this->actingAs($this->lojaA)
            ->post(route('pecas.estoque.entrada'), $this->entrada($this->localA, 3))
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertSame(8, $this->saldo($this->localA));
    }

    public function test_cd_transfere_sem_observacao(): void
    {
        $this->actingAs($this->cd)
            ->post(route('pecas.estoque.transferir'), [
                'peca_id' => $this->peca->id, 'origem_id' => $this->localB->id,
                'destino_id' => $this->localA->id, 'quantidade' => 4,
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertSame(95, $this->saldo($this->localB));
        $this->assertSame(9, $this->saldo($this->localA));
    }

    public function test_loja_nao_transfere_saldo_entre_filiais(): void
    {
        $this->actingAs($this->lojaA)
            ->post(route('pecas.estoque.transferir'), [
                'peca_id' => $this->peca->id, 'origem_id' => $this->localA->id,
                'destino_id' => $this->localB->id, 'quantidade' => 1,
            ])
            ->assertForbidden();

        $this->assertSame(5, $this->saldo($this->localA));
        $this->assertSame(99, $this->saldo($this->localB));
    }

    private function localDeLoja(string $nome): EstoqueLocal
    {
        return EstoqueLocal::create([
            'nome' => $nome, 'slug' => str($nome)->slug() . '-' . uniqid(),
            'tipo' => EstoqueLocal::TIPO_LOJA, 'participa_pecas' => true, 'ativo' => true,
        ]);
    }

    private function entrada(EstoqueLocal $local, int $quantidade): array
    {
        return ['peca_id' => $this->peca->id, 'local_id' => $local->id, 'quantidade' => $quantidade];
    }

    private function saldo(EstoqueLocal $local): int
    {
        return (int) PecaEstoque::where('peca_id', $this->peca->id)->where('local_id', $local->id)->value('saldo');
    }
}
