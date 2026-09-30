<?php

namespace App\Services;

use Google\Client as GoogleClient;
use Google\Service\Drive as GoogleDrive;
use Google\Service\Drive\DriveFile;
use Google\Service\Drive\Permission;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

/**
 * Árvore de backup dos comprovantes no Google Drive.
 *
 * A ESTRUTURA É CONTRATO, NÃO DETALHE
 * Está em uso desde a v2 e é por ela que a equipe procura um canhoto:
 *
 *     {pasta raiz} / Filial - {users.filial} / {ano} / {mês por extenso} / {subpasta}
 *
 * Subpastas: Comprovantes e Avarias (motos, desde a v2) e Peças (romaneio da
 * basqueta conferido pela filial). Nome da filial, ano e mês precisam sair
 * idênticos aos que já existem — qualquer variação abre uma árvore paralela e
 * parte o histórico da filial em dois lugares.
 *
 * POR QUE ESTA CLASSE EXISTE
 * A montagem da árvore vivia duplicada em PedidoController e em
 * ArquivoComprovante, e as duas cacheavam sob a MESMA chave valores de tipos
 * diferentes: array num, string no outro. Quem gravava primeiro quebrava o
 * outro — o recebimento de motos passava a lançar TypeError, ou a foto da
 * basqueta ia parar no disco local. Aqui a chave inclui a subpasta e o valor é
 * sempre o id de uma única pasta.
 */
class GoogleDriveComprovantes
{
    public const PASTA_COMPROVANTES = 'Comprovantes';
    public const PASTA_AVARIAS      = 'Avarias';
    public const PASTA_PECAS        = 'Peças';

    private const MESES = [
        1 => 'Janeiro',  2 => 'Fevereiro', 3 => 'Março',     4 => 'Abril',
        5 => 'Maio',     6 => 'Junho',     7 => 'Julho',     8 => 'Agosto',
        9 => 'Setembro', 10 => 'Outubro',  11 => 'Novembro', 12 => 'Dezembro',
    ];

    /** O id da pasta do mês não muda; o cache só evita buscá-lo a cada foto. */
    private const CACHE_SEGUNDOS = 3600;

    /**
     * @param  GoogleDrive|null  $drive  injetado nos testes; em produção o
     *                                   cliente é montado sob demanda a partir
     *                                   de services.google
     */
    public function __construct(private ?GoogleDrive $drive = null)
    {
    }

    public function configurado(): bool
    {
        return $this->drive !== null || filled(config('services.google.refresh_token'));
    }

    /**
     * Envia o arquivo para a subpasta do mês da filial e devolve o link.
     *
     * Lança em qualquer falha: decidir o que fazer sem o Drive é de quem chama.
     */
    public function enviar(string $caminho, string $nomeArquivo, string $mimeType, ?string $filial, string $subpasta): string
    {
        $drive = $this->drive();

        $arquivo = $drive->files->create(new DriveFile([
            'name'    => $nomeArquivo,
            'parents' => [$this->pastaDoMes($drive, $filial, $subpasta)],
        ]), [
            'data'       => file_get_contents($caminho),
            'mimeType'   => $mimeType,
            'uploadType' => 'multipart',
            'fields'     => 'id, webViewLink',
        ]);

        // Mesmo acesso que os comprovantes de moto sempre tiveram: quem tem o
        // link abre. Falhar aqui não invalida o upload — a pasta pai pode já
        // estar compartilhada.
        try {
            $drive->permissions->create($arquivo->id, new Permission([
                'role' => 'reader',
                'type' => 'anyone',
            ]));
        } catch (\Throwable) {
        }

        return $arquivo->webViewLink;
    }

    /** Nome da pasta da filial, exatamente como o fluxo de motos sempre gravou. */
    public static function nomePastaFilial(?string $filial): string
    {
        return 'Filial - ' . (filled($filial) ? $filial : 'Matriz');
    }

    private function pastaDoMes(GoogleDrive $drive, ?string $filial, string $subpasta): string
    {
        $agora       = now();
        $pastaFilial = self::nomePastaFilial($filial);
        $chave       = 'drive_pasta:' . sha1("{$pastaFilial}|{$agora->format('Y-m')}|{$subpasta}");

        return Cache::remember($chave, self::CACHE_SEGUNDOS, function () use ($drive, $pastaFilial, $subpasta, $agora) {
            $id = $this->buscarOuCriarPasta($drive, $pastaFilial, config('services.google.folder_id') ?: 'root');
            $id = $this->buscarOuCriarPasta($drive, $agora->format('Y'), $id);
            $id = $this->buscarOuCriarPasta($drive, self::MESES[$agora->month], $id);

            return $this->buscarOuCriarPasta($drive, $subpasta, $id);
        });
    }

    private function buscarOuCriarPasta(GoogleDrive $drive, string $nome, string $paiId): string
    {
        // Apóstrofo no nome da filial fechava a string da consulta: a API
        // recusava e a foto caía, calada, no fallback.
        $nomeNaConsulta = str_replace(['\\', "'"], ['\\\\', "\\'"], $nome);

        $existentes = $drive->files->listFiles([
            'q' => "mimeType='application/vnd.google-apps.folder' and name='{$nomeNaConsulta}' and '{$paiId}' in parents and trashed=false",
        ])->getFiles();

        if (count($existentes) > 0) {
            return $existentes[0]->id;
        }

        return $drive->files->create(new DriveFile([
            'name'     => $nome,
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents'  => [$paiId],
        ]), ['fields' => 'id'])->id;
    }

    private function drive(): GoogleDrive
    {
        if ($this->drive) {
            return $this->drive;
        }

        $cliente = new GoogleClient();
        $cliente->setClientId(config('services.google.client_id'));
        $cliente->setClientSecret(config('services.google.client_secret'));

        $token = $cliente->fetchAccessTokenWithRefreshToken(config('services.google.refresh_token'));

        if (isset($token['error'])) {
            throw new RuntimeException('Google Drive recusou o refresh token: ' . ($token['error_description'] ?? $token['error']));
        }

        // Memoizado, e a classe é `scoped` no container: um recebimento com
        // três avarias faz quatro uploads e renova o token uma vez só.
        return $this->drive = new GoogleDrive($cliente);
    }
}
