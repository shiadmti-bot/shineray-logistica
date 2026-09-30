<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Schedule extends Model
{
    protected $fillable = [
        'date',
        'route_id',
        'type',
        'status',
        'created_by'
    ];

    /*
     * As colunas target_user_id e secondary_user_id foram derrubadas pela
     * migration 2026_02_09_133110, que substituiu o par "destino + escala" pela
     * tabela schedule_stops — uma viagem passou a ter N paradas ordenadas.
     *
     * O $fillable e as relações destino()/escala() continuaram aqui apontando
     * para colunas inexistentes: qualquer chamada estourava em SQL. Removidos.
     * As paradas se leem por stops(), e a última delas (type = 'destination')
     * é o destino final.
     */

    public function stops()
    {
        return $this->hasMany(ScheduleStop::class)->orderBy('sequence');
    }
}