<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MicroworkService;
use App\Models\ReservaMicrowork;
use App\Models\Moto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class EstoqueController extends Controller
{
    protected $microworkService;

    public function __construct(MicroworkService $microworkService)
    {
        $this->microworkService = $microworkService;
    }

    public function index(Request $request)
    {
        $estoque = $this->microworkService->getEstoqueCD();
        
        // Buscar todos os chassis que estão reservados localmente (pendente ou faturada temporariamente)
        $reservasAtivas = ReservaMicrowork::whereIn('status', ['pendente', 'faturada'])
                            ->pluck('chassi')
                            ->toArray();

        // Buscar motos que já foram solicitadas em pedidos (em trânsito, separadas, no estoque de loja, etc)
        $motosEmAndamento = Moto::whereIn('status', [
            'solicitado', 'separado', 'aguardando_coleta', 'em_transito', 'expedido', 
            'em_transito_cd', 'no_cd', 'estoque_loja', 'vendida', 'transito_loja', 'reservado', 'avariado'
        ])
        ->whereNotNull('chassi')
        ->pluck('chassi')
        ->toArray();

        // Une as reservas ativas com as motos que já estão em andamento ou em lojas
        $reservasAtivas = array_unique(array_merge($reservasAtivas, $motosEmAndamento));
        
        Log::info("EstoqueController: Retornando " . count($estoque) . " itens. Reservas ocultadas: " . count($reservasAtivas));
        
        return response()->json([
            'data' => $estoque,
            'reservas_ativas' => $reservasAtivas
        ]);
    }

    /**
     * Busca dados do pátio Microwork para uma lista de chassis.
     * Utilizado pela tela de aprovação do Gestor para exibir a localização física em tempo real.
     */
    public function buscarPorChassis(Request $request)
    {
        $request->validate([
            'chassis' => 'required|array|min:1',
            'chassis.*' => 'required|string|max:30',
        ]);

        $chassisBuscados = array_map(function($c) {
            return strtoupper(trim($c));
        }, $request->input('chassis'));

        $estoque = $this->microworkService->getEstoqueCD();

        // Indexar o estoque por chassi para busca O(1)
        $estoqueIndexado = [];
        foreach ($estoque as $item) {
            $chassiItem = strtoupper(trim($item['Chassi'] ?? $item['chassi'] ?? ''));
            if ($chassiItem) {
                $estoqueIndexado[$chassiItem] = $item;
            }
        }

        $resultado = [];
        foreach ($chassisBuscados as $chassi) {
            if (isset($estoqueIndexado[$chassi])) {
                $item = $estoqueIndexado[$chassi];
                $resultado[$chassi] = [
                    'encontrado' => true,
                    'patio' => $item['patio'] ?? null,
                    'modelo' => $item['Modelo'] ?? $item['modelo'] ?? null,
                    'cor' => $item['Cor'] ?? $item['cor'] ?? null,
                    'situacao' => $item['SituacaoDescricao'] ?? $item['situacaodescricao'] ?? $item['situacaoestoque'] ?? null,
                    'dias_estoque' => $item['diasestoque'] ?? $item['DiasEstoque'] ?? null,
                ];
            } else {
                $resultado[$chassi] = [
                    'encontrado' => false,
                ];
            }
        }

        return response()->json($resultado);
    }
}
