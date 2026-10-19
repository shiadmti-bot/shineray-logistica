<?php

namespace App\Http\Controllers;

use App\Enums\Modulo;
use App\Enums\StatusPedido;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\Devolucao;
use App\Models\ModuloSistema;
use App\Models\Pedido;
use App\Services\Modulos;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Gestão > Módulos — ligar e desligar módulos opcionais. Exclusivo do admin.
 *
 * Quem barra as rotas é o middleware `modulo:` (ExigirModulo); quem esconde
 * menu e atalhos é o front, pela prop `modulos`. Aqui só se lê e grava o
 * estado — ver App\Services\Modulos.
 */
class ModuloController extends Controller
{
    public function index(Modulos $modulos)
    {
        $gravados = ModuloSistema::with('atualizadoPor:id,name')->get()->keyBy('chave');
        $estados = $modulos->estados();

        return Inertia::render('Admin/Modulos', [
            'modulos' => collect(Modulo::cases())->map(fn (Modulo $modulo) => [
                'chave'          => $modulo->value,
                'rotulo'         => $modulo->rotulo(),
                'descricao'      => $modulo->descricao(),
                'ativo'          => $estados[$modulo->value],
                'padrao'         => $modulo->padrao(),
                'alterado_por'   => $gravados->get($modulo->value)?->atualizadoPor?->name,
                'alterado_em'    => $gravados->get($modulo->value)?->updated_at,
                'em_andamento'   => $this->emAndamento($modulo),
            ])->values(),
        ]);
    }

    public function atualizar(Request $request, string $chave, Modulos $modulos)
    {
        $modulo = Modulo::tryFrom($chave) ?? abort(404);

        $dados = $request->validate([
            'ativo' => ['required', 'boolean'],
        ]);

        $modulos->definir($modulo, (bool) $dados['ativo'], $request->user());

        // O menu de quem mudou reflete na hora; o dos demais, em até 30 s.
        Cache::forget(HandleInertiaRequests::chaveDoMenu($request->user()->id));

        return back()->with('success', $dados['ativo']
            ? "Módulo “{$modulo->rotulo()}” ligado."
            : "Módulo “{$modulo->rotulo()}” desligado. As telas dele saem do menu em até 30 segundos.");
    }

    /**
     * Quantos registros do módulo estão no meio do fluxo — o que fica
     * congelado se ele for desligado agora.
     */
    private function emAndamento(Modulo $modulo): int
    {
        return match ($modulo) {
            Modulo::PedidosPecas => Pedido::where('tipo_carga', 'peca')
                ->whereIn('status', StatusPedido::emAndamento())
                ->count(),
            Modulo::Devolucoes => Devolucao::emAndamento()->count(),
        };
    }
}
