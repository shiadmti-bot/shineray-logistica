<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Schedule extends Model
{
    protected $fillable = [
        'date', 
        'target_user_id',    // Primário (Destino Final)
        'secondary_user_id', // Secundário (Escala)
        'status', 
        'created_by'
    ];

    // Destino Final
    public function destino()
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    // Escala
    public function escala()
    {
        return $this->belongsTo(User::class, 'secondary_user_id');
    }

    public function stops()
    {
        return $this->hasMany(ScheduleStop::class)->orderBy('sequence');
    }
}