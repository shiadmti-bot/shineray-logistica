<?php

namespace App\Services\Pecas;

use App\Models\Peca;
use Illuminate\Support\Collection;

/**
 * Serviço de Catálogo de Kits de Revisão Frequente e Giro Rápido para Oficinas Shineray.
 *
 * Fornece pacotes estruturados de peças de manutenção preventiva (Revisão Básica, Relação/Transmissão,
 * Freios e Revisões Periódicas 5.000/10.000 km) adaptados para cada família de motocicletas.
 * Associa dinamicamente as peças ativas no banco aos slots do kit, garantindo que
 * oficinas autorizadas possam adicionar todo o pacote de revisão com apenas 1 clique.
 */
class KitRevisaoService
{
    /**
     * Retorna a lista de kits disponíveis para uma determinada família de moto Shineray.
     *
     * @param string|null $familia Ex: 'JET', 'PHOENIX', 'SHI', 'WORKER', 'JEF', 'RIO', 'URBAN', 'STORM'
     * @return array<int, array<string, mixed>>
     */
    public static function obterKitsParaModelo(?string $familia): array
    {
        if (! $familia) {
            return [];
        }

        $familia = mb_strtoupper(trim($familia), 'UTF-8');
        $labelModelo = CatalogoModelos::label($familia);
        $definicoes = self::definicoesKits();

        $kits = [];

        foreach ($definicoes as $slug => $def) {
            $itensResolvidos = [];
            $totalPreco = 0.0;
            $itensIdentificados = 0;

            foreach ($def['slots'] as $slot) {
                $item = self::resolverItemParaModelo($slot, $familia, $labelModelo);
                $itensResolvidos[] = $item;

                if ($item['peca_id']) {
                    $itensIdentificados++;
                    if ($item['preco_unitario'] !== null) {
                        $totalPreco += ((float) $item['preco_unitario']) * $item['quantidade'];
                    }
                }
            }

            $kits[] = [
                'id'                   => $slug,
                'nome'                 => $def['nome'],
                'subtitulo'            => $def['subtitulo'],
                'intervalo'            => $def['intervalo'],
                'descricao'            => $def['descricao'],
                'badge'                => $def['badge'],
                'badge_cor'            => $def['badge_cor'],
                'icone'                => $def['icone'],
                'modelo'               => $labelModelo,
                'familia'              => $familia,
                'itens'                => $itensResolvidos,
                'total_itens'          => count($itensResolvidos),
                'itens_identificados'  => $itensIdentificados,
                'preco_total_estimado' => $totalPreco > 0 ? round($totalPreco, 2) : null,
            ];
        }

        return $kits;
    }

    /**
     * Resolve um slot específico do kit para a melhor peça ativa no banco de dados.
     *
     * Prioridade de resolução com sanitização de falso-positivo:
     * 1. Peça específica vinculada ao modelo via peca_aplicacoes.
     * 2. Peça com menção explícita do modelo na descrição.
     * 3. Peça de consumo universal (ex: óleos lubrificantes 4T).
     * 4. Degradação elegante para item solicitado sem código (triagem do CD).
     *
     * @param array<string, mixed> $slot
     * @param string $familia
     * @param string $labelModelo
     * @return array<string, mixed>
     */
    public static function resolverItemParaModelo(array $slot, string $familia, string $labelModelo): array
    {
        $includes = $slot['termos'];
        $excludes = $slot['exclusoes'] ?? [];
        $peca = null;

        // Caso 1: Item universal (ex: óleo de motor 20W50 / 10W40)
        if (! empty($slot['preferir_universal'])) {
            $peca = self::buscarPecaQuery(null, $includes, $excludes, apenasUniversal: true);
        }

        // Caso 2: Peça aplicada especificamente à família da moto
        if (! $peca) {
            $peca = self::buscarPecaQuery($familia, $includes, $excludes, viaAplicacao: true);
        }

        // Caso 3: Menção explícita da família no texto da descrição
        if (! $peca) {
            $peca = self::buscarPecaQuery($familia, $includes, $excludes, viaTextoDescricao: true);
        }

        // Caso 4: Se aceita genérico/universal como alternativa
        if (! $peca && ! empty($slot['aceita_generico'])) {
            $peca = self::buscarPecaQuery(null, $includes, $excludes);
        }

        $quantidade = $slot['quantidade'] ?? 1;

        if ($peca) {
            $saldoTotal = $peca->saldosExternos->sum('saldo');

            return [
                'slot_nome'            => $slot['slot_nome'],
                'peca_id'              => $peca->id,
                'codigo'               => $peca->codigo,
                'descricao'            => $peca->descricao,
                'unidade'              => $peca->unidade ?? 'UN',
                'quantidade'           => $quantidade,
                'preco_unitario'       => $peca->preco_referencia,
                'tipo_item'            => $peca->tipo_item,
                'identificado'         => true,
                'tem_estoque'          => $saldoTotal > 0,
                'saldo_estimado'       => $saldoTotal,
                'descricao_solicitada' => null,
            ];
        }

        // Fallback: item sem código pronto para triagem do CD
        $fallbackTexto = str_replace(
            ['{modelo}', '{familia}'],
            [$labelModelo, $familia],
            $slot['fallback_descricao'] ?? $slot['slot_nome'] . " para {$labelModelo}"
        );

        return [
            'slot_nome'            => $slot['slot_nome'],
            'peca_id'              => null,
            'codigo'               => null,
            'descricao'            => $fallbackTexto,
            'unidade'              => 'UN',
            'quantidade'           => $quantidade,
            'preco_unitario'       => null,
            'tipo_item'            => 'indefinido',
            'identificado'         => false,
            'tem_estoque'          => false,
            'saldo_estimado'       => 0,
            'descricao_solicitada' => $fallbackTexto,
        ];
    }

    /**
     * Helper de busca no Eloquent com aplicação estrita de inclusões e exclusões de termos.
     */
    private static function buscarPecaQuery(
        ?string $familia,
        array $includes,
        array $excludes = [],
        bool $apenasUniversal = false,
        bool $viaAplicacao = false,
        bool $viaTextoDescricao = false
    ): ?Peca {
        $query = Peca::query()->where('ativo', true);

        if ($apenasUniversal) {
            $query->where('tipo_item', 'universal');
        } elseif ($viaAplicacao && $familia) {
            $query->paraModelo($familia);
        } elseif ($viaTextoDescricao && $familia) {
            $query->where('descricao', 'like', "%{$familia}%");
        }

        // Aplica termos de inclusão (OR entre sinônimos)
        $query->where(function ($q) use ($includes) {
            foreach ($includes as $inc) {
                $q->orWhere('descricao', 'like', "%{$inc}%");
            }
        });

        // Aplica termos de exclusão (evita falso-positivos como MANIVELA ou BUCHA DA COROA)
        foreach ($excludes as $exc) {
            $query->where('descricao', 'not like', "%{$exc}%");
        }

        return $query
            ->with('saldosExternos')
            ->orderBy('preco_referencia')
            ->first();
    }

    /**
     * Catálogo mestre dos kits de manutenção e giro rápido.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function definicoesKits(): array
    {
        return [
            'revisao_basica' => [
                'nome'       => 'Kit Revisão Básica',
                'subtitulo'  => 'Óleo Motor 4T + Filtro/Tela + Vela de Ignição',
                'descricao'  => 'Manutenção preventiva periódica rápida para troca de óleo e ignição.',
                'intervalo'  => 'A cada 1.000 a 3.000 km',
                'badge'      => 'Mais Pedido ⚡',
                'badge_cor'  => 'amber',
                'icone'      => 'sparkles',
                'slots'      => [
                    [
                        'slot_nome'          => 'Óleo de Motor 4T 20W50 / 10W40 (1L)',
                        'quantidade'         => 1,
                        'termos'             => ['20W50', '10W40', 'OLEO', 'ÓLEO', '4T'],
                        'exclusoes'          => ['BOMBA', 'TAMPA', 'BUJAO', 'ENGRENAGEM'],
                        'preferir_universal' => true,
                        'aceita_generico'    => true,
                        'fallback_descricao' => 'Óleo Motor 4T 20W50 Mineral/Semi-sintético (1 Litro)',
                    ],
                    [
                        'slot_nome'          => 'Vela de Ignição',
                        'quantidade'         => 1,
                        'termos'             => ['VELA '],
                        'exclusoes'          => ['MANIVELA', 'ARVORE', 'CHAVE DE VELA'],
                        'preferir_universal' => false,
                        'aceita_generico'    => false,
                        'fallback_descricao' => 'Vela de Ignição Original para Shineray {modelo}',
                    ],
                    [
                        'slot_nome'          => 'Elemento Filtrante / Filtro de Ar',
                        'quantidade'         => 1,
                        'termos'             => ['ELEMENTO DO FILTRO', 'FILTRO DE AR ESPUMA', 'ESPUMA DO FILTRO', 'ELEMENTO FILTRO'],
                        'exclusoes'          => ['CAIXA', 'TAMPA', 'DUTO', 'MANGUEIRA'],
                        'preferir_universal' => false,
                        'aceita_generico'    => false,
                        'fallback_descricao' => 'Elemento do Filtro de Ar para Shineray {modelo}',
                    ],
                ],
            ],

            'relacao_transmissao' => [
                'nome'       => 'Kit Relação e Transmissão',
                'subtitulo'  => 'Coroa + Pinhão de Aço + Corrente Reforçada',
                'descricao'  => 'Conjunto completo de tração traseira para reposição de desgaste.',
                'intervalo'  => 'A cada ~15.000 km ou desgaste dos dentes',
                'badge'      => 'Giro Rápido ⚙️',
                'badge_cor'  => 'blue',
                'icone'      => 'cog',
                'slots'      => [
                    [
                        'slot_nome'          => 'Coroa de Transmissão',
                        'quantidade'         => 1,
                        'termos'             => ['COROA DE TRANSMISSAO', 'COROA DE TRANSMISSÃO', 'COROA '],
                        'exclusoes'          => ['BUCHA', 'PARAFUSO', 'TRAVA', 'FLANGE', 'COXIM'],
                        'preferir_universal' => false,
                        'aceita_generico'    => false,
                        'fallback_descricao' => 'Coroa de Transmissão para Shineray {modelo}',
                    ],
                    [
                        'slot_nome'          => 'Pinhão de Transmissão',
                        'quantidade'         => 1,
                        'termos'             => ['PINHAO DE TRANSMISSAO', 'PINHÃO DE TRANSMISSÃO', 'PINHÃO 14', 'PINHAO 14', 'PINHAO 13', 'PINHAO 16'],
                        'exclusoes'          => ['ROLAMENTO', 'RETENTOR', 'EIXO', 'PORCA', 'KIT DE TRANSMISSAO'],
                        'preferir_universal' => false,
                        'aceita_generico'    => false,
                        'fallback_descricao' => 'Pinhão de Transmissão para Shineray {modelo}',
                    ],
                    [
                        'slot_nome'          => 'Corrente de Transmissão',
                        'quantidade'         => 1,
                        'termos'             => ['CORRENTE DE TRANSMISSAO', 'CORRENTE TRANSMISSAO', 'CORRENTE 428', 'CORRENTE 520'],
                        'exclusoes'          => ['CAPA', 'GUIA', 'TENSOR', 'PROTETOR', 'COMANDO', 'BOMBA', 'PARTIDA'],
                        'preferir_universal' => false,
                        'aceita_generico'    => true,
                        'fallback_descricao' => 'Corrente de Transmissão Reforçada para Shineray {modelo}',
                    ],
                ],
            ],

            'kit_freios' => [
                'nome'       => 'Kit Freios e Segurança',
                'subtitulo'  => 'Pastilhas Dianteiras + Lonas / Sapatas Traseiras',
                'descricao'  => 'Frenagem completa e segura para inspeção ou substituição preventiva.',
                'intervalo'  => 'Inspeção a cada 3.000 km / Substituição conforme uso',
                'badge'      => 'Segurança 🛑',
                'badge_cor'  => 'rose',
                'icone'      => 'shield-check',
                'slots'      => [
                    [
                        'slot_nome'          => 'Pastilha de Freio Dianteiro',
                        'quantidade'         => 1,
                        'termos'             => ['PASTILHA DE FREIO', 'PASTILHAS DO FREIO'],
                        'exclusoes'          => ['CHAPA', 'MOLA', 'PINO'],
                        'preferir_universal' => false,
                        'aceita_generico'    => false,
                        'fallback_descricao' => 'Jogo de Pastilhas de Freio Dianteiro para Shineray {modelo}',
                    ],
                    [
                        'slot_nome'          => 'Lona / Patim de Freio Traseiro',
                        'quantidade'         => 1,
                        'termos'             => ['LONA DE FREIO', 'SAPATA DE FREIO', 'PATIM DE FREIO'],
                        'exclusoes'          => ['CHAPA', 'MOLA', 'ESPELHO', 'HASTE'],
                        'preferir_universal' => false,
                        'aceita_generico'    => false,
                        'fallback_descricao' => 'Jogo de Lonas/Sapatas de Freio Traseiro para Shineray {modelo}',
                    ],
                ],
            ],

            'revisao_periodica' => [
                'nome'       => 'Kit Revisão 5.000 / 10.000 km',
                'subtitulo'  => 'Filtro de Ar + Cabos + Vela de Ignição',
                'descricao'  => 'Pacote de itens essenciais para manter a garantia e calibragem de fábrica.',
                'intervalo'  => 'Revisão periódica de manual do proprietário',
                'badge'      => 'Garantia Shineray 🛡️',
                'badge_cor'  => 'emerald',
                'icone'      => 'wrench-screwdriver',
                'slots'      => [
                    [
                        'slot_nome'          => 'Elemento do Filtro de Ar',
                        'quantidade'         => 1,
                        'termos'             => ['ELEMENTO DO FILTRO', 'FILTRO DE AR ESPUMA', 'ESPUMA DO FILTRO', 'ELEMENTO FILTRO'],
                        'exclusoes'          => ['CAIXA', 'TAMPA', 'DUTO', 'MANGUEIRA'],
                        'preferir_universal' => false,
                        'aceita_generico'    => false,
                        'fallback_descricao' => 'Elemento do Filtro de Ar Original {modelo}',
                    ],
                    [
                        'slot_nome'          => 'Vela de Ignição Resistiva',
                        'quantidade'         => 1,
                        'termos'             => ['VELA '],
                        'exclusoes'          => ['MANIVELA', 'ARVORE', 'CHAVE DE VELA'],
                        'preferir_universal' => false,
                        'aceita_generico'    => false,
                        'fallback_descricao' => 'Vela de Ignição Shineray Original para {modelo}',
                    ],
                    [
                        'slot_nome'          => 'Cabo de Embreagem',
                        'quantidade'         => 1,
                        'termos'             => ['CABO DE EMBREAGEM', 'CABO EMBREAGEM'],
                        'exclusoes'          => [],
                        'preferir_universal' => false,
                        'aceita_generico'    => true,
                        'fallback_descricao' => 'Cabo de Embreagem Completo para Shineray {modelo}',
                    ],
                    [
                        'slot_nome'          => 'Cabo de Acelerador',
                        'quantidade'         => 1,
                        'termos'             => ['CABO DE ACELERADOR', 'CABO ACELERADOR'],
                        'exclusoes'          => [],
                        'preferir_universal' => false,
                        'aceita_generico'    => false,
                        'fallback_descricao' => 'Cabo de Acelerador Original para Shineray {modelo}',
                    ],
                ],
            ],
        ];
    }
}
