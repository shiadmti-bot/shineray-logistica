<?php

/*
|--------------------------------------------------------------------------
| Módulos opcionais — estado PADRÃO
|--------------------------------------------------------------------------
|
| Vale enquanto ninguém mexer na tela Gestão > Módulos. O que o admin liga ou
| desliga lá fica gravado em `modulos_sistema` e passa por cima deste arquivo.
|
| A lista de módulos é o enum App\Enums\Modulo; quem lê o estado é
| App\Services\Modulos. Um módulo novo entra nos dois lugares e aqui.
|
*/

return [

    // Desligado até o alinhamento do fluxo com o Pós-Venda (19/10/2026).
    'pedidos_pecas' => (bool) env('MODULO_PEDIDOS_PECAS', false),

    'devolucoes' => (bool) env('MODULO_DEVOLUCOES', true),

];
