<?php

namespace App\Http\Controllers;

use App\Services\OneSignalService;
use App\Models\Moto;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\Romaneio;
use App\Models\User;
use App\Models\ReservaMicrowork;
use App\Models\Schedule; // Modelo do Calendário V2
use App\Models\Modelo;
use App\Notifications\EstornoSolicitado;
use App\Notifications\PedidoAtualizado;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Google\Client;
use Google\Service\Drive;
use Google\Service\Drive\DriveFile;
use Google\Service\Drive\Permission;
use Carbon\Carbon;

class PedidoController extends Controller
{
    // --- HELPER: Logs e Notificações ---
    private function registrarLog($pedido, $titulo, $desc = '') {
        if ($pedido?->exists) {
            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo' => $titulo,
                'descricao' => "$desc (Por: " . Auth::user()->name . ")"
            ]);
        }
    }

    private function enviarNotificacao($usuarios, $titulo, $mensagem, $link) {
        \Illuminate\Support\defer(function() use ($usuarios, $titulo, $mensagem, $link) {
            $usuarios = is_iterable($usuarios) ? $usuarios : collect([$usuarios]);
            
            foreach ($usuarios as $user) {
                if($user) $user->notify(new PedidoAtualizado($titulo, $mensagem, $link));
            }

            $ids = collect($usuarios)->pluck('onesignal_id')->filter()->toArray();
            if (!empty($ids)) {
                try { (new OneSignalService())->sendToUser($ids, $titulo, $mensagem, $link); } 
                catch (\Exception $e) { \Illuminate\Support\Facades\Log::warning("OneSignal: " . $e->getMessage()); }
            }
        });
    }

    // --- API v2: CÉREBRO LOGÍSTICO ---
    public function calcularLogistica(Request $request) {
        $destino = Auth::user(); // Quem pede
        $origemId = $request->fornecedor_id; // De onde vem

        // Se não tem origem definida, assumimos que é CD (Reposição)
        if (!$origemId) {
            return response()->json([
                'tipo' => 'reposicao',
                'origem' => 'CD / Fábrica',
                'rota_origem' => 'Fluxo CD',
                // 'data_coleta' => now()->format('Y-m-d'), // REMOVIDO: Sem previsão
                // 'data_entrega' => now()->addDays(2)->format('Y-m-d'), // REMOVIDO: Sem previsão
                'mensagem' => 'Saída direta do estoque do CD.'
            ]);
        }

        $origem = User::find($origemId);
        if (!$origem) return response()->json(['erro' => 'Fornecedor não encontrado.'], 404);

        // LÓGICA CAPITAL vs INTERIOR (V2)
        if (!$origem->is_interior) {
            // Capital: Fluxo Direto (Imediato)
            return response()->json([
                'tipo' => 'transferencia',
                'origem' => $origem->filial,
                'rota_origem' => 'Direta (Capital)',
                // 'data_coleta' => now()->format('Y-m-d'), // REMOVIDO
                // 'data_entrega' => now()->addDay()->format('Y-m-d'), // REMOVIDO
                'mensagem' => 'Transferência direta na região metropolitana.'
            ]);
        } 
        
        // Interior: Depende do Calendário (Schedule)
        // A loja pode solicitar a transferência normalmente a qualquer momento.
        // A matriz/CD fará o agendamento através do Calendário posteriormente.
        return response()->json([
            'tipo' => 'transferencia',
            'origem' => $origem->filial,
            'rota_origem' => 'Agendada (Interior)',
            'mensagem' => 'Aguardando definição de rota de envio pelo CD.'
        ]);
    }

    // --- CRUD PEDIDOS ---
    public function index(Request $request)
    {
        // 1. AUTO-HEALING: Limpa rotas vencidas que não foram despachadas pelo CD
        // Se a data de agendamento passou e o caminhão não saiu, o pedido regride.
        \App\Http\Controllers\CalendarController::limparRotasVencidas();

        $user = Auth::user();
        
        // 2. BUSCA BASE
        $termo = $request->input('search');
        
        // Filtros Avançados
        $dataInicio = $request->input('data_inicio');
        $dataFim = $request->input('data_fim');
        $statusFiltro = $request->input('status');
        $lojaFiltro = $request->input('loja_id');

        $pedidos = Pedido::select('pedidos.*')
            ->with([
                'user:id,name,filial',    
                'origem:id,name,filial,perfil',  
                'romaneio'
            ])
            ->addSelect(['destino_final' => \App\Models\Moto::select('pedido_moto.destino')
                ->join('pedido_moto', 'motos.id', '=', 'pedido_moto.moto_id')
                ->whereColumn('pedido_moto.pedido_id', 'pedidos.id')
                ->limit(1)
            ])
            ->withCount('motos')
            // Visibilidade (Loja vê seus pedidos e pedidos DELE)
            ->when($user->perfil === 'loja', function($q) use ($user) {
                $q->where(function($sub) use ($user) {
                    $sub->where('user_id', $user->id)
                        ->orWhere('origem_user_id', $user->id);
                });
            })
            // Filtro por Texto (ID, Status, Chassi, Loja)
            ->when($termo, function($q) use ($termo) {
                $q->where(function($sub) use ($termo) {
                    $sub->where('id', 'like', "%{$termo}%")
                        ->orWhere('status', 'like', "%{$termo}%")
                        ->orWhereHas('motos', fn($m) => $m->where('chassi', 'like', "%{$termo}%"))
                        ->orWhereHas('user', fn($u) => $u->where('filial', 'like', "%{$termo}%"))
                        ->orWhereHas('origem', fn($o) => $o->where('filial', 'like', "%{$termo}%"));
                });
            })
            // Filtro por STATUS Específico
            ->when($statusFiltro, fn($q) => $q->where('status', $statusFiltro))
            // Filtro por DATA DE CRIAÇÃO
            ->when($dataInicio, fn($q) => $q->whereDate('created_at', '>=', $dataInicio))
            ->when($dataFim, fn($q) => $q->whereDate('created_at', '<=', $dataFim))
            // Filtro por LOJA (Apenas para Admin/Gestor/CD)
            ->when($lojaFiltro && in_array($user->perfil, ['admin', 'gestor', 'cd']), fn($q) => $q->where('user_id', $lojaFiltro))
            
            // ORDENAÇÃO POR PRIORIDADE (Ativos Primeiro)
            ->orderByRaw("
                CASE 
                    WHEN status IN ('em_analise', 'solicitado', 'separado', 'aguardando_rota', 'rota_confirmada', 'aguardando_coleta', 'coletado', 'expedido', 'em_transito', 'em_transito_cd', 'no_cd') THEN 1 
                    ELSE 2 
                END ASC,
                FIELD(status, 'em_analise', 'solicitado', 'separado', 'aguardando_rota', 'rota_confirmada', 'aguardando_coleta', 'coletado', 'expedido', 'em_transito', 'em_transito_cd', 'no_cd') ASC,
                created_at DESC
            ")
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Pedidos/Index', [
            'pedidos' => $pedidos, 
            'perfil' => $user->perfil, 
            'filters' => $request->only(['search', 'data_inicio', 'data_fim', 'status', 'loja_id']),
            // Enviar lista de lojas para o filtro (apenas se tiver permissão)
            'lojas' => in_array($user->perfil, ['admin', 'gestor', 'cd']) ? User::where('perfil', 'loja')->orderBy('filial')->get(['id', 'filial']) : []
        ]);
    }

    public function buscarEstoqueLoja(Request $request)
    {
        $lojaId = $request->input('loja_id');
        if (!$lojaId) return response()->json([]);

        // CORREÇÃO: Aceita status 'estoque_loja', 'disponivel' (antigo) e 'concluido' (recém entregue)
        // Desde que pertença à loja selecionada.
        $motos = Moto::where('loja_atual_id', $lojaId)
            ->whereIn('status', ['estoque_loja', 'disponivel', 'concluido']) 
            ->whereDoesntHave('pedidos', function ($query) {
                // Garante que não está em nenhum PROCESSO ATIVO de logística
                $query->whereIn('status', ['solicitado', 'aprovado', 'separado', 'aguardando_rota', 'aguardando_coleta', 'em_transito', 'expedido', 'em_transito_cd', 'no_cd']);
            })
            ->select('id', 'chassi', 'modelo', 'cor')
            ->orderBy('modelo')
            ->get();

        return response()->json($motos);
    }

    public function create()
    {
        // Lista lojas para transferência (exclui a própria)
        $lojas = User::where('perfil', 'loja')
            ->where('id', '!=', Auth::id())
            ->select('id', 'name', 'filial')
            ->orderBy('filial')
            ->get();

        // Busca ID do CD (ou Admin Admin se não houver CD explícito)
        // Isso permite que devolvamsos motos para "alguém"
        $cdUser = User::whereIn('perfil', ['cd', 'admin'])->orderBy('id')->first();

        // [CORREÇÃO] Lista de locais de entrega para o dropdown (Injecao Backend)
        $locaisEntrega = User::where('perfil', 'loja')
            ->whereNotNull('filial')
            ->where('filial', '!=', '')
            ->orderBy('filial')
            ->pluck('filial')
            ->toArray();
        
        // Adiciona destinos padrão que não são lojas (se necessário)
        if (!in_array('Matriz / CD', $locaisEntrega)) {
            array_unshift($locaisEntrega, 'Matriz / CD');
        }

        // [CORREÇÃO] Adiciona Lojas Especiais (PDVs sem Login)
        $pdvsExtras = ['PDV Paar/PA', 'PDV Barcarena/PA'];
        foreach ($pdvsExtras as $pdv) {
            if (!in_array($pdv, $locaisEntrega)) {
                $locaisEntrega[] = $pdv;
            }
        }

        // Ordena novamente para garantir
        sort($locaisEntrega);

        return Inertia::render('Pedidos/Create', [
            'listaModelos' => Modelo::orderBy('nome')->pluck('nome'),
            'lojasDisponiveis' => $lojas,
            'cdUserId' => $cdUser ? $cdUser->id : null,
            'locaisEntrega' => $locaisEntrega // Variável recuperada
        ]);
    }

    public function store(Request $request)
    {
        // 1. Validação dos Campos
        $request->validate([
            'itens' => 'required|array|min:1',
            'itens.*.modelo' => 'required|string',
            'itens.*.cor' => 'required|string',
            'itens.*.motivo' => 'required|string',
            'itens.*.local' => 'required|string',
            'itens.*.chassi' => 'nullable|string|min:11|max:17', 
            'origem_id' => 'nullable|exists:users,id',
            'modo' => 'nullable|string|in:cd,transferencia,devolucao', // Novo Campo
            'cd_user_id' => 'nullable|exists:users,id' // ID do CD para Devolução
        ]);

        return DB::transaction(function () use ($request) {
            $user = Auth::user();
            
            // --- TRAVA DE GESTÃO: BLOQUEIO POR PENDÊNCIA EM TRÂNSITO ---
            if ($user->perfil === 'loja') {
                $pendentes = \App\Models\Pedido::where('user_id', $user->id)
                    ->whereIn('status', ['em_transito', 'em_transito_cd'])
                    ->count();
                
                if ($pendentes > 0) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'itens' => "BLOQUEIO DE SISTEMA: Sua loja possui $pendentes carga(s) 'Em Trânsito'. Por determinação da diretoria, você deve realizar a Conferência e Finalização de todos os pedidos que já chegaram fisicamente na sua loja antes de poder solicitar novas motos."
                    ]);
                }
            }
            
            // Lógica de Modos
            $modo = $request->modo ?? 'cd'; // default: reposição simples
            
            // Variáveis de Origem/Destino
            $destinoUserId = $user->id; // Padrão: Eu estou pedindo (Sou o Destino)
            $origemUserId = $request->origem_id; // Padrão: Vem de alguém (Origem)

            // Ajuste para DEVOLUÇÃO (Logística Reversa)
            if ($modo === 'devolucao') {
                if (!$request->cd_user_id) {
                    throw \Illuminate\Validation\ValidationException::withMessages(['modo' => 'ID do CD não fornecido para devolução.']);
                }
                $destinoUserId = $request->cd_user_id; // O CD é o destino
                $origemUserId = $user->id; // Eu sou a origem (Estou devolvendo)
            }

            $isTransferencia = !empty($origemUserId);

            // 2. Cálculo Logístico (Datas)
            $previsaoColeta = null; 
            $previsaoEntrega = null;
            
            if ($isTransferencia && $modo !== 'devolucao') {
                // ... Lógica existente de cálculo de rota para reposição/transferência ...
                $reqLogistica = new Request(['fornecedor_id' => $origemUserId]);
                $dadosLogistica = $this->calcularLogistica($reqLogistica)->getData();
                
                if (isset($dadosLogistica->erro)) {
                    throw \Illuminate\Validation\ValidationException::withMessages(['origem_id' => $dadosLogistica->erro]);
                }
                $previsaoColeta = null; // REMOVIDO
                $previsaoEntrega = null; // REMOVIDO
            }

            // 3. Criação do Cabeçalho do Pedido
            $pedido = Pedido::create([
                'user_id' => $destinoUserId, // Quem recebe a moto
                'origem_user_id' => $origemUserId, // De onde a moto sai
                'status' => 'em_analise', // Status Inicial
                'observacao' => $request->observacao,
                // Prefixo [DEVOLUÇÃO] se for o caso, para facilitar identificação visual
                'motivo_solicitacao' => ($modo === 'devolucao' ? '[DEVOLUÇÃO] ' : '') . ($request->itens[0]['motivo'] ?? 'Estoque Regular'),
                'itens' => $request->itens, 
                'previsao_coleta' => $previsaoColeta,
                'previsao_entrega' => $previsaoEntrega
            ]);

            // --- 3.5 OTIMIZAÇÃO E TRAVAS GLOBAIS DE CHASSI (Evita lentidão e erros graves) ---
            $chassisRecebidos = array_filter(array_map(function($item) {
                return isset($item['chassi']) && trim($item['chassi']) !== '' ? mb_strtoupper(trim($item['chassi'])) : null;
            }, $request->itens));

            if (!empty($chassisRecebidos)) {
                
                // TRAVA 1: Motos Presas em Outros Pedidos (Não concluídos/cancelados/rejeitados)
                $motosEmUso = Moto::whereIn('chassi', $chassisRecebidos)
                    ->whereHas('pedidos', function ($q) {
                        $q->whereNotIn('status', ['concluido', 'cancelado', 'rejeitado']);
                    })->pluck('chassi')->toArray();

                if (!empty($motosEmUso)) {
                    $listaErro = implode(', ', $motosEmUso);
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'itens' => "CHASSI PRESO: Os seguintes chassis já estão vinculados a outro pedido ativo: {$listaErro}"
                    ]);
                }

                // TRAVA 2: Motos Historicamente Vendidas
                $motosVendidas = Moto::whereIn('chassi', $chassisRecebidos)
                    ->where(function($query) {
                        // Condição A: O status atual da moto cravou como "vendida"
                        $query->where('status', 'vendida')
                              // Condição B: A moto tem motivo_solicitacao indicando venda
                              ->orWhere('motivo_solicitacao', 'LIKE', '%venda%')
                              ->orWhere('motivo_solicitacao', 'LIKE', '%cliente%')
                              // Condição C: Possui um pedido concluído cujo pivot declara Venda/Cliente
                              ->orWhereHas('pedidos', function ($q) {
                                  $q->where('pedidos.status', 'concluido')
                                    ->where(function ($subQ) {
                                        $subQ->where('pedido_moto.motivo', 'LIKE', '%venda%')
                                             ->orWhere('pedido_moto.motivo', 'LIKE', '%cliente%');
                                    });
                              });
                    })->pluck('chassi')->toArray();

                if (!empty($motosVendidas)) {
                    $listaErroVendidas = implode(', ', $motosVendidas);
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'itens' => "VENDA JÁ CONFIRMADA: O sistema não permite re-encomendar motos de clientes. Verifique: {$listaErroVendidas}"
                    ]);
                }
            }
            // ----------------------------------------------------------------------------------

            // 4. Processamento dos Itens (Motos)
            $syncLogs = []; // Array para registrar ajustes automáticos no DB para a Timeline
            $motosParaAttach = []; // Array para vínculo dinâmico em lote (Bulk Insert)

            foreach ($request->itens as $item) {
                $chassi = isset($item['chassi']) ? mb_strtoupper(trim($item['chassi'])) : null;
                $moto = null;

                // --- B. CENÁRIO: TRANSFERÊNCIA OU DEVOLUÇÃO ---
                if ($isTransferencia) {
                    if (!$chassi) {
                        throw \Illuminate\Validation\ValidationException::withMessages(['itens' => "Para transferência/devolução, o chassi é obrigatório."]);
                    }

                    $moto = Moto::where('chassi', $chassi)->first();

                    if (!$moto) {
                        $lojaOrigem = User::find($origemUserId);
                        $nomeLoja = $lojaOrigem ? $lojaOrigem->filial : 'Loja Externa';

                        $moto = Moto::create([
                            'chassi' => $chassi,
                            'modelo' => mb_strtoupper($item['modelo']),
                            'cor' => mb_strtoupper($item['cor']),
                            'status' => 'solicitado', // Vai mudar logo abaixo
                            'loja_atual_id' => $origemUserId,
                            'localizacao_atual' => "Estoque Loja: {$nomeLoja}"
                        ]);
                    } 
                    else {
                        // C.2 MOTO JÁ EXISTE NO SISTEMA
                        // Atualiza modelo e cor para garantir que dados antigos (de cancelamentos) sejam sobrescritos
                        $moto->update([
                            'modelo' => mb_strtoupper($item['modelo']),
                            'cor' => mb_strtoupper($item['cor'])
                        ]);

                        if ($modo === 'devolucao') {
                            if ($moto->loja_atual_id != $user->id) {
                                $moto->update([
                                    'loja_atual_id' => $user->id,
                                    'localizacao_atual' => "Estoque Loja: " . ($user->filial ?? 'Minha Loja')
                                ]);
                            }
                        }
                        else {
                            if ($moto->loja_atual_id != $request->origem_id) {
                                $lojaReal = User::find($request->origem_id);
                                $oldPatio = $moto->localizacao_atual;
                                $newPatio = "Estoque Loja: " . ($lojaReal->filial ?? 'Sincronizada via Transferência');
                                
                                $moto->update([
                                    'loja_atual_id' => $request->origem_id,
                                    'localizacao_atual' => $newPatio
                                ]);

                                $syncLogs[] = "✓ Chassi {$chassi} ajustado sistemicamente: de '{$oldPatio}' para '{$newPatio}'.";
                            }
                        }

                        // Validação de Status (Bloqueios)
                        $statusBloqueados = ['vendida', 'reservado', 'solicitado', 'separado', 'aguardando_coleta', 'em_transito', 'expedido', 'transito_loja'];

                        if (in_array($moto->status, $statusBloqueados) && !$moto->wasRecentlyCreated) {
                            throw \Illuminate\Validation\ValidationException::withMessages([
                                'itens' => "A moto {$chassi} está com status '{$moto->status}' e não pode ser transferida."
                            ]);
                        }

                        // Atualiza status para evitar concorrência
                        $moto->update(['status' => 'solicitado']); 
                    } 
                }
                // --- C. CENÁRIO 2: PEDIDO AO CD (Fabrica/Novo) ---
                else {
                    if ($chassi) {
                        $moto = Moto::firstOrCreate(
                            ['chassi' => $chassi],
                            [
                                'modelo' => mb_strtoupper($item['modelo']),
                                'cor' => mb_strtoupper($item['cor']),
                                'status' => 'solicitado',
                                'localizacao_atual' => 'Fábrica/CD'
                            ]
                        );

                        if (!$moto->wasRecentlyCreated) {
                            $updData = [
                                'modelo' => mb_strtoupper($item['modelo']),
                                'cor' => mb_strtoupper($item['cor'])
                            ];

                            if (!in_array($moto->status, ['estoque_fabrica', 'solicitado'])) {
                                $oldPatio = $moto->localizacao_atual;
                                $newPatio = 'Fábrica/CD (Sincronizado na Saída)';
                                
                                $updData['status'] = 'solicitado';
                                $updData['loja_atual_id'] = null;
                                $updData['localizacao_atual'] = $newPatio;
                                
                                $syncLogs[] = "✓ Chassi {$chassi} devolvido sistemicamente ao CD: de '{$oldPatio}' para 'Fábrica/CD'.";
                            }
                            
                            $moto->update($updData);
                        }
                    } else {
                        // Pedido genérico (sem chassi) - Cria registro placeholder
                        $moto = Moto::create([
                            'modelo' => mb_strtoupper($item['modelo']),
                            'cor' => mb_strtoupper($item['cor']),
                            'status' => 'solicitado',
                            'localizacao_atual' => 'Fábrica/CD'
                        ]);
                    }
                }

                // Vincula ao Array Lote (Evita N+1 Insert do Pivot!)
                if ($moto) {
                    $motosParaAttach[$moto->id] = [
                        'destino' => mb_strtoupper($item['local']),
                        'motivo' => $item['motivo']
                    ];
                }
            } // Fim Loop de Itens

            // 5. Executa Bulk Insert na tabela Pivô de uma vez (Redução maciça de queries)
            if (!empty($motosParaAttach)) {
                $pedido->motos()->attach($motosParaAttach);
            }

            // 6. Logs e Notificações
            $modo = $request->modo ?? 'cd';
            $origemNome = $modo === 'devolucao' ? 'Devolução (Logística Reversa)' : ($request->origem_id ? 'Transferência (Inter-lojas)' : 'Reposição CD');
            $logDesc = "Solicitação via sistema ($origemNome)";
            
            if (!empty($syncLogs)) {
                $logDesc .= "\n\n📝 Ajustes Automáticos na Abertura do Pedido:\n" . implode("\n", $syncLogs);
            }
            
            $this->registrarLog($pedido, 'Criado', $logDesc);
            
            // Notifica Gestores
            try {
                $gestores = User::where('perfil', 'gestor')->get();
                $this->enviarNotificacao(
                    $gestores, 
                    'Nova Solicitação 🆕', 
                    "Loja " . Auth::user()->filial . " criou pedido #{$pedido->id}.", 
                    route('pedidos.show', $pedido->id)
                );
            } catch (\Exception $e) {
                // Log erro de notificação mas não para o processo
            }

            return redirect()->route('pedidos.index')->with('success', 'Solicitação enviada para aprovação!');
        });
    }

    public function aprovar($id)
    {
        return DB::transaction(function () use ($id) {
            $pedido = Pedido::with(['user', 'motos', 'origem'])->findOrFail($id);

            if (!in_array(Auth::user()->perfil, ['admin', 'gestor'])) {
                abort(403, 'Apenas a diretoria pode aprovar movimentações.');
            }

            if ($pedido->status !== 'em_analise') {
                return back()->with('error', 'Este pedido já foi processado.');
            }

            // Aprova
            $pedido->update(['status' => 'solicitado']);
            
            // --- PREVISÃO DE ENTREGA: Busca a rota mais próxima no calendário ---
            $this->anexarPrevisaoRota($pedido);
            
            $this->registrarLog($pedido, 'Aprovado', 'Movimentação autorizada pelo Gestor.');

            // Notifica solicitante
            $previsaoMsg = $pedido->previsao_entrega 
                ? " Previsão de saída: " . \Carbon\Carbon::parse($pedido->previsao_entrega)->format('d/m/Y') . "."
                : "";
            
            $this->enviarNotificacao(
                $pedido->user, 
                'Aprovado ✅', 
                "Sua solicitação #{$pedido->id} foi aprovada.{$previsaoMsg}", 
                route('pedidos.show', $pedido->id)
            );

            // Se for Transferência, notifica a Origem para separar
            if ($pedido->origem_user_id && $pedido->origem) {
                // Lista modelos do JSON ou das motos vinculadas
                $modelos = collect($pedido->itens)->pluck('modelo')->unique()->implode(', ');
                
                $this->enviarNotificacao(
                    $pedido->origem, 
                    'Transferência Solicitada 🔁', 
                    "Aprovado: Separe as motos ({$modelos}) para envio à {$pedido->user->filial}. Pedido #{$pedido->id}.", 
                    route('pedidos.show', $pedido->id)
                );
            }

            return back()->with('success', 'Movimentação aprovada! Lojas notificadas.');
        });
    }

    // --- FLUXO DE RETIRADA / ESTORNO ---
    public function solicitarRetiradaItem(Request $request, $id)
    {
        $moto = Moto::with('pedidos')->findOrFail($id);
        $user = Auth::user();
        
        // Validações básicas de permissão e status
        if ($user->perfil === 'cd' && !in_array($moto->status, ['solicitado', 'separado', 'estoque_fabrica'])) 
            return back()->withErrors('CD só cancela item em separação.');
        
        $moto->update([
            'estorno_pendente' => true, 
            'motivo_estorno' => "$user->perfil: $request->motivo", 
            'user_estorno_id' => $user->id
        ]);
        
        // Notifica Gestores
        User::whereIn('perfil', ['gestor', 'admin'])->each(fn($u) => $u->notify(new EstornoSolicitado($moto, $user)));
        
        return back()->with('success', 'Solicitação de estorno enviada.');
    }

    // --- OPERAÇÃO DE SEPARAÇÃO (ATUALIZADA V2) ---
    public function marcarSeparado($id)
    {
        return DB::transaction(function () use ($id) {
            $pedido = Pedido::with('origem', 'user')->findOrFail($id);
            $user = Auth::user();

            // Validação de Status
            if ($pedido->status !== 'solicitado') {
                return back()->withErrors(['erro' => 'Status inválido para separação.']);
            }

            // LÓGICA V2: QUEM SEPARA E PARA ONDE VAI O STATUS?
            // CORREÇÃO: Reposições do CD não podem cair na coleta.
            $isTransferenciaVerdadeira = $pedido->origem_user_id && $pedido->origem && $pedido->origem->perfil === 'loja';

            // Cenário A: Transferência (Origem é de uma loja) -> Quem separa é a Loja de Origem
            if ($isTransferenciaVerdadeira) {
                $novoStatus = 'aguardando_coleta'; // Padrão: Separou, está pronto pra coletar
                if ($user->id !== $pedido->origem_user_id && $user->perfil !== 'admin') {
                    return back()->withErrors(['erro' => 'Apenas a loja de origem (' . $pedido->origem->filial . ') pode confirmar a separação desta moto.']);
                }
                // Se a previsão de entrega/rota já foi anexada na aprovação, o status deve pular direto para rota_confirmada
                if ($pedido->previsao_entrega != null) {
                    $novoStatus = 'rota_confirmada';
                    $msgLog = "Separado na origem ({$pedido->origem->filial}). Rota já estava previamente confirmada para entrega.";
                } 
                // Exceção Organizacional: Lojas do Interior separam a moto e entram em "Aguardando Rota" do CD
                else if ($pedido->origem->is_interior && $pedido->created_at >= '2026-03-12 00:00:00') {
                    $novoStatus = 'aguardando_rota';
                    $msgLog = "Separado na origem ({$pedido->origem->filial}). Aguardando a Matriz/CD definir uma rota de coleta.";
                } else {
                    $novoStatus = 'aguardando_coleta';
                    $msgLog = "Separado na origem ({$pedido->origem->filial}). Aguardando coleta direta.";
                }
            } 
            // Cenário B: Reposição (Origem NULL ou Origem CD) -> Quem separa é o CD
            else {
                if ($pedido->previsao_entrega != null) {
                    $novoStatus = 'rota_confirmada';
                    $msgLog = "Separado no CD. Rota já havia sido confirmada pelo calendário.";
                } else {
                    $novoStatus = 'separado'; // Para o CD, continua separado até virar romaneio (expedido)
                    $msgLog = "Separado no estoque do CD. Pronto para embarque.";
                }
                
                if ($user->perfil !== 'cd' && $user->perfil !== 'admin') {
                    return back()->withErrors(['erro' => 'Apenas o CD pode separar pedidos de reposição.']);
                }
            }

            // Atualiza
            $pedido->update(['status' => $novoStatus]);
            $pedido->motos()->update(['status' => $novoStatus]);
            
            $this->registrarLog($pedido, 'Separado 📦', $msgLog);
            
            // Notifica o CD que existe uma carga pronta no interior/capital aguardando frete
            if ($isTransferenciaVerdadeira) {
                $cdUsers = User::where('perfil', 'cd')->get();
                $assunto = $novoStatus === 'aguardando_rota' ? 'Aguardando Rota 🚚' : 'Coleta Pronta 🚚';
                $this->enviarNotificacao($cdUsers, $assunto, "Loja {$pedido->origem->filial} separou as motos do pedido #{$pedido->id}. Pode agendar coleta.", route('romaneios.create'));
            }

            return back()->with('success', 'Motos separadas fisicamente! O fluxo agora segue para a logística (coleta/agendamento).');
        });
    }

    public function confirmarSaida($id)
    {
        return DB::transaction(function () use ($id) {
            $pedido = Pedido::with('motos')->findOrFail($id);
            // Saída lógica (o trânsito físico real é via RomaneioController)
            $pedido->update(['status' => 'em_transito']);
            $pedido->motos()->update(['status' => 'em_transito']);
            
            $this->registrarLog($pedido, 'Expedido', 'Aguardando embarque no romaneio.');
            
            return back()->with('success', 'Pedido marcado como expedido.');
        });
    }

    // --- FINALIZAÇÃO (RECEBIMENTO NA LOJA) ---
    public function finalizarEntrega(Request $request, $id)
{
    // 1. Validação (Adicionada validação para as fotos das avarias)
    $request->validate([
        'arquivo_romaneio' => 'required|file|max:15360|mimes:jpg,jpeg,png,pdf',
        'fotos_avarias.*'  => 'nullable|image|max:10240' // Max 10MB por foto antes de comprimir
    ]);

    return DB::transaction(function () use ($request, $id) {
        $pedido = Pedido::with('user', 'motos')->findOrFail($id);
        
        if (Auth::user()->perfil === 'loja' && $pedido->user_id !== Auth::id()) {
            abort(403, 'Acesso não autorizado.');
        }

        // --- PREPARAÇÃO DOS SERVIÇOS DE UPLOAD ---
        $service = null;
        $folders = ['comprovantes' => null, 'avarias' => null];
        $usouBackupLocal = false;

        try {
            $refreshToken = config('services.google.refresh_token');
            if ($refreshToken) {
                $client = new \Google\Client();
                $client->setClientId(config('services.google.client_id'));
                $client->setClientSecret(config('services.google.client_secret'));
                $client->refreshToken($refreshToken);
                $service = new \Google\Service\Drive($client);

                $filialNome = "Filial - " . ($pedido->user->filial ?? 'Matriz');
                
                // Cache estruturado por filial/ano/mês para evitar chamadas repetitivas
                $folders = Cache::remember("drive_folders_{$filialNome}_" . date('Ym'), 3600, function () use ($service, $filialNome) {
                    $root = config('services.google.folder_id') ?: 'root';
                    
                    // 1. Pasta da Filial
                    $filialId = $this->findOrCreateFolder($service, $filialNome, $root);
                    
                    // 2. Pasta do Ano
                    $anoId = $this->findOrCreateFolder($service, date('Y'), $filialId);
                    
                    // 3. Pasta do Mês (Nome: Janeiro, Fevereiro...)
                    $meses = [
                        '01' => 'Janeiro', '02' => 'Fevereiro', '03' => 'Março', 
                        '04' => 'Abril',   '05' => 'Maio',      '06' => 'Junho',
                        '07' => 'Julho',   '08' => 'Agosto',    '09' => 'Setembro',
                        '10' => 'Outubro', '11' => 'Novembro',  '12' => 'Dezembro'
                    ];
                    $nomeMes = $meses[date('m')];
                    $mesId = $this->findOrCreateFolder($service, $nomeMes, $anoId);

                    // 4. Subpastas de Organização
                    return [
                        'comprovantes' => $this->findOrCreateFolder($service, 'Comprovantes', $mesId),
                        'avarias'      => $this->findOrCreateFolder($service, 'Avarias', $mesId)
                    ];
                });
            }
        } catch (\Exception $e) {
            $usouBackupLocal = true; // Falha na conexão com Google
            Log::error("Erro Drive: " . $e->getMessage());
        }

        // --- 2. UPLOAD DO ROMANEIO (COM COMPRESSÃO SE FOR IMAGEM) ---
        $pedido->comprovante_url = $this->tratarUpload(
            $request->file('arquivo_romaneio'), 
            "PEDIDO_{$id}_RECEBIMENTO", 
            $service, 
            $folders['comprovantes'], // Usa a pasta de comprovantes
            'comprovantes'
        );

        // --- 3. PROCESSAMENTO DAS MOTOS ---
        $avarias = $request->input('avarias', []);
        $fotos = $request->file('fotos_avarias', []);
        $qtdAvarias = 0;

        foreach ($pedido->motos as $moto) {
            $motivo = $moto->pivot->motivo ?? $pedido->motivo_solicitacao ?? 'Estoque Regular (Giro)';
            $motivoLimpo = mb_strtolower($motivo, 'UTF-8');

            $novoStatus = (str_contains($motivoLimpo, 'venda') || str_contains($motivoLimpo, 'cliente')) 
                ? 'vendida' 
                : 'estoque_loja';

            $obsAvaria = null;
            $linkFoto = null;

            // Se houver avaria reportada
            if (!empty($avarias[$moto->id])) {
                $qtdAvarias++;
                $novoStatus = 'avariado';
                $obsAvaria = $avarias[$moto->id];
                
                // Upload da Foto da Avaria (Otimizado)
                if (isset($fotos[$moto->id])) {
                    $linkFoto = $this->tratarUpload(
                        $fotos[$moto->id], 
                        "AVARIA_{$moto->chassi}", 
                        $service, 
                        $folders['avarias'], // Usa a pasta de avarias
                        'avarias'
                    );
                }
            }

            // Atualiza Moto
            $moto->update([
                'status'            => $novoStatus,
                'localizacao_atual' => "Estoque Loja: {$pedido->user->filial}",
                'loja_atual_id'     => $pedido->user_id,
                'detalhes_avaria'   => $obsAvaria,
                'foto_avaria'       => $linkFoto,
                // 'romaneio_id'       => null // COMENTADO: Mantém o histórico do último romaneio
            ]);

            // ATUALIZA O PIVOT (Histórico Permanente no Pedido)
            if ($obsAvaria || $linkFoto) {
                $pedido->motos()->updateExistingPivot($moto->id, [
                    'detalhes_avaria' => $obsAvaria,
                    'foto_avaria'     => $linkFoto
                ]);
            }
        }

        // 4. Finalização
        $pedido->update(['status' => 'concluido']);
        
        if ($pedido->romaneio_id) {
            $pendentes = Pedido::where('romaneio_id', $pedido->romaneio_id)
                               ->where('status', '!=', 'concluido')
                               ->where('id', '!=', $pedido->id)
                               ->count();
            if ($pendentes === 0) {
                Romaneio::where('id', $pedido->romaneio_id)->update(['status' => 'concluido']);
            }
        }

        $this->registrarLog($pedido, 'Concluído', $qtdAvarias ? "Finalizado com $qtdAvarias avarias." : "Recebimento 100%.");
        
        try {
            // 1. Notifica Gestores/CD/Admin (Visão Geral)
            $notificaveis = User::whereIn('perfil', ['gestor', 'admin', 'cd'])->get();
            $this->enviarNotificacao($notificaveis, 'Entrega Confirmada ✅', "Loja {$pedido->user->filial} finalizou pedido #{$id}.", route('pedidos.show', $id));

            // 2. Notifica a Loja de Origem (se for transferência)
            if ($pedido->origem_user_id && $pedido->origem) {
                $this->enviarNotificacao(
                    $pedido->origem, 
                    'Transferência Concluída 🏁', 
                    "As motos do pedido #{$id} foram recebidas pela {$pedido->user->filial}!", 
                    route('pedidos.show', $id)
                );
            }

            // 3. Notifica o Solicitante (Confirmação) - Caso tenha sido finalizado por outro (ex: Admin)
            if (Auth::id() !== $pedido->user_id) {
                $this->enviarNotificacao(
                    $pedido->user,
                    'Recebimento Confirmado ✅',
                    "Seu pedido #{$id} foi marcado como entregue/concluído.",
                    route('pedidos.show', $id)
                );
            }

        } catch (\Exception $e) {}

        $msg = ($service === null) 
            ? 'Salvo localmente (Backup Ativo).' 
            : 'Recebimento confirmado!';

        return back()->with('message', $msg);
    });
}

/**
 * Helper Privado para Comprimir e Uploadar (Drive ou Local)
 */
private function tratarUpload($arquivo, $nomeBase, $driveService, $folderId, $pastaLocal)
{
    // 1. Definição do Nome
    $extensao = $arquivo->getClientOriginalExtension();
    $nomeArquivo = "{$nomeBase}_" . time() . ".{$extensao}";
    $caminhoFinal = $arquivo; // Por padrão é o arquivo original

    // 2. Compressão (Apenas se for imagem)
    if (in_array(strtolower($extensao), ['jpg', 'jpeg', 'png'])) {
        try {
            // SINTAXE INTERVENTION IMAGE V3 (SEM FACADE)
            // Instancia o gerenciador com driver GD (padrão XAMPP/PHP)
            $manager = new \Intervention\Image\ImageManager(new \Intervention\Image\Drivers\Gd\Driver());
            
            $nomeArquivo = "{$nomeBase}_" . time() . ".jpg"; // Força JPG
            $caminhoFinal = sys_get_temp_dir() . '/' . $nomeArquivo;

            // Lê, Redimensiona e Salva
            $image = $manager->read($arquivo);
            $image->scaleDown(width: 1280);
            $image->toJpeg(80)->save($caminhoFinal);
            
        } catch (\Exception $e) {
            // Se falhar a compressão, usa o original
            Log::warning("Falha na compressão de imagem: " . $e->getMessage());
            // Verifica se o arquivo foi criado, se não, usa o original
            if (!file_exists($caminhoFinal)) {
                $caminhoFinal = $arquivo;
            }
        }
    }

    // 3. Tentativa de Upload no Drive
    if ($driveService && $folderId) {
        try {
            // Nota: seu método uploadFileToDrive precisa aceitar um CAMINHO (string) ou Objeto UploadedFile
            // Se você usa o original, passe o objeto. Se for comprimido, passe o caminho.
            $arquivoParaEnviar = is_string($caminhoFinal) ? $caminhoFinal : $caminhoFinal->getPathname();
            
            // Aqui assumo que você adaptará seu uploadFileToDrive para ler o conteúdo
            // Se não quiser mexer no helper, instancie um UploadedFile fake ou leia o stream
            return $this->uploadFileToDrive($driveService, $caminhoFinal, $folderId, $nomeBase);
        } catch (\Exception $e) {
            // Falhou Drive, cai para o local abaixo
        }
    }

    // 4. Fallback Local (Storage)
    // Se foi comprimido, temos que mover o arquivo temporário
    if (is_string($caminhoFinal) && file_exists($caminhoFinal)) {
        $path = "{$pastaLocal}/{$nomeArquivo}";
        Storage::disk('public')->put($path, file_get_contents($caminhoFinal));
        return asset("storage/{$path}");
    } else {
        // Se não foi comprimido (PDF ou erro), usa o store padrão
        $path = $arquivo->storeAs($pastaLocal, $nomeArquivo, 'public');
        return asset("storage/{$path}");
    }
}

    // --- PREVISÃO DE ROTA (CALENDÁRIO V2) ---
    private function anexarPrevisaoRota(Pedido $pedido)
    {
        try {
            // Busca a próxima rota (Schedule) que tenha uma parada (ScheduleStop)
            // correspondente à loja destino do pedido (user_id)
            $proximaRota = Schedule::whereHas('stops', function ($q) use ($pedido) {
                    $q->where('user_id', $pedido->user_id);
                })
                ->where('date', '>=', now()->toDateString())
                ->orderBy('date', 'asc')
                ->first();

            if ($proximaRota) {
                $pedido->update(['previsao_entrega' => $proximaRota->date]);
                
                $this->registrarLog(
                    $pedido, 
                    'Previsão de Rota 📅', 
                    "Rota mais próxima encontrada para " . Carbon::parse($proximaRota->date)->format('d/m/Y') . ". Esta é uma estimativa baseada no calendário."
                );
            }
        } catch (\Exception $e) {
            // Não bloqueia a aprovação se houver erro na busca de previsão
            Log::warning("Erro ao buscar previsão de rota para pedido #{$pedido->id}: " . $e->getMessage());
        }
    }

    // --- GOOGLE DRIVE HELPERS ---
    private function uploadFileToDrive($service, $file, $folderId, $name) {
        // Correção para permitir caminho de arquivo string (pós compressão) ou UploadedFile
        $realPath = is_string($file) ? $file : $file->getRealPath();
        $mimeType = is_string($file) ? mime_content_type($file) : $file->getClientMimeType();
        $extension = is_string($file) ? 'jpg' : $file->getClientOriginalExtension();

        $meta = new DriveFile(['name' => $name . "." . $extension, 'parents' => [$folderId]]);
        $uploaded = $service->files->create($meta, [
            'data' => file_get_contents($realPath),
            'mimeType' => $mimeType,
            'uploadType' => 'multipart',
            'fields' => 'id, webViewLink'
        ]);
        try {
            $service->permissions->create($uploaded->id, new Permission(['role' => 'reader', 'type' => 'anyone']));
        } catch (\Exception $e) {}
        return $uploaded->webViewLink;
    }

    private function findOrCreateFolder($service, $name, $parentId) {
        $q = "mimeType='application/vnd.google-apps.folder' and name='$name' and '$parentId' in parents and trashed=false";
        $files = $service->files->listFiles(['q' => $q]);
        if (count($files->getFiles()) > 0) return $files->getFiles()[0]->id;
        return $service->files->create(new DriveFile(['name' => $name, 'mimeType' => 'application/vnd.google-apps.folder', 'parents' => [$parentId]]), ['fields' => 'id'])->id;
    }

    // --- CANCELAMENTOS ---
    public function rejeitar(Request $request, $id) { return $this->cancelarGenerico($id, 'rejeitado', $request->motivo); }
    public function cancelarSolicitacao($id) { return $this->cancelarGenerico($id, 'cancelado', 'Cancelado pela Loja'); }

    private function cancelarGenerico($id, $tipo, $motivo) {
        return DB::transaction(function () use ($id, $tipo, $motivo) {
            $pedido = Pedido::with('motos', 'user')->findOrFail($id);
            if ($tipo == 'cancelado' && !in_array($pedido->status, ['solicitado', 'em_analise'])) return back()->with('error', 'Não é possível cancelar neste estágio.');
            
            // Libera motos
            foreach ($pedido->motos as $moto) {
                // Se era transferência, volta pro dono original, senão volta pra fábrica/CD
                $statusVolta = $pedido->origem_user_id ? 'disponivel' : 'estoque_fabrica';
                $localVolta = $pedido->origem_user_id ? "Estoque Loja" : "Pátio CD/Fábrica";
                
                $moto->update(['status' => $statusVolta, 'localizacao_atual' => $localVolta]);
            }
            $pedido->motos()->detach();

            // Libera qualquer reserva de chassi do Microwork atrelada a este pedido
            \App\Models\ReservaMicrowork::where('pedido_id', $pedido->id)
                ->whereIn('status', ['pendente', 'faturada'])
                ->update(['status' => 'cancelada']);
            
            $this->enviarNotificacao($pedido->user, ucfirst($tipo), "Pedido #$id $tipo: $motivo", route('dashboard'));
            
            $pedido->delete(); // Soft Delete
            return redirect()->route('dashboard')->with('warning', "Pedido $tipo com sucesso.");
        });
    }
    
    // --- VIEWS ---
    public function sucesso() { return Inertia::render('Pedidos/Sucesso'); }
    public function show($id) 
    {
        return Inertia::render('Pedidos/Show', [
            'pedido' => Pedido::with([
                'user',
                'origem', // <--- ADICIONADO: Traz os dados da loja de origem
                'motos' => function($q) {
                    $q->withPivot(['id', 'detalhes_avaria', 'foto_avaria', 'motivo']);
                },
                'romaneio',
                'logs' => fn($q) => $q->latest()
            ])->findOrFail($id)
        ]);
    }    
    public function imprimir($id) { return Inertia::render('Pedidos/Romaneio', ['pedido' => Pedido::with(['user', 'motos', 'romaneio'])->findOrFail($id)]); }
}