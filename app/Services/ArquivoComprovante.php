<?php

namespace App\Services;

use Google\Client as GoogleClient;
use Google\Service\Drive as GoogleDrive;
use Google\Service\Drive\DriveFile;
use Google\Service\Drive\Permission;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Guarda uma foto de comprovante e devolve a URL pública (Google Drive ou local).
 *
 * Comprime antes de gravar porque a origem é sempre a câmera de um celular no
 * galpão: uma foto de romaneio sai com 4 ou 5 MB e nada nela precisa de mais
 * que 1280px de largura para ser lida.
 *
 * Se o Google Drive estiver configurado, salva estruturado por Filial / Ano / Mês
 * e retorna a URL pública webViewLink. Caso contrário (ou em caso de falha),
 * realiza fallback seguro no storage local.
 */
class ArquivoComprovante
{
    private const LARGURA_MAXIMA = 1280;
    private const QUALIDADE_JPEG = 80;

    /**
     * @param  UploadedFile  $arquivo     Arquivo enviado no request
     * @param  string        $pasta       Subpasta dentro do disco public (ou subpasta no Drive)
     * @param  string        $nomeBase    Prefixo do nome do arquivo
     * @param  string|null   $filialNome  Nome da filial (ex: 'Castanhal') para organizar no Drive
     * @return string  URL pública do arquivo gravado (Google Drive webViewLink ou asset local)
     */
    public function guardar(UploadedFile $arquivo, string $pasta, string $nomeBase, ?string $filialNome = null): string
    {
        $extensao = strtolower($arquivo->getClientOriginalExtension());
        $ehImagem = in_array($extensao, ['jpg', 'jpeg', 'png', 'webp'], true);
        $caminhoComprimido = null;

        if ($ehImagem) {
            $caminhoComprimido = $this->comprimir($arquivo, $nomeBase);
        }

        $arquivoFinal = $caminhoComprimido && file_exists($caminhoComprimido)
            ? $caminhoComprimido
            : $arquivo;

        // 1. TENTATIVA DE UPLOAD NO GOOGLE DRIVE
        $driveUrl = $this->enviarParaGoogleDrive($arquivoFinal, $pasta, $nomeBase, $filialNome, $extensao);
        if ($driveUrl) {
            if ($caminhoComprimido && file_exists($caminhoComprimido)) {
                @unlink($caminhoComprimido);
            }
            return $driveUrl;
        }

        // 2. FALLBACK: DISCO LOCAL (PUBLIC)
        if ($caminhoComprimido && file_exists($caminhoComprimido)) {
            $caminho = "{$pasta}/" . basename($caminhoComprimido);
            Storage::disk('public')->put($caminho, file_get_contents($caminhoComprimido));
            @unlink($caminhoComprimido);

            return asset("storage/{$caminho}");
        }

        $nome = "{$nomeBase}_" . time() . ($extensao ? ".{$extensao}" : '');
        $caminho = $arquivo->storeAs($pasta, $nome, 'public');

        return asset("storage/{$caminho}");
    }

    /**
     * Envia o arquivo para a pasta correspondente no Google Drive.
     */
    private function enviarParaGoogleDrive(string|UploadedFile $arquivo, string $pasta, string $nomeBase, ?string $filialNome, string $extensaoOriginal): ?string
    {
        $refreshToken = config('services.google.refresh_token');
        if (! $refreshToken) {
            return null;
        }

        try {
            $client = new GoogleClient();
            $client->setClientId(config('services.google.client_id'));
            $client->setClientSecret(config('services.google.client_secret'));
            $client->refreshToken($refreshToken);

            $service = new GoogleDrive($client);

            $filialPasta = "Filial - " . ($filialNome ?: 'Matriz');

            // Cache estruturado por filial/ano/mês para evitar chamadas de API repetitivas
            $folderId = Cache::remember("drive_folders_{$filialPasta}_" . date('Ym'), 3600, function () use ($service, $filialPasta) {
                $root = config('services.google.folder_id') ?: 'root';

                $filialId = $this->findOrCreateFolder($service, $filialPasta, $root);
                $anoId    = $this->findOrCreateFolder($service, date('Y'), $filialId);

                $meses = [
                    '01' => 'Janeiro', '02' => 'Fevereiro', '03' => 'Março',
                    '04' => 'Abril',   '05' => 'Maio',      '06' => 'Junho',
                    '07' => 'Julho',   '08' => 'Agosto',    '09' => 'Setembro',
                    '10' => 'Outubro', '11' => 'Novembro',  '12' => 'Dezembro',
                ];
                $mesId = $this->findOrCreateFolder($service, $meses[date('m')] ?? date('m'), $anoId);

                return $this->findOrCreateFolder($service, 'Comprovantes', $mesId);
            });

            $realPath = is_string($arquivo) ? $arquivo : $arquivo->getRealPath();
            $mimeType = is_string($arquivo) ? (mime_content_type($arquivo) ?: 'image/jpeg') : $arquivo->getClientMimeType();
            $ext      = is_string($arquivo) ? 'jpg' : ($extensaoOriginal ?: 'jpg');
            $fileName = "{$nomeBase}_" . time() . ".{$ext}";

            $meta = new DriveFile([
                'name'    => $fileName,
                'parents' => [$folderId],
            ]);

            $uploaded = $service->files->create($meta, [
                'data'       => file_get_contents($realPath),
                'mimeType'   => $mimeType,
                'uploadType' => 'multipart',
                'fields'     => 'id, webViewLink',
            ]);

            try {
                $service->permissions->create($uploaded->id, new Permission([
                    'role' => 'reader',
                    'type' => 'anyone',
                ]));
            } catch (\Throwable $e) {
                // Permissão opcional se a pasta pai já for compartilhada
            }

            return $uploaded->webViewLink;
        } catch (\Throwable $e) {
            Log::warning('Falha no upload para o Google Drive no ArquivoComprovante', [
                'erro' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private function findOrCreateFolder(GoogleDrive $service, string $name, string $parentId): string
    {
        $q = "mimeType='application/vnd.google-apps.folder' and name='{$name}' and '{$parentId}' in parents and trashed=false";
        $files = $service->files->listFiles(['q' => $q]);

        if (count($files->getFiles()) > 0) {
            return $files->getFiles()[0]->id;
        }

        $folder = $service->files->create(new DriveFile([
            'name'     => $name,
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents'  => [$parentId],
        ]), ['fields' => 'id']);

        return $folder->id;
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

            $destino = sys_get_temp_dir() . '/' . $nomeBase . '_' . time() . '.jpg';

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
