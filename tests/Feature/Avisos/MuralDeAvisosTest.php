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
}
