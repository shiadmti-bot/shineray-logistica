<?php

namespace App\Http\Controllers;

use App\Models\EstoqueLocal;
use App\Models\Filial;
use App\Models\Pedido;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class FilialController extends Controller
{
    private function autorizar(): void
    {
        if (!in_array(Auth::user()?->perfil, ['admin', 'gestor'], true)) {
            abort(403, 'Apenas administradores e gestores podem gerenciar filiais.');
        }
    }

    public function index(Request $request)
    {
        $this->autorizar();

        $search = trim((string) $request->input('search'));
        $status = $request->input('status'); // 'todas', 'ativas', 'inativas'
        $uf = $request->input('uf');

        $query = Filial::query();

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('nome', 'like', "%{$search}%")
                  ->orWhere('cidade', 'like', "%{$search}%")
                  ->orWhere('uf', 'like', "%{$search}%");
            });
        }

        if ($status === 'ativas') {
            $query->where('ativo', true);
        } elseif ($status === 'inativas') {
            $query->where('ativo', false);
        }

        if ($uf) {
            $query->where('uf', mb_strtoupper($uf));
        }

        $todasFiliais = Filial::all();
        $totalFiliais = $todasFiliais->count();
        $totalAtivas = $todasFiliais->where('ativo', true)->count();
        $totalInativas = $totalFiliais - $totalAtivas;

        // Distribuição por UF
        $ufsDistribuicao = $todasFiliais->groupBy('uf')->map(fn ($group) => $group->count())->toArray();

        // Mapeamento rápido de contagem de usuários por filial
        $usuariosPorFilial = User::whereNotNull('filial')
            ->where('filial', '!=', '')
            ->select('filial', DB::raw('count(*) as total'))
            ->groupBy('filial')
            ->pluck('total', 'filial')
            ->toArray();

        // Mapeia filiais paginadas ou ordenadas
        $filiais = $query->orderBy('uf')
            ->orderBy('cidade')
            ->paginate(25)
            ->withQueryString()
            ->through(function (Filial $f) use ($usuariosPorFilial) {
                $chave = $f->chave_filial;
                $local = $f->estoqueLocal();

                // Calcula usuários vinculados somando pela chave "Cidade/UF" e pelo nome direto
                $qtdUsers = ($usuariosPorFilial[$chave] ?? 0) + ($usuariosPorFilial[$f->nome] ?? 0);

                return [
                    'id'               => $f->id,
                    'nome'             => $f->nome,
                    'cidade'           => $f->cidade,
                    'uf'               => $f->uf,
                    'ativo'            => (bool) $f->ativo,
                    'codigo_empresa'   => $f->codigo_empresa,
                    'chave_filial'     => $chave,
                    'rotulo_completo'  => $f->rotulo_completo,
                    'usuarios_count'   => $qtdUsers,
                    'estoque_local_id' => $local?->id,
                    'participa_pecas'  => (bool) ($local?->participa_pecas ?? true),
                    'created_at'       => $f->created_at?->format('d/m/Y'),
                ];
            });

        return Inertia::render('Filiais/Index', [
            'filiais' => $filiais,
            'stats' => [
                'total'    => $totalFiliais,
                'ativas'   => $totalAtivas,
                'inativas' => $totalInativas,
                'ufs'      => $ufsDistribuicao,
            ],
            'filters' => [
                'search' => $search,
                'status' => $status ?? 'todas',
                'uf'     => $uf ?? '',
            ],
            'todasUfs' => array_keys($ufsDistribuicao),
        ]);
    }

    public function store(Request $request)
    {
        $this->autorizar();

        $dados = $request->validate([
            'nome'            => ['required', 'string', 'max:100'],
            'cidade'          => ['required', 'string', 'max:100'],
            'uf'              => ['required', 'string', 'size:2'],
            'ativo'           => ['boolean'],
            'codigo_empresa'  => ['nullable', 'string', 'max:50'],
            'participa_pecas' => ['boolean'],
        ], [
            'nome.required'   => 'Informe o nome da filial.',
            'cidade.required' => 'Informe a cidade da filial.',
            'uf.required'     => 'Informe a UF da filial com 2 letras.',
            'uf.size'         => 'A UF deve ter exatamente 2 letras (ex: PA, CE).',
        ]);

        $dados['uf'] = mb_strtoupper(trim($dados['uf']));
        $dados['cidade'] = trim($dados['cidade']);
        $dados['nome'] = trim($dados['nome']);
        $dados['ativo'] = $request->boolean('ativo', true);

        // Verifica duplicidade exata de cidade/uf
        $existe = Filial::where('cidade', $dados['cidade'])
            ->where('uf', $dados['uf'])
            ->exists();

        if ($existe) {
            return back()->withErrors(['cidade' => "Já existe uma filial cadastrada em {$dados['cidade']}/{$dados['uf']}."])->withInput();
        }

        DB::transaction(function () use ($dados, $request) {
            $filial = Filial::create($dados);

            // Sincroniza/cria o EstoqueLocal correspondente para atender fluxos de peças e logística
            $slug = Str::slug("loja-{$filial->cidade}-{$filial->uf}-{$filial->id}");
            $nomeLocal = "Loja {$filial->cidade}/{$filial->uf}";

            EstoqueLocal::firstOrCreate(
                [
                    'tipo' => EstoqueLocal::TIPO_LOJA,
                    'nome' => $nomeLocal,
                ],
                [
                    'slug'            => $slug,
                    'ativo'           => $filial->ativo,
                    'participa_pecas' => $request->boolean('participa_pecas', true),
                ]
            );
        });

        return redirect()->route('filiais.index')->with('success', "Filial {$dados['nome']} cadastrada com sucesso!");
    }

    public function update(Request $request, Filial $filial)
    {
        $this->autorizar();

        $dados = $request->validate([
            'nome'            => ['required', 'string', 'max:100'],
            'cidade'          => ['required', 'string', 'max:100'],
            'uf'              => ['required', 'string', 'size:2'],
            'ativo'           => ['boolean'],
            'codigo_empresa'  => ['nullable', 'string', 'max:50'],
            'participa_pecas' => ['boolean'],
        ]);

        $dados['uf'] = mb_strtoupper(trim($dados['uf']));
        $dados['cidade'] = trim($dados['cidade']);
        $dados['nome'] = trim($dados['nome']);
        $dados['ativo'] = $request->boolean('ativo', $filial->ativo);

        // Verifica duplicidade com outra filial
        $duplicada = Filial::where('cidade', $dados['cidade'])
            ->where('uf', $dados['uf'])
            ->where('id', '!=', $filial->id)
            ->exists();

        if ($duplicada) {
            return back()->withErrors(['cidade' => "Outra filial já utiliza a cidade {$dados['cidade']}/{$dados['uf']}."])->withInput();
        }

        DB::transaction(function () use ($filial, $dados, $request) {
            $filial->update($dados);

            // Sincroniza EstoqueLocal
            $local = $filial->estoqueLocal();
            if ($local) {
                $local->update([
                    'ativo'           => $filial->ativo,
                    'participa_pecas' => $request->boolean('participa_pecas', $local->participa_pecas),
                ]);
            }
        });

        return back()->with('success', "Filial {$filial->nome} atualizada com sucesso!");
    }

    public function toggle(Filial $filial)
    {
        $this->autorizar();

        $novoStatus = !$filial->ativo;
        $filial->update(['ativo' => $novoStatus]);

        $local = $filial->estoqueLocal();
        if ($local) {
            $local->update(['ativo' => $novoStatus]);
        }

        $acao = $novoStatus ? 'ativada' : 'desativada';
        return back()->with('success', "Filial {$filial->nome} {$acao} com sucesso!");
    }

    public function destroy(Filial $filial)
    {
        $this->autorizar();

        $chave = $filial->chave_filial;

        // Verifica vínculos com usuários
        $temUsuarios = User::where('filial', $chave)
            ->orWhere('filial', $filial->nome)
            ->exists();

        // Verifica se local de estoque tem pedidos ou movimentações
        $local = $filial->estoqueLocal();
        $temPedidos = false;
        if ($local) {
            $temPedidos = Pedido::where('local_origem_id', $local->id)
                ->orWhere('local_destino_id', $local->id)
                ->exists();
        }

        if ($temUsuarios || $temPedidos) {
            // Em vez de quebrar integridade referencial, desativa com mensagem explicativa
            $filial->update(['ativo' => false]);
            if ($local) {
                $local->update(['ativo' => false]);
            }

            return back()->with(
                'success',
                "A filial {$filial->nome} possui histórico vinculado (usuários ou pedidos) e foi desativada com segurança para não aparecer em novas seleções."
            );
        }

        // Sem vínculos: exclusão segura
        if ($local) {
            $local->delete();
        }
        $filial->delete();

        return back()->with('success', "Filial {$filial->nome} removida com sucesso!");
    }
}
