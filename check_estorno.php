<?php
require 'vendor/autoload.php';
require 'bootstrap/app.php';
$app = app();
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();
$m = App\Models\Moto::where('chassi', '99HDVF250TS002057')->with('pedidos')->first();
echo json_encode($m);
