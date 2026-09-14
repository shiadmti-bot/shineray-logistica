<?php

namespace Tests\Feature;

use App\Enums\Perfil;
use App\Models\Basqueta;
use App\Models\EstoqueLocal;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\Peca;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Perfil como enum, e o que ele destrava (v3.5).
 */
class PerfilTest extends TestCase
{
    use DatabaseTransactions;

    public function test_tem_perfil_compara_pelo_enum()
    {
        $cd = User::factory()->make(['perfil' => 'cd']);

        $this->assertTrue($cd->temPerfil(Perfil::Cd, Perfil::Admin));
        $this->assertFalse($cd->temPerfil(Perfil::Loja));

        // Valor desconhecido no banco nunca passa.
        $this->assertFalse(User::factory()->make(['perfil' => 'motorista'])->temPerfil(...Perfil::cases()));
    }

    public function test_gates_por_perfil_seguem_o_enum()
    {
        $admin = User::factory()->make(['perfil' => 'admin']);

        $this->assertTrue(Gate::forUser($admin)->allows('admin'));
        $this->assertFalse(Gate::forUser($admin)->allows('loja'));
    }

    /** Antes, `check_perfil:gestro` negava acesso a todo mundo sem ninguém perceber. */
    public function test_perfil_digitado_errado_na_rota_quebra_na_hora()
    {
        Route::middleware(['web', 'auth', 'check_perfil:gestro'])
            ->get('/_teste/perfil-errado', fn () => 'ok');

        $this->withoutExceptionHandling();
        $this->expectException(\ValueError::class);

        $this->actingAs(User::factory()->create(['perfil' => 'gestor']))
            ->get('/_teste/perfil-errado');
    }

    /**
     * Carbon 3 devolve diffIn* com sinal: `now()->diffInDays($passado)` era
     * negativo, e o alerta de basqueta parada nunca acendia.
     */
    public function test_basqueta_conta_os_dias_de_espera_para_frente()
    {
        Carbon::setTestNow('2026-09-14 10:00:00');

        $local = EstoqueLocal::create([
            'nome'            => 'Loja Dias Espera',
            'slug'            => 'loja-dias-espera-' . uniqid(),
            'tipo'            => EstoqueLocal::TIPO_LOJA,
            'participa_pecas' => true,
            'ativo'           => true,
        ]);

        $basqueta = Basqueta::create([
            'estoque_local_id' => $local->id,
            'status'           => Basqueta::STATUS_ABERTA,
        ]);

        $peca = Peca::create([
            'codigo'    => 'SKU-DIAS-' . uniqid(),
            'descricao' => 'PASTILHA DE FREIO',
            'unidade'   => 'UN',
            'ativo'     => true,
        ]);

        $pedido = Pedido::create(['user_id' => User::factory()->create()->id, 'tipo_carga' => 'peca', 'status' => 'separado']);

        $item = PedidoItem::create([
            'pedido_id'  => $pedido->id,
            'tipo'       => 'peca',
            'peca_id'    => $peca->id,
            'quantidade' => 1,
        ]);

        DB::table('pedido_itens')->where('id', $item->id)->update([
            'basqueta_id'   => $basqueta->id,
            'qtd_atribuida' => 1,
            'updated_at'    => now()->subDays(10),
        ]);

        $this->assertSame(10, $basqueta->diasEmEspera());

        Carbon::setTestNow();
    }
}
