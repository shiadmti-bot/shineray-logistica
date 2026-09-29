<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Todo passo do tour aponta para um elemento que existe de verdade no front.
 *
 * POR QUE ISTO É UM TESTE. Um passo com seletor quebrado não dá erro: o motor
 * mostra o cartão no centro da tela e a pessoa lê "clique no botão X" sem que
 * botão nenhum seja destacado. É o mesmo formato de falha silenciosa que a
 * vistoria encontrou em toda parte deste sistema — a tela continua plausível e
 * a informação simplesmente não está lá.
 *
 * Renomear ou remover um botão sem mexer no tour passa a quebrar aqui, na hora,
 * em vez de virar uma ajuda que aponta para o vazio.
 *
 * É o mesmo raciocínio de StatusPedidoTest, que exige que todo status do enum
 * exista no dicionário visual do front.
 */
class TourAncorasTest extends TestCase
{
    private const REGISTRO = 'resources/js/Components/Tour/passos.js';

    /** Onde procurar os `data-tour`. */
    private const FRONT = 'resources/js';

    public function test_todo_alvo_do_tour_existe_no_front()
    {
        $ancorasUsadas = $this->alvosDoRegistro();

        $this->assertNotEmpty($ancorasUsadas, 'o registro de passos não pode ficar vazio');

        $ancorasDeclaradas = $this->ancorasNoFront();

        $orfas = array_values(array_diff($ancorasUsadas, $ancorasDeclaradas));

        $this->assertSame([], $orfas, sprintf(
            "Passo(s) do tour apontando para âncora que não existe em nenhum arquivo do front:\n  %s\n".
            "Ponha `data-tour=\"<nome>\"` no elemento, ou remova o passo.",
            implode("\n  ", $orfas),
        ));
    }

    /**
     * O contrário também vale: âncora posta numa tela e esquecida é peso morto
     * — alguém a lê como "tem tour aqui" e não tem.
     *
     * A barra de navegação é a exceção: `AppLayout` gera `data-tour={item.key}`
     * a partir do menu, e esses nomes são consumidos pelo tour de boas-vindas
     * (GuidedTour.jsx), que ainda tem os passos dele embutidos.
     */
    public function test_nao_existe_ancora_declarada_sem_passo_correspondente()
    {
        $navegacao = [
            'brand', 'dashboard', 'calendario', 'motos', 'pecas',
            'logistica', 'gestao', 'notificacoes', 'manual', 'perfil',
        ];

        $naoUsadas = array_values(array_diff(
            $this->ancorasNoFront(),
            $this->alvosDoRegistro(),
            $navegacao,
        ));

        $this->assertSame([], $naoUsadas, sprintf(
            "Âncora(s) `data-tour` sem passo que as use:\n  %s\n".
            "Escreva o passo em %s ou apague a âncora.",
            implode("\n  ", $naoUsadas),
            self::REGISTRO,
        ));
    }

    /** Um passo sem texto não ajuda ninguém — e é fácil deixar pela metade. */
    public function test_todo_passo_tem_titulo_e_descricao()
    {
        $registro = $this->conteudoDoRegistro();

        $titulos = preg_match_all("/^\s*titulo:\s*'/m", $registro);
        $descricoes = preg_match_all('/^\s*descricao:/m', $registro);

        $this->assertGreaterThan(0, $titulos);

        // Cada tour tem um `titulo`/`descricao` de módulo além dos de passo, e as
        // duas contagens andam juntas: se divergirem, algum passo ficou sem texto.
        $this->assertSame(
            $titulos,
            $descricoes,
            'há passo (ou módulo) com título e sem descrição, ou o contrário',
        );
    }

    // ------------------------------------------------------------------
    // LEITURA DOS ARQUIVOS
    // ------------------------------------------------------------------

    /** @return list<string> nomes usados em `alvo: '[data-tour="..."]'` */
    private function alvosDoRegistro(): array
    {
        preg_match_all(
            '/alvo:\s*\'\[data-tour="([^"]+)"\]\'/',
            $this->conteudoDoRegistro(),
            $m,
        );

        return array_values(array_unique($m[1] ?? []));
    }

    /**
     * Nomes declarados como `data-tour="..."` em qualquer .jsx, exceto o próprio
     * registro (onde eles aparecem como seletor, não como âncora).
     *
     * Também aceita a forma condicional `data-tour={cond ? 'nome' : undefined}`,
     * usada nas telas que repetem o mesmo campo por item da lista.
     *
     * @return list<string>
     */
    private function ancorasNoFront(): array
    {
        $nomes = [];

        $arquivos = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator(base_path(self::FRONT))
        );

        foreach ($arquivos as $arquivo) {
            if ($arquivo->getExtension() !== 'jsx') {
                continue;
            }

            $caminho = str_replace('\\', '/', $arquivo->getPathname());

            if (str_contains($caminho, 'Components/Tour/')) {
                continue;
            }

            $conteudo = (string) file_get_contents($arquivo->getPathname());

            preg_match_all('/data-tour="([^"{]+)"/', $conteudo, $diretas);

            // `[^}\n]` — sem atravessar linha. Com `[^}]*` o quantificador
            // engolia o arquivo até a próxima chave e capturava qualquer string
            // que aparecesse no caminho.
            preg_match_all('/data-tour=\{[^}\n]*?\'([^\']+)\'/', $conteudo, $condicionais);

            $nomes = [...$nomes, ...($diretas[1] ?? []), ...($condicionais[1] ?? [])];
        }

        return array_values(array_unique($nomes));
    }

    private function conteudoDoRegistro(): string
    {
        $caminho = base_path(self::REGISTRO);

        $this->assertFileExists($caminho);

        return (string) file_get_contents($caminho);
    }
}
