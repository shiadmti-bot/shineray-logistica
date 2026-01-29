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
    // Carrega as motos com o Pedido ATUAL e o Usuário (Loja) desse pedido
    $query = Moto::with(['pedidos' => function($q) {
        // Pega apenas o último pedido vinculado para saber quem está com a moto agora
        $q->latest()->limit(1)->with('user');
    }]);

    // 1. Filtro de Texto (Chassi ou Modelo)
    if ($request->filled('search')) {
        $term = $request->search;
        $query->where(function($q) use ($term) {
            $q->where('chassi', 'like', "%{$term}%")
              ->orWhere('modelo', 'like', "%{$term}%");
        });
    }

    // 2. Filtro de Status
    if ($request->filled('status')) {
        $query->where('status', $request->status);
    }

    // 3. Filtro de Loja (Complexo: busca dentro do relacionamento)
    if ($request->filled('loja_id')) {
        $query->whereHas('pedidos', function($q) use ($request) {
            $q->where('user_id', $request->loja_id)
              ->where(function($sub) {
                  // Filtra apenas se o pedido estiver ativo (não cancelado)
                  $sub->where('status', '!=', 'cancelado');
              });
        });
    }

    // Pega lista de lojas para o select de filtro
    $lojas = \App\Models\User::where('perfil', 'loja')
        ->orderBy('filial')
        ->select('id', 'filial', 'name')
        ->get();

    return Inertia::render('Motos/Index', [
        'motos' => $query->orderBy('updated_at', 'desc')->paginate(20)->withQueryString(),
        'lojas' => $lojas,
        'filters' => $request->only(['search', 'status', 'loja_id'])
    ]);
}
}