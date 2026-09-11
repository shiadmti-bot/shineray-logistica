<?php

namespace Tests\Feature;

use App\Models\Moto;
use App\Models\Pedido;
use App\Models\Schedule;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Escopo e papel fora do módulo de peças (v3.4).
 *
 * Os três achados cobertos aqui tinham a mesma forma: a regra existia e estava
 * escrita na interface, mas o servidor não a repetia. Cada teste fixa os DOIS
 * lados — quem não pode é barrado, e quem trabalha ali continua passando.
 */
class EscopoModulosTest extends TestCase
{
    use DatabaseTransactions;

    private User $admin;
    private User $operadorCd;
    private User $gestor;
    private User $lojaDona;
    private User $lojaVizinha;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'email'  => 'admin_esc_' . uniqid() . '@shineray.com.br',
            'perfil' => 'admin',
        ]);

        $this->operadorCd = User::factory()->create([
            'email'  => 'cd_esc_' . uniqid() . '@shineray.com.br',
            'perfil' => 'cd',
        ]);

        $this->gestor = User::factory()->create([
            'email'  => 'gestor_esc_' . uniqid() . '@shineray.com.br',
            'perfil' => 'gestor',
        ]);

        $this->lojaDona = User::factory()->create([
            'email'  => 'dona_esc_' . uniqid() . '@shineray.com.br',
            'perfil' => 'loja',
            'filial' => 'Loja Dona Escopo',
        ]);

        $this->lojaVizinha = User::factory()->create([
            'email'  => 'vizinha_esc_' . uniqid() . '@shineray.com.br',
            'perfil' => 'loja',
            'filial' => 'Loja Vizinha Escopo',
        ]);
    }

    // ==================================================================
    // ACHADO 02 — calendário logístico
    // ==================================================================

    /**
     * A loja não cria nem apaga viagem.
     *
     * `destroy` não apaga só o evento: percorre os pedidos vinculados, reverte
     * status e grava PedidoLog. Apagar uma viagem devolvia carga inteira para
     * trás no fluxo, em nome de quem apagou.
     */
    public function test_loja_nao_cria_nem_apaga_viagem_no_calendario()
    {
        $this->actingAs($this->lojaDona)
            ->post(route('calendar.store'), [
                'date'  => now()->addDays(3)->toDateString(),
                'lojas' => [$this->lojaDona->id],
            ])
            ->assertForbidden();

        $viagem = Schedule::create([
            'date'   => now()->addDays(5)->toDateString(),
            'status' => 'scheduled',
        ]);

        $this->actingAs($this->lojaDona)
            ->delete(route('calendar.destroy', $viagem->id))
            ->assertForbidden();

        $this->assertDatabaseHas('schedules', ['id' => $viagem->id]);
    }

    /**
     * Mas continua vendo o calendário.
     *
     * Escopo de leitura aqui seria contraproducente: a filial precisa saber
     * quando o caminhão passa na cidade dela.
     */
    public function test_loja_continua_vendo_o_calendario()
    {
        $this->actingAs($this->lojaDona)
            ->get(route('calendar.index'))
            ->assertOk();
    }

    /**
     * Quem opera a logística passa pelo portão.
     *
     * O id inexistente é de propósito: o que se afirma aqui é que o middleware
     * deixa passar, não o que o controller faz depois. Qualquer resposta serve
     * menos 403 — que seria o portão barrando quem deveria entrar.
     */
    public function test_cd_gestor_e_admin_passam_pelo_portao_do_calendario()
    {
        foreach ([$this->operadorCd, $this->gestor, $this->admin] as $usuario) {
            $resposta = $this->actingAs($usuario)
                ->delete(route('calendar.destroy', 999999));

            $this->assertNotSame(
                403,
                $resposta->getStatusCode(),
                "Perfil {$usuario->perfil} foi barrado no calendário e não deveria."
            );
        }
    }

    // ==================================================================
    // ACHADO 03 — escopo da frota
    // ==================================================================

    /**
     * A loja vê as próprias motos e não vê as das outras.
     *
     * O método não filtrava por loja em momento nenhum — `loja_id` existe como
     * filtro OPCIONAL, que é o oposto de um escopo. A tela escondia; a resposta
     * trazia tudo.
     */
    public function test_loja_nao_recebe_motos_de_outra_filial()
    {
        $minha = Moto::create([
            'chassi'        => 'CHASSIMINHA' . random_int(1000, 9999),
            'modelo'        => 'JET 125',
            'cor'           => 'VERMELHA',
            'status'        => 'estoque_loja',
            'loja_atual_id' => $this->lojaDona->id,
        ]);

        $alheia = Moto::create([
            'chassi'        => 'CHASSIALHEIA' . random_int(1000, 9999),
            'modelo'        => 'SHI 175',
            'cor'           => 'PRETA',
            'status'        => 'estoque_loja',
            'loja_atual_id' => $this->lojaVizinha->id,
        ]);

        $this->actingAs($this->lojaDona)
            ->get(route('motos.index'))
            ->assertOk()
            ->assertSee($minha->chassi)
            ->assertDontSee($alheia->chassi);
    }

    /**
     * A moto que SAI do estoque da loja continua visível para ela.
     *
     * Metade da regra que um escopo ingênuo por `loja_atual_id` perderia: numa
     * transferência, quem cede precisa acompanhar a própria moto depois de ela
     * ser prometida a outra filial.
     */
    public function test_loja_de_origem_continua_vendo_a_moto_transferida()
    {
        $moto = Moto::create([
            'chassi'        => 'CHASSITRANSF' . random_int(1000, 9999),
            'modelo'        => 'JET 125',
            'cor'           => 'AZUL',
            'status'        => 'separado',
            'loja_atual_id' => null,
        ]);

        $pedido = Pedido::create([
            'user_id'        => $this->lojaVizinha->id,   // quem recebe
            'origem_user_id' => $this->lojaDona->id,      // quem cede
            'status'         => 'aprovado',
        ]);

        $pedido->motos()->attach($moto->id);

        $this->actingAs($this->lojaDona)
            ->get(route('motos.index'))
            ->assertOk()
            ->assertSee($moto->chassi);
    }

    /** CD e admin continuam vendo a frota inteira — é o trabalho deles. */
    public function test_cd_continua_vendo_a_frota_inteira()
    {
        $daVizinha = Moto::create([
            'chassi'        => 'CHASSIFROTA' . random_int(1000, 9999),
            'modelo'        => 'SHI 175',
            'cor'           => 'BRANCA',
            'status'        => 'estoque_loja',
            'loja_atual_id' => $this->lojaVizinha->id,
        ]);

        $this->actingAs($this->operadorCd)
            ->get(route('motos.index'))
            ->assertOk()
            ->assertSee($daVizinha->chassi);
    }

    // ==================================================================
    // ACHADO 04 — reserva de chassi no Microwork
    // ==================================================================

    /**
     * Reservar tira um chassi da disponibilidade da rede e abre um Pedido.
     * Quem não vende não segura estoque.
     */
    public function test_gestor_nao_reserva_chassi_no_microwork()
    {
        $this->actingAs($this->gestor)
            ->postJson(route('api.estoque.reservar'), [
                'chassi' => 'CHASSIRESERVA123',
                'modelo' => 'JET 125',
                'cor'    => 'VERMELHA',
            ])
            ->assertForbidden();

        // Tabela é 'reservas_microwork' — o model sobrescreve a pluralização
        // padrão do Eloquent, e a convenção aqui é a do banco.
        $this->assertDatabaseMissing('reservas_microwork', [
            'chassi' => 'CHASSIRESERVA123',
        ]);
    }
}
