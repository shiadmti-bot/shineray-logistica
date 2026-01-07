<?php

namespace Database\Seeders;

use App\Models\Filial;
use Illuminate\Database\Seeder;

class FilialSeeder extends Seeder
{
    public function run(): void
    {
        $lojas = [
            // PARÁ
            ['cidade' => 'Acará', 'uf' => 'PA'],
            ['cidade' => 'Barcarena', 'uf' => 'PA'],
            ['cidade' => 'Belém', 'uf' => 'PA'],
            ['cidade' => 'Bragança', 'uf' => 'PA'],
            ['cidade' => 'Breves', 'uf' => 'PA'],
            ['cidade' => 'Capanema', 'uf' => 'PA'],
            ['cidade' => 'Capitão Poço', 'uf' => 'PA'],
            ['cidade' => 'Castanhal', 'uf' => 'PA'],
            ['cidade' => 'Concórdia do Pará', 'uf' => 'PA'], // Ajustei para nome completo
            ['cidade' => 'Curuçá', 'uf' => 'PA'],
            ['cidade' => 'Icoaraci', 'uf' => 'PA'], // Distrito
            ['cidade' => 'Moju', 'uf' => 'PA'],
            ['cidade' => 'São Miguel do Guamá', 'uf' => 'PA'], // Ajustei para nome completo
            ['cidade' => 'Tailândia', 'uf' => 'PA'],
            ['cidade' => 'Tomé-Açu', 'uf' => 'PA'],

            // CEARÁ (Bairros de Fortaleza/Região)
            ['cidade' => 'Fortaleza (Aldeota)', 'uf' => 'CE'],
            ['cidade' => 'Fortaleza (Demócrito Rocha)', 'uf' => 'CE'],
            ['cidade' => 'Fortaleza (Parangaba)', 'uf' => 'CE'],
        ];

        foreach ($lojas as $loja) {
            Filial::firstOrCreate([
                'nome' => "Shineray {$loja['cidade']}", // Gera "Shineray Belém", etc.
                'cidade' => $loja['cidade'],
                'uf' => $loja['uf']
            ]);
        }
    }
}