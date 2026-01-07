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

    public function finalizarEntrega(Request $request, $id)
    {
        $pedido = Pedido::findOrFail($id);
        $request->validate(['arquivo' => 'required|file|max:10240']);

        if ($request->hasFile('arquivo')) {
            $caminho = $request->file('arquivo')->store('comprovantes', 'public');
            $pedido->update(['status' => 'concluido', 'arquivo_assinado' => $caminho]);
            foreach ($pedido->motos as $moto) { $moto->update(['status' => 'concluido']); }
            $this->registrarLog($pedido, 'Entrega Confirmada', 'Comprovante anexado.');
        }
        return redirect()->back();
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