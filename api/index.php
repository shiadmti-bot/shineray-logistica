<?php

try {
    require __DIR__ . '/../public/index.php';
} catch (\Throwable $e) {
    // O log sempre leva o detalhe completo (aparece nos logs da Vercel).
    error_log($e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine() . "\n" . $e->getTraceAsString());

    http_response_code(500);
    echo "<h1>Erro na inicializacao (Vercel)</h1>";

    // Mensagem, caminho de arquivo e trace só com APP_DEBUG ligado: em
    // produção eles expunham a estrutura do servidor (e, numa falha de
    // conexão, até o host do banco) para quem estivesse na tela.
    if (filter_var(getenv('APP_DEBUG') ?: ($_ENV['APP_DEBUG'] ?? false), FILTER_VALIDATE_BOOLEAN)) {
        echo "<p><strong>" . htmlspecialchars($e->getMessage()) . "</strong></p>";
        echo "<p>Arquivo: " . htmlspecialchars($e->getFile()) . " (linha " . $e->getLine() . ")</p>";
        echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
    } else {
        echo "<p>O sistema nao conseguiu iniciar. O detalhe do erro esta nos logs da Vercel.</p>";
    }
}
