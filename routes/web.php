<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\MotoController;
use App\Http\Controllers\PedidoController;
use App\Http\Controllers\RomaneioController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\FilialController;
use App\Http\Controllers\GestorController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\CalendarController; 
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Pedido;
use App\Models\Moto;
use App\Models\Romaneio;

/*
|--------------------------------------------------------------------------
| SISTEMA DE MANUTENÇÃO (ACESSO TÉCNICO)
|--------------------------------------------------------------------------
*/
Route::get('/liberar-acesso-ti', function () {
    Session::put('manutencao_bypass', true);
    return redirect('/dashboard')->with('message', 'Acesso de TI Liberado!');
});

Route::get('/bloquear-acesso', function () {
    Session::forget('manutencao_bypass');
    return redirect('/manutencao');
});

Route::get('/manutencao', function () {
    if (Session::has('manutencao_bypass')) return redirect('/dashboard');
    return Inertia::render('Maintenance');
})->name('maintenance');



// Webhook para o Vercel Cron rodar o agendador do Laravel
Route::any('/webhook/microwork', function (\Illuminate\Http\Request $request) {
    $authHeader = $request->header('Authorization');
    $cronSecret = env('CRON_SECRET');
    
    if ($cronSecret && $authHeader !== "Bearer $cronSecret") {
        return response()->json(['error' => 'Unauthorized'], 401);
    }

    \Illuminate\Support\Facades\Artisan::call('microwork:sync-estoque');
    \App\Http\Controllers\CalendarController::limparRotasVencidas();

    return response()->json(['message' => 'Estoque e rotas expiradas sincronizados via webhook com sucesso!']);
});

/*
 * Cobrança diária das travas humanas do fluxo de peças.
 *
 * Separado do webhook acima de propósito: aquele roda a cada 10 minutos, e a
 * cadência anti-spam de `pecas:cobrar` só é estável com UMA execução por dia.
 * Misturar os dois transformaria a cobrança em spam de 10 em 10 minutos.
 *
 * Configure no vercel.json para bater uma vez ao dia — ver a chave `crons`.
 */
Route::any('/webhook/pecas-cobranca', function (\Illuminate\Http\Request $request) {
    $authHeader = $request->header('Authorization');
    $cronSecret = env('CRON_SECRET');

    if ($cronSecret && $authHeader !== "Bearer $cronSecret") {
        return response()->json(['error' => 'Unauthorized'], 401);
    }

    \Illuminate\Support\Facades\Artisan::call('pecas:cobrar');

    return response()->json([
        'message' => 'Cobrança de pendências de peças executada.',
        'saida'   => \Illuminate\Support\Facades\Artisan::output(),
    ]);
});

/*
|--------------------------------------------------------------------------
| ROTAS DO SISTEMA (PROTEGIDAS PELO MIDDLEWARE DE MANUTENÇÃO)
|--------------------------------------------------------------------------
*/
Route::middleware([\App\Http\Middleware\VerificarManutencao::class])->group(function () {

    // --- PÚBLICO ---
    Route::get('/', function () { return redirect()->route('login'); });

    // --- AUTENTICADO ---
    Route::middleware(['auth', 'verified'])->group(function () {

        /*
        |--------------------------------------------------------------------------
        | DASHBOARD PRINCIPAL (LÓGICA DE PERFIS)
        |--------------------------------------------------------------------------
        */
        // BI (Business Intelligence) - Novo Módulo
        Route::get('/bi', [\App\Http\Controllers\BiController::class, 'index'])
            ->middleware('check_perfil:admin,gestor') // Apenas Admin e Gestor
            ->name('bi.index');

        Route::get('/bi-debug', function() {
            $p = \App\Models\Pedido::where('status', 'concluido')->latest()->with('logs')->first();
            return $p ? $p->logs : 'Nenhum pedido concluído encontrado.';
        });

        // Integração Microwork (Estoque CD)
        Route::get('/microwork/estoque-cd', [\App\Http\Controllers\Api\EstoqueController::class, 'index'])
            ->middleware(['auth', 'verified'])
            ->name('api.estoque.microwork');
            
        Route::post('/microwork/estoque-cd/reservar', [\App\Http\Controllers\Api\EstoqueController::class, 'reservar'])
            ->middleware(['auth', 'verified'])
            ->name('api.estoque.reservar');

        Route::post('/microwork/buscar-chassis', [\App\Http\Controllers\Api\EstoqueController::class, 'buscarPorChassis'])
            ->middleware(['auth', 'verified'])
            ->name('api.estoque.buscarChassis');

        Route::get('/dashboard', function () {


            $user = Auth::user();

            // Gestor tem dashboard próprio
            if ($user->perfil === 'gestor') return redirect()->route('gestor.index');

            $stats = [];
            
            // ADMIN
            if ($user->perfil === 'admin') {
                $stats = [
                    'total_pedidos'   => Pedido::count(),
                    'em_andamento'    => Pedido::whereNotIn('status', ['concluido', 'cancelado'])->count(),
                    'cargas_transito' => Romaneio::whereIn('status', ['em_transito', 'em_transito_cd'])->count(),
                    'cancelados'      => Pedido::where('status', 'cancelado')->count(),
                ];
            } 
            // CD
            elseif ($user->perfil === 'cd') {
                $stats = [
                    'pendentes'       => Pedido::whereIn('status', ['solicitado', 'aprovado', 'no_cd', 'aguardando_coleta'])->count(),
                    'no_patio'        => Moto::whereIn('status', ['separado', 'no_cd'])->count(),
                    'cargas_transito' => Romaneio::whereIn('status', ['em_transito', 'em_transito_cd'])->count(),
                    'cargas_total'    => Romaneio::count(),
                    'hoje'            => Pedido::where('status', 'concluido')->whereDate('updated_at', now())->count(),
                ];
            } 
            // LOJA
            else { 
                $stats = [
                    'meus_pedidos' => Pedido::where('user_id', $user->id)->count(),
                    
                    // Entradas (O que comprei e está chegando)
                    'receber' => Pedido::where('user_id', $user->id)
                                       ->whereIn('status', ['em_transito', 'expedido', 'em_transito_cd'])
                                       ->count(),
                    
                    // Saídas (O que pediram do meu estoque - Transferência)
                    'transferencias_saida' => Pedido::where('origem_user_id', $user->id)
                                                    ->whereIn('status', ['solicitado', 'aprovado']) 
                                                    ->count()
                ];
            }

            $notices = \App\Models\Notice::where('is_active', true)->orderBy('created_at', 'desc')->get(); // Mural de Avisos

            return Inertia::render('Dashboard', [
                'stats' => $stats, 
                'perfil' => $user->perfil,
                'notices' => $notices
            ]);
        })->name('dashboard');

        Route::get('/manual', function () { return Inertia::render('Manual'); })->name('manual');

        /*
        |--------------------------------------------------------------------------
        | INTEGRAÇÕES (ONESIGNAL & NOTIFICAÇÕES)
        |--------------------------------------------------------------------------
        */
        Route::post('/notificacoes/ler', function () {
            auth()->user()->unreadNotifications->markAsRead();
            return back();
        })->name('notificacoes.ler');

        Route::post('/user/onesignal', function (Request $request) {
            Auth::user()->update(['onesignal_id' => $request->onesignal_id]);
            return response()->json(['status' => 'success']);
        })->name('user.onesignal');


        /*
        |--------------------------------------------------------------------------
        | API INTERNA (SUPORTE AO FRONTEND)
        |--------------------------------------------------------------------------
        */
        // Rota para buscar estoque disponível de uma loja (Transferência)
        Route::get('/interno/estoque-loja', [PedidoController::class, 'buscarEstoqueLoja'])->name('api.estoque.loja');


        /*
        |--------------------------------------------------------------------------
        | MÓDULO 1: PEDIDOS (CORE)
        |--------------------------------------------------------------------------
        */
        Route::prefix('pedidos')->name('pedidos.')->group(function () {
            Route::get('/', [PedidoController::class, 'index'])->name('index');
            Route::post('/', [PedidoController::class, 'store'])->name('store');
            Route::get('/exportar', [PedidoController::class, 'exportar'])->name('exportar');
            
            // Calculadora Logística (V2)
            Route::post('/calcular-logistica', [PedidoController::class, 'calcularLogistica'])->name('logistica');
            
            // Detalhes e Ações
            Route::get('/{id}', [PedidoController::class, 'show'])->name('show');
            Route::get('/{id}/imprimir', [PedidoController::class, 'imprimir'])->name('imprimir');
            Route::post('/{id}/finalizar', [PedidoController::class, 'finalizarEntrega'])->name('finalizar');
            
            // Remoção direta de item do pedido (EXCLUSIVO ADMIN - bypassa o fluxo de estorno/aprovação)
            Route::delete('/{id}/motos/{motoId}', [PedidoController::class, 'removerMotoAdmin'])
                ->middleware('check_perfil:admin')
                ->name('removerMoto');

            // V2.6: Atribuição de chassis pelo CD (Fluxo A — dentro do pedido)
            Route::post('/{id}/atribuir-chassi', [PedidoController::class, 'atribuirChassi'])->name('atribuir_chassi');
            Route::delete('/{id}/chassi/{motoId}', [PedidoController::class, 'desatribuirChassi'])->name('desatribuir_chassi');
            Route::post('/itens/{itemId}/encerrar-saldo', [PedidoController::class, 'encerrarSaldoItem'])->name('encerrar_saldo');

            // Fluxo de Status
            Route::post('/{id}/aprovar', [PedidoController::class, 'aprovar'])->name('aprovar');
            Route::post('/{id}/separar', [PedidoController::class, 'marcarSeparado'])->name('separar');
            Route::post('/{id}/rejeitar', [PedidoController::class, 'rejeitar'])->name('rejeitar');
            Route::post('/{id}/cancelar', [PedidoController::class, 'cancelarSolicitacao'])->name('cancelar');
        });

        // Atalhos de Pedidos
        Route::get('/solicitar', [PedidoController::class, 'create'])->name('solicitar');
        Route::get('/pedido-sucesso', [PedidoController::class, 'sucesso'])->name('pedidos.sucesso');


        /*
        |--------------------------------------------------------------------------
        | MÓDULO 2: LOGÍSTICA (EXPEDIÇÃO, ROTAS E CARGAS)
        |--------------------------------------------------------------------------
        */
        // Calendário de Agendamento (V2)
        Route::prefix('calendario')->name('calendar.')->group(function () {
            Route::get('/', [CalendarController::class, 'index'])->name('index');       
            Route::post('/eventos', [CalendarController::class, 'store'])->name('store'); 
            Route::delete('/eventos/{id}', [CalendarController::class, 'destroy'])->name('destroy'); 
            Route::get('/rotas', [CalendarController::class, 'getRotas'])->name('rotas'); 
        });

        // Romaneios (Cargas) - Apenas CD, Admin e Gestor
        Route::prefix('expedicao')->name('romaneios.')->middleware('check_perfil:cd,admin,gestor')->group(function () {
            Route::get('/', [RomaneioController::class, 'index'])->name('index');
            Route::get('/nova', [RomaneioController::class, 'create'])->name('create');
            Route::post('/', [RomaneioController::class, 'store'])->name('store');

            // V2.6: Atribuição de chassis pelo CD (Fluxo B — bipagem na montagem da carga)
            Route::post('/atribuir-chassi', [RomaneioController::class, 'atribuirChassiCarga'])->name('atribuir_chassi');
            Route::get('/{id}', [RomaneioController::class, 'show'])->name('show');
            Route::delete('/{id}', [RomaneioController::class, 'destroy'])->name('destroy');
            Route::get('/{id}/imprimir', [RomaneioController::class, 'imprimir'])->name('imprimir'); // Redireciona para show/print
            
            // Ações de Logística V2
            Route::post('/{id}/saida', [RomaneioController::class, 'iniciarTransito'])->name('saida');
            Route::post('/{id}/receber', [RomaneioController::class, 'receber'])->name('receber'); // Transbordo
            
            // Milk Run (Ação do Motorista)
            Route::post('/coletar-item/{moto_id}', [RomaneioController::class, 'confirmarColetaItem'])->name('coletar_item');
        });


        /*
        |--------------------------------------------------------------------------
        | MÓDULO 3: GESTÃO DE ESTOQUE (MOTOS)
        |--------------------------------------------------------------------------
        */
        // IMPORTANTE: Rotas específicas ANTES do resource para evitar conflito de ID
        Route::get('/motos/timeline', [MotoController::class, 'timeline'])->name('motos.timeline'); // Nova V2
        Route::post('/motos/{id}/solicitar-retirada', [PedidoController::class, 'solicitarRetiradaItem'])->name('motos.solicitarRetirada');
        
        // Resource Padrão (Index, Store, Update, Destroy)
        // Admin, CD, Gestor e Loja (Loja terá view restrita no Front)
        Route::resource('motos', MotoController::class)->only(['index'])->middleware('check_perfil:admin,cd,gestor,loja');


        /*
        |--------------------------------------------------------------------------
        | MÓDULO 3.2: DEVOLUÇÃO DE MOTOS — LOGÍSTICA REVERSA (V3)
        |--------------------------------------------------------------------------
        | Exclusivo Loja -> CD, e só de moto. A devolução é o DOSSIÊ (checklist
        | nas duas pontas + fotos); o frete continua sendo um Pedido de
        | transferência, criado na aprovação — ver DevolucaoController::aprovar.
        |
        | Três portões, e o middleware de cada rota diz de quem é cada um:
        |   a loja preenche e envia | o gestor decide | o CD confere e fecha.
        */
        Route::prefix('devolucoes')->name('devolucoes.')->group(function () {
            Route::get('/', [\App\Http\Controllers\DevolucaoController::class, 'index'])->name('index');

            // Abertura: quem devolve é a loja (admin entra por herança, mas
            // precisa dizer de qual loja partem as motos).
            Route::get('/nova', [\App\Http\Controllers\DevolucaoController::class, 'create'])
                ->middleware('check_perfil:loja,admin')->name('create');
            Route::post('/', [\App\Http\Controllers\DevolucaoController::class, 'store'])
                ->middleware('check_perfil:loja,admin')->name('store');

            Route::get('/{devolucao}', [\App\Http\Controllers\DevolucaoController::class, 'show'])->name('show');
            Route::get('/{devolucao}/imprimir', [\App\Http\Controllers\DevolucaoController::class, 'imprimir'])->name('imprimir');
            Route::patch('/{devolucao}', [\App\Http\Controllers\DevolucaoController::class, 'update'])->name('update');

            // A conferência: a mesma rota serve às duas etapas. Quem pode
            // escrever em cada uma é decidido por etapa, não por rota — ver
            // DevolucaoController::autorizarEtapa.
            Route::post('/{devolucao}/itens/{item}/conferir', [\App\Http\Controllers\DevolucaoController::class, 'conferir'])
                ->name('conferir');

            Route::post('/{devolucao}/anexos', [\App\Http\Controllers\DevolucaoController::class, 'anexar'])->name('anexos.store');
            Route::delete('/{devolucao}/anexos/{anexo}', [\App\Http\Controllers\DevolucaoController::class, 'removerAnexo'])
                ->name('anexos.destroy');

            // PORTÃO 1 — a loja envia
            Route::post('/{devolucao}/enviar', [\App\Http\Controllers\DevolucaoController::class, 'enviar'])->name('enviar');
            Route::post('/{devolucao}/cancelar', [\App\Http\Controllers\DevolucaoController::class, 'cancelar'])->name('cancelar');

            // PORTÃO 2 — só a diretoria autoriza a moto a sair da loja
            Route::post('/{devolucao}/aprovar', [\App\Http\Controllers\DevolucaoController::class, 'aprovar'])
                ->middleware('check_perfil:gestor,admin')->name('aprovar');
            Route::post('/{devolucao}/recusar', [\App\Http\Controllers\DevolucaoController::class, 'recusar'])
                ->middleware('check_perfil:gestor,admin')->name('recusar');

            // PORTÃO 3 — o CD confere no destino e fecha
            Route::post('/{devolucao}/receber', [\App\Http\Controllers\DevolucaoController::class, 'receber'])
                ->middleware('check_perfil:cd,admin')->name('receber');
        });


        /*
        |--------------------------------------------------------------------------
        | MÓDULO 3.1: ESTOQUE DE PEÇAS (V3)
        |--------------------------------------------------------------------------
        | Peça é fungível (saldo por SKU/local), diferente de moto (chassi).
        | Toda escrita de saldo passa por App\Services\Estoque\EstoquePecaService.
        */
        Route::prefix('pecas')->name('pecas.')->group(function () {
            Route::get('/', [\App\Http\Controllers\PecaController::class, 'index'])->name('index');

            // Solicitação da loja ao CD (mesma estrutura de Pedido das motos,
            // com tipo_carga = 'peca').
            Route::get('/solicitar', [\App\Http\Controllers\PecaPedidoController::class, 'create'])
                ->name('solicitar');
            Route::post('/solicitar', [\App\Http\Controllers\PecaPedidoController::class, 'store'])
                ->name('solicitar.store');

            // Captura de conhecimento: quem tem a peça na mão confirma em qual
            // moto ela serve. Vira vínculo manual, com confiança alta.
            Route::post('/{peca}/aplicacao', [\App\Http\Controllers\PecaPedidoController::class, 'confirmarAplicacao'])
                ->name('aplicacao.confirmar');

            /*
             * Passos 2 e 3 do manual: identificar o código e liberar o pedido.
             * Acontece ANTES de qualquer movimento de estoque — ver
             * PecaLiberacaoController. Sem a liberação, separar recusa.
             */
            Route::get('/atendimento', [\App\Http\Controllers\PecaLiberacaoController::class, 'index'])
                ->name('atendimento');
            Route::get('/atendimento/buscar', [\App\Http\Controllers\PecaLiberacaoController::class, 'buscar'])
                ->name('atendimento.buscar');
            Route::post('/pedidos/{pedido}/atender', [\App\Http\Controllers\PecaLiberacaoController::class, 'atender'])
                ->name('atender');
            Route::post('/pedidos/{pedido}/liberar', [\App\Http\Controllers\PecaLiberacaoController::class, 'liberar'])
                ->name('liberar');
            Route::post('/pedidos/{pedido}/recusar', [\App\Http\Controllers\PecaLiberacaoController::class, 'recusar'])
                ->name('recusar');

            /*
             * Passo 4 do manual: o caixote reservado a cada filial. Enche na
             * separação e esvazia na montagem de carga — ver Basqueta.
             */
            Route::get('/basquetas', [\App\Http\Controllers\BasquetaController::class, 'index'])
                ->name('basquetas');

            // Passo 6: recolher, faturar e emitir o romaneio de peças.
            Route::post('/basquetas/{basqueta}/faturar', [\App\Http\Controllers\BasquetaController::class, 'faturar'])
                ->name('basquetas.faturar');

            // O documento que vai à conferência da filial (Passo 7).
            Route::get('/basquetas/{basqueta}/romaneio', [\App\Http\Controllers\BasquetaController::class, 'romaneio'])
                ->name('basquetas.romaneio');

            /*
             * GATE 2 — a filial confere antes do despacho. Dois desfechos:
             * libera a caixa, ou devolve para ajuste cancelando a NF.
             * A trava está em RomaneioController::embarcarPecas.
             */
            Route::post('/basquetas/{basqueta}/conferir', [\App\Http\Controllers\BasquetaController::class, 'conferir'])
                ->name('basquetas.conferir');
            Route::post('/basquetas/{basqueta}/ajustar', [\App\Http\Controllers\BasquetaController::class, 'ajustar'])
                ->name('basquetas.ajustar');

            // Fase 5: os números que medem a promessa do manual.
            Route::get('/indicadores', [\App\Http\Controllers\PecaIndicadorController::class, 'index'])
                ->name('indicadores');

            /*
             * Atendimento do pedido de peça. Três etapas com efeitos distintos
             * sobre o estoque — ver PecaAtendimentoController:
             *   separar -> reserva | carga -> nada | receber -> transfere
             */
            Route::post('/pedidos/{pedido}/separar', [\App\Http\Controllers\PecaAtendimentoController::class, 'separar'])
                ->name('separar');
            Route::post('/pedidos/{pedido}/carga', [\App\Http\Controllers\PecaAtendimentoController::class, 'adicionarNaCarga'])
                ->name('carga');
            Route::post('/pedidos/{pedido}/receber', [\App\Http\Controllers\PecaAtendimentoController::class, 'receber'])
                ->name('receber');

            // Pendências: divergências de recebimento e reposição de estoque.
            Route::prefix('pendencias')->name('pendencias.')->group(function () {
                Route::get('/', [\App\Http\Controllers\PecaPendenciaController::class, 'index'])->name('index');
                Route::post('/{item}/resolver', [\App\Http\Controllers\PecaPendenciaController::class, 'resolver'])->name('resolver');
                Route::post('/minimo', [\App\Http\Controllers\PecaPendenciaController::class, 'definirMinimo'])->name('minimo');
                Route::get('/sugerir-minimo', [\App\Http\Controllers\PecaPendenciaController::class, 'sugerirMinimo'])->name('sugerir');
            });

            // Entrada e inventário — onde o saldo gerenciado nasce.
            Route::prefix('estoque')->name('estoque.')->group(function () {
                Route::get('/', [\App\Http\Controllers\PecaEstoqueController::class, 'index'])->name('index');
                Route::get('/buscar', [\App\Http\Controllers\PecaEstoqueController::class, 'buscar'])->name('buscar');
                Route::post('/entrada', [\App\Http\Controllers\PecaEstoqueController::class, 'entrada'])->name('entrada');
                Route::post('/inventario', [\App\Http\Controllers\PecaEstoqueController::class, 'inventario'])->name('inventario');
                Route::post('/transferir', [\App\Http\Controllers\PecaEstoqueController::class, 'transferir'])->name('transferir');
            });
        });


        /*
        |--------------------------------------------------------------------------
        | MÓDULO 4: GESTÃO COMERCIAL & USUÁRIOS
        |--------------------------------------------------------------------------
        */
        // Área do Gestor (Aprovações)
        Route::prefix('gestor')->name('gestor.')->group(function () {
            Route::get('/', [GestorController::class, 'index'])->name('index');
            Route::get('/historico', [GestorController::class, 'historico'])->name('historico');
            Route::get('/{id}', [GestorController::class, 'show'])->name('show');
            Route::post('/aprovar/{id}', [GestorController::class, 'aprovar'])->name('aprovar');
            Route::post('/rejeitar/{id}', [GestorController::class, 'rejeitar'])->name('rejeitar');
            Route::post('/motos/{id}/aprovar-estorno', [GestorController::class, 'aprovarEstorno'])->name('aprovarEstorno');
        });

        // Chat Interno
        Route::prefix('chat')->name('chat.')->group(function () {
            Route::get('/{pedidoId}/messages', [ChatController::class, 'index'])->name('index');
            Route::post('/{pedidoId}/messages', [ChatController::class, 'store'])->name('store');
            Route::post('/{pedidoId}/read', [ChatController::class, 'markAsRead'])->name('markRead');
        });

        // Cadastro de Usuários (Lojas) - Exclusivo Admin
        Route::prefix('usuarios')->name('users.')->middleware('check_perfil:admin')->group(function () {
            Route::get('/', [UserController::class, 'index'])->name('index');
            Route::get('/novo', [UserController::class, 'create'])->name('create');
            Route::post('/', [UserController::class, 'store'])->name('store');
            Route::get('/{user}/editar', [UserController::class, 'edit'])->name('edit');
            Route::put('/{user}', [UserController::class, 'update'])->name('update');
            Route::delete('/{id}', [UserController::class, 'destroy'])->name('destroy');
            Route::patch('/{id}/restore', [UserController::class, 'restore'])->name('restore');
            
            Route::patch('/{id}/toggle-interior', [UserController::class, 'toggleInterior'])
                ->name('toggle-interior')
                ->middleware('can:admin');
        });

        // Gestão e Organização de Filiais (Admin/Gestor)
        Route::prefix('filiais')->name('filiais.')->middleware('check_perfil:admin,gestor')->group(function () {
            Route::get('/', [FilialController::class, 'index'])->name('index');
            Route::post('/', [FilialController::class, 'store'])->name('store');
            Route::put('/{filial}', [FilialController::class, 'update'])->name('update');
            Route::delete('/{filial}', [FilialController::class, 'destroy'])->name('destroy');
            Route::patch('/{filial}/toggle', [FilialController::class, 'toggle'])->name('toggle');
        });

        // Perfil do Usuário
        Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
        Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
        Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

        // Mural de Avisos (Admin/Gestor)
        Route::resource('notices', \App\Http\Controllers\NoticeController::class)->only(['store', 'destroy']);


        /*
        |--------------------------------------------------------------------------
        | MANUTENÇÃO AUTOMÁTICA (SELF-HEALING)
        |--------------------------------------------------------------------------
        */
        Route::get('/corrigir-status-romaneios', function() {
            // Script para garantir consistência dos status de carga
            // Fecha cargas vazias ou 100% entregues automaticamente
            $romaneiosAbertos = \App\Models\Romaneio::whereNotIn('status', ['concluido', 'cancelado'])->get();
            $corrigidos = 0;
            $detalhes = [];

            foreach ($romaneiosAbertos as $carga) {
                $pedidosAtivos = $carga->pedidos()->where('status', '!=', 'cancelado');
                
                // Fecha se vazio
                if ($pedidosAtivos->count() === 0) {
                    $carga->update(['status' => 'concluido']);
                    $corrigidos++;
                    $detalhes[] = "Carga #{$carga->id} fechada (Vazia).";
                    continue;
                }

                // Fecha se tudo entregue (Ignora 'no_cd' pois é status intermediário de transbordo)
                $pendencias = $carga->pedidos()
                    ->whereNotIn('status', ['concluido', 'cancelado', 'no_cd'])
                    ->count();

                if ($pendencias === 0) {
                    // Verifica se o último status não foi um transbordo
                    $statusAtual = $carga->pedidos->first()->status ?? 'concluido';
                    if ($statusAtual !== 'no_cd') {
                        $carga->update(['status' => 'concluido']);
                        $corrigidos++;
                    }
                }
            }
            return ['status' => 'Processamento Finalizado', 'cargas_corrigidas' => $corrigidos, 'log' => $detalhes];
        });

    }); // Fim Middleware Auth
    
    require __DIR__.'/auth.php';
    
}); // Fim Middleware Manutenção