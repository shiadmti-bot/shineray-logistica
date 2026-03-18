<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Models\ScheduleStop;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class CalendarController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();
        
        // Carrega as viagens COM as paradas e os nomes das lojas
        $schedules = Schedule::with(['stops.loja:id,filial,name'])->get();
        
        $events = [];
        $canManage = in_array($user->perfil, ['admin', 'cd', 'gestor']);
        $myId = (int) $user->id;

        foreach ($schedules as $sched) {
            // Itera sobre CADA parada desta viagem
            foreach ($sched->stops as $stop) {
                
                $isMyStop = ($stop->user_id === $myId);
                $isDestinoFinal = ($stop->type === 'destination');
                
                // Formata os IDs das paradas para enviar ao frontend (para preencher o modal de edição)
                $stopsIds = $sched->stops->pluck('user_id')->toArray();

                $events[] = [
                    // O ID visual é composto, mas mandamos o ID real da viagem em 'real_id'
                    'id' => $sched->id . '-' . $stop->id, 
                    'real_id' => $sched->id, 
                    'title' => $stop->loja->filial ?? 'Loja Removida',
                    'start' => $sched->date,
                    'extendedProps' => [
                        'type' => $isDestinoFinal ? 'destino' : 'escala',
                        'status' => $sched->status,
                        'is_my_route' => $canManage || $isMyStop,
                        'sequence' => $stop->sequence,
                        'description' => $isDestinoFinal ? 'Descarga Total' : "Parada {$stop->sequence}",
                        'rota_completa' => $this->formatarRotaCompleta($sched->stops),
                        // IMPORTANTE: Enviar a lista de IDs das paradas para o modal saber quem são
                        'stops_ids' => $stopsIds,
                        'is_past' => Carbon::parse($sched->date)->startOfDay()->lt(now()->startOfDay())
                    ]
                ];
            }
        }

        return Inertia::render('Calendar/Index', [
            'initialEvents' => $events,
            'canEdit' => $canManage,
            'minhaLoja' => $user->filial ?? $user->name 
        ]);
    }

    private function formatarRotaCompleta($stops)
    {
        return $stops->map(fn($s) => $s->loja->filial ?? 'N/A')->join(' ➔ ');
    }

    public function getRotas()
    {
        return response()->json(
            User::where('perfil', 'loja')
                // Remova o where is_interior se quiser que todas apareçam
                // .where('is_interior', true) 
                ->select('id', 'filial as name')
                ->orderBy('filial')
                ->get()
        );
    }

    // --- AQUI ESTÁ A CORREÇÃO PRINCIPAL ---
    public function store(Request $request)
    {
        $request->validate([
            'id' => 'nullable|exists:schedules,id',
            'date' => 'required|date', 
            'status' => 'required|in:confirmed,planned',
            'stops' => 'required|array|min:1',
            'stops.*' => 'exists:users,id'
        ]);

        // Proteção Retroativa: Trancar edição/criação de rotas já passadas
        if (Carbon::parse($request->date)->startOfDay()->lt(now()->startOfDay())) {
            return back()->withErrors(['erro' => 'Não é possível salvar agendamentos para dias que já passaram.']);
        }

        if ($request->id) {
            $existing = Schedule::find($request->id);
            if ($existing && Carbon::parse($existing->date)->startOfDay()->lt(now()->startOfDay())) {
                return back()->withErrors(['erro' => 'Este agendamento já ocorreu e não pode ser modificado.']);
            }
        }

        // 1. REMOVIDO O "return" DAQUI DA FRENTE DO DB::transaction
        DB::transaction(function () use ($request) {
            
            // Atualiza ou Cria
            $schedule = Schedule::updateOrCreate
(
                ['id' => $request->id], 
                [
                    'date' => $request->date,
                    'status' => $request->status,
                    'created_by' => Auth::id()
                ]
            );

            // Atualiza as paradas
            $schedule->stops()->delete();

            $totalStops = count($request->stops);
            
            foreach ($request->stops as $index => $lojaId) {
                $isLast = ($index === $totalStops - 1);
                
                ScheduleStop::create([
                    'schedule_id' => $schedule->id,
                    'user_id' => $lojaId,
                    'sequence' => $index + 1,
                    'type' => $isLast ? 'destination' : 'scale'
                ]);
            }
            
            // --- NOVA REGRA GESTOR: ATUALIZAR STATUS PARA 'ROTA CONFIRMADA' ---
            // Encontra pedidos pendentes que têm como destino as lojas dessa rota
            $pedidos = \App\Models\Pedido::whereIn('user_id', $request->stops)
                ->whereIn('status', ['separado', 'aguardando_rota'])
                ->get();

            foreach ($pedidos as $pedido) {
                $pedido->update([
                    'status' => 'rota_confirmada',
                    'previsao_entrega' => $request->date
                ]);
                
                $pedido->motos()->update(['status' => 'rota_confirmada']);
                
                \App\Models\PedidoLog::create([
                    'pedido_id' => $pedido->id,
                    'user_id' => Auth::id(),
                    'acao' => 'Rota Confirmada 🗺️',
                    'descricao' => "O CD agendou uma rota que passa nesta loja para o dia " . Carbon::parse($request->date)->format('d/m/Y') . ".",
                ]);
            }
            
            
            // Não precisa retornar nada aqui dentro, ou se retornar, não use esse valor fora.
        });

        // 2. O RETORNO TEM QUE SER AQUI (REDIRECT INERTIA)
        return back()->with('success', $request->id ? 'Rota atualizada com sucesso!' : 'Rota criada com sucesso!');
    }

    public function destroy($id)
    {
        // O FullCalendar pode enviar '15-42' ou apenas '15'. 
        // Garantimos que pegamos o ID da VIAGEM (parte antes do hífen).
        $realId = intval(explode('-', $id)[0]);
        
        $schedule = Schedule::findOrFail($realId);
        
        // Opcional: Bloquear exclusão de passado
        if (Carbon::parse($schedule->date)->startOfDay()->lt(now()->startOfDay())) {
             return back()->withErrors(['erro' => 'Não é possível excluir rotas que já ocorreram no passado.']);
        }

        // --- REGRESSÃO DE STATUS ---
        $lojasId = $schedule->stops()->pluck('user_id')->toArray();

        // Deletar a rota (garante a limpeza manual)
        $schedule->stops()->delete();
        $schedule->delete(); 

        // Recuperar pedidos ligados a essas lojas que estão em 'rota_confirmada'
        if (!empty($lojasId)) {
            $pedidos = \App\Models\Pedido::with('origem')->whereIn('user_id', $lojasId)
                ->where('status', 'rota_confirmada')
                ->get();

            foreach ($pedidos as $pedido) {
                // Tenta achar outra rota futura para o mesmo destino
                $outraRota = \App\Models\ScheduleStop::where('user_id', $pedido->user_id)
                    ->join('schedules', 'schedule_stops.schedule_id', '=', 'schedules.id')
                    ->whereDate('schedules.date', '>=', now()->startOfDay())
                    ->orderBy('schedules.date', 'asc')
                    ->first();

                if ($outraRota) {
                    $pedido->update(['previsao_entrega' => $outraRota->date]);
                    \App\Models\PedidoLog::create([
                        'pedido_id' => $pedido->id,
                        'user_id' => Auth::id(),
                        'acao' => 'Mudança de Rota 📅',
                        'descricao' => "A rota original foi cancelada, mas o pedido foi reengatado na próxima viagem prevista para " . Carbon::parse($outraRota->date)->format('d/m/Y') . "."
                    ]);
                } else {
                    $pedido->update(['previsao_entrega' => null]);
                    
                    $isTransferencia = $pedido->origem_user_id && $pedido->origem && $pedido->origem->perfil === 'loja';
                    
                    if ($isTransferencia) {
                        if ($pedido->origem->is_interior && $pedido->created_at >= '2026-03-12 00:00:00') {
                            $novoStatus = 'aguardando_rota';
                            $msg = "A rota de envio foi cancelada pelo CD. O pedido retornou para a fila de espera do calendário.";
                        } else {
                            $novoStatus = 'aguardando_coleta';
                            $msg = "A previsão de rota foi cancelada pelo calendário. A coleta ainda segue pendente aguardando o CD.";
                        }
                    } else {
                        $novoStatus = 'separado';
                        $msg = "A rota de envio programada pelo CD foi excluída. O pedido retornou ao status de separado aguardando nova programação.";
                    }
                    
                    $pedido->update(['status' => $novoStatus]);
                    $pedido->motos()->update(['status' => $novoStatus]);
                    
                    \App\Models\PedidoLog::create([
                        'pedido_id' => $pedido->id,
                        'user_id' => Auth::id(),
                        'acao' => 'Rota Cancelada ❌',
                        'descricao' => $msg
                    ]);
                }
            }
        }

        return back()->with('success', 'Viagem removida e pedidos reajustados para a fila.');
    }
}