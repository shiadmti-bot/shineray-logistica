<?php

use App\Models\Pedido;
use App\Models\Moto;
use App\Models\Romaneio;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\MotoController;
use App\Http\Controllers\PedidoController;
use App\Http\Controllers\RomaneioController;
use App\Http\Controllers\UserController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

// --- ROTA PARA CORRIGIR NUMERAÇÃO DOS ROMANEIOS ---
Route::get('/corrigir-numeracao', function () {
    try {
        // 1. Descobre qual é o último ID usado (Ex: 1)
        $ultimoId = \App\Models\Romaneio::max('id') ?? 0;
        
        // 2. Define o próximo número como Último + 1 (Ex: 2)
        $proximoId = $ultimoId + 1;

        // 3. Força o banco de dados a reiniciar a contagem
        // Nota: Funciona para MySQL/MariaDB/TiDB
        \Illuminate\Support\Facades\DB::statement("ALTER TABLE romaneios AUTO_INCREMENT = {$proximoId};");

        return "Numeração corrigida! O último romaneio foi #{$ultimoId}. O próximo será #{$proximoId}.";
    } catch (\Exception $e) {
        return "Erro ao corrigir: " . $e->getMessage();
    }
});

Route::post('/notificacoes/ler', function () {
    auth()->user()->unreadNotifications->markAsRead();
    return back();
})->name('notificacoes.ler');

// Tela Inicial (Redireciona para Login)
Route::get('/', function () {
    return redirect()->route('login');
});

// --- DASHBOARD (LÓGICA RESPONSIVA CENTRALIZADA) ---
Route::get('/dashboard', function () {
    $user = Auth::user();
    $stats = [];

    // 1. VISÃO DE DIRETORIA / ADMIN
    if ($user->perfil === 'admin') {
        $stats = [
            'total_pedidos'   => Pedido::count(),
            // Conta pedidos que não estão nem cancelados nem concluídos (fila ativa)
            'em_andamento'    => Pedido::whereNotIn('status', ['concluido', 'cancelado'])->count(),
            // Conta cargas que saíram (Romaneios em trânsito)
            'cargas_transito' => Romaneio::where('status', 'em_transito')->count(),
            'cancelados'      => Pedido::where('status', 'cancelado')->count(),
        ];
    } 
    // 2. VISÃO DO CD (FÁBRICA/OPERACIONAL)
    elseif ($user->perfil === 'cd') {
        $stats = [
            // O cartão amarelo "Novas Solicitações"
            'pendentes'    => Pedido::where('status', 'solicitado')->count(),
            // Motos separadas mas ainda sem romaneio (Pool)
            'no_patio'     => Moto::where('status', 'separado')->count(), 
            // Total de cargas expedidas na história
            'cargas_total' => Romaneio::count(),
            // Meta diária (entregas finalizadas hoje)
            'hoje'         => Pedido::where('status', 'concluido')
                                    ->whereDate('updated_at', now())
                                    ->count(),
        ];
    } 
    // 3. VISÃO DA LOJA (REVENDEDOR)
    else {
        $stats = [
            // Histórico total daquela loja
            'meus_pedidos' => Pedido::where('user_id', $user->id)->count(),
            // O que está para chegar (Motos em trânsito ou expedidas)
            'receber'      => Pedido::where('user_id', $user->id)
                                    ->whereIn('status', ['em_transito', 'expedido'])
                                    ->count(),
        ];
    }

    return Inertia::render('Dashboard', [
        'stats'  => $stats,
        'perfil' => $user->perfil
    ]);
})->middleware(['auth', 'verified'])->name('dashboard');
// Rota da Central de Ajuda
Route::get('/manual', function () {
    return Inertia::render('Manual');
})->name('manual');

// --- GRUPO DE ROTAS AUTENTICADAS ---
Route::middleware('auth')->group(function () {

    // --- CHAT EM TEMPO REAL ---
    Route::get('/chat/{pedidoId}/messages', [App\Http\Controllers\ChatController::class, 'index'])->name('chat.index');
    Route::post('/chat/{pedidoId}/messages', [App\Http\Controllers\ChatController::class, 'store'])->name('chat.store');
    Route::post('/chat/{pedidoId}/read', [App\Http\Controllers\ChatController::class, 'markAsRead'])->name('chat.read');

    // ==============================
    // 1. GESTÃO DE USUÁRIOS (ADMIN)
    // ==============================
    Route::get('/usuarios', [UserController::class, 'index'])->name('users.index');
    Route::get('/usuarios/novo', [UserController::class, 'create'])->name('users.create');
    Route::post('/usuarios', [UserController::class, 'store'])->name('users.store');
    Route::delete('/usuarios/{id}', [UserController::class, 'destroy'])->name('users.destroy');

    // ==============================
    // 2. PEDIDOS (CORE)
    // ==============================
    
    // Listagem e Exportação
    Route::get('/pedidos', [PedidoController::class, 'index'])->name('pedidos.index');
    Route::get('/pedidos/exportar', [PedidoController::class, 'exportar'])->name('pedidos.exportar');
    
    // Criação (Loja)
    Route::get('/solicitar', [PedidoController::class, 'create'])->name('solicitar');
    Route::post('/solicitar', [PedidoController::class, 'store'])->name('pedidos.store');
    Route::get('/pedido-sucesso', [PedidoController::class, 'sucesso'])->name('pedidos.sucesso');

    // Detalhes
    Route::get('/pedidos/{id}', [PedidoController::class, 'show'])->name('pedidos.show');
    Route::get('/pedidos/{id}/imprimir', [PedidoController::class, 'imprimir'])->name('pedidos.imprimir');

    // Ações de Fluxo (Loja/CD)
    Route::post('/pedidos/{id}/separar', [PedidoController::class, 'marcarSeparado'])->name('pedidos.separar');
    Route::post('/pedidos/{id}/cancelar-proprio', [PedidoController::class, 'cancelarSolicitacao'])->name('pedidos.cancelarProprio');
    Route::post('/pedidos/{id}/rejeitar', [PedidoController::class, 'rejeitar'])->name('pedidos.rejeitar');
    Route::post('/pedidos/{id}/finalizar', [PedidoController::class, 'finalizarEntrega'])->name('pedidos.finalizar');
    
    // Rotas de Legado/Compatibilidade
    Route::post('/pedidos/{id}/saida', [PedidoController::class, 'confirmarSaida'])->name('pedidos.saida');
    Route::post('/pedidos/{id}/romaneio', [PedidoController::class, 'gerarRomaneio'])->name('pedidos.gerarRomaneio');


    // ==============================
    // 3. ROMANEIOS (CARGAS/EXPEDIÇÃO)
    // ==============================
    Route::get('/expedicao', [RomaneioController::class, 'index'])->name('romaneios.index');
    Route::get('/expedicao/nova', [RomaneioController::class, 'create'])->name('romaneios.create');
    Route::post('/expedicao', [RomaneioController::class, 'store'])->name('romaneios.store');
    Route::get('/expedicao/{id}', [RomaneioController::class, 'show'])->name('romaneios.show');
    
    // Ações de Carga
    Route::post('/expedicao/{id}/saida', [RomaneioController::class, 'iniciarTransito'])->name('romaneios.saida');
    Route::delete('/expedicao/{id}', [RomaneioController::class, 'destroy'])->name('romaneios.destroy');


    // ==============================
    // 4. MOTOS (BASE DE DADOS)
    // ==============================
    Route::get('/motos', [MotoController::class, 'index'])->name('motos.index');


    // ==============================
    // 5. PERFIL DO USUÁRIO
    // ==============================
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';