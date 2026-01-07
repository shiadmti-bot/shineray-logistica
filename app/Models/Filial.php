<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Filial extends Model
{
    protected $fillable = ['nome', 'cidade', 'uf'];
}