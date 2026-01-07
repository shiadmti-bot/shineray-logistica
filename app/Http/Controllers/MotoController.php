<?php

namespace App\Http\Controllers;

use App\Models\Moto;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MotoController extends Controller
{
    // A única função necessária: LISTAR O HISTÓRICO
    public function index(Request $request)
    {
        $termo = $request->input('search');
        $ordem = $request->input('ordem', 'registro'); // Padrão: registro (ID)

        $query = Moto::query();

        // Filtro de Busca
        if ($termo) {
            $query->where(function($q) use ($termo) {
                $q->where('chassi', 'like', "%{$termo}%")
                  ->orWhere('modelo', 'like', "%{$termo}%")
                  ->orWhere('cor', 'like', "%{$termo}%");
            });
        }

        // Ordenação
        if ($ordem === 'alfabetica') {
            $query->orderBy('modelo');
        } else {
            $query->orderBy('id', 'desc');
        }

        // Paginação
        $motos = $query->paginate(15);

        return Inertia::render('Motos/Index', [
            'motos' => $motos,
            'filtroAtual' => $ordem,
            'filters' => $request->only(['search', 'ordem'])
        ]);
    }
}