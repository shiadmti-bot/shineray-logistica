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
     * Chassis que existem no Microwork mas NÃO estão realmente livres:
     * já reservados localmente ou já vinculados a algum pedido/loja no nosso sistema.
     *
     * Regra extraída do EstoqueController para ser reaproveitada pela tela de
     * criação de pedidos e pela atribuição de chassis do CD.
     */
    public function getChassisIndisponiveis(): array
    {
        $reservas = \App\Models\ReservaMicrowork::whereIn('status', ['pendente', 'faturada'])
            ->pluck('chassi')
            ->toArray();

        $emAndamento = \App\Models\Moto::whereIn('status', [
                'solicitado', 'separado', 'aguardando_coleta', 'em_transito', 'expedido',
                'em_transito_cd', 'no_cd', 'estoque_loja', 'vendida', 'transito_loja',
                'reservado', 'avariado',
            ])
            ->whereNotNull('chassi')
            ->pluck('chassi')
            ->toArray();

        $todos = array_merge($reservas, $emAndamento);

        // Normaliza para comparação segura (o cache do Microwork vem com espaços/caixa variável)
        return array_values(array_unique(array_map(
            fn ($c) => mb_strtoupper(trim((string) $c), 'UTF-8'),
            $todos
        )));
    }

    /**
     * Normaliza um registro cru do cache (as chaves variam entre 'Modelo'/'modelo').
     */
    public function normalizarItem(array $item): array
    {
        return [
            'chassi' => mb_strtoupper(trim($item['Chassi'] ?? $item['chassi'] ?? ''), 'UTF-8'),
            'modelo' => mb_strtoupper(trim($item['Modelo'] ?? $item['modelo'] ?? ''), 'UTF-8'),
            'cor'    => mb_strtoupper(trim($item['Cor'] ?? $item['cor'] ?? ''), 'UTF-8'),
            'patio'  => mb_strtoupper(trim($item['patio'] ?? $item['Patio'] ?? ''), 'UTF-8'),
        ];
    }

    /**
     * Estoque do CD agregado por MODELO + COR, já descontando o que está reservado
     * ou em uso. Alimenta os dropdowns da tela de criação de pedidos.
     *
     * @param bool $somenteMontadas Lojas só enxergam o pátio de motos montadas (regra v2.5).
     * @return array<int, array{modelo:string, cor:string, disponivel:int}>
     */
    public function getEstoqueDisponivelAgregado(bool $somenteMontadas = true): array
    {
        $estoque = $this->getEstoqueCD();
        if (empty($estoque)) {
            return [];
        }

        $indisponiveis = array_flip($this->getChassisIndisponiveis());
        $agregado = [];

        foreach ($estoque as $bruto) {
            $item = $this->normalizarItem((array) $bruto);

            if ($item['modelo'] === '' || $item['chassi'] === '') {
                continue;
            }

            if ($somenteMontadas && mb_strpos($item['patio'], 'MOTOS MONTADAS') === false) {
                continue;
            }

            if (isset($indisponiveis[$item['chassi']])) {
                continue;
            }

            $cor = $item['cor'] !== '' ? $item['cor'] : 'NÃO INFORMADA';
            $chave = $item['modelo'] . '|' . $cor;

            if (!isset($agregado[$chave])) {
                $agregado[$chave] = ['modelo' => $item['modelo'], 'cor' => $cor, 'disponivel' => 0];
            }

            $agregado[$chave]['disponivel']++;
        }

        $lista = array_values($agregado);

        usort($lista, function ($a, $b) {
            return [$a['modelo'], $a['cor']] <=> [$b['modelo'], $b['cor']];
        });

        return $lista;
    }

    /**
     * Dados de um chassi específico no cache do Microwork.
     * Usado na atribuição do CD para descobrir modelo/cor de um chassi bipado.
     *
     * @return array{chassi:string, modelo:string, cor:string, patio:string}|null
     */
    public function getInfoChassi(string $chassi): ?array
    {
        $alvo = mb_strtoupper(trim($chassi), 'UTF-8');
        if ($alvo === '') {
            return null;
        }

        foreach ($this->getEstoqueCD() as $bruto) {
            $item = $this->normalizarItem((array) $bruto);
            if ($item['chassi'] === $alvo) {
                return $item;
            }
        }

        return null;
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
