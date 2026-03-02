<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Http\Request;
use App\Http\Controllers\PedidoController;
use Illuminate\Support\Facades\Auth;
use App\Models\User;

$user = User::where('perfil', 'loja')->first();
Auth::login($user);

$itens = [];
for ($i=1; $i<=9; $i++) {
    $itens[] = [
        'modelo' => 'SHI 175',
        'chassi' => 'TESTCHASSI100000' . $i,
        'cor' => 'VERMELHA',
        'local' => 'Minha Loja',
        'motivo' => 'Estoque Regular (Giro)'
    ];
}

$request = Request::create('/pedidos', 'POST', [
    'modo' => 'cd',
    'origem_id' => null,
    'cd_user_id' => null,
    'observacao' => 'Teste script 9 motos',
    'itens' => $itens
]);

$controller = app(PedidoController::class);
try {
    $response = $controller->store($request);
    file_put_contents('test_out.txt', "Success");
} catch (\Exception $e) {
    file_put_contents('test_out.txt', "Exception: " . $e->getMessage() . "\n" . $e->getTraceAsString());
} catch (\Throwable $t) {
    file_put_contents('test_out.txt', "Throwable: " . $t->getMessage() . "\n" . $t->getTraceAsString());
}
