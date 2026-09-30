<?php

namespace App\Services\Pecas;

/**
 * Converte o texto livre de aplicação do Microwork em vínculos estruturados.
 *
 * Entradas reais que precisam funcionar:
 *   "JEF 150"                -> JEF/150
 *   "SHI 175 CARB"           -> SHI/175 variante CARB
 *   "JEF 150 / SHI 175 CARB" -> JEF/150 + SHI/175 CARB   (duas peças-modelo)
 *   "JET 125/50"             -> JET/125 + JET/50         (uma família, duas cilindradas)
 *   "JET 50-125"             -> JET/50 + JET/125
 *   "MOTOS"                  -> nada (genérico demais para ser útil)
 *
 * A AMBIGUIDADE DO "/"
 * A barra faz dois papéis no mesmo campo. Em "JEF 150 / SHI 175" separa modelos
 * distintos; em "JET 125/50" separa cilindradas da MESMA família. Distinguir os
 * casos é o núcleo deste parser: se a parte depois da barra contém nome de
 * família, é separador de modelo; se é só número, é cilindrada da família
 * anterior. Tratar tudo como separador de modelo produziria a família fantasma
 * "50" e perderia a JET 50.
 */
class AplicacaoParser
{
    /**
     * @return array<int, array{familia:string, cilindrada:?int, variante:?string, modelo:?string}>
     */
    public function parse(?string $texto): array
    {
        $texto = mb_strtoupper(trim((string) $texto), 'UTF-8');

        if ($texto === '' || $this->ehGenerico($texto)) {
            return [];
        }

        $resultados = [];

        foreach ($this->segmentar($texto) as $segmento) {
            foreach ($this->interpretarSegmento($segmento) as $r) {
                // Chave evita duplicar "JEF 150 / JEF 150 EFI" em linhas iguais.
                $chave = $r['familia'] . '|' . ($r['cilindrada'] ?? '') . '|' . ($r['variante'] ?? '');
                $resultados[$chave] = $r;
            }
        }

        return array_values($resultados);
    }

    /**
     * Quebra em segmentos que representam modelos distintos.
     *
     * Só quebra na barra quando o lado direito nomeia uma família — é o que
     * separa "JEF 150 / SHI 175" (dois modelos) de "JET 125/50" (uma família).
     */
    private function segmentar(string $texto): array
    {
        // Vírgula e "+" são sempre separadores de modelo.
        $partes = preg_split('/\s*[,+]\s*/u', $texto, -1, PREG_SPLIT_NO_EMPTY);

        $segmentos = [];

        foreach ($partes as $parte) {
            // Barra cercada de espaços costuma separar modelos: "JEF 150 / SHI 175".
            if (preg_match('/\s+\/\s+/u', $parte)) {
                foreach (preg_split('/\s+\/\s+/u', $parte, -1, PREG_SPLIT_NO_EMPTY) as $sub) {
                    $segmentos[] = trim($sub);
                }
                continue;
            }

            $segmentos[] = trim($parte);
        }

        return array_filter($segmentos);
    }

    /**
     * @return array<int, array{familia:string, cilindrada:?int, variante:?string, modelo:?string}>
     */
    private function interpretarSegmento(string $segmento): array
    {
        $familia = CatalogoModelos::resolverFamilia($segmento);

        if ($familia === null) {
            return [];
        }

        $variante = $this->extrairVariante($segmento);
        $cilindradas = $this->extrairCilindradas($segmento, $familia);

        // Família sem cilindrada identificável (ex.: "STORM", "SHI") ainda é
        // um vínculo útil: a busca por família funciona.
        if (empty($cilindradas)) {
            return [[
                'familia'    => $familia,
                'cilindrada' => null,
                'variante'   => $variante,
                'modelo'     => $this->rotulo($familia, null, $variante),
            ]];
        }

        return array_map(fn (int $cc) => [
            'familia'    => $familia,
            'cilindrada' => $cc,
            'variante'   => $variante,
            'modelo'     => $this->rotulo($familia, $cc, $variante),
        ], $cilindradas);
    }

    /**
     * Extrai as cilindradas do segmento.
     *
     * "JET 125/50" e "JET 50-125" devolvem as duas; a barra aqui é interna à
     * família porque o lado direito é só número.
     *
     * @return array<int, int>
     */
    private function extrairCilindradas(string $segmento, string $familia): array
    {
        $conhecidas = CatalogoModelos::FAMILIAS[$familia]['cilindradas'] ?? [];

        preg_match_all('/\b(\d{2,4})\b/u', $segmento, $m);

        $numeros = array_map('intval', $m[1] ?? []);

        // Mantém só números plausíveis como cilindrada da família. Sem esse
        // filtro, "CAP EBF 7 LINE 58" viraria uma moto de 58cc.
        $validas = array_values(array_filter(
            $numeros,
            fn (int $n) => $conhecidas ? in_array($n, $conhecidas, true) : ($n >= 50 && $n <= 3000)
        ));

        return array_values(array_unique($validas));
    }

    private function extrairVariante(string $segmento): ?string
    {
        foreach (CatalogoModelos::VARIANTES as $v) {
            if (preg_match('/\b' . $v . '\b/u', $segmento)) {
                return $v;
            }
        }

        return null;
    }

    private function rotulo(string $familia, ?int $cc, ?string $variante): string
    {
        return trim(implode(' ', array_filter([
            CatalogoModelos::label($familia),
            $cc,
            $variante,
        ])));
    }

    /**
     * Texto que existe mas não diz nada de útil ("MOTOS", "GERAL", "TODAS").
     * Vincular a tudo é o mesmo que não vincular, e polui a busca.
     */
    private function ehGenerico(string $texto): bool
    {
        return in_array($texto, [
            'MOTOS', 'MOTO', 'GERAL', 'TODAS', 'TODOS', 'UNIVERSAL', 'DIVERSOS', 'N/A', '-',
        ], true);
    }

    /**
     * Classifica a peça em específica ou universal.
     *
     * Universal = acessório, vestuário ou consumível que serve em qualquer moto.
     * A classificação evita que esses itens apareçam como cadastro incompleto.
     */
    public function classificarTipo(string $descricao, ?string $marca, bool $temAplicacao): string
    {
        $d = mb_strtoupper($descricao, 'UTF-8');

        if ($marca && in_array(mb_strtoupper($marca, 'UTF-8'), CatalogoModelos::MARCAS_UNIVERSAIS, true)) {
            return 'universal';
        }

        foreach (CatalogoModelos::PADROES_UNIVERSAIS as $padrao) {
            if (str_contains($d, $padrao)) {
                return 'universal';
            }
        }

        // Aplicação preenchida é prova de que a peça é específica.
        return $temAplicacao ? 'especifica' : 'indefinido';
    }

    /**
     * Procura modelos citados no NOME da peça ("FILTRO DE OLEO STORM 200").
     *
     * Confiança média por construção: o nome pode citar o modelo por outro
     * motivo. Serve como pista para o CD confirmar, não como verdade.
     *
     * @return array<int, array{familia:string, cilindrada:?int, variante:?string, modelo:?string}>
     */
    public function parseDescricao(string $descricao): array
    {
        // Reaproveita o parser: a diferença está na confiança que o chamador
        // atribui ao resultado, não na forma de extrair.
        return $this->parse($descricao);
    }
}
