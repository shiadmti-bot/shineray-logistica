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
        $this->token = env('MICROWORK_TOKEN');
    }

    /**
     * Consulta o estoque do CD (Pátios específicos)
     */
    public function getEstoqueCD()
    {
        // Cache por 5 minutos
        return Cache::remember('estoque_cd_microwork', 300, function () {
            $data = $this->fetchFromApi();
            return $this->filterPatios($data);
        });
    }

    private function filterPatios($data)
    {
        // Nomes de Pátios mapeados que correspondem ao CD
        // Baseado na coleta de dados reais:
        // 50 -> CD EXPEDIÇÃO
        // 22 -> DESMONTADA CD
        // 6  -> INATIVADA GALPÃO
        // 7  -> GALPÃO MOTOS MONTADAS
        // 15 -> AVARIA CD (Assumindo este como o principal do CD)
        
        $patiosPermitidos = [
            'CD EXPEDIÇÃO', 
            'DESMONTADA CD', 
            'INATIVADA GALPÃO', 
            'GALPÃO MOTOS MONTADAS', 
            'AVARIA CD'
        ];

        return array_values(array_filter($data, function ($item) use ($patiosPermitidos) {
            // Verifica se o campo 'patio' existe e está na lista permitida
            return isset($item['patio']) && in_array(strtoupper(trim($item['patio'])), $patiosPermitidos);
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
