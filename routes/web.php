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
use Illuminate\Foundation\Application;

/*
|--------------------------------------------------------------------------
| SISTEMA DE MANUTENÇÃO (ACESSO LIBERADO PARA TI)
|--------------------------------------------------------------------------
*/

// 1. Rota Secreta para VOCÊ liberar seu acesso
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

// 3. Rota visual da Manutenção (Esta rota fica FORA do middleware para não dar loop)
Route::get('/manutencao', function () {
    if (Session::has('manutencao_bypass')) {
        return redirect('/dashboard');
    }
    return Inertia::render('Maintenance');
})->name('maintenance');


/*
|--------------------------------------------------------------------------
| ROTAS DO SISTEMA (BLOQUEADAS PELO MIDDLEWARE)
|--------------------------------------------------------------------------
*/

// Agora chamamos a Classe que criamos no Passo 1
Route::middleware([\App\Http\Middleware\VerificarManutencao::class])->group(function () {

    // --- ROTA PÚBLICA (LOGIN) ---
    Route::get('/', function () {
        return redirect()->route('login');
    });

    // --- ROTAS AUTENTICADAS ---
    Route::middleware(['auth', 'verified'])->group(function () {

        // 1. DASHBOARD
        Route::get('/dashboard', function () {
            $user = Auth::user();

            if ($user->perfil === 'gestor') {
                return redirect()->route('gestor.index');
            }

            $stats = [];

            if ($user->perfil === 'admin') {
                $stats = [
                    'total_pedidos'   => Pedido::count(),
                    'em_andamento'    => Pedido::whereNotIn('status', ['concluido', 'cancelado'])->count(),
                    'cargas_transito' => Romaneio::where('status', 'em_transito')->count(),
                    'cancelados'      => Pedido::where('status', 'cancelado')->count(),
                ];
            } 
            elseif ($user->perfil === 'cd') {
                $stats = [
                    'pendentes'    => Pedido::whereIn('status', ['solicitado', 'aprovado'])->count(),
                    'no_patio'     => Moto::where('status', 'separado')->count(), 
                    'cargas_total' => Romaneio::count(),
                    'hoje'         => Pedido::where('status', 'concluido')->whereDate('updated_at', now())->count(),
                ];
            } 
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

        // 2. MANUAL E UTILITÁRIOS
        Route::get('/manual', function () { return Inertia::render('Manual'); })->name('manual');
        
        Route::post('/notificacoes/ler', function () {
            auth()->user()->unreadNotifications->markAsRead();
            return back();
        })->name('notificacoes.ler');

        Route::post('/user/onesignal', function (Request $request) {
            Auth::user()->update(['onesignal_id' => $request->onesignal_id]);
            return response()->json(['status' => 'success']);
        })->name('user.onesignal');

        // 3. GESTOR
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

        // 5. USUÁRIOS
        Route::prefix('usuarios')->name('users.')->group(function () {
            Route::get('/', [UserController::class, 'index'])->name('index');
            Route::get('/novo', [UserController::class, 'create'])->name('create');
            Route::post('/', [UserController::class, 'store'])->name('store');
            Route::delete('/{id}', [UserController::class, 'destroy'])->name('destroy');
        });

        // 6. PEDIDOS
        Route::prefix('pedidos')->name('pedidos.')->group(function () {
            Route::get('/', [PedidoController::class, 'index'])->name('index');
            Route::get('/exportar', [PedidoController::class, 'exportar'])->name('exportar');
            Route::post('/', [PedidoController::class, 'store'])->name('store');
            Route::get('/{id}', [PedidoController::class, 'show'])->name('show');
            Route::get('/{id}/imprimir', [PedidoController::class, 'imprimir'])->name('imprimir');
            
            Route::post('/{id}/aprovar', [PedidoController::class, 'aprovar'])->name('aprovar');
            Route::post('/{id}/separar', [PedidoController::class, 'marcarSeparado'])->name('separar');
            Route::post('/{id}/rejeitar', [PedidoController::class, 'rejeitar'])->name('rejeitar');
            Route::post('/{id}/finalizar', [PedidoController::class, 'finalizarEntrega'])->name('finalizar');
            Route::post('/{id}/saida', [PedidoController::class, 'confirmarSaida'])->name('saida');
            Route::post('/{id}/cancelar', [PedidoController::class, 'cancelarSolicitacao'])->name('cancelar');
            Route::post('/{id}/cancelar-proprio', [PedidoController::class, 'cancelarSolicitacao'])->name('cancelarProprio');
        });

        Route::get('/solicitar', [PedidoController::class, 'create'])->name('solicitar');
        Route::post('/solicitar', [PedidoController::class, 'store']);
        Route::get('/pedido-sucesso', [PedidoController::class, 'sucesso'])->name('pedidos.sucesso');

        // 7. EXPEDIÇÃO
        Route::prefix('expedicao')->name('romaneios.')->group(function () {
            Route::get('/', [RomaneioController::class, 'index'])->name('index');
            Route::get('/nova', [RomaneioController::class, 'create'])->name('create');
            Route::post('/', [RomaneioController::class, 'store'])->name('store');
            Route::get('/{id}', [RomaneioController::class, 'show'])->name('show');
            Route::post('/{id}/saida', [RomaneioController::class, 'iniciarTransito'])->name('saida');
            Route::delete('/{id}', [RomaneioController::class, 'destroy'])->name('destroy');
            Route::post('/{id}/adicionar', [RomaneioController::class, 'adicionarPedido'])->name('adicionar');
            Route::delete('/{id}/remover/{pedidoId}', [RomaneioController::class, 'removerPedido'])->name('remover');
            Route::get('/{id}/imprimir', [RomaneioController::class, 'imprimir'])->name('imprimir');
        });

       // 8. MOTOS
        Route::get('/motos', [MotoController::class, 'index'])
            ->middleware('check_perfil:admin,cd,gestor')
            ->name('motos.index');

        // 9. ESTORNO / RETIRADA DE ITEM (ATUALIZADO)
        
        // Rota UNIFICADA: Serve para o CD (Corte) e para a Loja (Cancelamento/Devolução)
        // Aponta para a nova função 'solicitarRetiradaItem' que criamos no PedidoController
        Route::post('/motos/{id}/solicitar-retirada', [PedidoController::class, 'solicitarRetiradaItem'])
            ->name('motos.solicitarRetirada');

        // Rota para o Gestor aprovar qualquer solicitação (seja do CD ou da Loja)
        Route::post('/motos/{id}/aprovar-estorno', [GestorController::class, 'aprovarEstorno'])
            ->name('gestor.aprovarEstorno');
        
        // 10. PERFIL
        Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
        Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
        Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

        // 11. ROTINA DE CORREÇÃO (ROBUSTA)
        // Acesse: seu-site.com/corrigir-status-romaneios
        Route::get('/corrigir-status-romaneios', function() {
            // Pega tudo que não está finalizado (em_transito, aberto, etc)
            $romaneiosAbertos = \App\Models\Romaneio::whereNotIn('status', ['concluido', 'cancelado'])->get();
            
            $corrigidos = 0;
            $detalhes = [];

            foreach ($romaneiosAbertos as $carga) {
                // 1. Conta quantos pedidos "ativos" (não cancelados) existem na carga
                $totalPedidos = $carga->pedidos()->where('status', '!=', 'cancelado')->count();

                // 2. Se a carga estiver vazia (sem pedidos ou só cancelados), fecha logo
                if ($totalPedidos === 0) {
                    $carga->update(['status' => 'concluido']);
                    $corrigidos++;
                    $detalhes[] = "Carga #{$carga->id} fechada (Vazia ou só cancelados).";
                    continue;
                }

                // 3. Conta quantos pedidos AINDA NÃO estão concluídos
                // (Ignorando cancelados, pois eles não impedem a carga de fechar)
                $pendencias = $carga->pedidos()
                    ->whereNotIn('status', ['concluido', 'cancelado'])
                    ->count();

                // LÓGICA: Se pendências for ZERO, significa que todos os válidos já foram entregues.
                if ($pendencias === 0) {
                    // Fecha a carga
                    $carga->update(['status' => 'concluido']);
                    
                    // Força status 'concluido' nos pedidos filhos (só pra garantir a integridade visual)
                    $carga->pedidos()
                        ->where('status', '!=', 'cancelado')
                        ->update(['status' => 'concluido']);

                    $corrigidos++;
                    $detalhes[] = "Carga #{$carga->id} fechada (Todos os pedidos válidos foram entregues).";
                }
            }

            return [
                'status' => 'Processamento Finalizado',
                'cargas_corrigidas' => $corrigidos,
                'log' => $detalhes
            ];
        });

    });
    

    require __DIR__.'/auth.php';

}); // Fim Middleware Manutenção