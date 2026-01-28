<?php

namespace App\Http\Controllers;

use App\Services\OneSignalService;
use App\Models\Moto;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\Romaneio;
use App\Models\Modelo;
use App\Models\User;
use App\Notifications\PedidoAtualizado;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Google\Client;
use Google\Service\Drive;
use Google\Service\Drive\DriveFile;

class PedidoController extends Controller
{
    private function registrarLog($pedido, $titulo, $desc = '') {
        if ($pedido && $pedido->exists) {
            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo' => $titulo,
                'descricao' => $desc . ' (Usuário: ' . Auth::user()->name . ')'
            ]);
        }
    }

    public function index(Request $request)
    {
        $user = Auth::user();
        $termo = $request->input('search');

        // Carrega relacionamentos para evitar N+1 queries
        $query = Pedido::with(['user', 'romaneio'])->withCount('motos');

        // Filtra se for Loja
        if ($user->perfil === 'loja') {
            $query->where('user_id', $user->id);
        }

        // Filtra por busca
        if ($termo) {
            $query->where(function($q) use ($termo) {
                $q->where('id', 'like', "%{$termo}%")
                  ->orWhereHas('motos', function($m) use ($termo) { 
                      $m->where('chassi', 'like', "%{$termo}%"); 
                  })
                  ->orWhereHas('user', function($u) use ($termo) {
                      $u->where('filial', 'like', "%{$termo}%");
                  });
            });
        }

        $pedidos = $query->orderByRaw("FIELD(status, 'solicitado') DESC")
                         ->orderBy('created_at', 'desc')
                         ->paginate(15);

        return Inertia::render('Pedidos/Index', [
            'pedidos' => $pedidos,
            'perfil' => $user->perfil,
            'filters' => $request->only(['search'])
        ]);
    }

    public function exportar(Request $request)
    {
        $termo = $request->input('search');
        $query = Pedido::with(['user', 'motos', 'romaneio']);

        if ($termo) {
            $query->where(function($q) use ($termo) {
                $q->where('id', 'like', "%{$termo}%")
                  ->orWhereHas('user', function($u) use ($termo) { $u->where('name', 'like', "%{$termo}%"); })
                  ->orWhereHas('motos', function($m) use ($termo) { $m->where('chassi', 'like', "%{$termo}%"); });
            });
        }

        $pedidos = $query->orderBy('created_at', 'desc')->get();

        $filename = "relatorio_pedidos_" . date('d-m-Y_H-i') . ".csv";
        $handle = fopen('php://output', 'w');
        
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        fputs($handle, "\xEF\xBB\xBF");

        fputcsv($handle, ['ID', 'Data Solicitação', 'Loja', 'Status', 'Qtd', 'Modelos', 'Chassis', 'Carga', 'Motorista', 'Conclusão'], ';');

        foreach ($pedidos as $pedido) {
            $chassis = $pedido->motos->map(fn($moto) => ' ' . $moto->chassi)->implode(', ');
            $modelos = $pedido->motos->pluck('modelo')->unique()->implode(', ');

            fputcsv($handle, [
                $pedido->id,
                ' ' . $pedido->created_at->format('d/m/Y H:i'), 
                $pedido->user->name . ' - ' . ($pedido->user->filial ?? 'Matriz'),
                strtoupper($pedido->status),
                $pedido->motos->count(),
                $modelos,
                $chassis,
                $pedido->romaneio_id ? ('#' . $pedido->romaneio_id) : '-',
                $pedido->romaneio ? $pedido->romaneio->motorista : '-',
                $pedido->status == 'concluido' ? $pedido->updated_at->format('d/m/Y') : '-'
            ], ';');
        }
        fclose($handle);
        exit;
    }
    
    public function create()
    {
        $modelos = \App\Models\Modelo::orderBy('nome')->pluck('nome');
        return Inertia::render('Pedidos/Create', ['listaModelos' => $modelos]);
    }

    public function store(Request $request)
    {
        // 1. Validação
        $request->validate([
            'itens' => 'required|array|min:1',
            'itens.*.modelo' => 'required|string',
            'itens.*.chassi' => 'required|string|between:11,17|distinct',
            'itens.*.cor' => 'required|string|min:3', 
            'itens.*.motivo' => 'required|string',
        ]);

        // 2. Verificação de Duplicidade
        $chassis = array_column($request->itens, 'chassi');
        
        $duplicados = Moto::whereIn('chassi', $chassis)
            ->whereNotIn('status', ['estoque_fabrica', 'cancelado']) 
            ->pluck('chassi')
            ->toArray();
        
        if (!empty($duplicados)) {
            throw ValidationException::withMessages(['itens' => 'Chassis já em uso/reservados: ' . implode(', ', $duplicados)]);
        }

        // 3. Criação do Pedido
        $pedido = Pedido::create([
            'user_id' => Auth::id(),
            'status' => 'em_analise', // Ajustado para 'solicitado' (padrão) em vez de 'em_analise' se não houver middleware de status
            'observacao' => $request->observacao
        ]);

        // 4. Vinculação das Motos
        foreach ($request->itens as $item) {
            $moto = Moto::updateOrCreate(
                ['chassi' => mb_strtoupper($item['chassi'])],
                [
                    'modelo' => mb_strtoupper($item['modelo']),
                    'cor' => mb_strtoupper($item['cor']),
                    'ano_fabricacao' => $item['ano'] ?? null,
                    'motivo_solicitacao' => $item['motivo'], 
                    'status' => 'reservado',
                    'localizacao_atual' => 'Solicitado pela Loja'
                ]
            );
            $pedido->motos()->attach($moto->id);
        }

        // 5. Log e Notificação
        $this->registrarLog($pedido, 'Solicitação Criada', 'Pedido enviado para análise.');

        // Notifica APENAS os Gestores via Sistema (Sininho)
        $gestores = User::where('perfil', 'gestor')->get();
        foreach ($gestores as $gestor) {
            $gestor->notify(new PedidoAtualizado(
                'Nova Solicitação #' . $pedido->id,
                'Loja ' . Auth::user()->filial . ' aguarda sua autorização.',
                route('pedidos.index') // Ajustado rota
            ));
        }

        // --- NOTIFICAÇÃO PUSH PARA GESTORES ---
        $gestoresIds = User::where('perfil', 'gestor')
            ->whereNotNull('onesignal_id')
            ->pluck('onesignal_id')
            ->toArray();

        if (!empty($gestoresIds)) {
            $push = new OneSignalService();
            $lojaNome = Auth::user()->name;
            
            $push->sendToUser(
                $gestoresIds,
                'Nova Solicitação 🆕',
                "A loja {$lojaNome} solicitou {$pedido->motos->count()} moto(s).",
                route('dashboard')
            );
        }

        return redirect()->route('pedidos.sucesso')->with('success', 'Solicitação enviada com sucesso!');
    }

    public function sucesso() { return Inertia::render('Pedidos/Sucesso'); }

    public function show($id)
    {
        $pedido = Pedido::with(['user', 'motos.romaneio', 'romaneio', 'logs'])->findOrFail($id);
        return Inertia::render('Pedidos/Show', ['pedido' => $pedido]);
    }

    public function marcarSeparado($id)
    {
        $pedido = Pedido::with('user')->findOrFail($id); // Eager load user
        
        if ($pedido->status !== 'solicitado') return redirect()->back();

        $pedido->update(['status' => 'separado', 'motivo_rejeicao' => null]);

        foreach ($pedido->motos as $moto) {
            $moto->update(['status' => 'separado']);
        }

        $this->registrarLog($pedido, 'Separação Concluída', 'Motos conferidas e enviadas para o Pool de Expedição.');

        // --- NOTIFICAÇÃO 1: Avisar a Loja que foi separado (Sistema) ---
        $pedido->user->notify(new PedidoAtualizado(
            'Pedido #' . $pedido->id . ' Separado',
            'Suas motos foram conferidas e estão aguardando carga.',
            route('pedidos.show', $pedido->id)
        ));

        // --- NOTIFICAÇÃO 2: Avisar a Loja via PUSH (OneSignal) ---
        if ($pedido->user->onesignal_id) {
            $push = new OneSignalService();
            $push->sendToUser(
                [$pedido->user->onesignal_id],
                'Pedido Separado! 📦',
                "Suas motos do pedido #{$pedido->id} foram conferidas e estão aguardando carga.",
                route('pedidos.show', $pedido->id)
            );
        }
        // -----------------------------------------------------

        return redirect()->back()->with('success', 'Pedido separado com sucesso!');
    }

    public function confirmarSaida($id)
    {
        $pedido = Pedido::with(['motos', 'user'])->findOrFail($id);
        
        $pedido->update(['status' => 'em_transito']);
        foreach ($pedido->motos as $moto) {
            $moto->update(['status' => 'em_transito']);
        }

        if ($pedido->romaneio_id) {
            $romaneio = Romaneio::find($pedido->romaneio_id);
            if ($romaneio && $romaneio->status === 'aberto') {
                $romaneio->update(['status' => 'em_transito']);
            }
        }

        $this->registrarLog($pedido, 'Saída Confirmada', 'Veículo saiu do CD e está em trânsito.');

        // --- NOTIFICAÇÃO 1: Avisar a Loja (Sistema) ---
        $pedido->user->notify(new PedidoAtualizado(
            'Pedido #' . $pedido->id . ' Em Trânsito',
            'O caminhão saiu do CD! Prepare o recebimento.',
            route('pedidos.show', $pedido->id)
        ));

        // --- NOTIFICAÇÃO 2: Avisar a Loja via PUSH (OneSignal) ---
        if ($pedido->user->onesignal_id) {
            $push = new OneSignalService();
            $push->sendToUser(
                [$pedido->user->onesignal_id],
                'Saiu para Entrega 🚚',
                "O caminhão saiu do CD com seu pedido #{$pedido->id}. Prepare o recebimento!",
                route('pedidos.show', $pedido->id)
            );
        }
        // -------------------------------------------------------
        
        return redirect()->back();
    }

    public function finalizarEntrega(Request $request, $id)
    {
        // 1. Validação
        $request->validate([
            'arquivo_romaneio' => 'required|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'avarias'          => 'nullable|array',
            'fotos_avarias'    => 'nullable|array', 
            'fotos_avarias.*'  => 'file|mimes:jpg,jpeg,png|max:10240' 
        ]);

        try {
            $pedido = Pedido::with(['user', 'motos'])->findOrFail($id);
            $userFilial = $pedido->user->filial ?? 'Matriz';
            $filialSlug = \Illuminate\Support\Str::slug($userFilial);

            // Segurança
            if (Auth::user()->perfil === 'loja' && $pedido->user_id !== Auth::id()) {
                abort(403, 'Acesso negado.');
            }
            
            // --- VOLTANDO PARA OAUTH 2.0 (MODO CORRETO PARA GMAIL GRÁTIS) ---
            $client = new \Google\Client();
            $client->setClientId(config('services.google.client_id'));
            $client->setClientSecret(config('services.google.client_secret'));
            $client->refreshToken(config('services.google.refresh_token'));
            
            $service = new \Google\Service\Drive($client);
            // ---------------------------------------------------------------
            // Cache de pastas
            $rootId = config('services.google.folder_id');
            $now = \Carbon\Carbon::now();
            $yearStr = $now->format('Y');
            $monthStr = $now->format('m') . ' - ' . \Illuminate\Support\Str::ucfirst($now->translatedFormat('F'));
            $cacheKey = "drive_folder_{$filialSlug}_{$yearStr}_{$monthStr}";
            
            $targetFolderId = \Illuminate\Support\Facades\Cache::remember($cacheKey, 60 * 60 * 24, function () use ($service, $rootId, $userFilial, $yearStr, $monthStr) {
                $filialId = $this->findOrCreateFolder($service, "Filial - " . $userFilial, $rootId);
                $yearId = $this->findOrCreateFolder($service, $yearStr, $filialId);
                return $this->findOrCreateFolder($service, $monthStr, $yearId);
            });

            // Upload Comprovante
            if ($request->hasFile('arquivo_romaneio')) {
                $file = $request->file('arquivo_romaneio');
                $name = "ROMANEIO_Ped-{$pedido->id}_{$now->format('d-m-Y')}.{$file->getClientOriginalExtension()}";
                $pedido->comprovante_url = $this->uploadFileToDrive($service, $file, $targetFolderId, $name);
            }

            // Avarias e Status das Motos
            $listaAvarias = $request->input('avarias', []);
            $fotosAvarias = $request->file('fotos_avarias', []);

            foreach ($pedido->motos as $moto) {
                $dadosUpdate = [];
                if (isset($listaAvarias[$moto->id]) && !empty($listaAvarias[$moto->id])) {
                    $dadosUpdate['status'] = 'avariado';
                    $dadosUpdate['localizacao_atual'] = "Loja ({$userFilial}) - COM AVARIA";
                    $dadosUpdate['detalhes_avaria'] = $listaAvarias[$moto->id];

                    if (isset($fotosAvarias[$moto->id])) {
                        $fotoFile = $fotosAvarias[$moto->id];
                        $fotoName = "AVARIA_Chassi-{$moto->chassi}_Ped-{$pedido->id}.{$fotoFile->getClientOriginalExtension()}";
                        $dadosUpdate['foto_avaria'] = $this->uploadFileToDrive($service, $fotoFile, $targetFolderId, $fotoName);
                    }
                } else {
                    $dadosUpdate['status'] = 'entregue';
                    $dadosUpdate['localizacao_atual'] = "Estoque Loja: {$userFilial}";
                    $dadosUpdate['detalhes_avaria'] = null;
                    $dadosUpdate['foto_avaria'] = null;
                }
                $moto->update($dadosUpdate);
            }

            // 1. ATUALIZA O STATUS DO PEDIDO PRIMEIRO
            $pedido->status = 'concluido';
            $pedido->save();

            // 2. VERIFICAÇÃO ROBUSTA DO ROMANEIO (CARGA)
            if ($pedido->romaneio_id) {
                // Conta quantos pedidos NESSE romaneio AINDA NÃO estão concluídos ou cancelados
                $pendentes = Pedido::where('romaneio_id', $pedido->romaneio_id)
                    ->whereNotIn('status', ['concluido', 'cancelado'])
                    ->count();

                // Se zero pendentes, fecha a carga
                if ($pendentes === 0) {
                    \App\Models\Romaneio::where('id', $pedido->romaneio_id)
                        ->update(['status' => 'concluido']);
                }
            }

            // Logs
            $texto = 'Entrega finalizada.';
            if (count($listaAvarias) > 0) $texto .= " ⚠️ " . count($listaAvarias) . " avarias registradas.";
            $pedido->logs()->create(['titulo' => 'Concluído', 'descricao' => $texto]);

            // Notificações
            $gestoresIds = User::where('perfil', 'gestor')->whereNotNull('onesignal_id')->pluck('onesignal_id')->toArray();
            if (!empty($gestoresIds)) {
                $push = new \App\Services\PushService();
                $lojaNome = $pedido->user->name;
                $push->sendToUser($gestoresIds, 'Entrega Concluída ✅', "A loja {$lojaNome} finalizou o recebimento do pedido #{$pedido->id}.", route('pedidos.show', $pedido->id));
            }

            if ($pedido->user->onesignal_id) {
                $push = new \App\Services\PushService();
                $push->sendToUser([$pedido->user->onesignal_id], 'Recebimento Confirmado', 'O estoque da loja foi atualizado.', route('dashboard'));
            }

            return redirect()->back()->with('message', 'Entrega finalizada com sucesso!');

        } catch (\Exception $e) {
            return redirect()->back()->withErrors(['erro_upload' => 'Erro: ' . $e->getMessage()]);
        }
    }

    // --- FUNÇÕES AUXILIARES ---

    private function uploadFileToDrive($service, $file, $folderId, $fileName)
    {
        $fileMetadata = new \Google\Service\Drive\DriveFile([
            'name' => $fileName,
            'parents' => [$folderId]
        ]);

        $content = file_get_contents($file->getRealPath());

        $file = $service->files->create($fileMetadata, [
            'data' => $content,
            'mimeType' => $file->getClientMimeType(),
            'uploadType' => 'multipart',
            'fields' => 'id, webViewLink'
        ]);
        
        // Torna público para conseguir ver no sistema
        try {
            $permission = new \Google\Service\Drive\Permission();
            $permission->setRole('reader');
            $permission->setType('anyone');
            $service->permissions->create($file->id, $permission);
        } catch (\Exception $e) {}

        return $file->webViewLink;
    }

    private function findOrCreateFolder($service, $folderName, $parentId)
    {
        $query = "mimeType='application/vnd.google-apps.folder' and name='{$folderName}' and '{$parentId}' in parents and trashed=false";
        $files = $service->files->listFiles(['q' => $query]);

        if (count($files->getFiles()) > 0) {
            return $files->getFiles()[0]->id;
        }

        $folderMetadata = new \Google\Service\Drive\DriveFile([
            'name' => $folderName,
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents' => [$parentId]
        ]);

        return $service->files->create($folderMetadata, ['fields' => 'id'])->id;
    }

    private function gerarLogFinalizacao($pedido, $qtdAvarias) {
        $texto = 'Entrega finalizada.';
        if ($qtdAvarias > 0) $texto .= " ⚠️ {$qtdAvarias} avarias registradas com fotos.";
        
        $pedido->logs()->create(['titulo' => 'Concluído', 'descricao' => $texto]);

        if ($pedido->romaneio_id) {
             $pendentes = Pedido::where('romaneio_id', $pedido->romaneio_id)
                ->whereNotIn('status', ['concluido', 'cancelado'])->count();
             if ($pendentes === 0) \App\Models\Romaneio::where('id', $pedido->romaneio_id)->update(['status' => 'concluido']);
        }
    }

    public function rejeitar(Request $request, $id)
    {
        $pedido = Pedido::with('motos', 'user')->findOrFail($id);
        $request->validate(['motivo' => 'required']);

        // --- NOTIFICAÇÃO 1: Avisar a Loja (Sistema) ---
        $pedido->user->notify(new PedidoAtualizado(
            'Pedido #' . $pedido->id . ' Rejeitado pelo CD',
            'Motivo: ' . $request->motivo . '. As motos foram liberadas.',
            route('dashboard') 
        ));

        // --- NOTIFICAÇÃO 2: Avisar a Loja via PUSH (OneSignal) ---
        // (Corrigido: Agora está ANTES do delete/return)
        if ($pedido->user->onesignal_id) {
            $push = new OneSignalService();
            $push->sendToUser(
                [$pedido->user->onesignal_id],
                'Pedido Rejeitado 🛑',
                "O pedido #{$pedido->id} foi rejeitado. Motivo: {$request->motivo}",
                route('dashboard')
            );
        }
        // -----------------------------------------------------

        foreach ($pedido->motos as $moto) {
            $moto->update([
                'status' => 'estoque_fabrica',
                'romaneio_id' => null,
                'localizacao_atual' => 'Estoque (Liberado após Rejeição)'
            ]);
            $pedido->motos()->detach($moto->id);
        }

        $pedido->delete();

        return redirect()->route('dashboard')->with('warning', 'Pedido rejeitado e excluído. Motos foram liberadas.');
    }

    public function imprimir($id) {
        $pedido = Pedido::with(['user', 'motos', 'romaneio'])->findOrFail($id);
        return Inertia::render('Pedidos/Romaneio', ['pedido' => $pedido]);
    }

    public function cancelarSolicitacao($id)
    {
        $pedido = Pedido::with('motos')->findOrFail($id);

        if ($pedido->status !== 'solicitado') {
            return redirect()->back()->with('error', 'Pedido já em processamento pelo CD. Não pode ser cancelado.');
        }

        if (Auth::user()->perfil === 'loja' && $pedido->user_id !== Auth::id()) {
            abort(403);
        }

        // 1. Libera as motos
        foreach ($pedido->motos as $moto) {
            $moto->update([
                'status' => 'estoque_fabrica',
                'romaneio_id' => null,
                'localizacao_atual' => 'Estoque (Liberado após Cancelamento)'
            ]);
            $pedido->motos()->detach($moto->id);
        }

        // 2. Exclui o Pedido Permanentemente
        $pedido->delete();

        // --- NOTIFICAÇÃO PARA O GESTOR (PUSH) ---
        $gestoresIds = User::where('perfil', 'gestor')
            ->whereNotNull('onesignal_id')
            ->pluck('onesignal_id')
            ->toArray();

        if (!empty($gestoresIds)) {
            $push = new OneSignalService();
            $lojaNome = $pedido->user->name;

            $push->sendToUser(
                $gestoresIds,
                'Solicitação Cancelada 🗑️',
                "A loja {$lojaNome} cancelou o pedido #{$pedido->id}. O estoque foi liberado.",
                route('dashboard')
            );
        }

        return redirect()->route('dashboard')->with('warning', 'Solicitação excluída e motos liberadas com sucesso.');
    }
}