<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\MotoController;
use App\Http\Controllers\PedidoController;
use App\Http\Controllers\RomaneioController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\GestorController;
use App\Http\Controllers\ChatController;
use App\Models\Pedido;
use App\Models\Moto;
use App\Models\Romaneio;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Illuminate\Http\Request;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| SISTEMA DE MANUTENÇÃO (BYPASS LOGIC)
|--------------------------------------------------------------------------
*/

// 1. Rota Secreta para VOCÊ liberar seu acesso (Salva cookie na sessão)
// Acesse: seu-site.com/liberar-acesso-ti
Route::get('/liberar-acesso-ti', function () {
    Session::put('manutencao_bypass', true);
    return redirect('/dashboard')->with('message', 'Acesso de TI Liberado!');
});

// 2. Rota para voltar a ver a manutenção
Route::get('/bloquear-acesso', function () {
    Session::forget('manutencao_bypass');
    return redirect('/manutencao');
});

// 3. Rota visual da Manutenção
Route::get('/manutencao', function () {
    if (Session::has('manutencao_bypass')) {
        return redirect('/dashboard');
    }
    return Inertia::render('Maintenance'); // Certifique-se de ter criado o Maintenance.jsx
})->name('maintenance');


/*
|--------------------------------------------------------------------------
| ROTAS DO SISTEMA (PROTEGIDAS PELO MANUTENÇÃO)
|--------------------------------------------------------------------------
*/

// Middleware Lógico: Se não tiver bypass, joga para manutenção.
Route::middleware(function ($request, $next) {
    if (Session::has('manutencao_bypass')) {
        return $next($request);
    }
    return redirect()->route('maintenance');
})->group(function () {

    // --- ROTA PÚBLICA (LOGIN) ---
    Route::get('/', function () {
        return redirect()->route('login');
    });

    // --- ROTAS AUTENTICADAS ---
    Route::middleware(['auth', 'verified'])->group(function () {

        // 1. DASHBOARD CENTRALIZADO
        Route::get('/dashboard', function () {
            $user = Auth::user();

            // Se for Gestor, vai para o painel dele
            if ($user->perfil === 'gestor') {
                return redirect()->route('gestor.index');
            }

            $stats = [];

            // Visão Admin/Diretoria
            if ($user->perfil === 'admin') {
                $stats = [
                    'total_pedidos'   => Pedido::count(),
                    'em_andamento'    => Pedido::whereNotIn('status', ['concluido', 'cancelado'])->count(),
                    'cargas_transito' => Romaneio::where('status', 'em_transito')->count(),
                    'cancelados'      => Pedido::where('status', 'cancelado')->count(),
                ];
            } 
            // Visão CD (Operacional)
            elseif ($user->perfil === 'cd') {
                $stats = [
                    'pendentes'    => Pedido::whereIn('status', ['solicitado', 'aprovado'])->count(), // Ajustado para incluir aprovados se houver
                    'no_patio'     => Moto::where('status', 'separado')->count(), 
                    'cargas_total' => Romaneio::count(),
                    'hoje'         => Pedido::where('status', 'concluido')->whereDate('updated_at', now())->count(),
                ];
            } 
            // Visão Loja
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
        })->name('dashboard');

        // 2. UTILITÁRIOS E MANUAL
        Route::get('/manual', function () { return Inertia::render('Manual'); })->name('manual');
        
        Route::post('/notificacoes/ler', function () {
            auth()->user()->unreadNotifications->markAsRead();
            return back();
        })->name('notificacoes.ler');

        Route::post('/user/onesignal', function (Request $request) {
            Auth::user()->update(['onesignal_id' => $request->onesignal_id]);
            return response()->json(['status' => 'success']);
        })->name('user.onesignal');

        // 3. GESTOR COMERCIAL
        Route::prefix('gestor')->name('gestor.')->group(function () {
            Route::get('/', [GestorController::class, 'index'])->name('index');
            Route::get('/historico', [GestorController::class, 'historico'])->name('historico');
            Route::get('/{id}', [GestorController::class, 'show'])->name('show');
            Route::post('/aprovar/{id}', [GestorController::class, 'aprovar'])->name('aprovar');
        });

        // 4. CHAT INTERNO
        Route::get('/chat/{pedidoId}/messages', [ChatController::class, 'index'])->name('chat.index');
        Route::post('/chat/{pedidoId}/messages', [ChatController::class, 'store'])->name('chat.store');
        Route::post('/chat/{pedidoId}/read', [ChatController::class, 'markAsRead'])->name('chat.read');

        // 5. USUÁRIOS (ADMIN)
        Route::prefix('usuarios')->name('users.')->group(function () {
            Route::get('/', [UserController::class, 'index'])->name('index');
            Route::get('/novo', [UserController::class, 'create'])->name('create');
            Route::post('/', [UserController::class, 'store'])->name('store');
            Route::delete('/{id}', [UserController::class, 'destroy'])->name('destroy');
        });

        // 6. PEDIDOS (CRUD E AÇÕES)
        Route::prefix('pedidos')->name('pedidos.')->group(function () {
            Route::get('/', [PedidoController::class, 'index'])->name('index');
            Route::get('/exportar', [PedidoController::class, 'exportar'])->name('exportar');
            Route::post('/', [PedidoController::class, 'store'])->name('store'); // Rota do POST /pedidos
            Route::get('/{id}', [PedidoController::class, 'show'])->name('show');
            Route::get('/{id}/imprimir', [PedidoController::class, 'imprimir'])->name('imprimir');
            
            // Ações Específicas
            Route::post('/{id}/aprovar', [PedidoController::class, 'aprovar'])->name('aprovar');
            Route::post('/{id}/separar', [PedidoController::class, 'marcarSeparado'])->name('separar');
            Route::post('/{id}/rejeitar', [PedidoController::class, 'rejeitar'])->name('rejeitar');
            Route::post('/{id}/finalizar', [PedidoController::class, 'finalizarEntrega'])->name('finalizar');
            Route::post('/{id}/saida', [PedidoController::class, 'confirmarSaida'])->name('saida');
            Route::post('/{id}/cancelar', [PedidoController::class, 'cancelarSolicitacao'])->name('cancelar'); // Nome padronizado
            Route::post('/{id}/cancelar-proprio', [PedidoController::class, 'cancelarSolicitacao'])->name('cancelarProprio'); // Alias para compatibilidade
        });

        // Rotas Soltas de Pedido (Legado/Atalhos)
        Route::get('/solicitar', [PedidoController::class, 'create'])->name('solicitar');
        Route::post('/solicitar', [PedidoController::class, 'store']); // Alias para store
        Route::get('/pedido-sucesso', [PedidoController::class, 'sucesso'])->name('pedidos.sucesso');

        // 7. EXPEDIÇÃO (ROMANEIOS)
        Route::prefix('expedicao')->name('romaneios.')->group(function () {
            Route::get('/', [RomaneioController::class, 'index'])->name('index');
            Route::get('/nova', [RomaneioController::class, 'create'])->name('create');
            Route::post('/', [RomaneioController::class, 'store'])->name('store');
            Route::get('/{id}', [RomaneioController::class, 'show'])->name('show');
            Route::post('/{id}/saida', [RomaneioController::class, 'iniciarTransito'])->name('saida');
            Route::delete('/{id}', [RomaneioController::class, 'destroy'])->name('destroy');
            // Rotas auxiliares de romaneio
            Route::post('/{id}/adicionar', [RomaneioController::class, 'adicionarPedido'])->name('adicionar');
            Route::delete('/{id}/remover/{pedidoId}', [RomaneioController::class, 'removerPedido'])->name('remover');
            Route::get('/{id}/imprimir', [RomaneioController::class, 'imprimir'])->name('imprimir');
        });

        // 8. MOTOS
        Route::get('/motos', [MotoController::class, 'index'])
            ->middleware('check_perfil:admin,cd,gestor') // Middleware customizado se existir
            ->name('motos.index');

        // 9. PERFIL
        Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
        Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
        Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

        // 10. ROTINA DE CORREÇÃO (MANUAL)
        Route::get('/corrigir-status-romaneios', function() {
            $romaneiosAbertos = \App\Models\Romaneio::whereNotIn('status', ['concluido', 'cancelado'])->get();
            $corrigidos = 0;
            $relatorio = [];

            foreach ($romaneiosAbertos as $carga) {
                $totalPedidos = $carga->pedidos()->count();
                if ($totalPedidos === 0) continue;

                $pedidosProntos = $carga->pedidos()
                    ->whereIn('status', ['concluido', 'finalizado'])
                    ->count();

                if ($totalPedidos === $pedidosProntos) {
                    $carga->update(['status' => 'concluido']);
                    $carga->pedidos()->update(['status' => 'concluido']);
                    $corrigidos++;
                    $relatorio[] = "Carga #{$carga->id} fechada automaticamente.";
                }
            }
            return ['status' => 'Sucesso', 'cargas_corrigidas' => $corrigidos, 'detalhes' => $relatorio];
        });

    }); // Fim do Middleware Auth

    require __DIR__.'/auth.php'; // Rotas de Autenticação (Login, Register, etc)

}); // Fim do Grupo de Manutenção