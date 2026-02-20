<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

    $service = app()->make(\App\Services\MicroworkService::class);
    $reflection = new \ReflectionClass(\App\Services\MicroworkService::class);
$method = $reflection->getMethod('fetchFromApi');
$method->setAccessible(true);
$rawApi = $method->invoke($service);

echo "RAW API COUNT: " . count($rawApi) . "\n";

$filtered = $service->getEstoqueCD();
echo "FILTERED COUNT: " . count($filtered) . "\n";

// Let's print the Patios found in the raw API response just to know what we got:
$patiosFound = [];
foreach($rawApi as $item) {
    if (isset($item['patio'])) {
        $patiosFound[$item['patio']] = true;
    }
}
echo "PATIOS RETURNED BY API: " . implode(', ', array_keys($patiosFound)) . "\n";
