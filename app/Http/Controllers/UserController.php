<?php

namespace App\Http\Controllers;
use App\Models\Filial;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use Carbon\Carbon;

class UserController extends Controller implements HasMiddleware
{
    // --- NOVA FORMA DE DEFINIR MIDDLEWARE NO LARAVEL 11 ---
    public static function middleware(): array
    {
        return [
            new Middleware(function ($request, $next) {
                // A Lógica de Segurança fica aqui
                if (Auth::user()->perfil !== 'admin') {
                    abort(403, 'ACESSO NEGADO: Apenas administradores podem gerenciar usuários.');
                }
                return $next($request);
            }),
        ];
    }

    // Lista de Usuários
public function index(Request $request)
    {
        $termo = $request->input('search');

        $users = User::query()
            ->when($termo, function($q) use ($termo) {
                $q->where('name', 'like', "%{$termo}%")
                  ->orWhere('email', 'like', "%{$termo}%")
                  ->orWhere('filial', 'like', "%{$termo}%");
            })
            ->orderBy('last_seen_at', 'desc') // Ordenar pelos mais recentes online
            ->paginate(10)
            ->through(function ($user) {
                // Lógica de "Online"
                $isOnline = false;
                if ($user->last_seen_at) {
                    $lastSeen = Carbon::parse($user->last_seen_at);
                    // Se foi visto nos últimos 5 minutos, está online
                    if ($lastSeen->diffInMinutes(now()) < 5) {
                        $isOnline = true;
                    }
                }

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'perfil' => $user->perfil,
                    'filial' => $user->filial,
                    'last_seen_at' => $user->last_seen_at, // Data bruta
                    'last_seen_human' => $user->last_seen_at ? Carbon::parse($user->last_seen_at)->diffForHumans() : 'Nunca acessou',
                    'is_online' => $isOnline
                ];
            });

        return Inertia::render('Users/Index', [
            'users' => $users,
            'filters' => $request->only(['search'])
        ]);
    }

    // Tela de Criação
    public function create()
    {
        // Manda a lista de filiais ordenadas por UF e depois Cidade
        $filiais = \App\Models\Filial::orderBy('uf', 'desc')->orderBy('cidade')->get();

        return Inertia::render('Users/Create', [
            'filiais' => $filiais
        ]);
    }
    // Salvar Novo Usuário
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'perfil' => 'required|in:loja,cd,admin',
            'filial' => 'nullable|string',
        ]);

        User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'perfil' => $request->perfil,
            'filial' => $request->filial ?? 'Matriz',
        ]);

        return redirect()->route('users.index')
    ->with('success', 'Usuário criado com sucesso!');
    }

    // Excluir Usuário
    public function destroy($id)
    {
        if (Auth::id() == $id) {
            return redirect()->back(); // Não pode excluir a si mesmo
        }

        User::findOrFail($id)->delete();
        return redirect()->back();
    }
}