<?php

namespace App\Exceptions;

use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * O comprovante não pôde ser gravado num lugar durável.
 *
 * Existe para a operação falhar INTEIRA: recebimento, conferência ou anexo sem
 * a foto que os prova não deve ser registrado. `paraCampo` devolve a mensagem
 * no campo do formulário que enviou o arquivo.
 */
class ComprovanteNaoArmazenadoException extends RuntimeException
{
    public function paraCampo(string $campo): ValidationException
    {
        return ValidationException::withMessages([$campo => $this->getMessage()]);
    }
}
