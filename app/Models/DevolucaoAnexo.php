<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A prova de uma conferência: foto da avaria, do chassi, da nota, do canhoto.
 *
 * Tabela própria em vez de uma coluna `foto_url` porque uma avaria raramente
 * cabe numa foto só — o risco na carenagem, o número do chassi provando que é
 * a moto certa, o documento. O formulário pede "registro fotográfico anexado",
 * e no galpão isso são três ou quatro imagens.
 *
 * `devolucao_item_id` NULL = anexo do embarque inteiro (a NF, o caminhão
 * carregado); preenchido = prova daquela moto específica.
 */
class DevolucaoAnexo extends Model
{
    use HasFactory;

    protected $table = 'devolucao_anexos';

    protected $fillable = [
        'devolucao_id',
        'devolucao_item_id',
        'etapa',
        'url',
        'nome_original',
        'descricao',
        'enviado_por',
    ];

    public function devolucao()
    {
        return $this->belongsTo(Devolucao::class);
    }

    public function item()
    {
        return $this->belongsTo(DevolucaoItem::class, 'devolucao_item_id');
    }

    public function enviadoPor()
    {
        return $this->belongsTo(User::class, 'enviado_por');
    }
}
