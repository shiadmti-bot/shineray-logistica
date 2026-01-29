<?php

namespace App\Http\Controllers;

use App\Services\OneSignalService;
use App\Models\Moto;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\Romaneio;
use App\Models\User;
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

        // Ordenação inteligente: Solicitados primeiro, depois por data
        $pedidos = $query->orderByRaw("FIELD(status, 'solicitado') DESC")
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
        $request->validate([
            'itens' => 'required|array|min:1',
            'itens.*.modelo' => 'required|string',
            'itens.*.chassi' => 'required|string|between:11,17|distinct',
            'itens.*.cor' => 'required|string|min:3', 
            'itens.*.motivo' => 'required|string',
        ]);

        return DB::transaction(function () use ($request) {
            // 1. Verificação de Duplicidade (Mais eficiente)
            $chassisRequest = array_column($request->itens, 'chassi');
            $duplicados = Moto::whereIn('chassi', $chassisRequest)
                ->whereNotIn('status', ['estoque_fabrica', 'cancelado']) 
                ->pluck('chassi')
                ->toArray();
            
            if (!empty($duplicados)) {
                throw ValidationException::withMessages(['itens' => 'Chassis indisponíveis: ' . implode(', ', $duplicados)]);
            }

            // 2. Cria Pedido
            $pedido = Pedido::create([
                'user_id' => Auth::id(),
                'status' => 'solicitado', // Padronizado
                'observacao' => $request->observacao
            ]);

            // 3. Vincula Motos
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
                $pedido->motos()->attach($moto->id);
            }

            $this->registrarLog($pedido, 'Solicitação Criada', 'Pedido enviado.');

            // 4. Notifica Gestores
            $gestores = User::where('perfil', 'gestor')->get();
            $this->enviarNotificacao(
                $gestores, 
                'Nova Solicitação 🆕', 
                "Loja " . Auth::user()->name . " pediu {$pedido->motos()->count()} moto(s).", 
                route('dashboard')
            );

            return redirect()->route('pedidos.sucesso')->with('success', 'Solicitação enviada!');
        });
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
            
            // Atualização em massa para performance
            $pedido->motos()->update(['status' => 'separado']);

            $this->registrarLog($pedido, 'Separação Concluída', 'Motos conferidas.');

            // Notifica Loja
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

            // Atualiza Romaneio se necessário
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
                
                // Cache de Pastas (Evita chamadas repetidas API)
                $folderName = "Filial - " . $userFilial;
                $rootId = config('services.google.folder_id');
                
                // Lógica de Pastas (Filial -> Ano -> Mês)
                $targetFolderId = Cache::remember("drive_fldr_{$pedido->user_id}_" . date('Ym'), 3600, function () use ($service, $rootId, $folderName) {
                    $filialId = $this->findOrCreateFolder($service, $folderName, $rootId);
                    $yearId = $this->findOrCreateFolder($service, date('Y'), $filialId);
                    return $this->findOrCreateFolder($service, date('m') . ' - ' . ucfirst(now()->translatedFormat('F')), $yearId);
                });

                // Upload Comprovante
                $file = $request->file('arquivo_romaneio');
                $name = "ROMANEIO_Ped-{$pedido->id}_" . date('d-m-Y') . ".{$file->getClientOriginalExtension()}";
                $pedido->comprovante_url = $this->uploadFileToDrive($service, $file, $targetFolderId, $name);

                // Processa Avarias e Atualiza Motos
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

                // Finaliza Pedido
                $pedido->status = 'concluido';
                $pedido->save();

                // Verifica Romaneio (Padronizado para 'concluido')
                if ($pedido->romaneio_id) {
                    $pendentes = Pedido::where('romaneio_id', $pedido->romaneio_id)
                        ->whereNotIn('status', ['concluido', 'cancelado'])
                        ->count();

                    if ($pendentes === 0) {
                        Romaneio::where('id', $pedido->romaneio_id)->update(['status' => 'concluido']);
                    }
                }

                // Logs e Notificações
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

                // Confirmação para quem enviou
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
                // Em caso de erro, rollback automático da transação acontece aqui
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

            // Notifica Loja ANTES de deletar o objeto da memória
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

            if ($pedido->status !== 'solicitado') {
                return redirect()->back()->with('error', 'Pedido já em processamento.');
            }

            if (Auth::user()->perfil === 'loja' && $pedido->user_id !== Auth::id()) {
                abort(403);
            }

            // Libera Motos
            foreach ($pedido->motos as $moto) {
                $moto->update([
                    'status' => 'estoque_fabrica',
                    'romaneio_id' => null,
                    'localizacao_atual' => 'Estoque (Cancelamento)'
                ]);
            }
            $pedido->motos()->detach();
            
            // Notifica Gestores
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
            fputs($handle, "\xEF\xBB\xBF"); // BOM para Excel
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

    // --- FUNÇÕES AUXILIARES PRIVADAS (GOOGLE DRIVE) ---

    private function uploadFileToDrive($service, $file, $folderId, $fileName)
    {
        $fileMetadata = new DriveFile([
            'name' => $fileName,
            'parents' => [$folderId]
        ]);
        
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

        if (count($files->getFiles()) > 0) {
            return $files->getFiles()[0]->id;
        }

        $folderMetadata = new DriveFile([
            'name' => $folderName,
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents' => [$parentId]
        ]);

        return $service->files->create($folderMetadata, ['fields' => 'id'])->id;
    }
}