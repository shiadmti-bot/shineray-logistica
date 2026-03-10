<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$p = App\Models\Pedido::findOrFail(8747460);
$it = $p->itens[0];

$moto = App\Models\Moto::create([
    'chassi' => $it['chassi'],
    'modelo' => $it['modelo'],
    'cor' => $it['cor'],
    'status' => 'separado',
    'localizacao_atual' => 'Estoque Origem',
    'loja_atual_id' => $p->origem_user_id
]);

$p->motos()->attach($moto->id, [
    'motivo' => $it['motivo'] ?? 'Venda'
]);

echo "Moto {$moto->chassi} Restored Successfully to Pedido 8747460!\n";
