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
    public function calcularLogistica(Request $request)
    {
        $origemId = $request->input('origem_id');
        $origem = User::findOrFail($origemId);
        $solicitante = Auth::user(); // Quem vai receber a moto

        // LÓGICA V2: A prioridade é a Loja Solicitante (Destino)
        
        $rotaNome = 'Indefinida';
        $dataColeta = now()->addDay()->format('Y-m-d'); // Padrão: Coleta amanhã (D+1) se for capital
        $dataEntrega = null; // Null ativa o aviso "Aguardando Agendamento" no Frontend

        // CENÁRIO 1: O SOLICITANTE É DO INTERIOR (Hub & Spoke Mandatório)
        // Não importa de onde vem a moto, ela vai para o CD e espera o caminhão da rota.
        if ($solicitante->is_interior) {
            $rotaNome = 'Rota Interior (Agendada)';
            
            // 1. Busca se já existe uma viagem CONFIRMADA para esta loja no calendário
            // A busca olha na tabela de paradas (stops) ou destino final
            $proximaViagem = \App\Models\Schedule::whereHas('stops', function($q) use ($solicitante) {
                $q->where('user_id', $solicitante->id);
            })
            ->where('date', '>=', now())
            ->where('status', 'confirmed') // Só rotas confirmadas geram data
            ->orderBy('date', 'asc')
            ->first();

            if ($proximaViagem) {
                $dataEntrega = $proximaViagem->date;
            }
            
            // Se a origem for interior também, a coleta depende da rota da origem
            if ($origem->is_interior) {
                $rotaColeta = \App\Models\Schedule::whereHas('stops', function($q) use ($origem) {
                    $q->where('user_id', $origem->id);
                })->where('date', '>=', now())->first();
                
                $dataColeta = $rotaColeta ? $rotaColeta->date : null; // Aguardando coleta
            }
        } 
        // CENÁRIO 2: O SOLICITANTE É DA CAPITAL
        else {
            // Se a origem for Interior -> Capital (Retorno de Milk Run)
            if ($origem->is_interior) {
                $rotaNome = 'Retorno Interior -> Capital';
                
                // A entrega depende de quando o caminhão passar na origem para buscar
                $viagemColeta = \App\Models\Schedule::whereHas('stops', function($q) use ($origem) {
                    $q->where('user_id', $origem->id);
                })->where('date', '>=', now())->first();

                if ($viagemColeta) {
                    $dataColeta = $viagemColeta->date;
                    // Entrega no mesmo dia da chegada ou dia seguinte
                    $dataEntrega = \Carbon\Carbon::parse($viagemColeta->date)->format('Y-m-d'); 
                }
            } 
            // Se a origem for Capital -> Capital (Rota Direta)
            else {
                $rotaNome = 'Direta (Capital)';
                $dataEntrega = now()->addDay()->format('Y-m-d'); // D+1 Garantido
            }
        }

        return response()->json([
            'origem' => $origem->filial,
            'rota_origem' => $rotaNome,
            'data_coleta' => $dataColeta,
            'data_entrega' => $dataEntrega, // Se for null, o frontend mostra o alerta laranja
            'erro' => false
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
        // 1. Validação Rigorosa: Arquivo Obrigatório
        $request->validate([
            'arquivo_romaneio' => 'required|file|mimes:jpg,jpeg,png,pdf|max:15360', // Máx 15MB
            'avarias'          => 'nullable|array',
            'fotos_avarias'    => 'nullable|array'
        ], [
            'arquivo_romaneio.required' => 'É obrigatório anexar a foto do romaneio assinado para finalizar.',
            'arquivo_romaneio.mimes'    => 'O arquivo deve ser uma imagem (JPG, PNG) ou PDF.'
        ]);

        return DB::transaction(function () use ($request, $id) {
            
            // Carrega Pedido e Motos
            $pedido = Pedido::with(['user', 'motos'])->findOrFail($id);
            $userFilial = $pedido->user->filial ?? 'Matriz';

            // Segurança: Apenas o dono da loja ou Admin/Gestor pode finalizar
            if (Auth::user()->perfil === 'loja' && $pedido->user_id !== Auth::id()) {
                abort(403, 'Acesso negado: Você não pode finalizar pedidos de outra loja.');
            }

            // 2. Upload do Romaneio (Google Drive com Fallback Local)
            $linkComprovante = null;
            $driveError = null;

            try {
                // Tenta conectar ao Drive
                $client = new Client();
                $client->setClientId(config('services.google.client_id'));
                $client->setClientSecret(config('services.google.client_secret'));
                $client->refreshToken(config('services.google.refresh_token'));
                $service = new Drive($client);
                
                // Estrutura de Pastas: Filial -> Ano -> Mês
                $folderName = "Filial - " . $userFilial;
                $rootId = config('services.google.folder_id');
                
                // Cache para evitar chamadas repetidas à API do Drive para achar pastas
                $targetFolderId = Cache::remember("drive_fldr_{$pedido->user_id}_" . date('Ym'), 3600, function () use ($service, $rootId, $folderName) {
                    $filialId = $this->findOrCreateFolder($service, $folderName, $rootId);
                    $yearId = $this->findOrCreateFolder($service, date('Y'), $filialId);
                    return $this->findOrCreateFolder($service, date('m') . ' - Recebimentos', $yearId);
                });

                // Nome do Arquivo Padronizado
                $fileName = "ROMANEIO_Ped-{$pedido->id}_" . date('d-m-Y') . ".{$request->file('arquivo_romaneio')->getClientOriginalExtension()}";
                
                // Upload
                $linkComprovante = $this->uploadFileToDrive($service, $request->file('arquivo_romaneio'), $targetFolderId, $fileName);

            } catch (\Exception $e) {
                // Se o Drive falhar, salva localmente para não travar a operação
                $driveError = $e->getMessage();
                $localName = "comprovante_ped_{$id}_" . time() . "." . $request->file('arquivo_romaneio')->getClientOriginalExtension();
                $path = $request->file('arquivo_romaneio')->storeAs('comprovantes_contingencia', $localName, 'public');
                $linkComprovante = asset("storage/$path");
            }

            // Salva link no pedido
            $pedido->comprovante_url = $linkComprovante;

            // 3. Processamento das Motos e Avarias
            $listaAvarias = $request->input('avarias', []);
            $fotosAvarias = $request->file('fotos_avarias', []);
            $qtdAvarias = 0;

            foreach ($pedido->motos as $moto) {
                
                $statusMoto = 'disponivel'; // Padrão: Entra no estoque da loja para venda
                $obsAvaria = null;
                $linkFotoAvaria = null;

                // Verifica se esta moto foi marcada como avariada
                if (!empty($listaAvarias[$moto->id])) {
                    $qtdAvarias++;
                    $statusMoto = 'avariado'; // Entra no estoque como avariada (indisponível)
                    $obsAvaria = $listaAvarias[$moto->id];

                    // Upload da foto da avaria (se houver)
                    if (isset($fotosAvarias[$moto->id])) {
                        try {
                            if (!isset($driveError) && isset($service)) {
                                // Tenta Drive
                                $fName = "AVARIA_{$moto->chassi}_Ped-{$pedido->id}." . $fotosAvarias[$moto->id]->getClientOriginalExtension();
                                $linkFotoAvaria = $this->uploadFileToDrive($service, $fotosAvarias[$moto->id], $targetFolderId, $fName);
                            } else {
                                throw new \Exception("Drive indisponível");
                            }
                        } catch (\Exception $e) {
                            // Fallback Local
                            $path = $fotosAvarias[$moto->id]->store('avarias_contingencia', 'public');
                            $linkFotoAvaria = asset("storage/$path");
                        }
                    }
                }

                // Atualiza a Moto
                $moto->update([
                    'status' => $statusMoto,
                    'localizacao_atual' => "Estoque Loja: {$userFilial}" . ($statusMoto === 'avariado' ? ' (COM AVARIA)' : ''),
                    'detalhes_avaria' => $obsAvaria,
                    'foto_avaria' => $linkFotoAvaria,
                    // Mantemos o 'romaneio_id' histórico, mas o ciclo logístico encerrou aqui.
                ]);
            }

            // 4. Finaliza o Pedido
            $pedido->status = 'concluido';
            $pedido->save();

            // 5. Verifica se a Carga (Romaneio) inteira foi concluída
            if ($pedido->romaneio_id) {
                // Conta quantos pedidos ainda faltam entregar neste caminhão
                $pendentes = Pedido::where('romaneio_id', $pedido->romaneio_id)
                    ->whereNotIn('status', ['concluido', 'cancelado', 'no_cd']) // no_cd = transbordo devolvido
                    ->count();

                if ($pendentes === 0) {
                    Romaneio::where('id', $pedido->romaneio_id)->update(['status' => 'concluido']);
                }
            }

            // 6. Logs e Notificações
            $logMsg = $qtdAvarias > 0 
                ? "Entrega finalizada com {$qtdAvarias} avarias reportadas." 
                : "Entrega finalizada com sucesso (100% OK).";
            
            $this->registrarLog($pedido, 'Concluído', $logMsg);

            // Notifica Gestores
            try {
                $gestores = User::where('perfil', 'gestor')->get();
                $this->enviarNotificacao(
                    $gestores,
                    'Entrega Realizada ✅',
                    "Loja {$userFilial} finalizou o recebimento do pedido #{$pedido->id}.",
                    route('pedidos.show', $pedido->id)
                );
            } catch (\Exception $e) {
                // Ignora erro de notificação para não travar o processo
            }

            $msgFinal = isset($driveError) 
                ? 'Recebimento salvo localmente (Google Drive instável), mas finalizado com sucesso!' 
                : 'Recebimento confirmado e arquivos salvos na nuvem!';

            return redirect()->back()->with('message', $msgFinal);
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