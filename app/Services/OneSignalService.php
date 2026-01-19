<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OneSignalService
{
    protected $appId;
    protected $apiKey;

    public function __construct()
    {
        // Pega as chaves do .env
        $this->appId = config('services.onesignal.app_id');
        $this->apiKey = config('services.onesignal.rest_api_key');
    }

    /**
     * Envia notificação para usuários específicos (pelo ID do OneSignal)
     */
    public function sendToUser(array $playerIds, string $titulo, string $mensagem, $url = null)
    {
        // Remove IDs vazios/nulos
        $playerIds = array_filter($playerIds);

        if (empty($playerIds)) {
            return;
        }

        $fields = [
            'app_id' => $this->appId,
            'include_player_ids' => array_values($playerIds),
            'headings' => ['en' => $titulo], // O padrão é 'en', mas aceita o texto em PT
            'contents' => ['en' => $mensagem],
        ];

        // Se tiver link para abrir
        if ($url) {
            $fields['url'] = $url;
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Basic ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])->post('https://onesignal.com/api/v1/notifications', $fields);

            if ($response->failed()) {
                Log::error('Erro OneSignal: ' . $response->body());
            }
        } catch (\Exception $e) {
            Log::error('Exceção OneSignal: ' . $e->getMessage());
        }
    }
}