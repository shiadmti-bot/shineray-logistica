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
                
                // Define se é relevante para quem está logado
                $isMyStop = ($stop->user_id === $myId);
                
                // Visualização: Verde se for Destino Final, Laranja se for Escala
                $isDestinoFinal = ($stop->type === 'destination');
                
                $events[] = [
                    'id' => $sched->id . '-' . $stop->id, // ID Único composto
                    'real_id' => $sched->id,
                    'title' => $stop->loja->filial ?? 'Loja Removida',
                    'start' => $sched->date,
                    'extendedProps' => [
                        'type' => $isDestinoFinal ? 'destino' : 'escala',
                        'status' => $sched->status,
                        // Se sou loja e essa parada não é minha, mostro cinza
                        'is_my_route' => $canManage || $isMyStop,
                        'sequence' => $stop->sequence, // Para mostrar "1ª Parada", "2ª Parada"
                        'description' => $isDestinoFinal ? 'Descarga Total (Fim da Rota)' : "Parada nº {$stop->sequence} (Milk Run)",
                        'rota_completa' => $this->formatarRotaCompleta($sched->stops)
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

    // Helper para gerar texto: "Castanhal -> Belém -> Ananindeua"
    private function formatarRotaCompleta($stops)
    {
        return $stops->map(fn($s) => $s->loja->filial)->join(' ➔ ');
    }

    public function getRotas()
    {
        return response()->json(
            User::where('perfil', 'loja')
                ->where('is_interior', true) 
                ->select('id', 'filial as name')
                ->orderBy('filial')
                ->get()
        );
    }

    public function store(Request $request)
    {
        // Validação mais complexa agora (array de paradas)
        $request->validate([
            'date' => 'required|date|after_or_equal:today', 
            'status' => 'required|in:confirmed,planned',
            'stops' => 'required|array|min:1', // Pelo menos 1 destino
            'stops.*' => 'exists:users,id' // Cada item do array deve ser uma loja válida
        ]);

        return DB::transaction(function () use ($request) {
            // 1. Cria a Viagem (Cabeçalho)
            $schedule = Schedule::create([
                'date' => $request->date,
                'status' => $request->status,
                'created_by' => Auth::id()
            ]);

            // 2. Cria as Paradas (Detalhes)
            $totalStops = count($request->stops);
            
            foreach ($request->stops as $index => $lojaId) {
                // O último item do array é o Destino Final, os anteriores são Escalas
                $isLast = ($index === $totalStops - 1);
                
                ScheduleStop::create([
                    'schedule_id' => $schedule->id,
                    'user_id' => $lojaId,
                    'sequence' => $index + 1, // 1, 2, 3...
                    'type' => $isLast ? 'destination' : 'scale'
                ]);
            }
        });

        return back()->with('success', 'Rota multi-paradas criada com sucesso!');
    }

    public function destroy($id)
    {
        // O ID vem visual (ex: 15-42). Pegamos o ID da VIAGEM (15).
        $realId = intval(explode('-', $id)[0]);
        $schedule = Schedule::findOrFail($realId);
        
        if (Carbon::parse($schedule->date)->isPast()) {
            return back()->withErrors(['erro' => 'Não é possível excluir viagens passadas.']);
        }

        $schedule->delete(); // O cascade no banco apaga as stops automaticamente
        return back()->with('success', 'Viagem removida.');
    }
}