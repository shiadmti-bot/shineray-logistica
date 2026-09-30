<?php

namespace App\Services;

use App\Exceptions\ComprovanteNaoArmazenadoException;
use Illuminate\Http\File;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Guarda a foto (ou PDF) de um comprovante e devolve a URL para abri-lo.
 *
 * Comprime antes de gravar porque a origem é sempre a câmera de um celular no
 * galpão: uma foto de romaneio sai com 4 ou 5 MB e nada nela precisa de mais
 * que 1280px de largura para ser lida.
 *
 * PONTO ÚNICO DE UPLOAD
 * Recebimento de motos, conferência de basqueta e anexos de devolução passam
 * todos por aqui. O destino é a árvore de backup da filial no Google Drive —
 * ver GoogleDriveComprovantes.
 *
 * SEM DRIVE, SÓ GRAVA LOCAL ONDE O DISCO É DE VERDADE
 * Na Vercel o storage é /tmp: some no próximo cold start e nem é servido em
 * /storage. O fallback local ali devolvia um link quebrado com cara de
 * sucesso — a evidência sumia e ninguém ficava sabendo. Com
 * `filesystems.comprovantes.fallback_local` desligado (padrão na Vercel), a
 * falha vira erro na tela e a operação não é registrada sem comprovante.
 */
class ArquivoComprovante
{
    private const LARGURA_MAXIMA = 1280;
    private const QUALIDADE_JPEG = 80;
    private const IMAGENS = ['jpg', 'jpeg', 'png', 'webp'];

    public function __construct(private GoogleDriveComprovantes $drive)
    {
    }

    /**
     * @param  string       $pasta          subpasta no disco `public` (fallback local)
     * @param  string       $nomeBase       prefixo do nome do arquivo
     * @param  string|null  $filial         `users.filial` da loja — nomeia a pasta no Drive
     * @param  string       $subpastaDrive  uma das GoogleDriveComprovantes::PASTA_*
     * @return string  link do Drive (webViewLink) ou URL pública local
     *
     * @throws ComprovanteNaoArmazenadoException  quando não há onde gravar de forma durável
     */
    public function guardar(
        UploadedFile $arquivo,
        string $pasta,
        string $nomeBase,
        ?string $filial = null,
        string $subpastaDrive = GoogleDriveComprovantes::PASTA_COMPROVANTES,
    ): string {
        $extensao   = strtolower($arquivo->getClientOriginalExtension());
        $comprimido = in_array($extensao, self::IMAGENS, true) ? $this->comprimir($arquivo, $nomeBase) : null;

        // PDF, HEIC ou falha na compressão: segue o arquivo como veio.
        $caminho = $comprimido ?? $arquivo->getRealPath();
        $sufixo  = $comprimido ? 'jpg' : $extensao;
        $nome    = "{$nomeBase}_" . time() . ($sufixo ? ".{$sufixo}" : '');
        $mime    = $comprimido ? 'image/jpeg' : ($arquivo->getClientMimeType() ?: 'application/octet-stream');

        try {
            if ($this->drive->configurado()) {
                try {
                    return $this->drive->enviar($caminho, $nome, $mime, $filial, $subpastaDrive);
                } catch (\Throwable $e) {
                    Log::error('Falha ao enviar comprovante ao Google Drive', [
                        'arquivo'  => $nome,
                        'filial'   => $filial,
                        'subpasta' => $subpastaDrive,
                        'erro'     => $e->getMessage(),
                    ]);
                }
            }

            $gravado = config('filesystems.comprovantes.fallback_local')
                ? Storage::disk('public')->putFileAs($pasta, new File($caminho), $nome)
                : false;

            if (! $gravado) {
                throw new ComprovanteNaoArmazenadoException(
                    'Não foi possível salvar o arquivo no Google Drive agora. Nada foi registrado — tente novamente em instantes.'
                );
            }

            return asset("storage/{$gravado}");
        } finally {
            if ($comprimido) {
                @unlink($comprimido);
            }
        }
    }

    /**
     * @return string|null  caminho temporário do JPEG, ou null se falhar
     */
    private function comprimir(UploadedFile $arquivo, string $nomeBase): ?string
    {
        try {
            $manager = new \Intervention\Image\ImageManager(
                new \Intervention\Image\Drivers\Gd\Driver()
            );

            $destino = sys_get_temp_dir() . '/' . $nomeBase . '_' . uniqid() . '.jpg';

            $manager->read($arquivo)
                ->scaleDown(width: self::LARGURA_MAXIMA)
                ->toJpeg(self::QUALIDADE_JPEG)
                ->save($destino);

            return file_exists($destino) ? $destino : null;
        } catch (\Throwable $e) {
            // Comprimir é otimização, não requisito: sem isso a foto original
            // ainda serve como evidência.
            Log::warning('Falha ao comprimir comprovante', ['erro' => $e->getMessage()]);

            return null;
        }
    }
}
