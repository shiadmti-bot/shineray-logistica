<?php

use App\Models\Pedido;
use App\Models\Moto;
use App\Models\Romaneio;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\MotoController;
use App\Http\Controllers\PedidoController;
use App\Http\Controllers\RomaneioController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\GestorController; 
use App\Http\Controllers\ChatController;   
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

// --- ROTA PÚBLICA (LOGIN) ---
Route::get('/', function () {
    return redirect()->route('login');
});

// --- TODAS AS ROTAS PROTEGIDAS (LOGIN OBRIGATÓRIO) ---
Route::middleware(['auth', 'verified'])->group(function () {

    // --- DASHBOARD (LÓGICA RESPONSIVA CENTRALIZADA) ---
Route::get('/dashboard', function () {
    $user = Auth::user();

    // 1. SE FOR GESTOR -> Redireciona para o Painel de Aprovação
    if ($user->perfil === 'gestor') {
        return redirect()->route('gestor.index');
    }

    $stats = [];

    // 2. VISÃO DE DIRETORIA / ADMIN
    if ($user->perfil === 'admin') {
        $stats = [
            'total_pedidos'   => Pedido::count(),
            'em_andamento'    => Pedido::whereNotIn('status', ['concluido', 'cancelado'])->count(),
            'cargas_transito' => Romaneio::where('status', 'em_transito')->count(),
            'cancelados'      => Pedido::where('status', 'cancelado')->count(),
        ];
    } 
    // 3. VISÃO DO CD (FÁBRICA/OPERACIONAL)
    elseif ($user->perfil === 'cd') {
        $stats = [
            'pendentes'    => Pedido::where('status', 'solicitado')->count(),
            'no_patio'     => Moto::where('status', 'separado')->count(), 
            'cargas_total' => Romaneio::count(),
            'hoje'         => Pedido::where('status', 'concluido')->whereDate('updated_at', now())->count(),
        ];
    } 
    // 4. VISÃO DA LOJA (REVENDEDOR)
    else {
        $stats = [
            'meus_pedidos' => Pedido::where('user_id', $user->id)->count(),
            'receber'      => Pedido::where('user_id', $user->id)->whereIn('status', ['em_transito', 'expedido'])->count(),
        ];
    }

    return Inertia::render('Dashboard', [
        'stats'  => $stats,
        'perfil' => $user->perfil
    ]);
})->middleware(['auth', 'verified'])->name('dashboard');

    Route::get('/manual', function () { return Inertia::render('Manual'); })->name('manual');

    // 2. UTILITÁRIOS
    Route::post('/notificacoes/ler', function () {
        auth()->user()->unreadNotifications->markAsRead();
        return back();
    })->name('notificacoes.ler');

    // 3. GESTOR COMERCIAL (APROVAÇÃO)
    Route::prefix('gestor')->name('gestor.')->group(function () {
        Route::get('/', [GestorController::class, 'index'])->name('index');
        Route::get('/{id}', [GestorController::class, 'show'])->name('show');
        Route::post('/aprovar/{id}', [GestorController::class, 'aprovar'])->name('aprovar');
    });

    // 4. CHAT
    Route::get('/chat/{pedidoId}/messages', [ChatController::class, 'index'])->name('chat.index');
    Route::post('/chat/{pedidoId}/messages', [ChatController::class, 'store'])->name('chat.store');
    Route::post('/chat/{pedidoId}/read', [ChatController::class, 'markAsRead'])->name('chat.read');

    // 5. USUÁRIOS (ADMIN)
    Route::get('/usuarios', [UserController::class, 'index'])->name('users.index');
    Route::get('/usuarios/novo', [UserController::class, 'create'])->name('users.create');
    Route::post('/usuarios', [UserController::class, 'store'])->name('users.store');
    Route::delete('/usuarios/{id}', [UserController::class, 'destroy'])->name('users.destroy');

    // 6. PEDIDOS
    Route::get('/pedidos', [PedidoController::class, 'index'])->name('pedidos.index');
    Route::get('/pedidos/exportar', [PedidoController::class, 'exportar'])->name('pedidos.exportar');
    Route::get('/solicitar', [PedidoController::class, 'create'])->name('solicitar');
    Route::post('/solicitar', [PedidoController::class, 'store'])->name('pedidos.store');
    Route::get('/pedido-sucesso', [PedidoController::class, 'sucesso'])->name('pedidos.sucesso');
    Route::get('/pedidos/{id}', [PedidoController::class, 'show'])->name('pedidos.show');
    Route::get('/pedidos/{id}/imprimir', [PedidoController::class, 'imprimir'])->name('pedidos.imprimir');
    
    // Ações de Fluxo
    Route::post('/pedidos/{id}/separar', [PedidoController::class, 'marcarSeparado'])->name('pedidos.separar');
    Route::post('/pedidos/{id}/cancelar-proprio', [PedidoController::class, 'cancelarSolicitacao'])->name('pedidos.cancelarProprio');
    Route::post('/pedidos/{id}/rejeitar', [PedidoController::class, 'rejeitar'])->name('pedidos.rejeitar');
    Route::post('/pedidos/{id}/finalizar', [PedidoController::class, 'finalizarEntrega'])->name('pedidos.finalizar');
    Route::post('/pedidos/{id}/saida', [PedidoController::class, 'confirmarSaida'])->name('pedidos.saida'); // Compatibilidade

    // 7. EXPEDIÇÃO (ROMANEIOS)
    Route::get('/expedicao', [RomaneioController::class, 'index'])->name('romaneios.index');
    Route::get('/expedicao/nova', [RomaneioController::class, 'create'])->name('romaneios.create');
    Route::post('/expedicao', [RomaneioController::class, 'store'])->name('romaneios.store');
    Route::get('/expedicao/{id}', [RomaneioController::class, 'show'])->name('romaneios.show');
    Route::post('/expedicao/{id}/saida', [RomaneioController::class, 'iniciarTransito'])->name('romaneios.saida');
    Route::delete('/expedicao/{id}', [RomaneioController::class, 'destroy'])->name('romaneios.destroy');

    // 8. MOTOS
    Route::get('/motos', [MotoController::class, 'index'])->name('motos.index');

    // 9. PERFIL
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // ⚠️ ROTA DE EMERGÊNCIA (Descomente se precisar limpar, mas mantenha protegida)
    /*
    Route::get('/limpar-transacoes', function () {
        if (Auth::user()->perfil !== 'admin') abort(403);
        Schema::disableForeignKeyConstraints();
        DB::table('pedido_logs')->truncate();
        DB::table('messages')->truncate();
        DB::table('notifications')->truncate();
        Schema::hasTable('pedido_moto') ? DB::table('pedido_moto')->truncate() : null;
        \App\Models\Romaneio::truncate();
        \App\Models\Pedido::truncate();
        \App\Models\Moto::truncate(); 
        Schema::enableForeignKeyConstraints();
        return "Limpeza Concluída!";
    });
    */
});

require __DIR__.'/auth.php';