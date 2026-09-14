<?php

try {
    require __DIR__ . '/../public/index.php';
} catch (\Throwable $e) {
    http_response_code(500);
    echo "<h1>Erro na inicializacao (Vercel)</h1>";
    echo "<p><strong>" . htmlspecialchars($e->getMessage()) . "</strong></p>";
    echo "<p>Arquivo: " . htmlspecialchars($e->getFile()) . " (linha " . $e->getLine() . ")</p>";
    echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
    error_log($e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine() . "\n" . $e->getTraceAsString());
}