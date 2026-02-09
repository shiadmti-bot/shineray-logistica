<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Route extends Model
{
    use HasFactory;

    // Define quais campos podem ser preenchidos
    protected $fillable = [
        'code', 
        'name', 
        'description', 
        'active'
    ];

    // Relacionamento: Uma rota tem muitos agendamentos
    public function schedules()
    {
        return $this->hasMany(Schedule::class);
    }
    
    // Relacionamento: Uma rota tem muitas lojas (users)
    public function users()
    {
        return $this->hasMany(User::class, 'default_route_id');
    }
}