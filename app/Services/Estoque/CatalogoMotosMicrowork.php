<?php

namespace App\Services\Estoque;

use App\Models\Modelo;
use App\Models\ModeloCor;
use App\Services\MicroworkService;
use Illuminate\Support\Facades\DB;

/**
 * O catálogo de modelos e cores de moto — o que EXISTE, não o que está em estoque.
 *
 * DUAS PERGUNTAS DIFERENTES, QUE ESTAVAM MISTURADAS. "Que modelos a Shineray
 * tem?" é catálogo e muda quando a fábrica lança ou encerra uma linha. "Quantas
 * unidades do JEF S vermelho o CD tem agora?" é saldo e muda a cada faturamento.
 * A tela de pedido respondia à primeira com os dados da segunda: a lista de
 * modelos saía dos chassis em pátio, então pedir reposição de um modelo esgotado
 * era impossível — exatamente quando mais se precisa pedir.
 *
 * ESTE SERVIÇO É O CATÁLOGO. `MicroworkService` continua sendo o saldo. A tela
 * usa os dois: o catálogo para o que se pode pedir, o saldo para anotar ao lado
 * quanto há disponível agora.
 *
 * O CATÁLOGO SÓ CRESCE. `registrar()` faz upsert e nunca remove: um modelo que
 * desapareceu da resposta da API pode ter sumido por filtro de pátio, por erro
 * de integração ou porque o último chassi foi vendido — nenhuma dessas coisas
 * significa que o modelo deixou de existir. Quem tira da lista é uma pessoa,
 * marcando `ativo = false`.
 */
class CatalogoMotosMicrowork
{
    public function __construct(private MicroworkService $microwork)
    {
    }

    /**
     * Grava no catálogo os modelos e cores presentes numa resposta do Microwork.
     *
     * RECEBE A RESPOSTA CRUA, de propósito — antes do filtro de pátios que o
     * saldo aplica. O catálogo tem de ver o inventário do grupo inteiro: um
     * modelo que hoje só existe no pátio de uma loja continua sendo um modelo
     * que a loja pode pedir ao CD.
     *
     * @param  iterable<array<string, mixed>>  $itensCrus
     * @return array{modelos_novos: int, cores_novas: int, modelos_vistos: int}
     */
    public function registrar(iterable $itensCrus): array
    {
        $agora = now();
        $vistos = [];

        foreach ($itensCrus as $bruto) {
            $item = $this->microwork->normalizarItem((array) $bruto);

            if ($item['modelo'] === '') {
                continue;
            }

            $cor = $item['cor'] !== '' ? $item['cor'] : 'NÃO INFORMADA';

            $vistos[$item['modelo']] ??= [];
            $vistos[$item['modelo']][$cor] = true;
        }

        if ($vistos === []) {
            return ['modelos_novos' => 0, 'cores_novas' => 0, 'modelos_vistos' => 0];
        }

        $novosModelos = 0;
        $novasCores = 0;

        DB::transaction(function () use ($vistos, $agora, &$novosModelos, &$novasCores) {
            $existentes = Modelo::whereIn('nome', array_keys($vistos))
                ->pluck('id', 'nome');

            foreach ($vistos as $nome => $cores) {
                $modeloId = $existentes[$nome] ?? null;

                if ($modeloId === null) {
                    $modelo = Modelo::create([
                        'nome'     => $nome,
                        'origem'   => 'microwork',
                        'visto_em' => $agora,
                    ]);

                    $modeloId = $modelo->id;
                    $novosModelos++;
                } else {
                    // Só a data de visita: não mexe em `ativo`, que é decisão
                    // humana, nem em `origem`, que é histórico.
                    Modelo::whereKey($modeloId)->update(['visto_em' => $agora]);
                }

                $coresExistentes = ModeloCor::where('modelo_id', $modeloId)
                    ->pluck('id', 'cor');

                foreach (array_keys($cores) as $cor) {
                    if (isset($coresExistentes[$cor])) {
                        ModeloCor::whereKey($coresExistentes[$cor])->update(['visto_em' => $agora]);
                        continue;
                    }

                    ModeloCor::create([
                        'modelo_id' => $modeloId,
                        'cor'       => $cor,
                        'origem'    => 'microwork',
                        'visto_em'  => $agora,
                    ]);

                    $novasCores++;
                }
            }
        });

        return [
            'modelos_novos'  => $novosModelos,
            'cores_novas'    => $novasCores,
            'modelos_vistos' => count($vistos),
        ];
    }

    /**
     * O catálogo como a tela de criação de pedido precisa dele.
     *
     * Um registro por modelo ativo, com as cores conhecidas e o saldo atual do
     * CD anotado em cada uma. Modelo sem saldo vem com `disponivel_total = 0` e
     * continua na lista: é justamente ele que a loja precisa pedir.
     *
     * As cores vêm do catálogo, não de uma lista fixa no código. Antes, um
     * modelo sem saldo recebia sete cores inventadas no front-end, e a loja
     * podia pedir "SHI 175 EFI BEGE" sem que essa variante existisse.
     *
     * @return list<array{
     *     nome: string,
     *     disponivel_total: int,
     *     cores: list<array{cor: string, disponivel: int}>
     * }>
     */
    public function paraTelaDePedido(bool $somenteMontadas = false): array
    {
        $saldo = [];

        foreach ($this->microwork->getEstoqueDisponivelAgregado($somenteMontadas) as $linha) {
            $saldo[$linha['modelo']][$linha['cor']] = (int) $linha['disponivel'];
        }

        $modelos = Modelo::query()
            ->where('ativo', true)
            ->with(['cores' => fn ($q) => $q->where('ativo', true)->orderBy('cor')])
            ->orderBy('nome')
            ->get();

        $lista = [];

        foreach ($modelos as $modelo) {
            $saldoDoModelo = $saldo[$modelo->nome] ?? [];

            // União do catálogo com o saldo: uma cor que apareceu no estoque
            // AGORA mas ainda não está catalogada (sincronia nova, catálogo
            // antigo) não pode ficar de fora da tela por causa disso.
            $cores = $modelo->cores->pluck('cor')->all();
            $cores = array_values(array_unique([...$cores, ...array_keys($saldoDoModelo)]));
            sort($cores);

            $lista[] = [
                'nome'             => $modelo->nome,
                'disponivel_total' => array_sum($saldoDoModelo),
                'cores'            => array_map(
                    fn (string $cor) => ['cor' => $cor, 'disponivel' => $saldoDoModelo[$cor] ?? 0],
                    $cores,
                ),
            ];
        }

        // Modelo que está no estoque e NÃO está no catálogo: aparece igual, com
        // as cores do saldo. É a rede de segurança para o caso de a sincronia
        // rodar antes desta versão, ou de o catálogo ser limpo por engano.
        $catalogados = array_column($lista, 'nome');

        foreach ($saldo as $nome => $cores) {
            if (in_array($nome, $catalogados, true)) {
                continue;
            }

            ksort($cores);

            $lista[] = [
                'nome'             => $nome,
                'disponivel_total' => array_sum($cores),
                'cores'            => array_map(
                    fn (string $cor) => ['cor' => $cor, 'disponivel' => $cores[$cor]],
                    array_keys($cores),
                ),
            ];
        }

        usort($lista, fn (array $a, array $b) => $a['nome'] <=> $b['nome']);

        return $lista;
    }
}
