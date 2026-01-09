<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Chama os seeders na ordem correta
        $this->call([
            FilialSeeder::class,  // Cria as Lojas/Cidades
            ModeloSeeder::class,  // Cria os Modelos de Moto
            UserSeeder::class,    // Cria os Usuários (Admin, CD, Gerentes)
        ]);
    }
}