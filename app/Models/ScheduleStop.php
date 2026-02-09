<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScheduleStop extends Model
{
    protected $fillable = ['schedule_id', 'user_id', 'sequence', 'type'];

    public function loja()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}