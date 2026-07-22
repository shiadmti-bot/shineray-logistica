<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$id = 16604575;
$pedido = \App\Models\Pedido::with('motos')->find($id);

if (!$pedido) {
    echo "Pedido não encontrado.\n";
    exit;
}

echo "Pedido encontrado: " . $pedido->id . " - Status: " . $pedido->status . "\n";
echo "Origem: " . $pedido->origem_user_id . "\n";
echo "Motos count: " . $pedido->motos->count() . "\n";

DB::transaction(function () use ($pedido, $id) {
    foreach ($pedido->motos as $moto) {
        $statusVolta = $pedido->origem_user_id ? 'disponivel' : 'estoque_fabrica';
        $localVolta = $pedido->origem_user_id ? "Estoque Loja" : "Pátio CD/Fábrica";
        $moto->update(['status' => $statusVolta, 'localizacao_atual' => $localVolta]);
        echo "Moto " . $moto->chassi . " atualizada para " . $statusVolta . "\n";
    }
    
    $pedido->motos()->detach();
    echo "Motos desvinculadas.\n";

    \App\Models\ReservaMicrowork::where('pedido_id', $pedido->id)
        ->whereIn('status', ['pendente', 'faturada'])
        ->update(['status' => 'cancelada']);
    echo "Reservas Microwork canceladas.\n";

    // Since we don't have request and session to do UI redirects, just update the status
    // Actually, the system uses soft deletes for orders but first we set status if we want to keep it visible, 
    // or just soft delete it as seen in the controller.
    
    // In the controller it does: $pedido->delete();
    $pedido->delete();
    echo "Pedido deletado (soft delete).\n";
});

echo "Cancelamento concluído.\n";
