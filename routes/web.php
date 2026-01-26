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
        Route::get('/historico', [GestorController::class, 'historico'])->name('historico');
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
    Route::get('/motos', [MotoController::class, 'index'])
    ->middleware('check_perfil:admin,cd,gestor')
    ->name('motos.index');

    // 9. PERFIL
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::post('/user/onesignal', function (\Illuminate\Http\Request $request) {
        $user = \Illuminate\Support\Facades\Auth::user();
        $user->update(['onesignal_id' => $request->onesignal_id]);
        return response()->json(['status' => 'success']);
    })->middleware('auth');

    Route::get('/corrigir-cargas', function() {
    // Busca todas as cargas em trânsito
    $cargas = \App\Models\Romaneio::where('status', 'em_transito')->get();
    $corrigidas = 0;

    foreach ($cargas as $carga) {
        // Conta pedidos pendentes dessa carga
        $pendentes = \App\Models\Pedido::where('romaneio_id', $carga->id)
            ->whereNotIn('status', ['concluido', 'cancelado'])
            ->count();

        // Se não tem pendentes, força finalizar
        if ($pendentes === 0) {
            $carga->update(['status' => 'finalizado']);
            $corrigidas++;
        }
    }

    return "Total de cargas corrigidas: $corrigidas";
});


    Route::get('/teste-drive-final', function () {
        try {
            // 1. Tenta pegar as configs
            $projectId = config('services.google.project_id');
            $email = config('services.google.client_email');
            $privateKey = config('services.google.private_key');
            $folderId = config('services.google.folder_id');

            if (!$privateKey) return "ERRO: Private Key não encontrada no config.";

            // 2. Monta o Cliente (Exatamente como deve ser)
            $client = new \Google\Client();
            $client->setAuthConfig([
                'type' => 'service_account',
                'project_id' => $projectId,
                'private_key_id' => 'random_id',
                // O segredo do \n está aqui:
                'private_key' => str_replace('\\n', "\n", $privateKey),
                'client_email' => $email,
                'client_id' => '1000', // Dummy
                'auth_uri' => 'https://accounts.google.com/o/oauth2/auth',
                'token_uri' => 'https://oauth2.googleapis.com/token',
                'auth_provider_x509_cert_url' => 'https://www.googleapis.com/oauth2/v1/certs',
                'client_x509_cert_url' => 'https://www.googleapis.com/robot/v1/metadata/x509/' . urlencode($email),
            ]);
            $client->setScopes([\Google\Service\Drive::DRIVE]);

            // 3. Tenta listar arquivos na pasta (Prova de Fogo)
            $service = new \Google\Service\Drive($client);
            $results = $service->files->listFiles([
                'q' => "'{$folderId}' in parents",
                'pageSize' => 5,
                'fields' => 'files(id, name)'
            ]);

            return response()->json([
                'status' => 'SUCESSO TOTAL! ✅',
                'mensagem' => 'Conectado como: ' . $email,
                'arquivos_na_pasta' => $results->getFiles()
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'FALHA ❌',
                'erro_tipo' => get_class($e),
                'erro_msg' => $e->getMessage(),
                // Debug da chave (sem mostrar ela toda)
                'debug_key_inicio' => substr(config('services.google.private_key'), 0, 15) . '...',
                'debug_key_tem_barran' => strpos(config('services.google.private_key'), '\\n') !== false ? 'SIM' : 'NÃO',
            ], 500);
        }
    });

});

require __DIR__.'/auth.php';