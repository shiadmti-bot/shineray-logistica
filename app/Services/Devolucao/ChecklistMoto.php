<?php

namespace App\Services\Devolucao;

/**
 * O checklist de recebimento de moto, em código.
 *
 * Transcreve o formulário "Checklist de Recebimento de Moto CD ↔ Loja" que hoje
 * circula em papel. Fonte ÚNICA: o backend valida contra esta lista e o
 * frontend desenha o formulário a partir dela (DevolucaoController manda
 * `grupos()` como prop). Acrescentar um item é mudar uma linha aqui — não
 * duas, em dois idiomas, que é como o mapa de status ficou espalhado antes de
 * virar o statusMap.js da v3.
 *
 * DUAS ETAPAS, A MESMA LISTA
 * O papel tem duas colunas de marcação por item: ORIGEM (a loja, antes do
 * embarque) e DESTINO (o CD, no ato do recebimento). São as mesmas 31
 * perguntas, respondidas por gente diferente em momentos diferentes — por isso
 * uma lista só e duas colunas JSON em devolucao_itens, e não duas listas.
 *
 * POR QUE 'C' E 'NC' E NÃO BOOLEAN
 * Porque é o que está impresso na prancheta do conferente. Quem digita está
 * olhando para o papel; traduzir "conforme" para `true` no meio do caminho só
 * cria uma chance de inverter o sentido sem ninguém perceber.
 */
final class ChecklistMoto
{
    // --- Resposta de um item ---
    public const CONFORME     = 'C';
    public const NAO_CONFORME = 'NC';

    public const RESPOSTAS = [self::CONFORME, self::NAO_CONFORME];

    // --- Etapas de conferência ---
    public const ETAPA_ORIGEM  = 'origem';
    public const ETAPA_DESTINO = 'destino';

    public const ETAPAS = [self::ETAPA_ORIGEM, self::ETAPA_DESTINO];

    /**
     * Veredito da conferência — o rodapé do formulário.
     *
     * ressalva     -> segue, mas com divergência registrada
     * nao_conforme -> "Não conforme – retido": a moto para onde está
     */
    public const RESULTADO_CONFORME     = 'conforme';
    public const RESULTADO_RESSALVA     = 'ressalva';
    public const RESULTADO_NAO_CONFORME = 'nao_conforme';

    public const RESULTADOS = [
        self::RESULTADO_CONFORME,
        self::RESULTADO_RESSALVA,
        self::RESULTADO_NAO_CONFORME,
    ];

    /**
     * Os quatro blocos do formulário, na ordem impressa.
     *
     * A chave de cada item é o que vai para o JSON e nunca deve mudar — é ela
     * que liga uma conferência de hoje ao histórico de meses atrás. O rótulo
     * pode ser reescrito à vontade.
     */
    private const GRUPOS = [
        [
            'id'     => 'inspecao_visual',
            'titulo' => '1. Inspeção visual e avarias',
            'itens'  => [
                'pintura_carenagens' => 'Pintura e carenagens (riscos, amassados, trincas)',
                'tanque_combustivel' => 'Tanque de combustível (amassados, riscos, tampa)',
                'banco_alcas'        => 'Banco e alças (rasgos, fixação)',
                'retrovisores'       => 'Retrovisores (íntegros e firmes)',
                'piscas_lentes'      => 'Piscas e lentes dos faróis (sem rachaduras)',
                'escapamento'        => 'Escapamento (amassados ou ferrugem)',
                'manetes_pedais'     => 'Manetes e pedais (tortos ou quebrados)',
                'rodas_raios'        => 'Rodas e raios (empenos, riscos)',
                'adesivos_emblemas'  => 'Adesivos e emblemas (íntegros e corretos)',
            ],
        ],
        [
            'id'     => 'parte_eletrica',
            'titulo' => '2. Parte elétrica',
            'itens'  => [
                'farol_alto_baixo'    => 'Farol alto e baixo',
                'luz_freio'           => 'Luz de freio (dianteiro e traseiro)',
                'lanterna_luz_placa'  => 'Lanterna traseira e luz de placa',
                'piscas'              => 'Piscas (direito e esquerdo)',
                'painel_indicadores'  => 'Painel e indicadores',
                'buzina'              => 'Buzina',
                'partida_eletrica'    => 'Partida elétrica',
                'bateria'             => 'Bateria (fixação, terminais, carga)',
                'chave_ignicao_trava' => 'Chave de ignição e trava de direção',
            ],
        ],
        [
            'id'     => 'parte_mecanica',
            'titulo' => '3. Parte mecânica e segurança',
            'itens'  => [
                'pneus'                => 'Pneus (desgaste e calibragem)',
                'freios'               => 'Freios (funcionamento e nível do fluido)',
                'corrente_transmissao' => 'Corrente / transmissão (folga e lubrificação)',
                'nivel_oleo_motor'     => 'Nível do óleo do motor',
                'suspensao_dianteira'  => 'Suspensão dianteira (vazamento, empeno)',
                'suspensao_traseira'   => 'Suspensão traseira (vazamento, fixação)',
                'guidao_direcao'       => 'Guidão e direção (alinhamento e folga)',
                'cavalete'             => 'Cavalete lateral e central',
            ],
        ],
        [
            'id'     => 'acessorios_documentos',
            'titulo' => '4. Acessórios e documentos na moto',
            'itens'  => [
                'chave_reserva'            => 'Chave reserva',
                'manual_proprietario'      => 'Manual do proprietário',
                'kit_ferramentas'          => 'Kit de ferramentas',
                'nota_fiscal_documentacao' => 'Nota fiscal / documentação de origem',
                'outros'                   => 'Outros (descrever nas observações)',
            ],
        ],
    ];

    /** Os blocos como o frontend precisa: {id, titulo, itens:[{chave, rotulo}]}. */
    public static function grupos(): array
    {
        return array_map(fn (array $grupo) => [
            'id'     => $grupo['id'],
            'titulo' => $grupo['titulo'],
            'itens'  => array_map(
                fn ($chave, $rotulo) => ['chave' => $chave, 'rotulo' => $rotulo],
                array_keys($grupo['itens']),
                $grupo['itens']
            ),
        ], self::GRUPOS);
    }

    /** @return array<string, string> chave => rótulo, achatado. */
    public static function itens(): array
    {
        return array_merge(...array_column(self::GRUPOS, 'itens'));
    }

    /** @return array<int, string> */
    public static function chaves(): array
    {
        return array_keys(self::itens());
    }

    public static function rotulo(string $chave): string
    {
        return self::itens()[$chave] ?? $chave;
    }

    /**
     * Descarta chave desconhecida e resposta fora do domínio.
     *
     * O formulário chega do navegador: aceitar só o que está na lista impede
     * que um bundle antigo em cache, ou um POST montado à mão, grave lixo no
     * JSON que ninguém mais consegue interpretar meses depois.
     *
     * @param  array<string, mixed>  $respostas
     * @return array<string, string>
     */
    public static function normalizar(array $respostas): array
    {
        $validas = self::itens();
        $limpo   = [];

        foreach ($respostas as $chave => $valor) {
            if (! isset($validas[$chave])) {
                continue;
            }

            $valor = mb_strtoupper(trim((string) $valor));

            if (in_array($valor, self::RESPOSTAS, true)) {
                $limpo[$chave] = $valor;
            }
        }

        return $limpo;
    }

    /**
     * Itens ainda sem marcação.
     *
     * Um checklist só vale assinado inteiro: meia conferência não distingue
     * "está bom" de "ninguém olhou".
     *
     * @param  array<string, string>  $respostas
     * @return array<int, string> rótulos pendentes
     */
    public static function faltantes(array $respostas): array
    {
        return array_values(array_diff_key(self::itens(), self::normalizar($respostas)));
    }

    /**
     * O que veio marcado como NC — a lista que obriga descrição e foto.
     *
     * @param  array<string, string>  $respostas
     * @return array<string, string> chave => rótulo
     */
    public static function naoConformes(array $respostas): array
    {
        $nc = array_filter(
            self::normalizar($respostas),
            fn (string $valor) => $valor === self::NAO_CONFORME
        );

        return array_intersect_key(self::itens(), $nc);
    }

    /**
     * Veredito coerente com as marcações.
     *
     * Sem NC não existe "não conforme"; com NC não existe "conforme". O papel
     * deixa isso para o bom senso de quem preenche — aqui é regra, porque é
     * exatamente essa incoerência que torna um checklist arquivado inútil na
     * hora de decidir quem paga a avaria.
     */
    public static function resultadoCompativel(string $resultado, array $respostas): bool
    {
        $temNaoConformidade = self::naoConformes($respostas) !== [];

        return $temNaoConformidade
            ? $resultado !== self::RESULTADO_CONFORME
            : $resultado === self::RESULTADO_CONFORME;
    }
}
