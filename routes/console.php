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
