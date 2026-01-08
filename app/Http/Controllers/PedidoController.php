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
use Illuminate\Support\Facades\Cache; // Importante para o cache de pastas
use Illuminate\Support\Str; // Importante para formatar nomes
use Carbon\Carbon; // Importante para datas
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

// --- BIBLIOTECAS DO GOOGLE (Obrigatório ficar aqui fora) ---
use Google\Client;
use Google\Service\Drive;
use Google\Service\Drive\DriveFile;

class PedidoController extends Controller
{
    // Helper privado para registrar logs
    private function registrarLog($pedido, $titulo, $desc = '') {
        PedidoLog::create([
            'pedido_id' => $pedido->id,
            'titulo' => $titulo,
            'descricao' => $desc . ' (Usuário: ' . Auth::user()->name . ')'
        ]);
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

    // --- EXPORTAR PARA EXCEL (CSV) ---
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
        fputs($handle, "\xEF\xBB\xBF"); // BOM para acentos

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
        $duplicados = Moto::whereIn('chassi', $chassis)->whereNotIn('status', ['cancelado'])->pluck('chassi')->toArray();
        
        if (!empty($duplicados)) {
            throw ValidationException::withMessages(['itens' => 'Chassis já cadastrados: ' . implode(', ', $duplicados)]);
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
        $pedido = Pedido::findOrFail($id);
        $pedido->update(['status' => 'em_transito']);
        foreach ($pedido->motos as $moto) { $moto->update(['status' => 'em_transito']); }
        $this->registrarLog($pedido, 'Saída Confirmada', 'Veículo em trânsito.');
        return redirect()->back();
    }

    // --- FUNÇÃO DE FINALIZAÇÃO ATUALIZADA (UPLOAD + ORGANIZAÇÃO DE PASTAS + AUTOMAÇÃO) ---
    public function finalizarEntrega(Request $request, $id)
    {
        // 1. Validação (Aumentada para 15MB para garantir)
        $request->validate([
            'arquivo_romaneio' => 'required|file|mimes:jpg,jpeg,png,pdf|max:15360',
        ]);

        try {
            $pedido = Pedido::with('user')->findOrFail($id);

            // --- TRAVA DE SEGURANÇA NOVA ---
            // Se for Loja, só pode finalizar se o pedido for dela
            if (Auth::user()->perfil === 'loja' && $pedido->user_id !== Auth::id()) {
                abort(403, 'Você não tem permissão para finalizar pedidos de outra loja.');
            }
            
            if ($request->hasFile('arquivo_romaneio')) {
                $uploadedFile = $request->file('arquivo_romaneio');
                
                // A. Configura Cliente Google
                $client = new Client();
                $client->setClientId(env('GOOGLE_DRIVE_CLIENT_ID'));
                $client->setClientSecret(env('GOOGLE_DRIVE_CLIENT_SECRET'));
                $client->refreshToken(env('GOOGLE_DRIVE_REFRESH_TOKEN'));
                $service = new Drive($client);

                // --- B. LÓGICA DE PASTAS (ANO/MÊS) COM CACHE ---
                $rootFolderId = env('GOOGLE_DRIVE_FOLDER'); 
                $now = Carbon::now();
                $yearFolder = $now->format('Y'); // Ex: 2026
                $monthFolder = $now->format('m') . ' - ' . Str::ucfirst($now->translatedFormat('F')); // Ex: 01 - Janeiro
                
                $cacheKey = "gdrive_folder_{$yearFolder}_{$monthFolder}";

                // Pega ID da pasta do cache ou cria se não existir
                $targetFolderId = Cache::remember($cacheKey, 60 * 60 * 24, function () use ($service, $rootFolderId, $yearFolder, $monthFolder) {
                    $yearId = $this->findOrCreateFolder($service, $yearFolder, $rootFolderId);
                    return $this->findOrCreateFolder($service, $monthFolder, $yearId);
                });
                // ------------------------------------------------

                // C. Montagem do Nome do Arquivo
                $romaneioId = $pedido->romaneio_id ?? 'AVULSO'; 
                $dataDia = $now->format('d-m-Y'); 
                $filial = Str::slug($pedido->user->filial ?? 'Matriz');
                $ext = $uploadedFile->getClientOriginalExtension();
                
                $novoNomeArquivo = "Romaneio-{$romaneioId}_{$dataDia}_{$filial}_ID-{$pedido->id}.{$ext}";

                // D. Upload
                $fileMetadata = new DriveFile([
                    'name' => $novoNomeArquivo,
                    'parents' => [$targetFolderId] // Salva na pasta do Mês
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

            // 2. Atualiza Status
            $pedido->status = 'concluido';
            $pedido->save();

            $pedido->logs()->create([
                'titulo' => 'Entrega Finalizada',
                'descricao' => 'Comprovante anexado e pedido concluído.'
            ]);

            // --- 3. AUTOMAÇÃO DA CARGA (Fecha Romaneio se for o último) ---
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
        $pedido = Pedido::findOrFail($id);
        $request->validate(['motivo' => 'required']);
        $pedido->update(['status' => 'cancelado', 'motivo_rejeicao' => $request->motivo]);
        foreach ($pedido->motos as $moto) { $moto->update(['status' => 'cancelado']); }
        $this->registrarLog($pedido, 'Pedido Rejeitado', "Motivo: {$request->motivo}");
        return redirect()->back();
    }

    public function imprimir($id) {
        $pedido = Pedido::with(['user', 'motos', 'romaneio'])->findOrFail($id);
        return Inertia::render('Pedidos/Romaneio', ['pedido' => $pedido]);
    }

    public function cancelarSolicitacao($id)
    {
        $pedido = Pedido::findOrFail($id);

        if ($pedido->status !== 'solicitado') {
            return redirect()->back()->with('error', 'Pedido já em processamento pelo CD. Não pode ser cancelado.');
        }

        if (Auth::user()->perfil === 'loja' && $pedido->user_id !== Auth::id()) {
            abort(403);
        }

        $pedido->update(['status' => 'cancelado', 'motivo_rejeicao' => 'Cancelado pelo solicitante (Erro de digitação/Desistência)']);
        foreach ($pedido->motos as $moto) {
            $moto->update(['status' => 'cancelado']);
        }

        return redirect()->back()->with('warning', 'Solicitação cancelada com sucesso.');
    }

    // --- FUNÇÃO AUXILIAR PARA O GOOGLE DRIVE (Acha ou Cria Pastas) ---
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
                return $file->id; // Achou!
            }
            $pageToken = $response->nextPageToken;
        } while ($pageToken != null);

        // Não achou, cria
        $folderMetadata = new DriveFile([
            'name' => $folderName,
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents' => [$parentId]
        ]);

        $folder = $service->files->create($folderMetadata, ['fields' => 'id']);
        return $folder->id;
    }
}