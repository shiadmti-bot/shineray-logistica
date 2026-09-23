<?php

namespace App\Http\Controllers;

use App\Enums\StatusPedido;
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
        if ($user->isGestor()) {
            return redirect()->route('gestor.index');
        }

        return Inertia::render('Dashboard', [
            'stats'   => $this->numerosDo($user),
            'perfil'  => $user->perfil,
            'notices' => Notice::where('is_active', true)->orderBy('created_at', 'desc')->get(),
            // O aviso de recusa: vazio para quem não teve pedido recusado.
            'recusas' => $this->recusasRecentes($user),
        ]);
    }

    /**
     * Pedidos da loja recusados nos últimos dias, com o motivo.
     *
     * POR QUE NO PAINEL, SE JÁ EXISTE NOTIFICAÇÃO. O sininho é o aviso do
     * momento: quem estava fora do sistema quando a recusa aconteceu volta e
     * encontra a notificação no meio de outras, ou já lida. O pedido em si
     * também não ajudava a lembrar — ele é soft-deleted e ia para o fim de uma
     * lista paginada. Aqui a recusa fica na primeira tela, do lado dos números
     * que a loja usa para decidir a próxima reposição, que é a decisão que o
     * motivo da recusa deveria informar.
     *
     * A JANELA DE 15 DIAS é o que faz o aviso ir embora sozinho. Sem ela, ou o
     * bloco fica para sempre (e vira paisagem), ou precisaria de um fluxo de
     * "dar ciência" — coluna, rota e botão — que ninguém pediu.
     *
     * Inclui a loja de ORIGEM de uma transferência: as motos eram dela.
     *
     * @return list<array<string, mixed>>
     */
    private function recusasRecentes($user): array
    {
        if (! $user->isLoja()) {
            return [];
        }

        return Pedido::onlyTrashed()
            ->whereIn('status', ['rejeitado', 'cancelado'])
            ->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                  ->orWhere('origem_user_id', $user->id);
            })
            // `rejeitado_em` só existe a partir da v3.6; nos anteriores a data
            // da recusa é o próprio soft delete.
            ->where(fn ($q) => $q->where('rejeitado_em', '>=', now()->subDays(15))
                                 ->orWhere(fn ($r) => $r->whereNull('rejeitado_em')
                                                        ->where('deleted_at', '>=', now()->subDays(15))))
            ->with('rejeitadoPor:id,name')
            ->orderByDesc('deleted_at')
            ->limit(5)
            ->get()
            ->map(fn (Pedido $p) => [
                'id'         => $p->id,
                'tipo'       => $p->status,
                'tipo_carga' => $p->tipo_carga,
                'motivo'     => $p->motivo_rejeicao,
                'autor'      => $p->rejeitadoPor?->name,
                'em'         => $p->rejeitado_em ?? $p->deleted_at,
            ])
            ->all();
    }

    private function numerosDo($user): array
    {
        if ($user->isAdmin()) {
            return [
                'total_pedidos'   => Pedido::withTrashed()->count(),
                'em_andamento'    => Pedido::whereIn('status', StatusPedido::emAndamento())->count(),
                // withTrashed: recusa é soft delete, então este contador marcava
                // ZERO desde sempre — o painel do admin exibia "Cancelados: 0"
                // com qualquer volume de cancelamento no sistema.
                'cancelados'      => Pedido::withTrashed()
                                        ->whereIn('status', ['cancelado', 'rejeitado'])
                                        ->count(),
                'cargas_transito' => Romaneio::whereIn('status', ['em_transito', 'em_transito_cd'])->count(),
            ];
        }

        if ($user->isCd()) {
            return [
                'pendentes'       => Pedido::whereIn('status', ['solicitado', 'aprovado', 'no_cd', 'aguardando_coleta'])->count(),
                'no_patio'        => Moto::whereIn('status', ['separado', 'no_cd'])->count(),
                'cargas_transito' => Romaneio::whereIn('status', ['em_transito', 'em_transito_cd'])->count(),
                'cargas_total'    => Romaneio::count(),
                'hoje'            => Pedido::where('status', 'concluido')->whereDate('updated_at', now())->count(),
            ];
        }

        return [
            // withTrashed: "histórico completo" precisa contar o que foi
            // recusado, senão o número cai quando um pedido é rejeitado e a
            // loja vê o próprio histórico encolher.
            'meus_pedidos' => Pedido::withTrashed()->where('user_id', $user->id)->count(),

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
