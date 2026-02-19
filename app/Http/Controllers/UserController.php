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
                // Permite Admin e Gestor (Diretoria) gerenciarem usuários
                if (!in_array(Auth::user()->perfil, ['admin', 'gestor'])) {
                    abort(403, 'ACESSO NEGADO: Você não tem permissão para gerenciar usuários.');
                }
                return $next($request);
            }),
        ];
    }

    // --- 1. LISTAGEM (INDEX) ---
    public function index(Request $request)
    {
        $users = User::with('defaultRoute') // Carrega a relação da rota
            ->when($request->search, function ($query, $search) {
                $query->where('name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%")
                      ->orWhere('filial', 'like', "%{$search}%");
            })
            ->orderBy('last_seen_at', 'desc') // Prioriza quem está online/recente
            ->paginate(10)
            ->through(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'perfil' => $user->perfil,
                    'filial' => $user->filial,
                    'is_online' => $user->last_seen_at && $user->last_seen_at->diffInMinutes(now()) < 5,
                    'last_seen_human' => $user->last_seen_at ? $user->last_seen_at->diffForHumans() : 'Nunca',
                    // --- O PULO DO GATO ESTÁ AQUI ---
                    // Se esta linha não existir, o frontend recebe 'undefined' e mostra Capital por padrão
                    'is_interior' => (bool) $user->is_interior, 
                    'default_route' => $user->defaultRoute ? [
                        'id' => $user->defaultRoute->id, 
                        'code' => $user->defaultRoute->code
                    ] : null,
                ];
            });

        return Inertia::render('Users/Index', [
            'users' => $users,
            'filters' => $request->only(['search'])
        ]);
    }

    // --- 2. TELA DE CRIAÇÃO ---
    public function create()
    {
        // Carrega filiais para o select
        $filiais = Filial::orderBy('uf', 'desc')->orderBy('cidade')->get();
        
        // v2.0: Carrega rotas ativas para o select
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
            'perfil' => 'required|in:loja,cd,admin,gestor', // Adicionei gestor
            'filial' => 'nullable|string',
            'default_route_id' => 'nullable|exists:routes,id', // Validação v2.0
        ]);

        User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'perfil' => $request->perfil,
            'filial' => $request->filial ?? 'Matriz',
            'default_route_id' => $request->default_route_id, // Salva a rota
        ]);

        return redirect()->route('users.index')->with('success', 'Usuário criado com sucesso!');
    }

    // --- 4. TELA DE EDIÇÃO (NOVO - Faltava isso!) ---
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

    // --- 5. ATUALIZAR (UPDATE - NOVO - Faltava isso!) ---
    public function update(Request $request, User $user)
    {
        // 1. Validação (Adicionamos as regras novas)
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,'.$user->id,
            'perfil' => 'required|string',
            'filial' => 'nullable|string',
            
            // Regras da V2
            'default_route_id' => 'nullable|exists:schedules,id',
            'is_interior' => 'boolean', // Aceita true/false/1/0
            
            // Senha opcional
            'password' => 'nullable|string|min:8|confirmed',
        ]);

        // 2. Tratamento da Senha (só altera se preenchida)
        if (empty($validated['password'])) {
            unset($validated['password']);
        } else {
            $validated['password'] = bcrypt($validated['password']);
        }

        // 3. Atualização (Agora vai funcionar porque está no $fillable)
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