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

// --- ROTA DE DIAGNÓSTICO DO GOOGLE DRIVE ---
Route::get('/teste-drive', function () {
    // 1. Pega a configuração que o Laravel carregou
    $config = config('filesystems.disks.google');
    
    // 2. Verifica se a chave JSON foi lida corretamente
    $credenciais = $config['serviceAccountCredentials'] ?? null;
    $temCredenciais = is_array($credenciais) && !empty($credenciais);
    
    // 3. Mascara a chave para mostrar na tela com segurança
    $chaveMascarada = $temCredenciais 
        ? substr($credenciais['private_key_id'] ?? 'ERRO', 0, 10) . '...' 
        : 'NENHUMA (NULL)';

    // 4. Teste de Permissão da Pasta (Só se tiver credenciais)
    $testeConexao = 'Não testado (Falta credencial)';
    if ($temCredenciais) {
        try {
            $testeConexao = 'Tentando listar arquivos... ';
            $arquivos = Storage::disk('google')->files();
            $testeConexao .= 'SUCESSO! Encontrei ' . count($arquivos) . ' arquivos.';
        } catch (\Exception $e) {
            $testeConexao = 'FALHA: ' . $e->getMessage();
        }
    }

    return response()->json([
        'diagnostico' => [
            'folder_id' => $config['folder'] ?? 'VAZIO',
            'leu_credenciais' => $temCredenciais ? 'SIM' : 'NÃO (O problema está aqui)',
            'chave_id_lida' => $chaveMascarada,
            'teste_conexao' => $testeConexao,
        ]
    ]);
});