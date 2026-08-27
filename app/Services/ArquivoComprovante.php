<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Guarda uma foto de comprovante e devolve a URL pública.
 *
 * Comprime antes de gravar porque a origem é sempre a câmera de um celular no
 * galpão: uma foto de romaneio sai com 4 ou 5 MB e nada nela precisa de mais
 * que 1280px de largura para ser lida.
 *
 * ESCOPO
 * Grava no disco `public`. O upload para o Google Drive que existe no fluxo de
 * moto (PedidoController::tratarUpload) depende de um serviço autenticado
 * montado lá — não foi trazido para cá para não acoplar a conferência de peça
 * a essa configuração. Se o Drive virar requisito também aqui, este é o ponto
 * único onde acrescentar.
 */
class ArquivoComprovante
{
    private const LARGURA_MAXIMA = 1280;
    private const QUALIDADE_JPEG = 80;

    /**
     * @param  string  $pasta  subpasta dentro do disco public
     * @return string  URL pública do arquivo gravado
     */
    public function guardar(UploadedFile $arquivo, string $pasta, string $nomeBase): string
    {
        $extensao = strtolower($arquivo->getClientOriginalExtension());

        if (in_array($extensao, ['jpg', 'jpeg', 'png', 'webp'], true)) {
            $comprimido = $this->comprimir($arquivo, $nomeBase);

            if ($comprimido) {
                $caminho = "{$pasta}/" . basename($comprimido);
                Storage::disk('public')->put($caminho, file_get_contents($comprimido));
                @unlink($comprimido);

                return asset("storage/{$caminho}");
            }
        }

        // PDF, HEIC ou falha na compressão: grava como veio.
        $nome = "{$nomeBase}_" . time() . ($extensao ? ".{$extensao}" : '');
        $caminho = $arquivo->storeAs($pasta, $nome, 'public');

        return asset("storage/{$caminho}");
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
