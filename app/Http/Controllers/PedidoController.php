<?php

namespace App\Http\Controllers;

use App\Models\Moto;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\Modelo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Google\Client;
use Google\Service\Drive;
use Google\Service\Drive\DriveFile;

class PedidoController extends Controller
{
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
        // 1. (O código de busca continua igual...)
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

        // 2. Configura o CSV
        $filename = "relatorio_pedidos_" . date('d-m-Y_H-i') . ".csv";
        $handle = fopen('php://output', 'w');
        
        // Cabeçalhos (Adicionei BOM para corrigir acentos)
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        fputs($handle, "\xEF\xBB\xBF");

        // 3. Cabeçalho da Tabela
        fputcsv($handle, [
            'ID', 
            'Data Solicitação', 
            'Loja', 
            'Status', 
            'Qtd', 
            'Modelos', 
            'Chassis', 
            'Carga', 
            'Motorista',
            'Conclusão'
        ], ';');

        // 4. Linhas
        foreach ($pedidos as $pedido) {
            // TRUQUE 1: Colocar um espaço antes do Chassi impede notação científica
            $chassis = $pedido->motos->map(function($moto) {
                return ' ' . $moto->chassi; // Adiciona espaço
            })->implode(', ');

            $modelos = $pedido->motos->pluck('modelo')->unique()->implode(', ');

            fputcsv($handle, [
                $pedido->id,
                // TRUQUE 2: Espaço antes da data para não virar ####### (opcional, ou o usuário alarga a coluna)
                ' ' . $pedido->created_at->format('d/m/Y H:i'), 
                $pedido->user->name . ' - ' . ($pedido->user->filial ?? 'Matriz'),
                strtoupper($pedido->status),
                $pedido->motos->count(),
                $modelos,
                $chassis, // Agora vai com o espaço na frente
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
        // Busca todos os modelos em ordem alfabética para o autocomplete
        $modelos = \App\Models\Modelo::orderBy('nome')->pluck('nome');

        return Inertia::render('Pedidos/Create', [
            'listaModelos' => $modelos
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'itens' => 'required|array|min:1',
            'itens.*.modelo' => 'required|string',
            'itens.*.chassi' => 'required|string|size:11|distinct',
            'itens.*.cor' => 'required|string|min:3', 
        ]);

        // Validação de Duplicidade
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
        return redirect()->route('pedidos.sucesso')
            ->with('success', 'Solicitação enviada para o CD!');
    }

    public function sucesso() { return Inertia::render('Pedidos/Sucesso'); }

    public function show($id)
    {
        $pedido = Pedido::with(['user', 'motos.romaneio', 'romaneio', 'logs'])->findOrFail($id);
        return Inertia::render('Pedidos/Show', ['pedido' => $pedido]);
    }

    // --- CORREÇÃO AQUI: Atualiza motos para 'separado' ---
    public function marcarSeparado($id)
    {
        $pedido = Pedido::findOrFail($id);
        
        // Trava de segurança
        if ($pedido->status !== 'solicitado') {
            return redirect()->back();
        }

        // 1. Atualiza o Pedido
        // IMPORTANTE: Limpamos 'motivo_rejeicao' para null para sumir qualquer alerta vermelho antigo
        $pedido->update([
            'status' => 'separado',
            'motivo_rejeicao' => null 
        ]);

        // 2. Atualiza AS MOTOS vinculadas
        foreach ($pedido->motos as $moto) {
            $moto->update(['status' => 'separado']);
        }

        // 3. Log
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

    // --- FUNÇÃO DE FINALIZAÇÃO ATUALIZADA (NOME DO ARQUIVO PERSONALIZADO) ---
    public function finalizarEntrega(Request $request, $id)
    {
        $request->validate([
            'arquivo_romaneio' => 'required|file|mimes:jpg,jpeg,png,pdf|max:6144', // Max 6MB
        ]);

        try {
            // Carrega o pedido junto com o usuário para pegar a filial
            $pedido = Pedido::with('user')->findOrFail($id);
            
            if ($request->hasFile('arquivo_romaneio')) {
                $uploadedFile = $request->file('arquivo_romaneio');
                
                // 1. Configura Cliente Google com OAuth
                $client = new Client();
                $client->setClientId(env('GOOGLE_DRIVE_CLIENT_ID'));
                $client->setClientSecret(env('GOOGLE_DRIVE_CLIENT_SECRET'));
                $client->refreshToken(env('GOOGLE_DRIVE_REFRESH_TOKEN'));
                
                $service = new Drive($client);

                // --- 2. MONTAGEM DO NOME DO ARQUIVO ---
                // Pega os dados para o nome
                $romaneio = $pedido->romaneio_id ?? 'AVULSO'; // Se não tiver romaneio, chama de AVULSO
                $data = now()->format('d-m-Y'); // Data de hoje (Upload)
                
                // Trata o nome da filial para não ter acentos ou espaços (ex: "São Paulo" vira "Sao-Paulo")
                $filialNome = $pedido->user->filial ?? 'Matriz';
                $filial = \Illuminate\Support\Str::slug($filialNome);
                
                // Extensão original do arquivo (jpg, pdf, etc)
                $ext = $uploadedFile->getClientOriginalExtension();

                // NOME FINAL: Romaneio_123_08-01-2026_Recife_ID-555.jpg
                $novoNomeArquivo = "Romaneio-{$romaneio}_{$data}_{$filial}_ID-{$pedido->id}.{$ext}";

                // --------------------------------------

                $fileMetadata = new DriveFile([
                    'name' => $novoNomeArquivo, // <--- Usamos o novo nome aqui
                    'parents' => [env('GOOGLE_DRIVE_FOLDER')]
                ]);

                // 3. Lê o arquivo
                $content = file_get_contents($uploadedFile->getRealPath());

                // 4. Envia
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

            return redirect()->back()->with('message', 'Sucesso!');

        } catch (\Exception $e) {
            // Tratamento de erro (Google ou Outros)
            $msg = $e->getMessage();
            $jsonError = json_decode($msg, true);
            if (isset($jsonError['error']['message'])) {
                $msg = $jsonError['error']['message'];
            }

            return redirect()->back()->withErrors([
                'erro_upload' => 'Erro ao salvar no Drive: ' . $msg
            ]);
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

    // Loja cancela o próprio pedido (Se ainda não foi processado)
    public function cancelarSolicitacao($id)
    {
        $pedido = Pedido::findOrFail($id);

        // Trava de Segurança: Só pode cancelar se ainda estiver na fase 1
        if ($pedido->status !== 'solicitado') {
            return redirect()->back()->with('error', 'Pedido já em processamento pelo CD. Não pode ser cancelado.');
        }

        // Verifica se o usuário é o dono do pedido (segurança extra)
        if (Auth::user()->perfil === 'loja' && $pedido->user_id !== Auth::id()) {
            abort(403);
        }

        $pedido->update(['status' => 'cancelado', 'motivo_rejeicao' => 'Cancelado pelo solicitante (Erro de digitação/Desistência)']);
        
        foreach ($pedido->motos as $moto) {
            $moto->update(['status' => 'cancelado']);
        }

        return redirect()->back()->with('warning', 'Solicitação cancelada com sucesso.');
    }
}