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

        // 1. REMOVIDO O "return" DAQUI DA FRENTE DO DB::transaction
        DB::transaction(function () use ($request) {
            
            // Atualiza ou Cria
            $schedule = Schedule::updateOrCreate(
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
        // if (Carbon::parse($schedule->date)->isPast()) { ... }

        $schedule->delete(); 
        // Certifique-se que sua migration de schedule_stops tem ->onDelete('cascade') 
        // Se não tiver, precisa rodar $schedule->stops()->delete() antes.

        return back()->with('success', 'Viagem removida.');
    }
}