<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\MotoController;
use App\Http\Controllers\PedidoController;
use App\Http\Controllers\RomaneioController;
use App\Http\Controllers\UserController;
use App\Models\Pedido;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage; // <--- ADICIONADO AQUI NO TOPO (Correto)
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

// Tela Inicial (Login)
Route::get('/', function () {
    return redirect()->route('login');
});

// Dashboard com Lógica de Negócio
Route::get('/dashboard', function () {
    $user = Auth::user();
    $stats = [];

    // --- VISÃO DE DIRETORIA / ADMIN ---
    if ($user->perfil === 'admin') {
        $stats = [
            'total_pedidos' => \App\Models\Pedido::count(),
            'em_andamento' => \App\Models\Pedido::whereIn('status', ['solicitado', 'separado', 'expedido', 'em_transito'])->count(),
            'concluidos' => \App\Models\Pedido::where('status', 'concluido')->count(),
            'cancelados' => \App\Models\Pedido::where('status', 'cancelado')->count(),
            'total_motos' => \App\Models\Moto::count(),
            'cargas_transito' => \App\Models\Romaneio::whereHas('motos', function($q) {
                $q->where('status', 'em_transito');
            })->count()
        ];
    } 
    // --- VISÃO DO CD ---
    elseif ($user->perfil === 'cd') {
        $stats = [
            'pendentes' => \App\Models\Pedido::where('status', 'solicitado')->count(),
            'no_patio' => \App\Models\Moto::where('status', 'separado')->whereNull('romaneio_id')->count(),
            'cargas_total' => \App\Models\Romaneio::count(),
            'hoje' => \App\Models\Pedido::whereDate('updated_at', today())->where('status', 'concluido')->count(),
        ];
    } 
    // --- VISÃO DA LOJA ---
    else {
        $stats = [
            'meus_pedidos' => \App\Models\Pedido::where('user_id', $user->id)->count(),
            'receber' => \App\Models\Pedido::where('user_id', $user->id)->whereIn('status', ['expedido', 'em_transito'])->count(),
        ];
    }

    return Inertia::render('Dashboard', [
        'stats' => $stats,
        'perfil' => $user->perfil
    ]);
})->middleware(['auth', 'verified'])->name('dashboard');

// Rota da Central de Ajuda
Route::get('/manual', function () {
    return Inertia::render('Manual');
})->name('manual');

// --- GRUPO DE ROTAS AUTENTICADAS ---
Route::middleware('auth')->group(function () {

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

// --- ROTA DE DIAGNÓSTICO DE VARIÁVEIS ---
Route::get('/teste-drive', function () {
    // 1. Lê a variável crua (texto)
    $rawJson = env('GOOGLE_CREDENTIALS');
    
    // 2. Tenta decodificar
    $jsonDecoded = json_decode($rawJson, true);
    $jsonError = json_last_error_msg();
    
    // 3. Verifica o ID da pasta
    $folderId = env('GOOGLE_DRIVE_FOLDER');

    return response()->json([
        'status_site' => 'ONLINE (O AppServiceProvider foi limpo)',
        'analise_credenciais' => [
            'tem_conteudo' => !empty($rawJson) ? 'SIM' : 'NÃO (Variável Vazia)',
            'tamanho_texto' => strlen($rawJson ?? ''),
            'json_valido' => ($jsonDecoded !== null) ? 'SIM, JSON VÁLIDO ✅' : 'NÃO, JSON QUEBRADO ❌',
            'erro_json' => ($jsonDecoded === null) ? $jsonError : 'Nenhum',
            'email_robo' => $jsonDecoded['client_email'] ?? 'Não encontrado no JSON',
            'inicio_chave' => substr($rawJson ?? '', 0, 10) . '...',
            'fim_chave' => '...' . substr($rawJson ?? '', -10),
        ],
        'analise_pasta' => [
            'folder_id' => $folderId,
            'parece_valido' => (strlen($folderId) > 20 && !str_contains($folderId, 'http')) ? 'SIM' : 'NÃO (Verifique se colou link)',
        ]
    ]);
});