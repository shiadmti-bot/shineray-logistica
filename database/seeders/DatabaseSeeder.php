<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents; // Pode deixar comentado
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {

        // 0. SUPER ADMIN (AUDITORIA)
        User::create([
            'name' => 'Diretoria / Auditoria',
            'email' => 'admin@shineray.com',
            'password' => Hash::make('12345678'),
            'perfil' => 'admin', // Novo perfil
            'filial' => 'Matriz Administrativa'
        ]);

        // 1. USUÁRIO DO CD (ADMINISTRADOR)
        User::create([
            'name' => 'Gerente CD',
            'email' => 'cd@shineray.com',
            'password' => Hash::make('12345678'), // Senha
            'perfil' => 'cd',
            'filial' => 'Matriz CD'
        ]);

        // 2. USUÁRIO DA LOJA 1
        User::create([
            'name' => 'Loja Centro',
            'email' => 'loja@shineray.com',
            'password' => Hash::make('12345678'),
            'perfil' => 'loja',
            'filial' => 'Filial Centro'
        ]);

        // 3. (OPCIONAL) USUÁRIO DA LOJA 2 - Você pode adicionar quantos quiser!
        User::create([
            'name' => 'Loja Ananindeua',
            'email' => 'ananindeua@shineray.com',
            'password' => Hash::make('12345678'),
            'perfil' => 'loja',
            'filial' => 'Filial BR-316'
        ]);
    }
}