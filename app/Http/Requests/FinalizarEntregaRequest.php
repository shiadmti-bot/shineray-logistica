<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Recebimento de pedido de moto: canhoto assinado e, por moto, a avaria
 * encontrada. Quem pode receber é conferido em FinalizarEntregaPedido.
 */
class FinalizarEntregaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'arquivo_romaneio' => 'required|file|max:15360|mimes:jpg,jpeg,png,pdf',
            'avarias'          => 'nullable|array',
            'fotos_avarias'    => 'nullable|array',
            'fotos_avarias.*'  => 'nullable|image|max:10240', // antes de comprimir
        ];
    }
}
