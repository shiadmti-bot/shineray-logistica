<?php

namespace Tests\Feature\Avisos;

use App\Models\Notice;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\Concerns\CriaCenario;
use Tests\TestCase;

/**
 * O mural do dashboard: diretoria publica, toda a rede lê.
 *
 * As rotas não declaram perfil; a trava mora no controller. O conteúdo é HTML
 * de editor rico e chega ao navegador por DOMPurify (NoticeBoard.jsx).
 */
class MuralDeAvisosTest extends TestCase
{
    use DatabaseTransactions, CriaCenario;

    public function test_loja_e_cd_nao_publicam(): void
    {
        foreach (['loja', 'cd'] as $perfil) {
            $titulo = "Aviso indevido {$perfil} " . uniqid();

            $this->actingAs($this->usuario($perfil))
                ->post(route('notices.store'), ['title' => $titulo, 'content' => '<p>x</p>', 'type' => 'info'])
                ->assertForbidden();

            $this->assertDatabaseMissing('notices', ['title' => $titulo]);
        }
    }

    public function test_gestor_e_admin_publicam_com_autoria(): void
    {
        foreach (['gestor', 'admin'] as $perfil) {
            $autor = $this->usuario($perfil);
            $titulo = "Inventário geral {$perfil} " . uniqid();

            $this->actingAs($autor)
                ->post(route('notices.store'), ['title' => $titulo, 'content' => '<p>Sexta, 8h.</p>', 'type' => 'warning'])
                ->assertSessionHasNoErrors();

            $this->assertDatabaseHas('notices', ['title' => $titulo, 'created_by' => $autor->id, 'is_active' => true]);
        }
    }

    public function test_tipo_de_aviso_fora_da_lista_e_recusado(): void
    {
        $this->actingAs($this->usuario('admin'))
            ->post(route('notices.store'), ['title' => 'X', 'content' => 'Y', 'type' => 'javascript'])
            ->assertSessionHasErrors('type');
    }

    public function test_so_a_diretoria_remove(): void
    {
        $aviso = Notice::create(['title' => 'Fixo', 'content' => 'Não apagar', 'type' => 'info', 'is_active' => true]);

        $this->actingAs($this->usuario('loja'))->delete(route('notices.destroy', $aviso->id))->assertForbidden();
        $this->assertDatabaseHas('notices', ['id' => $aviso->id]);

        $this->actingAs($this->usuario('gestor'))->delete(route('notices.destroy', $aviso->id));
        $this->assertDatabaseMissing('notices', ['id' => $aviso->id]);
    }

    /**
     * O aviso de lançamento da v3 (migration 2026_10_19_110000) substitui o
     * "Em Desenvolvimento" e diz que pedidos de peças ainda não abriram.
     */
    public function test_mural_anuncia_a_v3_no_lugar_do_aviso_de_desenvolvimento(): void
    {
        $lancamento = Notice::where('title', '🚀 Chegou a versão 3 do BySabel Logística')->sole();

        $this->assertTrue($lancamento->is_active);
        $this->assertStringContainsString('pedidos de peças ainda não estão liberados', $lancamento->content);

        $this->assertFalse(
            Notice::where('title', 'LIKE', '%v3.0%Lançamento em Breve%')->where('is_active', true)->exists(),
            'O aviso de "em desenvolvimento" sai do mural quando a v3 é lançada.'
        );
    }
}
