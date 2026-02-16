<?php

namespace App\Http\Controllers;

use App\Services\OneSignalService;
use App\Models\Moto;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\Romaneio;
use App\Models\User;
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
        $usuarios = is_iterable($usuarios) ? $usuarios : collect([$usuarios]);
        
        foreach ($usuarios as $user) {
            if($user) $user->notify(new PedidoAtualizado($titulo, $mensagem, $link));
        }

        $ids = collect($usuarios)->pluck('onesignal_id')->filter()->toArray();
        if (!empty($ids)) {
            try { (new OneSignalService())->sendToUser($ids, $titulo, $mensagem, $link); } 
            catch (\Exception $e) { \Illuminate\Support\Facades\Log::warning("OneSignal: " . $e->getMessage()); }
        }
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
                'data_coleta' => now()->format('Y-m-d'),
                'data_entrega' => now()->addDays(2)->format('Y-m-d'), // Estimativa padrão
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
                'data_coleta' => now()->format('Y-m-d'),
                'data_entrega' => now()->addDay()->format('Y-m-d'),
                'mensagem' => 'Transferência direta na região metropolitana.'
            ]);
        } 
        
        // Interior: Depende do Calendário (Schedule)
        // Busca a próxima viagem confirmada onde a origem é Destino ou Escala
        $viagem = Schedule::where(function($q) use ($origemId) {
                $q->where('target_user_id', $origemId)
                  ->orWhere('secondary_user_id', $origemId);
            })
            ->where('date', '>=', now())
            ->where('status', 'confirmed')
            ->orderBy('date', 'asc')
            ->first();

        if (!$viagem) {
            return response()->json(['erro' => "A loja {$origem->filial} não tem viagens confirmadas no calendário para coleta."], 404);
        }

        return response()->json([
            'tipo' => 'transferencia',
            'origem' => $origem->filial,
            'rota_origem' => 'Agendada (Interior)',
            'data_coleta' => $viagem->date->format('Y-m-d'),
            // Entrega = Coleta + 3 dias (Triagem CD)
            'data_entrega' => Carbon::parse($viagem->date)->addDays(3)->format('Y-m-d')
        ]);
    }

    // --- CRUD PEDIDOS ---
    public function index(Request $request)
    {
        $user = Auth::user();
        $termo = $request->input('search');

        $pedidos = Pedido::with([
                'user:id,name,filial',    // Quem pediu
                'origem:id,name,filial',  // Quem fornece
                'romaneio'
            ])
            ->withCount('motos')
            // LÓGICA V2: Loja vê entrada (meus pedidos) E saída (pedidos de mim)
            ->when($user->perfil === 'loja', function($q) use ($user) {
                $q->where(function($sub) use ($user) {
                    $sub->where('user_id', $user->id)
                        ->orWhere('origem_user_id', $user->id);
                });
            })
            ->when($termo, function($q) use ($termo) {
                $q->where(function($sub) use ($termo) {
                    $sub->where('id', 'like', "%{$termo}%")
                        ->orWhere('status', 'like', "%{$termo}%")
                        // Busca nas motos (JSON ou relação)
                        ->orWhereHas('motos', fn($m) => $m->where('chassi', 'like', "%{$termo}%"))
                        // Busca quem pediu ou origem
                        ->orWhereHas('user', fn($u) => $u->where('filial', 'like', "%{$termo}%"))
                        ->orWhereHas('origem', fn($o) => $o->where('filial', 'like', "%{$termo}%"));
                });
            })
            // Ordenação por urgência de status
            ->orderByRaw("FIELD(status, 'em_analise', 'solicitado', 'separado') DESC")
            ->orderBy('created_at', 'desc')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Pedidos/Index', [
            'pedidos' => $pedidos, 
            'perfil' => $user->perfil, 
            'filters' => $request->only(['search'])
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
                $query->whereIn('status', ['solicitado', 'aprovado', 'separado', 'aguardando_coleta', 'em_transito', 'expedido', 'em_transito_cd', 'no_cd']);
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

        return Inertia::render('Pedidos/Create', [
            'listaModelos' => Modelo::orderBy('nome')->pluck('nome'),
            'lojasDisponiveis' => $lojas
        ]);
    }

    public function store(Request $request)
    {
        // 1. Validação dos Campos (Sem a regra 'unique' para chassis, pois trataremos manualmente)
        $request->validate([
            'itens' => 'required|array|min:1',
            'itens.*.modelo' => 'required|string',
            'itens.*.cor' => 'required|string',
            'itens.*.motivo' => 'required|string',
            'itens.*.local' => 'required|string',
            // Chassi validado manualmente abaixo para permitir Transferência
            'itens.*.chassi' => 'nullable|string|min:11|max:17', 
            'origem_id' => 'nullable|exists:users,id'
        ]);

        return DB::transaction(function () use ($request) {
            $user = Auth::user();
            $isTransferencia = !empty($request->origem_id);

            // 2. Cálculo Logístico (Datas)
            $previsaoColeta = null; 
            $previsaoEntrega = null;
            
            if ($isTransferencia) {
                // Simula requisição interna para calcular logística
                $reqLogistica = new Request(['fornecedor_id' => $request->origem_id]);
                // Assume que você tem o método calcularLogistica no controller
                $dadosLogistica = $this->calcularLogistica($reqLogistica)->getData();
                
                if (isset($dadosLogistica->erro)) {
                    throw \Illuminate\Validation\ValidationException::withMessages(['origem_id' => $dadosLogistica->erro]);
                }
                $previsaoColeta = $dadosLogistica->data_coleta ?? null;
                $previsaoEntrega = $dadosLogistica->data_entrega ?? null;
            }

            // 3. Criação do Cabeçalho do Pedido
            $pedido = Pedido::create([
                'user_id' => $user->id, // Quem pede (Destino)
                'origem_user_id' => $request->origem_id, // De onde vem (Origem)
                'status' => 'em_analise', // Status Inicial (Aguardando Aprovação Gestor)
                'observacao' => $request->observacao,
                'motivo_solicitacao' => $request->itens[0]['motivo'] ?? 'Estoque Regular (Giro)', // Pega o 1º motivo como geral
                'itens' => $request->itens, // Salva JSON para histórico/backup
                'previsao_coleta' => $previsaoColeta,
                'previsao_entrega' => $previsaoEntrega
            ]);

            // 4. Processamento dos Itens (Motos)
            foreach ($request->itens as $item) {
                $chassi = isset($item['chassi']) ? mb_strtoupper(trim($item['chassi'])) : null;
                
                // --- A. VALIDAÇÃO DE "EM USO" (CRÍTICO PARA CORRIGIR O ERRO) ---
                if ($chassi) {
                    // Verifica se o chassi está em algum pedido ATIVO (que não foi concluído nem cancelado)
                    $emUso = Pedido::whereHas('motos', function ($q) use ($chassi) {
                        $q->where('chassi', $chassi);
                    })
                    ->whereNotIn('status', ['concluido', 'cancelado']) // IMPORTANTE: Ignora pedidos velhos
                    ->exists();

                    if ($emUso) {
                        throw \Illuminate\Validation\ValidationException::withMessages([
                            'itens' => "O chassi {$chassi} já está em um pedido aberto/em trânsito e não pode ser solicitado novamente."
                        ]);
                    }
                }

                $moto = null;

                // --- B. CENÁRIO 1: TRANSFERÊNCIA (O Chassi TEM que existir na Origem) ---
                if ($isTransferencia) {
                    if (!$chassi) {
                        throw \Illuminate\Validation\ValidationException::withMessages(['itens' => "Para transferência, o chassi é obrigatório."]);
                    }

                    // Busca a moto na loja de origem
                    // Busca a moto (independente da loja, para validar duplicidade)
                    $moto = Moto::where('chassi', $chassi)->first();

                    if (!$moto) {
                        // C.1 MOTO NÃO CADASTRADA (Fluxo Externo Permitido)
                        // Cria o registro automaticamente como vindo da Loja de Origem
                        $lojaOrigem = User::find($request->origem_id);
                        $nomeLoja = $lojaOrigem ? $lojaOrigem->filial : 'Loja Externa';

                        $moto = Moto::create([
                            'chassi' => $chassi,
                            'modelo' => mb_strtoupper($item['modelo']),
                            'cor' => mb_strtoupper($item['cor']),
                            'status' => 'solicitado',
                            'loja_atual_id' => $request->origem_id,
                            'localizacao_atual' => "Estoque Loja: {$nomeLoja}"
                        ]);
                    } 
                    else {
                        // C.2 MOTO JÁ EXISTE NO SISTEMA
                        // Valida se pertence à loja de origem solicitada
                        if ($moto->loja_atual_id != $request->origem_id) {
                            $lojaReal = $moto->loja_atual_id ? (User::find($moto->loja_atual_id)->filial ?? 'Outra Loja') : 'Sem Registro';
                            throw \Illuminate\Validation\ValidationException::withMessages([
                                'itens' => "A moto {$chassi} já existe mas pertence a {$lojaReal}, não à loja de origem selecionada."
                            ]);
                        }

                        // Validação de Status (Bloqueios)
                        $statusBloqueados = [
                            'vendida', 
                            'reservado', // ADICIONADO: Bloqueia reservados
                            'solicitado', 
                            'separado', 
                            'aguardando_coleta', 
                            'em_transito', 
                            'expedido', 
                            'transito_loja'
                        ];

                        if (in_array($moto->status, $statusBloqueados)) {
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
                        // Se informou chassi, usa FirstOrCreate
                        $moto = Moto::firstOrCreate(
                            ['chassi' => $chassi],
                            [
                                'modelo' => mb_strtoupper($item['modelo']),
                                'cor' => mb_strtoupper($item['cor']),
                                'status' => 'solicitado',
                                'localizacao_atual' => 'Fábrica/CD'
                            ]
                        );

                        // Segurança: Se a moto já existia, mas pertence a outra loja, não deixa o CD "roubar"
                        // Exceto se estiver em estoque_fabrica
                        if (!$moto->wasRecentlyCreated && !in_array($moto->status, ['estoque_fabrica', 'solicitado'])) {
                             throw \Illuminate\Validation\ValidationException::withMessages([
                                'itens' => "O chassi {$chassi} já existe no sistema e pertence a outra loja ({$moto->localizacao_atual}). Use Transferência."
                            ]);
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

                // 5. Vínculo na Tabela Pivô
                if ($moto) {
                    $pedido->motos()->attach($moto->id, [
                        'destino' => mb_strtoupper($item['local']),
                        'motivo' => $item['motivo']
                    ]);
                }
            }

            // 6. Logs e Notificações
            $origemNome = $request->origem_id ? 'Transferência (Inter-lojas)' : 'Reposição CD';
            $this->registrarLog($pedido, 'Criado', "Solicitação via sistema ($origemNome)");
            
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
            
            $this->registrarLog($pedido, 'Aprovado', 'Movimentação autorizada pelo Gestor.');

            // Notifica solicitante
            $this->enviarNotificacao(
                $pedido->user, 
                'Aprovado ✅', 
                "Sua solicitação #{$pedido->id} foi aprovada.", 
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
        if ($user->perfil === 'cd' && !in_array($moto->status, ['solicitado', 'separado'])) 
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

            // LÓGICA V2: QUEM SEPARA?
            // Cenário A: Transferência (Origem definida) -> Quem separa é a Loja de Origem
            if ($pedido->origem_user_id) {
                if ($user->id !== $pedido->origem_user_id && $user->perfil !== 'admin') {
                    return back()->withErrors(['erro' => 'Apenas a loja de origem (' . $pedido->origem->filial . ') pode confirmar a separação desta moto.']);
                }
                $msgLog = "Separado na origem ({$pedido->origem->filial}). Aguardando coleta do CD.";
            } 
            // Cenário B: Reposição (Origem NULL) -> Quem separa é o CD
            else {
                if ($user->perfil !== 'cd' && $user->perfil !== 'admin') {
                    return back()->withErrors(['erro' => 'Apenas o CD pode separar pedidos de reposição.']);
                }
                $msgLog = "Separado no estoque do CD.";
            }

            // Atualiza
            $pedido->update(['status' => 'separado']);
            $pedido->motos()->update(['status' => 'separado']);
            
            $this->registrarLog($pedido, 'Separado 📦', $msgLog);
            
            // Notifica o CD que existe uma coleta pronta (apenas se for transferência)
            if ($pedido->origem_user_id) {
                $cdUsers = User::where('perfil', 'cd')->get();
                $this->enviarNotificacao($cdUsers, 'Coleta Pronta 🚚', "Loja {$pedido->origem->filial} separou as motos do pedido #{$pedido->id}. Pode agendar coleta.", route('romaneios.create'));
            }

            return back()->with('success', 'Itens separados e prontos para logística!');
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
            $notificaveis = User::whereIn('perfil', ['gestor', 'admin', 'cd'])->get();
            $this->enviarNotificacao($notificaveis, 'Entrega Confirmada ✅', "Loja {$pedido->user->filial} finalizou pedido #{$id}.", route('pedidos.show', $id));
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
            $image->toJpeg(quality: 80)->save($caminhoFinal);
            
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
                'motos.romaneio', 
                'romaneio', 
                'logs' => fn($q) => $q->latest()
            ])->findOrFail($id)
        ]); 
    }    
    public function imprimir($id) { return Inertia::render('Pedidos/Romaneio', ['pedido' => Pedido::with(['user', 'motos', 'romaneio'])->findOrFail($id)]); }
}