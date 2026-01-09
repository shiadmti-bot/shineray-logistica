<?php

namespace App\Http\Controllers;

use App\Models\Moto;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\Romaneio;
use App\Models\Modelo;
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

        $query = Pedido::with(['user', 'romaneio'])->withCount('motos');

        if ($user->perfil === 'loja') $query->where('user_id', $user->id);

        if ($termo) {
            $query->where(function($q) use ($termo) {
                $q->where('id', 'like', "%{$termo}%")
                  ->orWhereHas('motos', function($m) use ($termo) { $m->where('chassi', 'like', "%{$termo}%"); });
            });
        }

        $pedidos = $query->orderByRaw("FIELD(status, 'solicitado') DESC")->orderBy('created_at', 'desc')->get();

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
        $request->validate([
            'itens' => 'required|array|min:1',
            'itens.*.modelo' => 'required|string',
            'itens.*.chassi' => 'required|string|size:11|distinct',
            'itens.*.cor' => 'required|string|min:3', 
        ]);

        $chassis = array_column($request->itens, 'chassi');
        
        // --- CORREÇÃO DO ERRO SQL ---
        // Em vez de checar 'pedido_id' (que não existe), checamos o STATUS.
        // Se o status NÃO for 'estoque_fabrica' e nem 'cancelado', a moto está ocupada.
        $duplicados = Moto::whereIn('chassi', $chassis)
            ->whereNotIn('status', ['estoque_fabrica', 'cancelado']) 
            ->pluck('chassi')
            ->toArray();
        
        if (!empty($duplicados)) {
            throw ValidationException::withMessages(['itens' => 'Chassis já em uso/reservados: ' . implode(', ', $duplicados)]);
        }

        $pedido = Pedido::create([
            'user_id' => Auth::id(),
            'status' => 'solicitado',
            'observacao' => $request->observacao
        ]);

        foreach ($request->itens as $item) {
            $moto = Moto::updateOrCreate(
                ['chassi' => $item['chassi']],
                [
                    'modelo' => $item['modelo'],
                    'cor' => $item['cor'] ?? null,
                    'ano_fabricacao' => $item['ano'] ?? null,
                    'status' => 'reservado',
                    'localizacao_atual' => 'Loja Solicitou'
                ]
            );
            $pedido->motos()->attach($moto->id);
        }

        $this->registrarLog($pedido, 'Solicitação Criada', 'Pedido enviado pela loja.');
        return redirect()->route('pedidos.sucesso')->with('success', 'Solicitação enviada para o CD!');
    }

    public function sucesso() { return Inertia::render('Pedidos/Sucesso'); }

    public function show($id)
    {
        $pedido = Pedido::with(['user', 'motos.romaneio', 'romaneio', 'logs'])->findOrFail($id);
        return Inertia::render('Pedidos/Show', ['pedido' => $pedido]);
    }

    public function marcarSeparado($id)
    {
        $pedido = Pedido::findOrFail($id);
        
        if ($pedido->status !== 'solicitado') return redirect()->back();

        $pedido->update(['status' => 'separado', 'motivo_rejeicao' => null]);

        foreach ($pedido->motos as $moto) {
            $moto->update(['status' => 'separado']);
        }

        $this->registrarLog($pedido, 'Separação Concluída', 'Motos conferidas e enviadas para o Pool de Expedição.');
        return redirect()->back()->with('success', 'Pedido separado com sucesso!');
    }

    public function confirmarSaida($id)
    {
        $pedido = Pedido::with('motos')->findOrFail($id);
        
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
        
        return redirect()->back();
    }

    public function finalizarEntrega(Request $request, $id)
    {
        $request->validate([
            'arquivo_romaneio' => 'required|file|mimes:jpg,jpeg,png,pdf|max:15360',
        ]);

        try {
            $pedido = Pedido::with('user')->findOrFail($id);

            if (Auth::user()->perfil === 'loja' && $pedido->user_id !== Auth::id()) {
                abort(403, 'Você não tem permissão para finalizar pedidos de outra loja.');
            }
            
            if ($request->hasFile('arquivo_romaneio')) {
                $uploadedFile = $request->file('arquivo_romaneio');
                
                $client = new Client();
                $client->setClientId(env('GOOGLE_DRIVE_CLIENT_ID'));
                $client->setClientSecret(env('GOOGLE_DRIVE_CLIENT_SECRET'));
                $client->refreshToken(env('GOOGLE_DRIVE_REFRESH_TOKEN'));
                $service = new Drive($client);

                $rootFolderId = env('GOOGLE_DRIVE_FOLDER'); 
                $now = Carbon::now();
                $yearFolder = $now->format('Y'); 
                $monthFolder = $now->format('m') . ' - ' . Str::ucfirst($now->translatedFormat('F')); 
                
                $cacheKey = "gdrive_folder_{$yearFolder}_{$monthFolder}";

                $targetFolderId = Cache::remember($cacheKey, 60 * 60 * 24, function () use ($service, $rootFolderId, $yearFolder, $monthFolder) {
                    $yearId = $this->findOrCreateFolder($service, $yearFolder, $rootFolderId);
                    return $this->findOrCreateFolder($service, $monthFolder, $yearId);
                });

                $romaneioId = $pedido->romaneio_id ?? 'AVULSO'; 
                $dataDia = $now->format('d-m-Y'); 
                $filial = Str::slug($pedido->user->filial ?? 'Matriz');
                $ext = $uploadedFile->getClientOriginalExtension();
                
                $novoNomeArquivo = "Romaneio-{$romaneioId}_{$dataDia}_{$filial}_ID-{$pedido->id}.{$ext}";

                $fileMetadata = new DriveFile([
                    'name' => $novoNomeArquivo,
                    'parents' => [$targetFolderId] 
                ]);

                $content = file_get_contents($uploadedFile->getRealPath());

                $arquivoGoogle = $service->files->create($fileMetadata, [
                    'data' => $content,
                    'mimeType' => $uploadedFile->getMimeType(),
                    'uploadType' => 'multipart',
                    'fields' => 'id, webViewLink'
                ]);

                $pedido->comprovante_url = $arquivoGoogle->webViewLink;
            }

            $pedido->status = 'concluido';
            $pedido->save();

            $pedido->logs()->create([
                'titulo' => 'Entrega Finalizada',
                'descricao' => 'Comprovante anexado e pedido concluído.'
            ]);

            if ($pedido->romaneio_id) {
                $pendentes = Pedido::where('romaneio_id', $pedido->romaneio_id)
                    ->whereNotIn('status', ['concluido', 'cancelado'])
                    ->count();

                if ($pendentes === 0) {
                    $romaneio = Romaneio::find($pedido->romaneio_id);
                    if ($romaneio) {
                        $romaneio->status = 'finalizado';
                        $romaneio->save();
                    }
                }
            }

            return redirect()->back()->with('message', 'Sucesso! Entrega registrada.');

        } catch (\Exception $e) {
            $msg = $e->getMessage();
            $jsonError = json_decode($msg, true);
            if (isset($jsonError['error']['message'])) {
                $msg = $jsonError['error']['message'];
            }
            return redirect()->back()->withErrors(['erro_upload' => 'Erro ao salvar no Drive: ' . $msg]);
        }
    }

    public function rejeitar(Request $request, $id)
    {
        $pedido = Pedido::with('motos')->findOrFail($id);
        $request->validate(['motivo' => 'required']);

        // 1. Libera as motos (Reseta para estoque inicial)
        foreach ($pedido->motos as $moto) {
            $moto->update([
                'status' => 'estoque_fabrica',
                // 'pedido_id' => null,  <-- REMOVIDO: Coluna não existe
                'romaneio_id' => null,
                'localizacao_atual' => 'Estoque (Liberado após Rejeição)'
            ]);
            $pedido->motos()->detach($moto->id);
        }

        // 2. Exclui o Pedido Permanentemente
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
                // 'pedido_id' => null, <-- REMOVIDO: Coluna não existe
                'romaneio_id' => null,
                'localizacao_atual' => 'Estoque (Liberado após Cancelamento)'
            ]);
            $pedido->motos()->detach($moto->id);
        }

        // 2. Exclui o Pedido Permanentemente
        $pedido->delete();

        return redirect()->route('dashboard')->with('warning', 'Solicitação excluída e motos liberadas com sucesso.');
    }

    private function findOrCreateFolder(Drive $service, string $folderName, string $parentId): string
    {
        $pageToken = null;
        do {
            $response = $service->files->listFiles([
                'q' => "mimeType='application/vnd.google-apps.folder' and name='{$folderName}' and '{$parentId}' in parents and trashed=false",
                'fields' => 'nextPageToken, files(id, name)',
                'pageToken' => $pageToken,
            ]);

            foreach ($response->files as $file) {
                return $file->id; 
            }
            $pageToken = $response->nextPageToken;
        } while ($pageToken != null);

        $folderMetadata = new DriveFile([
            'name' => $folderName,
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents' => [$parentId]
        ]);

        $folder = $service->files->create($folderMetadata, ['fields' => 'id']);
        return $folder->id;
    }
}