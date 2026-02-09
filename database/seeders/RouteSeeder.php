<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class RouteSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    // database/seeders/RouteSeeder.php
public function run()
    {
        $rotas = [
            'BR 01', 'BR 02', 'BR 03', 'BR 04',
            'ALÇA 01', 'ALÇA 02', 
            'PA 01', 'PA 02',
            'SALINAS', 'MOSQUEIRO', 'TOMÉ AÇU',
            // ... adicione todos os códigos da sua planilha aqui
        ];

        foreach ($rotas as $codigo) {
            \App\Models\Route::firstOrCreate(['code' => $codigo], ['name' => "Rota $codigo"]);
        }
    }
}
