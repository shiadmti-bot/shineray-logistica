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
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

// --- ROTA DE LIMPEZA DE DADOS DE TESTE ---
Route::get('/limpar-transacoes', function () {
    
    // 1. Desativa a proteção de Chave Estrangeira (para poder apagar sem ordem específica)
    Schema::disableForeignKeyConstraints();

    // 2. Limpa tabelas de LOGS e CHAT
    DB::table('pedido_logs')->truncate();
    DB::table('messages')->truncate();
    DB::table('notifications')->truncate();

    // 3. Limpa tabelas de RELACIONAMENTO (Pivô)
    // Se você usa tabela pivo 'pedido_moto', limpe-a. 
    // Se usa apenas 'pedido_moto' no banco, o comando abaixo garante.
    Schema::hasTable('pedido_moto') ? DB::table('pedido_moto')->truncate() : null;

    // 4. Limpa as tabelas PRINCIPAIS
    \App\Models\Romaneio::truncate();
    \App\Models\Pedido::truncate();
    
    // 5. O que fazer com as MOTOS (Chassis)?
    // OPÇÃO A: Apagar todos os chassis cadastrados (Começar do zero)
    \App\Models\Moto::truncate(); 

    // 6. Reativa a proteção do banco
    Schema::enableForeignKeyConstraints();

    return "Limpeza Concluída! Pedidos, Cargas e Logs foram apagados. Usuários e Modelos foram mantidos.";
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

// Grupo do Gestor
Route::middleware(['auth', 'verified'])->prefix('gestor')->name('gestor.')->group(function () {
    Route::get('/', [App\Http\Controllers\GestorController::class, 'index'])->name('index');
    Route::get('/{id}', [App\Http\Controllers\GestorController::class, 'show'])->name('show');
    Route::post('/aprovar/{id}', [App\Http\Controllers\GestorController::class, 'aprovar'])->name('aprovar');
});

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