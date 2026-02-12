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
        $request->validate([
            'itens' => 'required|array|min:1',
            'itens.*.modelo' => 'required',
            'itens.*.cor' => 'required',
            // Chassi é opcional na solicitação inicial se for apenas "Pedido de Giro", 
            // mas obrigatório se for transferência específica.
            'origem_id' => 'nullable|exists:users,id'
        ]);

        return DB::transaction(function () use ($request) {
            
            // Valida duplicidade se chassis forem informados
            $chassisInformados = array_filter(array_column($request->itens, 'chassi'));
            if (!empty($chassisInformados)) {
                $duplicados = Moto::whereIn('chassi', $chassisInformados)
                    ->whereNotIn('status', ['estoque_fabrica', 'cancelado'])
                    ->pluck('chassi')->toArray();
                
                if ($duplicados) {
                    throw ValidationException::withMessages(['itens' => 'Chassis já em uso: ' . implode(', ', $duplicados)]);
                }
            }

            // Recalcula Logística (Backend Trust)
            $previsaoColeta = null; $previsaoEntrega = null;
            if ($request->origem_id) {
                $reqLogistica = new Request(['fornecedor_id' => $request->origem_id]);
                $dadosLogistica = $this->calcularLogistica($reqLogistica)->getData();
                
                if (isset($dadosLogistica->erro)) {
                    throw ValidationException::withMessages(['origem_id' => $dadosLogistica->erro]);
                }
                $previsaoColeta = $dadosLogistica->data_coleta ?? null;
                $previsaoEntrega = $dadosLogistica->data_entrega ?? null;
            }

            // Cria o Pedido
            $pedido = Pedido::create([
                'user_id' => Auth::id(),
                'status' => 'em_analise', // Vai para aprovação do Gestor
                'observacao' => $request->observacao,
                'origem_user_id' => $request->origem_id,
                'itens' => $request->itens, // Salva JSON para histórico
                'previsao_coleta' => $previsaoColeta,
                'previsao_entrega' => $previsaoEntrega
            ]);

            // Cria ou Vincula as Motos
            foreach ($request->itens as $item) {
                // Se o usuário informou chassi, criamos/atualizamos a moto
                if (!empty($item['chassi'])) {
                    $moto = Moto::updateOrCreate(
                        ['chassi' => mb_strtoupper($item['chassi'])],
                        [
                            'modelo' => mb_strtoupper($item['modelo']),
                            'cor' => mb_strtoupper($item['cor']),
                            'ano_fabricacao' => $item['ano'] ?? null,
                            'motivo_solicitacao' => $item['motivo'],
                            'status' => 'reservado', // Bloqueia para outros
                            'localizacao_atual' => 'Reservado Pedido #' . $pedido->id
                        ]
                    );
                    // Vincula na tabela pivô
                    $pedido->motos()->attach($moto->id, ['destino' => mb_strtoupper($item['local'])]);
                } else {
                    // Se NÃO informou chassi (Pedido Genérico), o CD alocará depois.
                    // A moto não é criada na tabela `motos` ainda, fica só no JSON `itens` do pedido.
                }
            }

            $origemNome = $request->origem_id ? 'Transferência (Inter-lojas)' : 'Reposição CD';
            $this->registrarLog($pedido, 'Solicitação Criada', $origemNome);
            
            // Notifica Diretoria
            $this->enviarNotificacao(
                User::where('perfil', 'gestor')->get(), 
                'Nova Solicitação 🆕', 
                "Loja " . Auth::user()->filial . " criou pedido #{$pedido->id}.", 
                route('dashboard')
            );

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
        // 1. Validação
        $request->validate([
            'arquivo_romaneio' => 'required|file|max:15360|mimes:jpg,jpeg,png,pdf'
        ]);

        return DB::transaction(function () use ($request, $id) {
            // Carrega pedido com motos e user (destino)
            $pedido = Pedido::with('user', 'motos')->findOrFail($id);
            
            // Segurança: Garante que apenas a loja dona do pedido pode finalizar
            if (Auth::user()->perfil === 'loja' && $pedido->user_id !== Auth::id()) {
                abort(403, 'Acesso não autorizado.');
            }

            // 2. Lógica de Backup (Drive ou Local)
            $linkComprovante = null;
            $usouBackupLocal = false;

            try {
                $refreshToken = config('services.google.refresh_token');
                if (empty($refreshToken)) throw new \Exception("Token vazio");

                $client = new \Google\Client();
                $client->setClientId(config('services.google.client_id'));
                $client->setClientSecret(config('services.google.client_secret'));
                $client->refreshToken($refreshToken);
                $service = new \Google\Service\Drive($client);

                // Cache para evitar chamadas repetidas ao Drive buscando a pasta
                $folderId = Cache::remember("drive_folder_" . date('Ym'), 3600, function () use ($service) {
                    $root = config('services.google.folder_id') ?: 'root';
                    $ano = $this->findOrCreateFolder($service, date('Y'), $root);
                    return $this->findOrCreateFolder($service, date('m') . ' - Recebimentos', $ano);
                });

                $linkComprovante = $this->uploadFileToDrive($service, $request->file('arquivo_romaneio'), $folderId, "PEDIDO_{$id}_RECEBIMENTO");

            } catch (\Exception $e) {
                // Fallback Local (Storage) se o Drive falhar
                $nomeArquivo = "comprovante_ped_{$id}_" . time() . "." . $request->file('arquivo_romaneio')->getClientOriginalExtension();
                $caminho = $request->file('arquivo_romaneio')->storeAs('comprovantes', $nomeArquivo, 'public');
                $linkComprovante = asset("storage/$caminho");
                $usouBackupLocal = true;
            }

            $pedido->comprovante_url = $linkComprovante;
            
            // 3. Processamento das Motos com Lógica de Estoque (V2)
            $avarias = $request->input('avarias', []);
            $fotos = $request->file('fotos_avarias', []);
            $qtdAvarias = 0;

            foreach ($pedido->motos as $moto) {
                // A. Identifica o Motivo (Prioriza o da moto, senão usa o do pedido)
                // O motivo pode vir do pivot (se many-to-many) ou direto da moto dependendo da sua estrutura
                $motivo = $moto->pivot->motivo ?? $pedido->motivo_solicitacao ?? 'Estoque Regular (Giro)';
                $motivoLimpo = mb_strtolower($motivo, 'UTF-8');

                // B. Define Status Base (Disponível p/ Transferência ou Vendida)
                if (str_contains($motivoLimpo, 'venda') || str_contains($motivoLimpo, 'cliente')) {
                    $novoStatus = 'vendida'; // Bloqueia transferência
                } else {
                    $novoStatus = 'estoque_loja'; // Libera para transferência
                }

                $obsAvaria = null;
                $linkFoto = null;

                // C. Verifica Avarias (Sobrescreve status se houver problema)
                if (!empty($avarias[$moto->id])) {
                    $qtdAvarias++;
                    $novoStatus = 'avariado'; // Avaria tem prioridade
                    $obsAvaria = $avarias[$moto->id];
                    
                    // Upload da Foto da Avaria
                    if (isset($fotos[$moto->id])) {
                        if (!$usouBackupLocal && isset($service)) {
                            try {
                                $linkFoto = $this->uploadFileToDrive($service, $fotos[$moto->id], $folderId, "AVARIA_{$moto->chassi}");
                            } catch (\Exception $e) {
                                $pathFoto = $fotos[$moto->id]->store('avarias', 'public');
                                $linkFoto = asset("storage/$pathFoto");
                            }
                        } else {
                            $pathFoto = $fotos[$moto->id]->store('avarias', 'public');
                            $linkFoto = asset("storage/$pathFoto");
                        }
                    }
                }

                // D. Atualização Definitiva da Moto
                $moto->update([
                    'status'            => $novoStatus,
                    'localizacao_atual' => "Estoque Loja: {$pedido->user->filial}", // Texto visual
                    'loja_atual_id'     => $pedido->user_id, // VÍNCULO CHAVE: Define quem é o novo dono (para transferências)
                    'detalhes_avaria'   => $obsAvaria,
                    'foto_avaria'       => $linkFoto,
                    'romaneio_id'       => null // IMPORTANTE: Libera a moto da carga anterior para poder entrar em uma nova (transferência)
                ]);
            }

            // 4. Finaliza Pedido
            $pedido->update(['status' => 'concluido']);
            
            // 5. Fechamento da Carga (Romaneio) se tudo foi entregue
            if ($pedido->romaneio_id) {
                $pendentes = Pedido::where('romaneio_id', $pedido->romaneio_id)
                                   ->where('status', '!=', 'concluido')
                                   ->where('id', '!=', $pedido->id) // Exclui o atual da contagem
                                   ->count();
                
                if ($pendentes === 0) {
                    Romaneio::where('id', $pedido->romaneio_id)->update(['status' => 'concluido']);
                }
            }

            // 6. Logs e Notificações
            $this->registrarLog($pedido, 'Concluído', $qtdAvarias ? "Finalizado com $qtdAvarias avarias relatadas." : "Recebimento conferido 100%.");
            
            try {
                // Notifica Gestores e CD
                $notificaveis = User::whereIn('perfil', ['gestor', 'admin', 'cd'])->get();
                $this->enviarNotificacao($notificaveis, 'Entrega Confirmada ✅', "Loja {$pedido->user->filial} finalizou o pedido #{$id}.", route('pedidos.show', $id));
            } catch (\Exception $e) {}

            $msg = $usouBackupLocal 
                ? 'Recebimento salvo (Modo Offline/Local ativo).' 
                : 'Recebimento confirmado e estoque atualizado!';

            return back()->with('message', $msg);
        });
    }

    public function buscarEstoqueLoja(Request $request)
    {
        // O ID da loja que vai FORNECER a moto (Origem)
        $lojaId = $request->input('loja_id');

        if (!$lojaId) {
            return response()->json([]);
        }

        $motosDisponiveis = \App\Models\Moto::where('loja_atual_id', $lojaId) // Filtra pela loja selecionada
            ->where('status', 'estoque_loja') // IMPORTANTE: Só pega motos com status de GIRO (ignora Vendidas/Avariadas)
            ->select('id', 'chassi', 'modelo', 'cor', 'ano_fabricacao') // Traz apenas o necessário para o combo
            ->orderBy('modelo')
            ->get();

        return response()->json($motosDisponiveis);
    }

    // --- GOOGLE DRIVE HELPERS ---
    private function uploadFileToDrive($service, $file, $folderId, $name) {
        $meta = new DriveFile(['name' => $name . "." . $file->getClientOriginalExtension(), 'parents' => [$folderId]]);
        $uploaded = $service->files->create($meta, [
            'data' => file_get_contents($file->getRealPath()),
            'mimeType' => $file->getClientMimeType(),
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