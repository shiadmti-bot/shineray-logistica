<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Agendamento: Sincroniza o estoque Microwork a cada 10 minutos (Se Vercel Cron estiver configurado)
// A Vercel ativará essa URL via API ou comando background.
Schedule::command('microwork:sync-estoque')->everyTenMinutes();

// Rota confirmada que venceu sem o caminhão sair devolve o pedido para a fila.
// Na Vercel, onde o scheduler não roda, quem dispara é o webhook /webhook/microwork.
Schedule::command('pedidos:regredir-rotas')->everyTenMinutes();

/*
 * Cobrança das travas humanas do fluxo de peças.
 *
 * UMA VEZ POR DIA, e isso não é preferência: a cadência anti-spam do comando
 * (cobra ao cruzar o limite, depois a cada 2 dias) é calculada a partir da
 * idade da pendência e só é estável com uma execução diária.
 *
 * 08:00 porque a cobrança precisa chegar no início do expediente, quando ainda
 * dá para resolver no mesmo dia — não às 23h, quando vira ruído.
 */
Schedule::command('pecas:cobrar')->dailyAt('08:00');
