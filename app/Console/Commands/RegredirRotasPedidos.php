<?php

namespace App\Console\Commands;

use App\Actions\Pedidos\RegredirRotasVencidas;
use Illuminate\Console\Command;

class RegredirRotasPedidos extends Command
{
    protected $signature = 'pedidos:regredir-rotas';

    protected $description = 'Devolve para a fila os pedidos cuja rota confirmada venceu sem o caminhão sair';

    public function handle(RegredirRotasVencidas $regredir): int
    {
        $this->info('Pedidos devolvidos para a fila: ' . $regredir->executar());

        return self::SUCCESS;
    }
}
