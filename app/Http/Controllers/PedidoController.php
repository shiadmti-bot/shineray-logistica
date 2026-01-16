<?php

namespace App\Http\Controllers;

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
                      $u->where('filial', 'like', "%{$termo}%"); // Permite buscar por nome da filial
                  });
            });
        }

        // Ordenação e Paginação (AQUI ESTAVA O ERRO)
        $pedidos = $query->orderByRaw("FIELD(status, 'solicitado') DESC")
                         ->orderBy('created_at', 'desc')
                         ->paginate(15); // Usa paginação para funcionar com pedidos.data.map

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
            'itens.*.motivo' => 'required|string', // Validando o motivo
        ]);

        // 2. Verificação de Duplicidade (Blindagem)
        // Impede pedir motos que já estão em processo (reservado, separado, etc)
        // Só permite pedir se não existir ou se estiver 'estoque_fabrica' (livre)
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
            'status' => 'em_analise', // Começa na mão do Gestor
            'observacao' => $request->observacao
        ]);

        // 4. Vinculação das Motos
        foreach ($request->itens as $item) {
            $moto = Moto::updateOrCreate(
                ['chassi' => mb_strtoupper($item['chassi'])], // Busca pelo Chassi
                [
                    'modelo' => mb_strtoupper($item['modelo']),
                    'cor' => mb_strtoupper($item['cor']),
                    'ano_fabricacao' => $item['ano'] ?? null,
                    
                    // --- AQUI ESTAVA FALTANDO ---
                    'motivo_solicitacao' => $item['motivo'], 
                    // ----------------------------

                    'status' => 'reservado',
                    'localizacao_atual' => 'Solicitado pela Loja'
                ]
            );
            
            // Vincula na tabela pivô
            $pedido->motos()->attach($moto->id);
        }

        // 5. Log e Notificação
        $this->registrarLog($pedido, 'Aguardando Aprovação', 'Pedido enviado para análise do Gestor Comercial.');

        // Notifica APENAS os Gestores (Diego)
        $gestores = User::where('perfil', 'gestor')->get();
        foreach ($gestores as $gestor) {
            $gestor->notify(new PedidoAtualizado(
                'Nova Solicitação #' . $pedido->id,
                'Loja ' . Auth::user()->filial . ' aguarda sua autorização.',
                route('gestor.show', $pedido->id)
            ));
        }

        return redirect()->route('pedidos.sucesso')->with('success', 'Solicitação enviada para aprovação do Gestor!');
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

        // --- NOTIFICAÇÃO 2: Avisar a Loja que foi separado ---
        $pedido->user->notify(new PedidoAtualizado(
            'Pedido #' . $pedido->id . ' Separado',
            'Suas motos foram conferidas e estão aguardando carga.',
            route('pedidos.show', $pedido->id)
        ));
        // -----------------------------------------------------

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

        // --- NOTIFICAÇÃO 3: Avisar a Loja que está a caminho ---
        $pedido->user->notify(new PedidoAtualizado(
            'Pedido #' . $pedido->id . ' Em Trânsito',
            'O caminhão saiu do CD! Prepare o recebimento.',
            route('pedidos.show', $pedido->id)
        ));
        // -------------------------------------------------------
        
        return redirect()->back();
    }

    public function finalizarEntrega(Request $request, $id)
    {
        $request->validate([
            'arquivo_romaneio' => 'required|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'avarias' => 'nullable|array'
        ]);

        try {
            $pedido = Pedido::with(['user', 'motos'])->findOrFail($id);

            if (Auth::user()->perfil === 'loja' && $pedido->user_id !== Auth::id()) {
                abort(403, 'Você não tem permissão para finalizar pedidos de outra loja.');
            }
            
            if ($request->hasFile('arquivo_romaneio')) {
                
                // --- TRAVA DE SEGURANÇA NOVA ---
                $clientId     = config('services.google.drive.client_id');
                $clientSecret = config('services.google.drive.client_secret');
                $refreshToken = config('services.google.drive.refresh_token');
                $folderId     = config('services.google.drive.folder_id');

                // Debug de segurança (vai estourar erro na tela se estiver vazio)
                if (!$clientId || !$clientSecret) {
                    throw new \Exception('ERRO CRÍTICO: As chaves do Google Drive não foram carregadas pelo Laravel. Verifique config/services.php');
                }

                if (!$clientId || !$clientSecret || !$refreshToken) {
                    throw new \Exception('Configuração do Google Drive incompleta na Vercel. Verifique as Variáveis de Ambiente.');
                }
                // -------------------------------

                $uploadedFile = $request->file('arquivo_romaneio');
                
                $client = new Client();
                $client->setClientId($clientId);
                $client->setClientSecret($clientSecret);
                $client->refreshToken($refreshToken);
                
                $service = new Drive($client);
                $rootFolderId = env('GOOGLE_DRIVE_FOLDER'); 
                
                // Estrutura de Pastas (Ano / Mês)
                $now = Carbon::now();
                $yearFolder = $now->format('Y'); 
                $monthFolder = $now->format('m') . ' - ' . Str::ucfirst($now->translatedFormat('F')); 
                
                // Cache para não bater na API do Google toda hora buscando pastas
                $cacheKey = "gdrive_folder_{$yearFolder}_{$monthFolder}";
                $targetFolderId = Cache::remember($cacheKey, 60 * 60 * 24, function () use ($service, $rootFolderId, $yearFolder, $monthFolder) {
                    $yearId = $this->findOrCreateFolder($service, $yearFolder, $rootFolderId);
                    return $this->findOrCreateFolder($service, $monthFolder, $yearId);
                });

                // Metadados do Arquivo
                $romaneioId = $pedido->romaneio_id ?? 'AVULSO'; 
                $dataDia = $now->format('d-m-Y'); 
                $filial = Str::slug($pedido->user->filial ?? 'Matriz');
                $ext = $uploadedFile->getClientOriginalExtension();
                $novoNomeArquivo = "Romaneio-{$romaneioId}_{$dataDia}_{$filial}_ID-{$pedido->id}.{$ext}";
                
                $fileMetadata = new DriveFile([
                    'name' => $novoNomeArquivo,
                    'parents' => [$targetFolderId] 
                ]);
                
                // Upload Real
                $content = file_get_contents($uploadedFile->getRealPath());
                $arquivoGoogle = $service->files->create($fileMetadata, [
                    'data' => $content,
                    'mimeType' => $uploadedFile->getMimeType(),
                    'uploadType' => 'multipart',
                    'fields' => 'id, webViewLink'
                ]);
                
                // Salva link no pedido
                $pedido->comprovante_url = $arquivoGoogle->webViewLink;
            }

            // 3. Atualiza Status do Pedido
            $pedido->status = 'concluido';
            $pedido->save();

            // 4. Processamento Inteligente das Motos (Avaria vs Perfeita) [ATUALIZADO]
            $listaAvarias = $request->input('avarias', []);

            foreach ($pedido->motos as $moto) {
                // Verifica se essa moto específica tem relato de avaria no array enviado
                if (isset($listaAvarias[$moto->id]) && !empty($listaAvarias[$moto->id])) {
                    // CASO COM AVARIA
                    $moto->update([
                        'status' => 'avariado', // Status específico para segregá-la
                        'localizacao_atual' => 'Loja (Recebido com Avaria)',
                        'detalhes_avaria' => $listaAvarias[$moto->id] // Salva o texto da loja
                    ]);
                } else {
                    // CASO PERFEITO (Padrão)
                    $moto->update([
                        'status' => 'entregue',
                        'localizacao_atual' => 'Estoque Loja: ' . ($pedido->user->filial ?? 'Matriz'),
                        'detalhes_avaria' => null // Limpa avarias antigas se houver
                    ]);
                }
            }

            // 5. Log de Auditoria
            $qtdAvarias = count($listaAvarias);
            $textoLog = 'Comprovante anexado e pedido concluído.';
            if ($qtdAvarias > 0) {
                $textoLog .= " ⚠️ ATENÇÃO: {$qtdAvarias} moto(s) recebida(s) com avaria.";
            }

            $pedido->logs()->create([
                'titulo' => 'Entrega Finalizada',
                'descricao' => $textoLog
            ]);

            // 6. Fechamento de Carga Automático (Se todos os pedidos foram entregues)
            if ($pedido->romaneio_id) {
                $pendentes = Pedido::where('romaneio_id', $pedido->romaneio_id)
                    ->whereNotIn('status', ['concluido', 'cancelado'])
                    ->count();

                if ($pendentes === 0) {
                    Romaneio::where('id', $pedido->romaneio_id)
                        ->update(['status' => 'finalizado']);
                }
            }

            return redirect()->back()->with('message', 'Sucesso! Entrega registrada e estoque atualizado.');

        } catch (\Exception $e) {
            // Tratamento de erro do Google Drive
            $msg = $e->getMessage();
            $jsonError = json_decode($msg, true);
            if (isset($jsonError['error']['message'])) {
                $msg = $jsonError['error']['message'];
            }
            return redirect()->back()->withErrors(['erro_upload' => 'Erro ao processar entrega: ' . $msg]);
        }
    }

    public function rejeitar(Request $request, $id)
    {
        $pedido = Pedido::with('motos')->findOrFail($id);
        $request->validate(['motivo' => 'required']);

        // --- NOTIFICAÇÃO 4: Avisar a Loja ANTES de excluir ---
        // Linkamos para o Dashboard pois o pedido vai deixar de existir
        $pedido->user->notify(new PedidoAtualizado(
            'Pedido #' . $pedido->id . ' Rejeitado pelo CD',
            'Motivo: ' . $request->motivo . '. As motos foram liberadas.',
            route('dashboard') 
        ));
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