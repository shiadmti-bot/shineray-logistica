<?php

namespace App\Http\Controllers;

use App\Models\Moto;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CensoPatioController extends Controller
{
    /**
     * Tela de Censo / Inventário Rápido de Pátio com Bipagem Contínua.
     *
     * Permite auditoria física instantânea do estoque de motos:
     * - Para Loja: limita estritamente ao pátio da filial do usuário autenticado.
     * - Para CD/Admin/Gestor: permite auditar o CD Matriz ou alternar para qualquer filial.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isLoja = $user->isLoja();

        // 1. Determina a unidade / pátio selecionado
        if ($isLoja) {
            $lojaId = $user->id;
            $localTipo = 'loja';
            $lojaNome = $user->filial ?: $user->name;
            $lojas = [];
        } else {
            // Operação central (admin, cd, gestor)
            $lojaParam = $request->input('loja_id');

            if ($lojaParam && $lojaParam !== 'cd') {
                $selectedLoja = User::lojas()->find($lojaParam);
                if ($selectedLoja) {
                    $lojaId = $selectedLoja->id;
                    $localTipo = 'loja';
                    $lojaNome = $selectedLoja->filial ?: $selectedLoja->name;
                } else {
                    $lojaId = null;
                    $localTipo = 'cd';
                    $lojaNome = 'CD Matriz (Fábrica)';
                }
            } else {
                $lojaId = null;
                $localTipo = 'cd';
                $lojaNome = 'CD Matriz (Fábrica)';
            }

            $lojas = User::lojas()
                ->orderBy('filial')
                ->select('id', 'name', 'filial')
                ->get();
        }

        // 2. Consulta de Motos Esperadas para este pátio
        $queryEsperadas = Moto::query();

        if ($localTipo === 'loja') {
            $queryEsperadas->where('loja_atual_id', $lojaId)
                ->where('status', '!=', 'vendida');
        } else {
            // CD Matriz: motos sem loja_atual_id no pátio físico da matriz
            $queryEsperadas->whereNull('loja_atual_id')
                ->whereNotIn('status', ['vendida', 'transito_loja', 'em_transito']);
        }

        $motosEsperadas = $queryEsperadas
            ->select('id', 'chassi', 'modelo', 'cor', 'status', 'ano_fabricacao', 'localizacao_atual')
            ->orderBy('modelo')
            ->orderBy('chassi')
            ->get()
            ->map(fn ($m) => [
                'id' => $m->id,
                'chassi' => strtoupper(trim((string) $m->chassi)),
                'modelo' => $m->modelo,
                'cor' => $m->cor,
                'status' => $m->status,
                'ano_fabricacao' => $m->ano_fabricacao,
                'localizacao_atual' => $m->localizacao_atual,
            ]);

        // 3. Catálogo Geral para verificação instantânea de motos intrusas
        // Permite identificar se o chassi pertence a outra loja ou se não existe no sistema
        $catalogoGeral = Moto::with('loja:id,name,filial')
            ->select('id', 'chassi', 'modelo', 'cor', 'status', 'loja_atual_id')
            ->get()
            ->map(function ($m) {
                return [
                    'id' => $m->id,
                    'chassi' => strtoupper(trim((string) $m->chassi)),
                    'modelo' => $m->modelo,
                    'cor' => $m->cor,
                    'status' => $m->status,
                    'loja_id' => $m->loja_atual_id,
                    'loja_nome' => $m->loja ? ($m->loja->filial ?: $m->loja->name) : 'CD Matriz (Fábrica)',
                ];
            });

        return Inertia::render('Motos/Censo', [
            'localAtual' => [
                'id' => $localTipo === 'cd' ? 'cd' : $lojaId,
                'nome' => $lojaNome,
                'tipo' => $localTipo,
            ],
            'lojas' => $lojas,
            'motosEsperadas' => $motosEsperadas,
            'catalogoGeral' => $catalogoGeral,
            'podeTrocarUnidade' => ! $isLoja,
        ]);
    }
}
