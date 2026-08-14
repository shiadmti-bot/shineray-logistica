<?php

namespace App\Services\Pecas;

/**
 * Linha de modelos Shineray usada para normalizar aplicação de peças.
 *
 * FONTES
 * 1. Tabela `modelos` do sistema (nomenclatura Microwork: "XY150-8 - MOTO JEF S").
 * 2. Campo `aplicacao` do relatório de peças (153 variações de texto observadas).
 * 3. Linha oficial Shineray do Brasil, para cilindradas e nomes comerciais.
 *
 * POR QUE UM MAPA EXPLÍCITO
 * O texto de aplicação usa nome comercial curto ("JEF 150"), o cadastro de motos
 * usa código de homologação ("XY150-8 - MOTO JEF S") e a loja pensa em nome de
 * rua ("JEF"). Sem uma tabela de tradução, buscar "JEF" não encontra nada.
 *
 * `aliases` são as grafias que já apareceram nos dados reais. Ao encontrar uma
 * grafia nova, adicione aqui — é o único lugar que precisa mudar.
 */
class CatalogoModelos
{
    /**
     * familia => [cilindradas conhecidas, aliases de texto, rótulo de exibição]
     */
    public const FAMILIAS = [
        'JET' => [
            'label'       => 'Jet',
            'cilindradas' => [50, 125],
            'aliases'     => ['JET', 'JET S', 'JET SS', 'JET SPEED', 'CICLOMOTOR JET'],
        ],
        'JEF' => [
            'label'       => 'Jef',
            'cilindradas' => [150],
            'aliases'     => ['JEF', 'JEF S', 'JEF150'],
        ],
        'SHI' => [
            'label'       => 'SHI',
            'cilindradas' => [170, 175, 250],
            'aliases'     => ['SHI', 'SHI RS', 'SHI SS'],
        ],
        'RIO' => [
            'label'       => 'Rio',
            'cilindradas' => [125],
            'aliases'     => ['RIO'],
        ],
        'URBAN' => [
            'label'       => 'Urban',
            'cilindradas' => [150],
            'aliases'     => ['URBAN'],
        ],
        'FREE' => [
            'label'       => 'Free',
            'cilindradas' => [150],
            'aliases'     => ['FREE'],
        ],
        'STORM' => [
            'label'       => 'Storm',
            'cilindradas' => [200],
            'aliases'     => ['STORM'],
        ],
        'FLASH' => [
            'label'       => 'Flash',
            'cilindradas' => [250],
            'aliases'     => ['FLASH', '250F'],
        ],
        'IRON' => [
            'label'       => 'Iron',
            'cilindradas' => [250],
            'aliases'     => ['IRON'],
        ],
        'TITANIUM' => [
            'label'       => 'Titanium',
            'cilindradas' => [250],
            'aliases'     => ['TITANIUM', 'TITANIO'],
        ],
        'DENVER' => [
            'label'       => 'Denver',
            'cilindradas' => [250],
            'aliases'     => ['DENVER'],
        ],
        'PHOENIX' => [
            'label'       => 'Phoenix',
            'cilindradas' => [50],
            'aliases'     => ['PHOENIX', 'CICLOMOTOR PHOENIX'],
        ],
        'SBM' => [
            'label'       => 'SBM',
            'cilindradas' => [150, 250, 400, 600],
            'aliases'     => ['SBM'],
        ],
        'ATV' => [
            'label'       => 'ATV / Quadriciclo',
            'cilindradas' => [200],
            'aliases'     => ['ATV', 'QUADRICICLO', 'QUADRICICLO ATV'],
        ],
        'PT' => [
            'label'       => 'Scooter PT',
            'cilindradas' => [],
            'aliases'     => ['PT1', 'PT2', 'PT3', 'PT4', 'PT2X', 'PT2 XS', 'PTXR', 'SCOOTER PT'],
        ],
        'SH' => [
            'label'       => 'Scooter SH',
            'cilindradas' => [],
            'aliases'     => ['SH3', 'SH-4', 'SH4', 'SCOOTER SH'],
        ],
        'WORKER' => [
            'label'       => 'Worker',
            'cilindradas' => [125],
            'aliases'     => ['WORKER'],
        ],
        'DRIFT' => [
            'label'       => 'Drift',
            'cilindradas' => [],
            'aliases'     => ['DRIFT'],
        ],
        'SOUZA' => [
            'label'       => 'Souza',
            'cilindradas' => [],
            'aliases'     => ['SOUZA', 'TRICICLO SOUZA', 'SOUZA CROSS'],
        ],
        'KART' => [
            'label'       => 'Kart Cross',
            'cilindradas' => [200],
            'aliases'     => ['KART', 'KART CROSS'],
        ],
        'SHE' => [
            'label'       => 'SHE',
            'cilindradas' => [3000],
            'aliases'     => ['SHE', 'SHE3000'],
        ],
    ];

    /** Variantes de alimentação. NULL significa "serve nas duas". */
    public const VARIANTES = ['EFI', 'CARB'];

    /**
     * Itens que não têm modelo por natureza: acessório, vestuário, consumível.
     *
     * Sem essa lista, ~600 capacetes, jaquetas e litros de óleo entrariam na
     * fila de "aplicação faltando" e a esconderiam sob ruído permanente.
     */
    public const PADROES_UNIVERSAIS = [
        // Vestuário e proteção
        'CAPACETE', 'CAP ', 'JAQUETA', 'LUVA', 'BOTA', 'VISEIRA', 'BALACLAVA',
        'CAPA CHUVA', 'CAPA DE CHUVA', 'COLETE', 'JOELHEIRA', 'COTOVELEIRA',
        // Lubrificantes e químicos
        'OLEO', 'ÓLEO', '20W50', '10W40', '15W40', '4T', 'GRAXA', 'ADITIVO',
        'DESENGRIPANTE', 'NEUTRALIZADOR', 'LIMPA', 'SILICONE', 'FLUIDO',
        // Elétrica e consumíveis genéricos
        'BATERIA', 'FUSIVEL', 'FUSÍVEL', 'LAMPADA', 'LÂMPADA',
        // Serviços e diversos
        'MAO DE OBRA', 'MÃO DE OBRA', 'SERVICO', 'SERVIÇO', 'KIT REVISAO',
        'KIT REVISÃO', 'CADEADO', 'ALARME', 'BAU', 'BAÚ', 'BAGAGEIRO',
        'CARREGADOR', 'SUPORTE CELULAR', 'ANTIFURTO',
    ];

    /** Marcas que indicam consumível de terceiro (lubrificante, bateria). */
    public const MARCAS_UNIVERSAIS = ['CASTROL', 'PETRONAS', 'Q8', 'EXTRON', 'MOTUL', 'IPIRANGA'];

    /**
     * Resolve uma grafia livre para a chave de família.
     * Retorna null quando o texto não corresponde a nenhuma família conhecida.
     */
    public static function resolverFamilia(string $texto): ?string
    {
        $texto = mb_strtoupper(trim($texto), 'UTF-8');

        if ($texto === '') {
            return null;
        }

        // Alias mais longo primeiro: "JET SPEED" deve vencer "JET".
        $candidatos = [];

        foreach (self::FAMILIAS as $familia => $dados) {
            foreach ($dados['aliases'] as $alias) {
                if (preg_match('/\b' . preg_quote($alias, '/') . '\b/u', $texto)) {
                    $candidatos[$familia] = max(
                        $candidatos[$familia] ?? 0,
                        mb_strlen($alias)
                    );
                }
            }
        }

        if (empty($candidatos)) {
            return null;
        }

        arsort($candidatos);

        return array_key_first($candidatos);
    }

    public static function label(string $familia): string
    {
        return self::FAMILIAS[$familia]['label'] ?? $familia;
    }

    /** @return array<int, string> */
    public static function familias(): array
    {
        return array_keys(self::FAMILIAS);
    }
}
