<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class SyncMicroworkEstoque extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'microwork:sync-estoque';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Busca assincronamente o estoque da API MicroworkCloud e injeta no cache sem bloquear acessos da tela.';

    /**
     * Execute the console command.
     */
    public function handle(\App\Services\MicroworkService $service)
    {
        $this->info('Iniciando sincronização na API da Microwork...');
        $sucesso = $service->syncEstoqueFromApi();

        if ($sucesso) {
            $this->info('Sincronização salva no Cache com sucesso!');
        } else {
            $this->error('Ocorreu um problema ao baixar ou a API retornou vazio.');
        }
    }
}
