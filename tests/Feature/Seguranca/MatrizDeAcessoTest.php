<?php

namespace Tests\Feature\Seguranca;

use App\Models\EstoqueLocal;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * Quem abre cada tela do sistema — a matriz inteira, num lugar só.
 *
 * As travas de perfil estão espalhadas entre rotas (`check_perfil`), Gates e
 * checagens de controller. Este teste não se importa com ONDE a trava mora:
 * ele fixa o RESULTADO. Uma rota que perder a trava (ou ganhar uma a mais e
 * trancar quem trabalhava nela) quebra aqui, com o nome da tela e do perfil.
 *
 * Mudou a regra de propósito? Atualize a linha da tela nesta matriz — é a
 * documentação viva de quem acessa o quê.
 */
class MatrizDeAcessoTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    private const TODOS = [200, 200, 200, 200];

    /**
     * Status esperado na ordem [admin, gestor, cd, loja].
     *
     * O gestor da matriz tem `valida_motos` (é o gestor comercial real); o
     * gestor sem a atribuição é coberto em test_gestor_sem_atribuicao_*.
     *
     * @return array<string, array{0: string, 1: array{0:int,1:int,2:int,3:int}}>
     */
    public static function telas(): array
    {
        return [
            // O gestor comercial é levado ao painel dele (302 para gestor.index).
            'dashboard'            => ['dashboard', [200, 302, 200, 200]],
            'pedidos'              => ['pedidos.index', self::TODOS],
            'novo pedido'          => ['pedidos.create', self::TODOS],
            'estoque de motos'     => ['motos.index', self::TODOS],
            'timeline de motos'    => ['motos.timeline', self::TODOS],
            'calendário'           => ['calendar.index', self::TODOS],
            'manual'               => ['manual', self::TODOS],
            'perfil'               => ['profile.edit', self::TODOS],
            'notificações'         => ['notificacoes.index', self::TODOS],
            'peças'                => ['pecas.index', self::TODOS],
            'pendências de peças'  => ['pecas.pendencias.index', self::TODOS],
            'devoluções'           => ['devolucoes.index', self::TODOS],
            'expedição'            => ['romaneios.index', [200, 200, 200, 403]],
            'nova carga'           => ['romaneios.create', [200, 200, 200, 403]],
            'basquetas'            => ['pecas.basquetas', [200, 200, 200, 403]],
            'indicadores de peças' => ['pecas.indicadores', [200, 200, 200, 403]],
            'painel do gestor'     => ['gestor.index', [200, 200, 403, 403]],
            'histórico do gestor'  => ['gestor.historico', [200, 200, 403, 403]],
            'filiais'              => ['filiais.index', [200, 200, 403, 403]],
            'BI'                   => ['bi.index', [200, 200, 403, 403]],
            'usuários'             => ['users.index', [200, 403, 403, 403]],
            'auditoria'            => ['auditoria.index', [200, 403, 403, 403]],
            // Atendimento é do CD ou de quem tem `valida_pecas` — o gestor da matriz não tem.
            'atendimento de peças' => ['pecas.atendimento', [200, 403, 200, 403]],
            // Segregação de funções: quem audita (gestor) não escreve estoque.
            'estoque de peças'     => ['pecas.estoque.index', [200, 403, 200, 200]],
            // Quem pede peça é quem tem oficina e destino: loja (e admin).
            'solicitar peça'       => ['pecas.solicitar', [200, 403, 403, 200]],
            'nova devolução'       => ['devolucoes.create', [200, 403, 403, 200]],
        ];
    }

    #[DataProvider('telas')]
    public function test_cada_perfil_abre_so_as_telas_dele(string $rota, array $esperado): void
    {
        Http::fake();

        foreach ($this->perfis() as $i => [$perfil, $user]) {
            $status = $this->actingAs($user)->get(route($rota))->status();

            $this->assertSame($esperado[$i], $status, "Perfil {$perfil} em {$rota}: esperado {$esperado[$i]}, veio {$status}.");
        }
    }

    public function test_visitante_e_mandado_para_o_login(): void
    {
        foreach (['dashboard', 'pedidos.index', 'motos.timeline', 'users.index', 'gestor.index', 'romaneios.index', 'pecas.estoque.index', 'devolucoes.index'] as $rota) {
            $this->get(route($rota))->assertRedirect(route('login'));
        }
    }

    public function test_gestor_sem_atribuicao_de_motos_nao_entra_no_painel_comercial(): void
    {
        $gestor = $this->usuario('gestor', ['valida_motos' => false]);

        $this->actingAs($gestor)->get(route('gestor.index'))->assertForbidden();
        $this->actingAs($gestor)->get(route('gestor.historico'))->assertForbidden();
    }

    /**
     * O dashboard mandava TODO gestor para o painel comercial — que barra o
     * gestor sem `valida_motos`. Essa conta logava e caía num 403.
     */
    public function test_gestor_sem_atribuicao_tem_dashboard_como_tela_inicial(): void
    {
        $gestor = $this->usuario('gestor', ['valida_motos' => false]);

        $this->actingAs($gestor)->get(route('dashboard'))->assertOk();
    }

    public function test_gestor_comercial_e_levado_ao_painel_dele(): void
    {
        $gestor = $this->usuario('gestor', ['valida_motos' => true]);

        $this->actingAs($gestor)->get(route('dashboard'))->assertRedirect(route('gestor.index'));
    }

    public function test_loja_validadora_de_pecas_entra_no_atendimento(): void
    {
        $loja = $this->usuario('loja', ['valida_pecas' => true]);

        $this->actingAs($loja)->get(route('pecas.atendimento'))->assertOk();
    }

    /** @return list<array{0: string, 1: User}> */
    private function perfis(): array
    {
        $cd = EstoqueLocal::firstOrCreate(
            ['tipo' => EstoqueLocal::TIPO_CD],
            ['nome' => 'CD Matriz Acesso', 'slug' => 'cd-matriz-acesso', 'ativo' => true, 'participa_pecas' => true]
        );

        $localLoja = EstoqueLocal::create([
            'nome'            => 'Loja Matriz Acesso',
            'slug'            => 'loja-matriz-acesso-' . uniqid(),
            'tipo'            => EstoqueLocal::TIPO_LOJA,
            'participa_pecas' => true,
            'ativo'           => true,
        ]);

        return [
            ['admin', $this->usuario('admin', ['filial' => 'Matriz'])],
            ['gestor', $this->usuario('gestor', ['valida_motos' => true])],
            ['cd', $this->usuario('cd', ['filial' => 'CD Matriz', 'estoque_local_id' => $cd->id])],
            ['loja', $this->usuario('loja', ['filial' => 'Loja Matriz Acesso/PA', 'estoque_local_id' => $localLoja->id])],
        ];
    }
}
