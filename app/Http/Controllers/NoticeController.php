<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Notice;

class NoticeController extends Controller
{
    public function store(Request $request) 
    {
        $user = Auth::user();

        // 1. Autorização: Apenas Admin e Gestor
        if (!in_array($user->perfil, ['admin', 'gestor'])) {
            abort(403, 'Acesso negado.');
        }

        // 2. Validação
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'type' => 'required|in:info,warning,success,danger'
        ]);

        // 3. Criação
        Notice::create([
            'title' => $validated['title'],
            'content' => $validated['content'],
            'type' => $validated['type'],
            'created_by' => $user->id,
            'is_active' => true
        ]);

        return back()->with('message', 'Aviso publicado com sucesso!');
    }

    public function destroy($id)
    {
        $user = Auth::user();

        // 1. Autorização
        if (!in_array($user->perfil, ['admin', 'gestor'])) {
            abort(403, 'Acesso negado.');
        }

        // 2. Exclusão (Soft Delete se o model tivesse, mas aqui é delete real ou inativação)
        // Optamos por delete real para limpar o mural
        Notice::destroy($id);

        return back()->with('message', 'Aviso removido!');
    }
}
