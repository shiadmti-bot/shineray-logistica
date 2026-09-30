<?php

namespace App\Http\Requests;

use App\Models\Filial;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Formato da abertura de pedido de moto. As travas que dependem do estado do
 * sistema (carga em trânsito, chassi preso) ficam em App\Actions\Pedidos\CriarPedido.
 */
class StorePedidoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * V2.6: o chassi deixou de ser sempre obrigatório. Continua exigido em
     * transferências e em Venda Confirmada — regra que depende do modo e do
     * motivo, conferida em CriarPedido.
     */
    public function rules(): array
    {
        return [
            'itens'              => 'required|array|min:1',
            'itens.*.modelo'     => 'required|string',
            'itens.*.cor'        => 'required|string',
            'itens.*.motivo'     => 'required|string',
            'itens.*.local'      => 'required|string',
            'itens.*.chassi'     => 'nullable|string|min:11|max:17',
            'itens.*.quantidade' => 'nullable|integer|min:1|max:50',
            'origem_id'          => 'nullable|exists:users,id',
            'destino_id'         => 'nullable|exists:users,id', // V2.6: permite enviar PARA o CD
            'modo'               => 'nullable|string|in:cd,transferencia,devolucao', // 'devolucao' só por compatibilidade
            'cd_user_id'         => 'nullable|exists:users,id',
            'observacao'         => 'nullable|string',
        ];
    }

    /** Filial desativada não recebe envio novo. */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                foreach ((array) $this->input('itens', []) as $idx => $item) {
                    $destino = trim((string) ($item['local'] ?? ''));

                    if ($destino === '' || $destino === 'Matriz / CD' || str_starts_with($destino, 'PDV ')) {
                        continue;
                    }

                    [$cidade, $uf] = array_pad(array_map('trim', explode('/', $destino)), 2, null);

                    $filial = Filial::where('cidade', $cidade)
                        ->when($uf, fn ($q) => $q->where('uf', $uf))
                        ->first();

                    if ($filial && ! $filial->ativo) {
                        $validator->errors()->add(
                            "itens.{$idx}.local",
                            "A filial {$destino} está inativa e não pode receber novos envios."
                        );
                    }
                }
            },
        ];
    }
}
