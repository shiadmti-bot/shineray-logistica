<?php

use App\Models\Pedido;
use App\Models\Moto;
use App\Models\PedidoLog;

$pedidos = Pedido::whereIn('status', ['separado', 'aguardando_rota'])->whereNotNull('previsao_entrega')->get();
$count = 0;
foreach($pedidos as $p) {
    if ($p->status !== 'rota_confirmada') {
        $p->update(['status' => 'rota_confirmada']);
        $p->motos()->update(['status' => 'rota_confirmada']);
        PedidoLog::create([
            'pedido_id' => $p->id,
            'titulo' => 'Correção de Status 🪲',
            'descricao' => 'O status foi corrigido automaticamente pelo sistema pois a Rota já estava agendada no Calendário.'
        ]);
        $count++;
    }
}
echo "Pedidos corrigidos: " . $count . "\n";
