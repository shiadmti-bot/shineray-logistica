<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$pedidos = App\Models\Pedido::orderBy('id', 'desc')->take(2)->get();
foreach ($pedidos as $p) {
    echo "ID: {$p->id} | Status: {$p->status} | Created: {$p->created_at} | Items count: " . (is_array($p->itens) ? count($p->itens) : 0) . "\n";
    $origem = $p->origem_user_id;
    echo "Origem User ID: " . var_export($origem, true) . "\n";
}
