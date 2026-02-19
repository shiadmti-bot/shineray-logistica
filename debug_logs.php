<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$pedido = App\Models\Pedido::where('status', 'concluido')->latest()->first();

$output = [];
if ($pedido) {
    foreach ($pedido->logs as $log) {
        $output[] = [
            'titulo' => $log->titulo,
            'data' => $log->created_at->format('Y-m-d H:i:s')
        ];
    }
} else {
    $output = ['error' => 'Nenhum pedido encontrado'];
}

file_put_contents('logs_output.json', json_encode($output, JSON_PRETTY_PRINT));
