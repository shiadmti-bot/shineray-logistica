<?php

namespace App\Services\Estoque;

/**
 * Resultado de uma sincronização com fonte externa.
 * Retornado em vez de bool para que o comando de console e os logs consigam
 * dizer o que mudou, não apenas se deu certo.
 */
class SyncResult
{
    public function __construct(
        public readonly bool $sucesso,
        public readonly int $criados = 0,
        public readonly int $atualizados = 0,
        public readonly int $ignorados = 0,
        public readonly ?string $mensagem = null,
    ) {
    }

    public static function ok(int $criados = 0, int $atualizados = 0, int $ignorados = 0): self
    {
        return new self(true, $criados, $atualizados, $ignorados);
    }

    public static function falha(string $mensagem): self
    {
        return new self(false, mensagem: $mensagem);
    }

    /** Provider que não tem fonte externa configurada. */
    public static function naoSuportado(string $motivo = 'Sincronização não disponível para este provider.'): self
    {
        return new self(false, mensagem: $motivo);
    }

    public function resumo(): string
    {
        if (! $this->sucesso) {
            return $this->mensagem ?? 'Falha na sincronização.';
        }

        return "{$this->criados} criados, {$this->atualizados} atualizados, {$this->ignorados} ignorados.";
    }
}
