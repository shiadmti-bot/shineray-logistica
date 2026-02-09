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
        // 1. Validação Robusta
        $request->validate([
            'origem_id'  => 'nullable|exists:users,id',
            'observacao' => 'nullable|string|max:500',
            'motos'      => 'required|array|min:1', // Garante que tem motos
            // Valida cada item dentro do array de motos
            'motos.*.chassi' => 'required|string|distinct', 
            'motos.*.modelo' => 'required|string',
            'motos.*.cor'    => 'required|string',
            'motos.*.ano'    => 'nullable'
        ]);

        return DB::transaction(function () use ($request) {
            $user = Auth::user();
            
            // 2. Cria o Cabeçalho do Pedido (Apenas 1 Query)
            $pedido = Pedido::create([
                'user_id'        => $user->id,
                'origem_user_id' => $request->origem_id, // Se for transferência
                'status'         => 'solicitado', // Status inicial V2
                'observacao'     => $request->observacao
            ]);

            // 3. Preparação para Inserção em Massa (Bulk Insert)
            // O método ::insert() é 50x mais rápido que o ::create() em loops,
            // mas ele NÃO preenche created_at/updated_at automaticamente.
            
            $motosParaInserir = [];
            $now = now(); // Data única para todos os registros
            $statusInicialMoto = 'solicitado';

            foreach ($request->motos as $motoData) {
                $motosParaInserir[] = [
                    'pedido_id'      => $pedido->id,
                    'user_id'        => $user->id, // Dono atual (quem pediu)
                    'chassi'         => mb_strtoupper($motoData['chassi']),
                    'modelo'         => mb_strtoupper($motoData['modelo']),
                    'cor'            => mb_strtoupper($motoData['cor']),
                    'ano_fabricacao' => $motoData['ano'] ?? null,
                    'status'         => $statusInicialMoto,
                    'localizacao_atual' => 'Aguardando Aprovação/Separação',
                    'created_at'     => $now,
                    'updated_at'     => $now,
                ];
            }

            // 4. Executa a Inserção (Query Única)
            // Divide em lotes de 100 para segurança, caso enviem 1000 de uma vez.
            foreach (array_chunk($motosParaInserir, 100) as $chunk) {
                \App\Models\Moto::insert($chunk);
            }

            // 5. Log e Notificações (Otimizado)
            // Logamos apenas o pedido para não travar a thread com muitos logs de moto
            \App\Models\PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo'    => 'Pedido Criado 🆕',
                'descricao' => "Solicitação #{$pedido->id} criada com " . count($motosParaInserir) . " motos."
            ]);

            // Notifica Gestores (Sem travar o request, usando queue se possível, ou try/catch)
            try {
                $gestores = \App\Models\User::where('perfil', 'gestor')->get();
                // Assumindo que você tem esse helper no controller
                if (method_exists($this, 'enviarNotificacao')) {
                    $this->enviarNotificacao(
                        $gestores, 
                        'Nova Solicitação 🆕', 
                        "Loja {$user->filial} solicitou {$pedido->id}.", 
                        route('gestor.show', $pedido->id)
                    );
                }
            } catch (\Exception $e) {
                // Ignora erro de notificação para não falhar o pedido
            }

            return redirect()->route('pedidos.index')
                ->with('success', 'Pedido enviado com sucesso! Aguarde a aprovação.');
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
        $request->validate(['arquivo_romaneio' => 'required|file|max:15360']);

        return DB::transaction(function () use ($request, $id) {
            $pedido = Pedido::with('user', 'motos')->findOrFail($id);
            
            if (Auth::user()->perfil === 'loja' && $pedido->user_id !== Auth::id()) abort(403);

            // 2. Lógica de Backup (Drive ou Local)
            $linkComprovante = null;
            $usouBackupLocal = false;

            try {
                $refreshToken = config('services.google.refresh_token');
                if (empty($refreshToken)) throw new \Exception("Token vazio");

                $client = new Client();
                $client->setClientId(config('services.google.client_id'));
                $client->setClientSecret(config('services.google.client_secret'));
                $client->refreshToken($refreshToken);
                $service = new Drive($client);

                $folderId = Cache::remember("drive_folder_" . date('Ym'), 3600, function () use ($service) {
                    $root = config('services.google.folder_id') ?: 'root';
                    $ano = $this->findOrCreateFolder($service, date('Y'), $root);
                    return $this->findOrCreateFolder($service, date('m') . ' - Recebimentos', $ano);
                });

                $linkComprovante = $this->uploadFileToDrive($service, $request->file('arquivo_romaneio'), $folderId, "PEDIDO_{$id}_RECEBIMENTO");

            } catch (\Exception $e) {
                // Fallback Local
                $nomeArquivo = "comprovante_ped_{$id}_" . time() . "." . $request->file('arquivo_romaneio')->getClientOriginalExtension();
                $caminho = $request->file('arquivo_romaneio')->storeAs('comprovantes', $nomeArquivo, 'public');
                $linkComprovante = asset("storage/$caminho");
                $usouBackupLocal = true;
            }

            $pedido->comprovante_url = $linkComprovante;
            
            // 3. Processamento das Motos (CORREÇÃO AQUI)
            $avarias = $request->input('avarias', []);
            $fotos = $request->file('fotos_avarias', []);
            $qtdAvarias = 0;

            foreach ($pedido->motos as $moto) {
                $statusMoto = 'disponivel'; 
                $obsAvaria = null;
                $linkFoto = null;

                if (!empty($avarias[$moto->id])) {
                    $qtdAvarias++;
                    $statusMoto = 'avariado';
                    $obsAvaria = $avarias[$moto->id];
                    
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

                $moto->update([
                    'status' => $statusMoto, // Fica 'disponivel' ou 'avariado'
                    'localizacao_atual' => "Estoque Loja: {$pedido->user->filial}",
                    'detalhes_avaria' => $obsAvaria,
                    'foto_avaria' => $linkFoto,
                    // REMOVIDO: 'romaneio_id' => null
                    // Mantemos o ID para que o histórico da carga continue mostrando essa moto.
                ]);
            }

            $pedido->update(['status' => 'concluido']);
            
            // 4. Fechamento da Carga (Romaneio)
            if ($pedido->romaneio_id) {
                $pendentes = Pedido::where('romaneio_id', $pedido->romaneio_id)
                                   ->where('status', '!=', 'concluido')->count();
                
                // Se não tem mais pedidos pendentes nesta carga, marca como Concluída
                if ($pendentes === 0) {
                    Romaneio::where('id', $pedido->romaneio_id)->update(['status' => 'concluido']);
                }
            }

            $this->registrarLog($pedido, 'Concluído', $qtdAvarias ? "Com $qtdAvarias avarias." : "100% OK.");
            
            try {
                $this->enviarNotificacao(User::where('perfil', 'gestor')->get(), 'Concluído ✅', "Loja finalizou pedido #{$id}.", route('pedidos.show', $id));
            } catch (\Exception $e) {}

            $msg = $usouBackupLocal 
                ? 'Recebimento salvo localmente (Drive indisponível).' 
                : 'Recebimento confirmado!';

            return back()->with('message', $msg);
        });
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