<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$cargas = App\Models\Romaneio::where('status', '!=', 'concluido')->get();
$count = 0;
foreach($cargas as $c) {
    if($c->motos()->count() === 0) {
        $c->update(['status' => 'concluido']);
        $count++;
    }
}
echo "Auditoria concluida. Cargas vazias corrigidas: " . $count . "\n";
