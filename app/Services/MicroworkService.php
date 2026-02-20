<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class MicroworkService
{
    private $baseUrl = 'https://microworkcloud.com.br/api/integracao/terceiro';
    private $token;

    public function __construct()
    {
        $this->token = config('services.microwork.token', env('MICROWORK_TOKEN'));
        
        // Fallback: Se o php artisan serve não recarregou o .env, lemos na marra
        if (!$this->token && file_exists(base_path('.env'))) {
            $envContent = file_get_contents(base_path('.env'));
            if (preg_match('/^MICROWORK_TOKEN=(.*)$/m', $envContent, $matches)) {
                $this->token = trim(trim($matches[1], '"\''));
            }
        }
    }

    /**
     * Consulta o estoque do CD (Pátios específicos)
     */
    public function getEstoqueCD()
    {
        // Retorna apenas os dados em cache (Carregados previamente pelo Cron Job)
        // Isso evita que a requisição do usuário seja penalizada com a latência da API externa
        // e culmine no Vercel (Timeout)
        return Cache::get('estoque_cd_microwork', []);
    }

    /**
     * Sincroniza o estoque com a API da MicroworkCloud e salva no cache local
     * Recomendado rodar via console/background job a cada 10 ou 15 min.
     */
    public function syncEstoqueFromApi()
    {
        Log::info('MicroworkService: Sincronizando estoque a partir da API...');
        
        $data = $this->fetchFromApi();
        
        if (empty($data)) {
            Log::warning('MicroworkService: A API retornou vazio ou erro, abortando atualização do cache para não sobrescrever dados válidos.');
            return false;
        }

        $filteredData = $this->filterPatios($data);
        
        // Salvar por longo período, confiando que o Job rodará frequentemente para mantê-lo atualizado
        Cache::put('estoque_cd_microwork', $filteredData, now()->addHours(24));
        
        Log::info('MicroworkService: Sincronização armazenada em cache com sucesso. Itens filtrados: ' . count($filteredData));
        return true;
    }

    private function filterPatios($data)
    {
        // Pátios que queremos filtrar baseados rigorosamente na imagem do Microwork.
        // Usamos substrings chave garantidas para evitar qualquer problema de charset (UTF-8, ISO, etc).
        $patiosDesejados = [
            'AVARIA CD', 
            'CD EXPEDI', 
            'DESMONTADA CD', 
            'GALPÃO MOTOS', 
            'INATIVADA GALP'
        ];

        return array_values(array_filter($data, function ($item) use ($patiosDesejados) {
            if (!isset($item['patio']) || empty($item['patio'])) {
                return false;
            }
            
            $patioNome = mb_strtoupper(trim($item['patio']), 'UTF-8');
            
            foreach ($patiosDesejados as $desejado) {
                if (mb_strpos($patioNome, mb_strtoupper($desejado, 'UTF-8'), 0, 'UTF-8') !== false) {
                    return true;
                }
            }
            return false;
        }));
    }

    private function fetchFromApi()
    {
        if (!$this->token) {
            Log::error('MICROWORK_TOKEN não configurado no .env');
            return [];
        }

        // Não enviamos filtro de Pátio para a API pois ela não retorna por ID corretamente neste endpoint.
        // Filtramos no PHP acima.
        $filtros = "Situacao=2,3,30,14,13,17,29,8,27,12;" .
                   "EComProposta=False;" .
                   "ESemReserva=False;" .
                   "AnoInicial=0;" .
                   "EComReserva=False;" .
                   "Modelo=null;" .
                   "SomentePagarQuitado=False;" .
                   "TipoDoModelo=null;" .
                   "Estado=null;" .
                   // "Patio=...;" . // Filtro removido, tratado no PHP
                   "ESomenteEmMontagem=False;" .
                   "FabricacaoInicial=0;" .
                   "FabricacaoFinal=9999;" .
                   "ESemProposta=False;" .
                   "ESomenteComReservaOuComProposta=False;" .
                   "ESomenteMontada=False;" .
                   "AnoFinal=9999;" .
                   "CategoriaModelo=null";

        $payload = [
            "idrelatorioconfiguracao" => 47,
            "idrelatorioconsulta" => 11,
            "idrelatorioconfiguracaoleiaute" => 47,
            "idrelatoriousuarioleiaute" => 149,
            "ididioma" => 1,
            "listaempresas" => [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20], // Todas empresas para pegar estoque global do grupo? Ou filtrar? Mantendo padrão.
            "filtros" => $filtros
        ];

        try {
            $response = Http::withToken($this->token)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($this->baseUrl, $payload);

            if ($response->successful()) {
                return $response->json();
            } else {
                Log::error("Erro Microwork API: " . $response->status() . " - " . $response->body());
                return [];
            }
        } catch (\Exception $e) {
            Log::error("Exceção Microwork: " . $e->getMessage());
            return [];
        }
    }
}
