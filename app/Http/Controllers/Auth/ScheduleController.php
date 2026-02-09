<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Models\Route;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class ScheduleController extends Controller
{
    // Painel do CD (Gerenciador)
    public function manager(Request $request)
    {
        // Garante que só CD/Admin/Gestor acessa
        if (Auth::user()->perfil === 'loja') {
            abort(403);
        }

        // Carrega todas as rotas ativas para o CD escolher
        $rotas = Route::where('active', true)->orderBy('code')->get();

        // Carrega os agendamentos do mês atual (ou selecionado)
        $mes = $request->input('mes', now()->format('Y-m'));
        $inicio = Carbon::parse($mes)->startOfMonth();
        $fim = Carbon::parse($mes)->endOfMonth();

        $eventos = Schedule::with('route')
            ->whereBetween('date', [$inicio, $fim])
            ->orderBy('date')
            ->get();

        return Inertia::render('Admin/Schedules/Manager', [
            'rotas' => $rotas,
            'eventos' => $eventos,
            'mesAtual' => $mes
        ]);
    }

    // Criar Viagem (Fase de Planejamento)
    public function store(Request $request)
    {
        $request->validate([
            'date' => 'required|date',
            'route_id' => 'required|exists:routes,id',
            'status' => 'in:planned,confirmed' // Planejado vs Confirmado
        ]);

        // Evita duplicidade da mesma rota no mesmo dia
        $existe = Schedule::where('date', $request->date)
            ->where('route_id', $request->route_id)
            ->first();

        if ($existe) {
            return back()->withErrors(['erro' => 'Esta rota já está agendada para este dia.']);
        }

        Schedule::create([
            'date' => $request->date,
            'route_id' => $request->route_id,
            'status' => $request->status, // 'planned' (Prévia) ou 'confirmed' (Definitiva)
            'type' => 'mista'
        ]);

        return back()->with('success', 'Viagem agendada!');
    }

    // Confirmar Viagem (Fase Definitiva)
    public function confirm($id)
    {
        $viagem = Schedule::findOrFail($id);
        $viagem->update(['status' => 'confirmed']);

        return back()->with('success', 'Viagem confirmada para operação!');
    }

    // Remover Viagem
    public function destroy($id)
    {
        Schedule::findOrFail($id)->delete();
        return back()->with('success', 'Viagem removida do calendário.');
    }
}