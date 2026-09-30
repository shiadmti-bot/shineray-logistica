<?php

namespace Tests\Feature;

use App\Models\Modelo;
use App\Models\ModeloCor;
use App\Models\User;
use App\Services\Estoque\CatalogoMotosMicrowork;
use App\Services\MicroworkService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Cache;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * O catálogo de modelos — o que se PODE pedir, separado do que EXISTE em pátio.
 *
 * O BUG QUE ESTA SUÍTE FECHA. `PedidoController::create` montava a lista de
 * modelos a partir dos chassis em estoque e só caía na tabela `modelos` com um
 * `?:`. Assim que o Microwork respondia qualquer coisa, o catálogo de 48 nomes
 * exatos era descartado — a loja só conseguia pedir o que o CD já tinha, e o
 * modelo esgotado (o único que de fato precisa de reposição) não existia no
 * dropdown.
 *
 * E as cores: sem saldo para o modelo, o front-end oferecia sete cores
 * INVENTADAS no código. A loja escolhia uma variante que podia não existir.
 */
class CatalogoModelosTest extends TestCase
{
    use DatabaseTransactions;

    private User $loja;

    protected function setUp(): void
    {
        parent::setUp();

        // O saldo vive em cache; cada teste declara o seu.
        Cache::forget('estoque_cd_microwork');

        $this->loja = User::factory()->create([
            'email'  => 'catalogo_loja_' . uniqid() . '@shineray.com.br',
            'perfil' => 'loja',
            'filial' => 'Loja Catálogo',
        ]);
    }

    // ------------------------------------------------------------------
    // REGISTRO A PARTIR DA SINCRONIA
    // ------------------------------------------------------------------

    /** Um modelo novo visto na API entra no catálogo com as cores dele. */
    public function test_sincronia_registra_modelo_e_cores_novos()
    {
        $resumo = $this->catalogo()->registrar([
            ['Modelo' => 'xy999-9 - moto inedita teste ', 'Cor' => ' vermelha', 'Chassi' => 'A1', 'patio' => 'GALPÃO MOTOS'],
            ['Modelo' => 'XY999-9 - MOTO INEDITA TESTE', 'Cor' => 'PRETA', 'Chassi' => 'A2', 'patio' => 'GALPÃO MOTOS'],
        ]);

        $this->assertSame(1, $resumo['modelos_novos']);
        $this->assertSame(2, $resumo['cores_novas']);

        // Normalizado em caixa alta e sem espaços — é o que faz duas grafias da
        // mesma linha caírem no mesmo registro.
        $modelo = Modelo::where('nome', 'XY999-9 - MOTO INEDITA TESTE')->sole();

        $this->assertSame('microwork', $modelo->origem);
        $this->assertNotNull($modelo->visto_em);
        $this->assertTrue($modelo->ativo);
        $this->assertEqualsCanonicalizing(
            ['VERMELHA', 'PRETA'],
            $modelo->cores->pluck('cor')->all()
        );
    }

    /** Rodar a sincronia duas vezes não duplica nada. */
    public function test_sincronia_e_idempotente()
    {
        $itens = [['Modelo' => 'SHI 175 EFI', 'Cor' => 'AZUL', 'Chassi' => 'B1', 'patio' => 'CD EXPEDIÇÃO']];

        $this->catalogo()->registrar($itens);
        $segundo = $this->catalogo()->registrar($itens);

        $this->assertSame(0, $segundo['modelos_novos']);
        $this->assertSame(0, $segundo['cores_novas']);
        $this->assertSame(1, Modelo::where('nome', 'SHI 175 EFI')->count());
        $this->assertSame(1, ModeloCor::whereIn('modelo_id', Modelo::where('nome', 'SHI 175 EFI')->pluck('id'))->count());
    }

    /**
     * A sincronia NUNCA desativa um modelo por ausência.
     *
     * Um modelo pode faltar numa resposta por filtro de pátio, erro de
     * integração ou porque o último chassi foi vendido — nenhuma dessas coisas
     * significa que ele saiu de linha. Desativar por ausência esvaziaria a lista
     * no primeiro soluço da API.
     */
    public function test_sincronia_nao_desativa_modelo_ausente()
    {
        $antigo = Modelo::create(['nome' => 'MODELO FORA DA RESPOSTA', 'origem' => 'seed', 'ativo' => true]);

        $this->catalogo()->registrar([
            ['Modelo' => 'OUTRO MODELO', 'Cor' => 'PRETA', 'Chassi' => 'C1', 'patio' => 'GALPÃO MOTOS'],
        ]);

        $this->assertTrue($antigo->fresh()->ativo);
    }

    /** Cor em branco no Microwork não vira cor vazia no catálogo. */
    public function test_cor_ausente_fica_identificada_em_vez_de_vazia()
    {
        $this->catalogo()->registrar([
            ['Modelo' => 'SCOOTER PT2', 'Cor' => '', 'Chassi' => 'D1', 'patio' => 'GALPÃO MOTOS'],
        ]);

        $this->assertSame(
            ['NÃO INFORMADA'],
            Modelo::where('nome', 'SCOOTER PT2')->sole()->cores->pluck('cor')->all()
        );
    }

    // ------------------------------------------------------------------
    // O QUE A TELA RECEBE
    // ------------------------------------------------------------------

    /**
     * O CORAÇÃO DO PEDIDO. Modelo sem nenhuma unidade no CD continua na lista,
     * marcado com zero — antes ele simplesmente não aparecia.
     */
    public function test_modelo_sem_estoque_continua_no_catalogo_marcado_com_zero()
    {
        $semEstoque = Modelo::create(['nome' => 'MODELO ESGOTADO', 'origem' => 'seed']);
        ModeloCor::create(['modelo_id' => $semEstoque->id, 'cor' => 'VERMELHA', 'origem' => 'microwork']);

        $this->cacheDeEstoque([
            ['Modelo' => 'MODELO COM SALDO', 'Cor' => 'PRETA', 'Chassi' => 'E1', 'patio' => 'GALPÃO MOTOS'],
        ]);

        $lista = collect($this->catalogo()->paraTelaDePedido())->keyBy('nome');

        $this->assertTrue($lista->has('MODELO ESGOTADO'), 'o modelo esgotado tem de estar na lista');
        $this->assertSame(0, $lista['MODELO ESGOTADO']['disponivel_total']);
        $this->assertSame(
            [['cor' => 'VERMELHA', 'disponivel' => 0]],
            $lista['MODELO ESGOTADO']['cores'],
        );
    }

    /** As cores vêm do catálogo, com o saldo anotado em cada uma. */
    public function test_saldo_e_anotado_na_cor_do_catalogo()
    {
        $modelo = Modelo::create(['nome' => 'MODELO MISTO', 'origem' => 'seed']);
        ModeloCor::create(['modelo_id' => $modelo->id, 'cor' => 'AZUL', 'origem' => 'microwork']);
        ModeloCor::create(['modelo_id' => $modelo->id, 'cor' => 'PRETA', 'origem' => 'microwork']);

        $this->cacheDeEstoque([
            ['Modelo' => 'MODELO MISTO', 'Cor' => 'PRETA', 'Chassi' => 'F1', 'patio' => 'GALPÃO MOTOS'],
            ['Modelo' => 'MODELO MISTO', 'Cor' => 'PRETA', 'Chassi' => 'F2', 'patio' => 'GALPÃO MOTOS'],
        ]);

        $linha = collect($this->catalogo()->paraTelaDePedido())->firstWhere('nome', 'MODELO MISTO');

        $this->assertSame(2, $linha['disponivel_total']);
        $this->assertSame(
            [['cor' => 'AZUL', 'disponivel' => 0], ['cor' => 'PRETA', 'disponivel' => 2]],
            $linha['cores'],
        );
    }

    /** Modelo inativado por decisão humana sai da lista. */
    public function test_modelo_inativo_sai_da_lista()
    {
        Modelo::create(['nome' => 'MODELO DESCONTINUADO', 'origem' => 'seed', 'ativo' => false]);

        $nomes = array_column($this->catalogo()->paraTelaDePedido(), 'nome');

        $this->assertNotContains('MODELO DESCONTINUADO', $nomes);
    }

    /**
     * Rede de segurança: modelo que está no estoque e ainda não no catálogo
     * aparece igual. Cobre o intervalo entre subir esta versão e a sincronia
     * seguinte rodar.
     */
    public function test_modelo_so_no_estoque_ainda_aparece()
    {
        $this->cacheDeEstoque([
            ['Modelo' => 'MODELO NAO CATALOGADO', 'Cor' => 'CINZA', 'Chassi' => 'G1', 'patio' => 'GALPÃO MOTOS'],
        ]);

        $linha = collect($this->catalogo()->paraTelaDePedido())->firstWhere('nome', 'MODELO NAO CATALOGADO');

        $this->assertNotNull($linha);
        $this->assertSame(1, $linha['disponivel_total']);
    }

    // ------------------------------------------------------------------
    // A TELA
    // ------------------------------------------------------------------

    /** A tela de criação recebe o catálogo inteiro, não só o que tem saldo. */
    public function test_tela_de_criacao_recebe_o_catalogo_completo()
    {
        Modelo::create(['nome' => 'AAA MODELO SEM SALDO', 'origem' => 'seed']);

        $this->cacheDeEstoque([
            ['Modelo' => 'ZZZ MODELO COM SALDO', 'Cor' => 'PRETA', 'Chassi' => 'H1', 'patio' => 'GALPÃO MOTOS'],
        ]);

        $this->actingAs($this->loja)
            ->get(route('solicitar'))
            ->assertOk()
            ->assertInertia(function (AssertableInertia $page) {
                $catalogo = collect($page->toArray()['props']['catalogoModelos']);

                $nomes = $catalogo->pluck('nome');

                $this->assertTrue($nomes->contains('AAA MODELO SEM SALDO'));
                $this->assertTrue($nomes->contains('ZZZ MODELO COM SALDO'));

                // listaModelos continua existindo para o datalist do modo livre,
                // e agora é derivada do catálogo — não mais dos chassis.
                $this->assertSame(
                    $nomes->all(),
                    $page->toArray()['props']['listaModelos'],
                );
            });
    }

    // ------------------------------------------------------------------
    // HELPERS
    // ------------------------------------------------------------------

    private function catalogo(): CatalogoMotosMicrowork
    {
        return app(CatalogoMotosMicrowork::class);
    }

    /**
     * MicroworkService lê o saldo só do cache (nunca chama a API numa
     * requisição de usuário), então declarar o cache é o jeito honesto de
     * simular o estoque.
     *
     * @param  list<array<string, mixed>>  $itens
     */
    private function cacheDeEstoque(array $itens): void
    {
        Cache::put('estoque_cd_microwork', $itens, now()->addHour());

        // Sanidade: se o serviço deixar de ler esta chave, os testes de saldo
        // passariam por acidente com estoque vazio.
        $this->assertNotEmpty(app(MicroworkService::class)->getEstoqueCD());
    }
}
