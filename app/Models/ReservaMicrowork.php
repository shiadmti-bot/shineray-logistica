<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\User;
use App\Models\Pedido;

class ReservaMicrowork extends Model
{
    use HasFactory;

    protected $table = 'reservas_microwork';

    protected $fillable = [
        'chassi',
        'user_id',
        'pedido_id',
        'status',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function pedido()
    {
        return $this->belongsTo(Pedido::class);
    }
}
