<?php
require 'vendor/autoload.php';
require 'bootstrap/app.php';
$app = app();
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();
$m = App\Models\Moto::where('chassi', '99HNJ1150TS000279')->with(['pedidos' => function($q) { $q->select('pedidos.id', 'pedidos.status'); }])->first();
echo json_encode($m);
