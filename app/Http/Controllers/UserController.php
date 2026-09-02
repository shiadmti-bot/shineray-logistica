<?php

namespace App\Http\Controllers;

use App\Models\Filial;
use App\Models\User;
use App\Models\Route;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use Carbon\Carbon;

class UserController extends Controller implements HasMiddleware
{
    // --- MIDDLEWARE DE SEGURANÇA ---
    public static function middleware(): array
    {
        return [
            new Middleware(function ($request, $next) {
                // Permite apenas Admin gerenciar usuários
                if (Auth::user()->perfil !== 'admin') {
                    abort(403, 'ACESSO NEGADO: Você não tem permissão para gerenciar usuários.');
                }
                return $next($request);
            }),
        ];
    }

    // --- 1. LISTAGEM (INDEX) ---
    public function index(Request $request)
    {
        $stats = [
            'total' => User::count(),
            'lojas' => User::where('perfil', 'loja')->count(),
            'cd' => User::where('perfil', 'cd')->count(),
            'gestores' => User::whereIn('perfil', ['gestor', 'admin'])->count(),
            'online' => User::where('last_seen_at', '>=', now()->subMinutes(5))->count(),
        ];

        $users = User::with('defaultRoute')
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%")
                      ->orWhere('filial', 'like', "%{$search}%");
                });
            })
            ->when($request->perfil && $request->perfil !== 'all', function ($query) use ($request) {
                if ($request->perfil === 'online') {
                    $query->where('last_seen_at', '>=', now()->subMinutes(5));
                } elseif ($request->perfil === 'gestao') {
                    $query->whereIn('perfil', ['gestor', 'admin']);
                } else {
                    $query->where('perfil', $request->perfil);
                }
            })
            ->orderBy('last_seen_at', 'desc')
            ->paginate(12)
            ->withQueryString()
            ->through(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'perfil' => $user->perfil,
                    'filial' => $user->filial,
                    'is_online' => $user->last_seen_at && $user->last_seen_at->diffInMinutes(now()) < 5,
                    'last_seen_human' => $user->last_seen_at ? $user->last_seen_at->diffForHumans() : 'Nunca',
                    'is_interior' => (bool) $user->is_interior,
                    'valida_pecas' => (bool) $user->valida_pecas,
                    'valida_motos' => (bool) $user->valida_motos,
                    'default_route' => $user->defaultRoute ? [
                        'id' => $user->defaultRoute->id,
                        'code' => $user->defaultRoute->code
                    ] : null,
                ];
            });

        return Inertia::render('Users/Index', [
            'users' => $users,
            'stats' => $stats,
            'filters' => $request->only(['search', 'perfil'])
        ]);
    }

    // --- 2. TELA DE CRIAÇÃO ---
    public function create()
    {
        $filiais = Filial::orderBy('uf', 'desc')->orderBy('cidade')->get();
        $rotas = Route::where('active', true)->orderBy('code')->get();

        return Inertia::render('Users/Create', [
            'filiais' => $filiais,
            'rotas' => $rotas
        ]);
    }

    // --- 3. SALVAR NOVO (STORE) ---
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'perfil' => 'required|in:loja,cd,admin,gestor',
            'filial' => 'nullable|string',
            'default_route_id' => 'nullable|exists:routes,id',
            'is_interior' => 'boolean',
            'valida_pecas' => 'boolean',
            'valida_motos' => 'boolean',
        ]);

        $filial = $request->filial;
        if (empty($filial)) {
            $filial = ($request->perfil === 'cd') ? 'CD Ananindeua' : 'Matriz';
        }

        // Auto-vincula estoque_local_id quando aplicável
        $estoqueLocalId = null;
        if ($request->perfil === 'cd') {
            $estoqueLocalId = \App\Models\EstoqueLocal::where('tipo', \App\Models\EstoqueLocal::TIPO_CD)->value('id');
        } elseif ($request->perfil === 'loja' && $filial) {
            $partes = explode('/', $filial);
            $cidade = trim($partes[0]);
            $estoqueLocalId = \App\Models\EstoqueLocal::where('nome', 'LIKE', "%{$cidade}%")->value('id');
        }

        User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'perfil' => $request->perfil,
            'filial' => $filial,
            'default_route_id' => $request->default_route_id,
            'is_interior' => $request->boolean('is_interior'),
            'valida_pecas' => $request->boolean('valida_pecas'),
            'valida_motos' => $request->boolean('valida_motos'),
            'estoque_local_id' => $estoqueLocalId,
        ]);

        return redirect()->route('users.index')->with('success', 'Usuário criado com sucesso!');
    }

    // --- 4. TELA DE EDIÇÃO ---
    public function edit($id)
    {
        $user = User::findOrFail($id);
        $filiais = Filial::orderBy('uf', 'desc')->orderBy('cidade')->get();
        $rotas = Route::where('active', true)->orderBy('code')->get();

        return Inertia::render('Users/Edit', [
            'usuario' => $user,
            'filiais' => $filiais,
            'rotas' => $rotas
        ]);
    }

    // --- 5. ATUALIZAR (UPDATE) ---
    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,'.$user->id,
            'perfil' => 'required|in:loja,cd,admin,gestor',
            'filial' => 'nullable|string',
            'default_route_id' => 'nullable|exists:routes,id',
            'is_interior' => 'boolean',
            'valida_pecas' => 'boolean',
            'valida_motos' => 'boolean',
            'password' => 'nullable|string|min:8|confirmed',
        ]);

        $validated['is_interior'] = $request->boolean('is_interior');
        $validated['valida_pecas'] = $request->boolean('valida_pecas');
        $validated['valida_motos'] = $request->boolean('valida_motos');

        if (empty($validated['password'])) {
            unset($validated['password']);
        } else {
            $validated['password'] = bcrypt($validated['password']);
        }

        // Se estoque_local_id ainda estiver nulo, sincroniza agora
        if (!$user->estoque_local_id) {
            if ($validated['perfil'] === 'cd') {
                $validated['estoque_local_id'] = \App\Models\EstoqueLocal::where('tipo', \App\Models\EstoqueLocal::TIPO_CD)->value('id');
            } elseif ($validated['perfil'] === 'loja' && !empty($validated['filial'])) {
                $partes = explode('/', $validated['filial']);
                $cidade = trim($partes[0]);
                $validated['estoque_local_id'] = \App\Models\EstoqueLocal::where('nome', 'LIKE', "%{$cidade}%")->value('id');
            }
        }

        $user->update($validated);

        return back()->with('success', 'Dados do usuário atualizados com sucesso!');
    }

    // --- 6. EXCLUIR ---
    public function destroy($id)
    {
        if (Auth::id() == $id) {
            return redirect()->back()->with('error', 'Você não pode excluir a si mesmo.');
        }

        User::findOrFail($id)->delete();
        return redirect()->back()->with('success', 'Usuário removido.');
    }

    public function toggleInterior($id)
    {
        // Segurança extra: impede editar o próprio usuário para não se trancar (opcional)
        if (auth()->id() == $id) {
            return back()->withErrors(['erro' => 'Você não pode alterar sua própria rota logística.']);
        }

        $user = User::findOrFail($id);
    
        // Força a conversão booleana para inverter com segurança
        $user->is_interior = !(bool) $user->is_interior;
        $user->save();

        // Feedback claro
        $status = $user->is_interior ? 'INTERIOR (Via CD)' : 'CAPITAL (Direta)';

        return back()->with('success', "Rota da filial {$user->filial} alterada para: {$status}");
    }
}