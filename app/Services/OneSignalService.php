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
        $this->appId = config('services.onesignal.app_id');
        $this->apiKey = config('services.onesignal.rest_api_key');
    }

    /**
     * Envia notificação Push para usuários específicos (pelo ID do OneSignal / Subscription ID / User ID)
     */
    public function sendToUser(array $playerIds, string $titulo, string $mensagem, $url = null)
    {
        // Remove IDs vazios/nulos
        $playerIds = array_values(array_unique(array_filter($playerIds)));

        if (empty($playerIds)) {
            return;
        }

        if (empty($this->appId) || empty($this->apiKey)) {
            Log::warning('OneSignal: Notificação não enviada porque ONESIGNAL_APP_ID ou ONESIGNAL_REST_API_KEY não estão configurados no .env');
            return;
        }

        $fields = [
            'app_id' => $this->appId,
            'include_player_ids' => $playerIds,
            'include_aliases' => [
                'onesignal_id' => $playerIds,
            ],
            'target_channel' => 'push',
            'headings' => [
                'en' => $titulo,
                'pt' => $titulo,
            ],
            'contents' => [
                'en' => $mensagem,
                'pt' => $mensagem,
            ],
        ];

        if ($url) {
            $fields['url'] = $url;
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Basic ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(5)->post('https://onesignal.com/api/v1/notifications', $fields);

            if ($response->failed()) {
                Log::error('Erro OneSignal Push: ' . $response->body());
            } else {
                Log::info('OneSignal Push enviado com sucesso para: ' . implode(', ', $playerIds));
            }
        } catch (\Exception $e) {
            Log::error('Exceção OneSignal Push: ' . $e->getMessage());
        }
    }
}