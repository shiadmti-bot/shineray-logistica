<?php

namespace App\Http\Controllers;

use App\Services\OneSignalService;
use App\Models\Moto;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\Romaneio;
use App\Models\User;
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

class PedidoController extends Controller
{
    // --- HELPER: Centraliza Logs ---
    private function registrarLog($pedido, $titulo, $desc = '') {
        if ($pedido && $pedido->exists) {
            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo' => $titulo,
                'descricao' => $desc . ' (Por: ' . Auth::user()->name . ')'
            ]);
        }
    }

    // --- HELPER: Centraliza Notificações (Sistema + Push) ---
    private function enviarNotificacao($usuarios, $titulo, $mensagem, $link, $tipo = 'info') {
        // Garante que é uma coleção ou array
        if (!is_iterable($usuarios)) $usuarios = collect([$usuarios]);

        // 1. Notificação do Sistema (Sininho)
        foreach ($usuarios as $user) {
            $user->notify(new PedidoAtualizado($titulo, $mensagem, $link));
        }

        // 2. Notificação Push (OneSignal)
        $ids = collect($usuarios)->whereNotNull('onesignal_id')->pluck('onesignal_id')->toArray();
        
        if (!empty($ids)) {
            try {
                $push = new OneSignalService();
                $push->sendToUser($ids, $titulo, $mensagem, $link);
            } catch (\Exception $e) {
                // Loga erro mas não para o fluxo
                \Illuminate\Support\Facades\Log::warning("Erro OneSignal: " . $e->getMessage());
            }
        }
    }

    public function index(Request $request)
    {
        $user = Auth::user();
        $termo = $request->input('search');

        $query = Pedido::with(['user', 'romaneio'])->withCount('motos');

        if ($user->perfil === 'loja') {
            $query->where('user_id', $user->id);
        }

        if ($termo) {
            $query->where(function($q) use ($termo) {
                $q->where('id', 'like', "%{$termo}%")
                  ->orWhere('status', 'like', "%{$termo}%")
                  ->orWhereHas('motos', fn($m) => $m->where('chassi', 'like', "%{$termo}%"))
                  ->orWhereHas('user', fn($u) => $u->where('name', 'like', "%{$termo}%")->orWhere('filial', 'like', "%{$termo}%"));
            });
        }

        // Ordenação: 
        // 1. 'em_analise' (Topo para o Gestor)
        // 2. 'solicitado' (Topo para o CD)
        // 3. Data decrescente
        $pedidos = $query->orderByRaw("FIELD(status, 'em_analise', 'solicitado') DESC")
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
        $modelos = \App\Models\Modelo::orderBy('nome')->pluck('nome');
        return Inertia::render('Pedidos/Create', ['listaModelos' => $modelos]);
    }

    public function store(Request $request)
    {
        // 1. Validação Rigorosa (Incluindo o novo campo 'local')
        $request->validate([
            'itens' => 'required|array|min:1',
            'itens.*.modelo' => 'required|string',
            'itens.*.chassi' => 'required|string|between:11,17|distinct',
            'itens.*.cor' => 'required|string|min:3', 
            'itens.*.motivo' => 'required|string',
            'itens.*.local' => 'required|string', // Novo campo obrigatório (Destino)
        ]);

        return DB::transaction(function () use ($request) {
            // 2. Verificação de Duplicidade (Otimizada)
            $chassisRequest = array_map('strtoupper', array_column($request->itens, 'chassi'));
            
            $duplicados = Moto::whereIn('chassi', $chassisRequest)
                ->whereNotIn('status', ['estoque_fabrica', 'cancelado']) 
                ->pluck('chassi')
                ->toArray();
            
            if (!empty($duplicados)) {
                throw ValidationException::withMessages(['itens' => 'Chassis indisponíveis/já em uso: ' . implode(', ', $duplicados)]);
            }

            // 3. Cria Pedido (Status inicial: 'em_analise')
            $pedido = Pedido::create([
                'user_id' => Auth::id(),
                'status' => 'em_analise', 
                'observacao' => $request->observacao
            ]);

            // 4. Vincula Motos e Salva o Destino Individual
            foreach ($request->itens as $item) {
                $moto = Moto::updateOrCreate(
                    ['chassi' => mb_strtoupper($item['chassi'])],
                    [
                        'modelo' => mb_strtoupper($item['modelo']),
                        'cor' => mb_strtoupper($item['cor']),
                        'ano_fabricacao' => $item['ano'] ?? null,
                        'motivo_solicitacao' => $item['motivo'], 
                        'status' => 'reservado',
                        'localizacao_atual' => 'Solicitado pela Loja: ' . Auth::user()->name
                    ]
                );

                // AQUI ESTÁ A ATUALIZAÇÃO DO REQUISITO:
                // Salvamos o 'local' do formulário na coluna 'destino' da tabela pivô
                $pedido->motos()->attach($moto->id, [
                    'destino' => mb_strtoupper($item['local']) 
                ]);
            }

            $this->registrarLog($pedido, 'Solicitação Criada', 'Pedido aguardando análise do Gestor.');

            // 5. Notifica Gestores
            $gestores = User::where('perfil', 'gestor')->get();
            $this->enviarNotificacao(
                $gestores, 
                'Nova Solicitação 🆕', 
                "Loja " . Auth::user()->name . " solicitou aprovação para {$pedido->motos()->count()} moto(s).", 
                route('dashboard') 
            );

            return redirect()->route('pedidos.sucesso')->with('success', 'Solicitação enviada para análise!');
        });
    }

    // --- NOVO MÉTODO: APROVAR (Gestor -> CD) ---
    public function aprovar($id)
    {
        return DB::transaction(function () use ($id) {
            $pedido = Pedido::with('user', 'motos')->findOrFail($id);

            // Segurança
            if (!in_array(Auth::user()->perfil, ['admin', 'gestor'])) {
                abort(403, 'Ação não autorizada.');
            }

            if ($pedido->status !== 'em_analise') {
                return redirect()->back()->with('error', 'Status inválido para aprovação.');
            }

            // Atualiza status para o CD ver
            $pedido->update(['status' => 'solicitado']);

            $this->registrarLog($pedido, 'Aprovado', 'Solicitação autorizada pelo Gestor.');

            // Notifica a Loja
            $this->enviarNotificacao(
                $pedido->user,
                'Solicitação Aprovada ✅',
                "Seu pedido #{$pedido->id} foi aprovado e enviado ao CD.",
                route('pedidos.show', $pedido->id)
            );

            return redirect()->back()->with('success', 'Pedido aprovado e encaminhado ao CD!');
        });
    }

    public function solicitarRetiradaItem(Request $request, $id)
    {
        $moto = Moto::with('pedidos')->findOrFail($id);
        $user = Auth::user();
        $pedido = $moto->pedidos->first(); // Pega o pedido vinculado

        // Regra 1: Validação para o CD (Expedição)
        if ($user->perfil === 'cd') {
            // O CD só pode pedir retirada se a moto ainda estiver no pátio (Solicitado ou Separado)
            // Se já foi "Expedido" (Bipado na carga) ou "Em Trânsito", é falha deles, não pode cancelar simples.
            if (!in_array($moto->status, ['solicitado', 'separado'])) {
                return back()->withErrors('ERRO: O CD só pode solicitar retirada de motos em separação. Item já expedido!');
            }
            $prefixo = "CD Reportou: ";
        }
        
        // Regra 2: Validação para a Loja
        elseif ($user->perfil === 'loja') {
            // A loja só pode pedir retirada de itens do SEU PRÓPRIO pedido
            if (!$pedido || $pedido->user_id !== $user->id) {
                return back()->withErrors('Acesso não autorizado.');
            }
            
            // Loja tentando cancelar item ANTES de receber (Cancelamento Parcial)
            if (in_array($moto->status, ['solicitado', 'separado'])) {
                $prefixo = "Loja Solicitou Cancelamento: ";
            } 
            // Loja tentando devolver item DEPOIS de receber (Devolução/Garantia)
            elseif ($moto->status === 'entregue' || $moto->status === 'concluido') {
                $prefixo = "Loja Solicitou Devolução: ";
            } else {
                return back()->withErrors('Não é possível solicitar retirada neste status (Em Trânsito/Expedido). Aguarde a chegada.');
            }
        } else {
            $prefixo = "Solicitação: ";
        }

        // Aplica a marcação para o Gestor ver
        $moto->update([
            'estorno_pendente' => true,
            'motivo_estorno' => $prefixo . $request->motivo,
            'user_estorno_id' => $user->id
        ]);

       $gestores = User::whereIn('perfil', ['gestor', 'admin'])->get();
    
        foreach ($gestores as $gestor) {
            $gestor->notify(new EstornoSolicitado($moto, $user));
        }

        return back()->with('success', 'Solicitação enviada ao Gestor Comercial.');
    }

    public function solicitarEstornoCD(Request $request, $id)
    {
        // Apenas perfil CD ou Admin pode fazer isso
        if (Auth::user()->perfil !== 'cd' && Auth::user()->perfil !== 'admin') {
            return back()->withErrors('Acesso negado.');
        }

        $moto = Moto::findOrFail($id);
        
        // Verifica se a moto realmente está em um pedido mas ainda não saiu
        if ($moto->status === 'expedido' || $moto->status === 'em_transito') {
            return back()->withErrors('Não é possível estornar moto já expedida ou em trânsito.');
        }

        $moto->update([
            'estorno_pendente' => true,
            'motivo_estorno' => 'CD Reportou: ' . $request->motivo, // Prefixo para o Gestor saber quem pediu
            'user_estorno_id' => Auth::id()
        ]);

        return back()->with('success', 'Solicitação enviada ao Gestor! A moto ficará pendente até aprovação.');
    }

    public function sucesso() { return Inertia::render('Pedidos/Sucesso'); }

    public function show($id)
    {
        $pedido = Pedido::with(['user', 'motos.romaneio', 'romaneio', 'logs' => fn($q) => $q->latest()])->findOrFail($id);
        return Inertia::render('Pedidos/Show', ['pedido' => $pedido]);
    }

    public function marcarSeparado($id)
    {
        return DB::transaction(function () use ($id) {
            $pedido = Pedido::with('user', 'motos')->findOrFail($id);
            
            if ($pedido->status !== 'solicitado') return redirect()->back();

            $pedido->update(['status' => 'separado', 'motivo_rejeicao' => null]);
            $pedido->motos()->update(['status' => 'separado']);

            $this->registrarLog($pedido, 'Separação Concluída', 'Motos conferidas.');

            $this->enviarNotificacao(
                $pedido->user,
                'Pedido Separado! 📦',
                "Pedido #{$pedido->id} conferido e aguardando carga.",
                route('pedidos.show', $pedido->id)
            );

            return redirect()->back()->with('success', 'Pedido separado!');
        });
    }

    public function confirmarSaida($id)
    {
        return DB::transaction(function () use ($id) {
            $pedido = Pedido::with(['motos', 'user'])->findOrFail($id);
            
            $pedido->update(['status' => 'em_transito']);
            $pedido->motos()->update(['status' => 'em_transito']);

            if ($pedido->romaneio_id) {
                $romaneio = Romaneio::find($pedido->romaneio_id);
                if ($romaneio && $romaneio->status === 'aberto') {
                    $romaneio->update(['status' => 'em_transito']);
                }
            }

            $this->registrarLog($pedido, 'Saída Confirmada', 'Veículo em trânsito.');

            $this->enviarNotificacao(
                $pedido->user,
                'Saiu para Entrega 🚚',
                "O pedido #{$pedido->id} saiu do CD. Prepare o recebimento!",
                route('pedidos.show', $pedido->id)
            );

            return redirect()->back()->with('success', 'Saída confirmada!');
        });
    }

    public function finalizarEntrega(Request $request, $id)
    {
        $request->validate([
            'arquivo_romaneio' => 'required|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'avarias'          => 'nullable|array',
            'fotos_avarias'    => 'nullable|array'
        ]);

        return DB::transaction(function () use ($request, $id) {
            try {
                $pedido = Pedido::with(['user', 'motos'])->findOrFail($id);
                $userFilial = $pedido->user->filial ?? 'Matriz';

                if (Auth::user()->perfil === 'loja' && $pedido->user_id !== Auth::id()) {
                    abort(403, 'Acesso negado.');
                }
                
                // --- SETUP GOOGLE DRIVE ---
                $client = new Client();
                $client->setClientId(config('services.google.client_id'));
                $client->setClientSecret(config('services.google.client_secret'));
                $client->refreshToken(config('services.google.refresh_token'));
                $service = new Drive($client);
                
                $folderName = "Filial - " . $userFilial;
                $rootId = config('services.google.folder_id');
                
                $targetFolderId = Cache::remember("drive_fldr_{$pedido->user_id}_" . date('Ym'), 3600, function () use ($service, $rootId, $folderName) {
                    $filialId = $this->findOrCreateFolder($service, $folderName, $rootId);
                    $yearId = $this->findOrCreateFolder($service, date('Y'), $filialId);
                    return $this->findOrCreateFolder($service, date('m') . ' - ' . ucfirst(now()->translatedFormat('F')), $yearId);
                });

                // Upload Comprovante
                $file = $request->file('arquivo_romaneio');
                $name = "ROMANEIO_Ped-{$pedido->id}_" . date('d-m-Y') . ".{$file->getClientOriginalExtension()}";
                $pedido->comprovante_url = $this->uploadFileToDrive($service, $file, $targetFolderId, $name);

                // Processa Avarias
                $listaAvarias = $request->input('avarias', []);
                $fotosAvarias = $request->file('fotos_avarias', []);
                $qtdAvarias = 0;

                foreach ($pedido->motos as $moto) {
                    $dadosUpdate = [
                        'status' => 'entregue',
                        'localizacao_atual' => "Estoque Loja: {$userFilial}",
                        'detalhes_avaria' => null,
                        'foto_avaria' => null
                    ];

                    if (!empty($listaAvarias[$moto->id])) {
                        $qtdAvarias++;
                        $dadosUpdate['status'] = 'avariado';
                        $dadosUpdate['localizacao_atual'] .= " (COM AVARIA)";
                        $dadosUpdate['detalhes_avaria'] = $listaAvarias[$moto->id];

                        if (isset($fotosAvarias[$moto->id])) {
                            $fName = "AVARIA_{$moto->chassi}_Ped-{$pedido->id}." . $fotosAvarias[$moto->id]->getClientOriginalExtension();
                            $dadosUpdate['foto_avaria'] = $this->uploadFileToDrive($service, $fotosAvarias[$moto->id], $targetFolderId, $fName);
                        }
                    }
                    $moto->update($dadosUpdate);
                }

                $pedido->status = 'concluido';
                $pedido->save();

                if ($pedido->romaneio_id) {
                    $pendentes = Pedido::where('romaneio_id', $pedido->romaneio_id)
                        ->whereNotIn('status', ['concluido', 'cancelado'])
                        ->count();

                    if ($pendentes === 0) {
                        Romaneio::where('id', $pedido->romaneio_id)->update(['status' => 'concluido']);
                    }
                }

                $logMsg = $qtdAvarias > 0 ? "Entrega com {$qtdAvarias} avarias." : "Entrega finalizada 100%.";
                $this->registrarLog($pedido, 'Concluído', $logMsg);

                // Avisa Gestores
                $gestores = User::where('perfil', 'gestor')->get();
                $this->enviarNotificacao(
                    $gestores,
                    'Entrega Concluída ✅',
                    "Loja {$pedido->user->name} finalizou pedido #{$pedido->id}.",
                    route('pedidos.show', $pedido->id)
                );

                if ($pedido->user->id !== Auth::id()) {
                     $this->enviarNotificacao(
                        $pedido->user,
                        'Recebimento Confirmado',
                        'O estoque da loja foi atualizado.',
                        route('dashboard')
                    );
                }

                return redirect()->back()->with('message', 'Entrega finalizada com sucesso!');

            } catch (\Exception $e) {
                throw $e; 
            }
        });
    }

    public function rejeitar(Request $request, $id)
    {
        return DB::transaction(function () use ($request, $id) {
            $pedido = Pedido::with('motos', 'user')->findOrFail($id);
            $request->validate(['motivo' => 'required']);

            $motivo = $request->motivo;

            // Libera Motos
            foreach ($pedido->motos as $moto) {
                $moto->update([
                    'status' => 'estoque_fabrica',
                    'romaneio_id' => null,
                    'localizacao_atual' => 'Estoque (Liberado após Rejeição)'
                ]);
                $pedido->motos()->detach($moto->id);
            }

            $this->enviarNotificacao(
                $pedido->user,
                'Pedido Rejeitado 🛑',
                "Pedido #{$pedido->id} rejeitado. Motivo: {$motivo}",
                route('dashboard')
            );

            $pedido->delete();

            return redirect()->route('dashboard')->with('warning', 'Pedido rejeitado e excluído.');
        });
    }

    public function cancelarSolicitacao($id)
    {
        return DB::transaction(function () use ($id) {
            $pedido = Pedido::with('motos', 'user')->findOrFail($id);

            // Permite cancelar se estiver 'solicitado' (CD ainda não pegou) ou 'em_analise'
            if (!in_array($pedido->status, ['solicitado', 'em_analise'])) {
                return redirect()->back()->with('error', 'Pedido já em processamento avançado.');
            }

            if (Auth::user()->perfil === 'loja' && $pedido->user_id !== Auth::id()) {
                abort(403);
            }

            foreach ($pedido->motos as $moto) {
                $moto->update([
                    'status' => 'estoque_fabrica',
                    'romaneio_id' => null,
                    'localizacao_atual' => 'Estoque (Cancelamento)'
                ]);
            }
            $pedido->motos()->detach();
            
            $gestores = User::where('perfil', 'gestor')->get();
            $this->enviarNotificacao(
                $gestores,
                'Solicitação Cancelada 🗑️',
                "Loja {$pedido->user->name} cancelou o pedido #{$pedido->id}.",
                route('dashboard')
            );

            $pedido->delete();

            return redirect()->route('dashboard')->with('warning', 'Solicitação cancelada.');
        });
    }

    public function exportar(Request $request)
    {
        $termo = $request->input('search');
        $query = Pedido::with(['user', 'motos', 'romaneio']);

        if ($termo) {
            $query->where(function($q) use ($termo) {
                $q->where('id', 'like', "%{$termo}%")
                  ->orWhereHas('user', fn($u) => $u->where('name', 'like', "%{$termo}%"))
                  ->orWhereHas('motos', fn($m) => $m->where('chassi', 'like', "%{$termo}%"));
            });
        }

        $pedidos = $query->orderBy('created_at', 'desc')->get();
        $filename = "relatorio_pedidos_" . date('d-m-Y_H-i') . ".csv";
        
        return response()->stream(function () use ($pedidos) {
            $handle = fopen('php://output', 'w');
            fputs($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['ID', 'Data', 'Loja', 'Status', 'Qtd', 'Modelos', 'Chassis', 'Carga', 'Motorista', 'Conclusão'], ';');

            foreach ($pedidos as $pedido) {
                fputcsv($handle, [
                    $pedido->id,
                    $pedido->created_at->format('d/m/Y H:i'), 
                    $pedido->user->name . ' - ' . ($pedido->user->filial ?? 'Matriz'),
                    strtoupper($pedido->status),
                    $pedido->motos->count(),
                    $pedido->motos->pluck('modelo')->unique()->implode(', '),
                    $pedido->motos->pluck('chassi')->implode(', '),
                    $pedido->romaneio_id ? ('#' . $pedido->romaneio_id) : '-',
                    $pedido->romaneio->motorista ?? '-',
                    $pedido->status == 'concluido' ? $pedido->updated_at->format('d/m/Y') : '-'
                ], ';');
            }
            fclose($handle);
        }, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }
    
    public function imprimir($id) {
        $pedido = Pedido::with(['user', 'motos', 'romaneio'])->findOrFail($id);
        return Inertia::render('Pedidos/Romaneio', ['pedido' => $pedido]);
    }

    // --- FUNÇÕES PRIVADAS (G. DRIVE) ---
    private function uploadFileToDrive($service, $file, $folderId, $fileName)
    {
        $fileMetadata = new DriveFile(['name' => $fileName, 'parents' => [$folderId]]);
        $content = file_get_contents($file->getRealPath());

        $uploadedFile = $service->files->create($fileMetadata, [
            'data' => $content,
            'mimeType' => $file->getClientMimeType(),
            'uploadType' => 'multipart',
            'fields' => 'id, webViewLink'
        ]);
        
        try {
            $permission = new Permission();
            $permission->setRole('reader');
            $permission->setType('anyone');
            $service->permissions->create($uploadedFile->id, $permission);
        } catch (\Exception $e) {}

        return $uploadedFile->webViewLink;
    }

    private function findOrCreateFolder($service, $folderName, $parentId)
    {
        $query = "mimeType='application/vnd.google-apps.folder' and name='{$folderName}' and '{$parentId}' in parents and trashed=false";
        $files = $service->files->listFiles(['q' => $query]);

        if (count($files->getFiles()) > 0) return $files->getFiles()[0]->id;

        $folderMetadata = new DriveFile([
            'name' => $folderName,
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents' => [$parentId]
        ]);

        return $service->files->create($folderMetadata, ['fields' => 'id'])->id;
    }
}