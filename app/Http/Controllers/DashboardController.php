<?php

namespace App\Http\Controllers;

use App\Models\Moto;
use App\Models\Notice;
use App\Models\Pedido;
use App\Models\Romaneio;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Tela inicial: os números que cada perfil precisa ver ao entrar.
 *
 * Era uma closure de 50 linhas em routes/web.php.
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request)
    {
        $user = $request->user();

        // Gestor tem painel próprio.
        if ($user->perfil === 'gestor') {
            return redirect()->route('gestor.index');
        }

        return Inertia::render('Dashboard', [
            'stats'   => $this->numerosDo($user),
            'perfil'  => $user->perfil,
            'notices' => Notice::where('is_active', true)->orderBy('created_at', 'desc')->get(),
        ]);
    }

    private function numerosDo($user): array
    {
        if ($user->perfil === 'admin') {
            return [
                'total_pedidos'   => Pedido::count(),
                'em_andamento'    => Pedido::whereNotIn('status', ['concluido', 'cancelado'])->count(),
                'cargas_transito' => Romaneio::whereIn('status', ['em_transito', 'em_transito_cd'])->count(),
                'cancelados'      => Pedido::where('status', 'cancelado')->count(),
            ];
        }

        if ($user->perfil === 'cd') {
            return [
                'pendentes'       => Pedido::whereIn('status', ['solicitado', 'aprovado', 'no_cd', 'aguardando_coleta'])->count(),
                'no_patio'        => Moto::whereIn('status', ['separado', 'no_cd'])->count(),
                'cargas_transito' => Romaneio::whereIn('status', ['em_transito', 'em_transito_cd'])->count(),
                'cargas_total'    => Romaneio::count(),
                'hoje'            => Pedido::where('status', 'concluido')->whereDate('updated_at', now())->count(),
            ];
        }

        return [
            'meus_pedidos' => Pedido::where('user_id', $user->id)->count(),

            // Entradas: o que a loja pediu e está chegando.
            'receber' => Pedido::where('user_id', $user->id)
                ->whereIn('status', ['em_transito', 'expedido', 'em_transito_cd'])
                ->count(),

            // Saídas: o que pediram do estoque dela (transferência).
            'transferencias_saida' => Pedido::where('origem_user_id', $user->id)
                ->whereIn('status', ['solicitado', 'aprovado'])
                ->count(),
        ];
    }
}
