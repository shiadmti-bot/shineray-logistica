<?php

namespace App\Http\Controllers;

use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Carbon\Carbon;

class BiController extends Controller
{
    public function index(Request $request)
    {
        // 1. Filtros Globais (Data)
        $startDate = $request->input('start_date', Carbon::now()->startOfMonth()->format('Y-m-d'));
        $endDate = $request->input('end_date', Carbon::now()->endOfMonth()->format('Y-m-d'));

        // 2. Volumetria Geral (Pedidos Criados no Período)
        $totalPedidos = Pedido::whereBetween('created_at', ["$startDate 00:00:00", "$endDate 23:59:59"])->count();
        $totalConcluidos = Pedido::whereBetween('updated_at', ["$startDate 00:00:00", "$endDate 23:59:59"])
                                 ->where('status', 'concluido')
                                 ->count();
        $totalCancelados = Pedido::whereBetween('updated_at', ["$startDate 00:00:00", "$endDate 23:59:59"])
                                 ->where('status', 'cancelado')
                                 ->count();

        // 3. Status Atual (Snapshot em Tempo Real)
        $statusDistribution = Pedido::select('status', DB::raw('count(*) as total'))
            ->whereNotIn('status', ['concluido', 'cancelado']) // Apenas ativos
            ->groupBy('status')
            ->get();

        // 4. Ranking de Lojas (Top 10 Solicitantes)
        $rankingLojas = Pedido::select('user_id', DB::raw('count(*) as total'))
            ->join('users', 'pedidos.user_id', '=', 'users.id') // Join para garantir acesso à filial
            ->whereBetween('pedidos.created_at', ["$startDate 00:00:00", "$endDate 23:59:59"])
            ->whereNotNull('users.filial') // Garante que tem filial
            ->where('users.filial', '!=', '')
            ->groupBy('user_id', 'users.filial') // Agrupa também por filial para compatibilidade SQL
            ->orderByDesc('total')
            ->limit(10)
            ->get()
            ->map(function ($item) {
                // Recupera filial via Relation ou Join (neste caso, o join já filtrou, mas o model precisa acessar)
                // Como fiz join, o campo filial pode não estar no model Pedido automaticamente sem select explícito ou with
                // Melhor abordagem: Fazer a query direto na tabela Users contando pedidos
                return [
                    'boja' => $item->user->filial ?? 'Desconhecida',
                    'total' => $item->total
                ];
            });

        // REFAZENDO RANKING (Mais Seguro)
        $rankingLojas = User::where('perfil', 'loja')
            ->whereNotNull('filial')
            ->withCount(['pedidos' => function($q) use ($startDate, $endDate) {
                $q->whereBetween('created_at', ["$startDate 00:00:00", "$endDate 23:59:59"]);
            }])
            ->having('pedidos_count', '>', 0)
            ->orderByDesc('pedidos_count')
            ->limit(10)
            ->get()
            ->map(function ($user) {
                return [
                    'loja' => $user->filial,
                    'total' => $user->pedidos_count
                ];
            });

        // 5. Cálculo SLA (Tempo Médio entre Etapas)
        $pedidosConcluidosIds = Pedido::whereBetween('updated_at', ["$startDate 00:00:00", "$endDate 23:59:59"])
            ->where('status', 'concluido')
            ->pluck('id');

        $slaStats = [
            'analise' => [],      // Criação -> Aprovado (Gestor)
            'separacao_cd' => [], // Aprovado -> Separado (CD)
            'separacao_loja' => [], // Aprovado -> Separado (Lojas/Transferência)
            'expedicao' => [],    // Separado -> Expedido (Montagem Carga)
            'transito'   => [],   // Expedido -> Concluído (Entrega)
            'total'     => [] 
        ];

        Pedido::whereIn('id', $pedidosConcluidosIds)
            ->with(['logs' => function($q) { $q->orderBy('created_at', 'asc'); }])
            ->chunk(100, function ($pedidos) use (&$slaStats) {
                foreach ($pedidos as $pedido) {
                    $criacao = $pedido->created_at;
                    $conclusao = $pedido->updated_at;

                    $tAprovado = null;
                    $tSeparado = null;
                    $tExpedido = null;

                    foreach ($pedido->logs as $log) {
                        $titulo = mb_strtolower($log->titulo);
                        
                        // 1. Aprovação: 'aprovado', 'auditoria', 'solicitado' (dependendo do fluxo)
                        if (!$tAprovado && (str_contains($titulo, 'aprovado') || str_contains($titulo, 'auditoria') || str_contains($titulo, 'solicitado'))) {
                            $tAprovado = $log->created_at;
                        }
                        
                        // 2. Separação: 'separado'
                        if (!$tSeparado && str_contains($titulo, 'separado')) $tSeparado = $log->created_at;
                        
                        // 3. Expedição: 'expedido', 'transito', 'coletado', 'saiu'
                        if (!$tExpedido && (str_contains($titulo, 'expedido') || str_contains($titulo, 'em trânsito') || str_contains($titulo, 'transito') || str_contains($titulo, 'coleta') || str_contains($titulo, 'saiu'))) {
                            $tExpedido = $log->created_at;
                        }
                    }

                    $diff = fn($start, $end) => ($start && $end && $end->gt($start)) 
                        ? round($start->floatDiffInHours($end), 2) 
                        : null;

                    // 1. Análise
                    if ($val = $diff($criacao, $tAprovado)) $slaStats['analise'][] = $val;

                    // 2. Separação
                    if ($val = $diff($tAprovado, $tSeparado)) {
                        if ($pedido->origem_user_id) $slaStats['separacao_loja'][] = $val;
                        else $slaStats['separacao_cd'][] = $val;
                    }

                    // 3. Expedição e Trânsito (Com Fallback)
                    if ($tExpedido) {
                        // Fluxo Completo: Separado -> Expedido -> Concluído
                        if ($val = $diff($tSeparado, $tExpedido)) $slaStats['expedicao'][] = $val;
                        if ($val = $diff($tExpedido, $conclusao)) $slaStats['transito'][] = $val;
                    } else {
                        // Fluxo Curto: Separado -> Concluído (Sem Expedição explícita)
                        // Assume Expedição = 0 e Joga tudo no Trânsito (ou considera trânsito como Separação->Conclusão)
                        // Opção: Trânsito = Conclusão - Separação
                        if ($val = $diff($tSeparado, $conclusao)) $slaStats['transito'][] = $val;
                        // Expedição fica sem dados (0 na média)
                    }

                    // Total
                    if ($val = $diff($criacao, $conclusao)) $slaStats['total'][] = $val;
                }
            });

        // Médias Finais
        $slas = [
            'analise'        => $this->avg($slaStats['analise']),
            'separacao_cd'   => $this->avg($slaStats['separacao_cd']),
            'separacao_loja' => $this->avg($slaStats['separacao_loja']),
            'expedicao'      => $this->avg($slaStats['expedicao']),
            'transito'       => $this->avg($slaStats['transito']),
            'total'          => $this->avg($slaStats['total']),
        ];

        return Inertia::render('BI/Index', [
            'filters' => ['start_date' => $startDate, 'end_date' => $endDate],
            'kpis' => [
                'total_pedidos' => $totalPedidos,
                'concluidos' => $totalConcluidos,
                'cancelados' => $totalCancelados,
                'taxa_sucesso' => $totalPedidos > 0 ? round(($totalConcluidos / $totalPedidos) * 100, 1) : 0
            ],
            'status_chart' => $statusDistribution,
            'ranking_lojas' => $rankingLojas,
            'slas' => $slas
        ]);
    }

    private function avg($array) {
        $filtered = array_filter($array, fn($v) => !is_null($v) && $v >= 0);
        if (empty($filtered)) return 0;
        return round(array_sum($filtered) / count($filtered), 1);
    }
}
