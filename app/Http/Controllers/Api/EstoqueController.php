<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MicroworkService;
use Illuminate\Http\Request;

class EstoqueController extends Controller
{
    protected $microworkService;

    public function __construct(MicroworkService $microworkService)
    {
        $this->microworkService = $microworkService;
    }

    public function index(Request $request)
    {
        // Aqui podemos adicionar filtros extras vindos do Request se necessário
        $estoque = $this->microworkService->getEstoqueCD();
        
        return response()->json($estoque);
    }
}
