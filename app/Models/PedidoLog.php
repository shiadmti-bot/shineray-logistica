<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class PedidoLog extends Model
{
    protected $fillable = ['pedido_id', 'titulo', 'descricao'];
}