<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Senha padrão para todos (facilita o teste)
        $senhaPadrao = Hash::make('12345678');

        // 1. LISTA DE USUÁRIOS FIXOS (Admin e CD)
        $usuariosParaCriar = [
            [
                'name' => 'Diretoria / Auditoria',
                'email' => 'admin@shineray.com',
                'password' => $senhaPadrao,
                'perfil' => 'admin',
                'filial' => 'Matriz Administrativa'
            ],
            [
                'name' => 'Gerente CD',
                'email' => 'cd@shineray.com',
                'password' => $senhaPadrao,
                'perfil' => 'cd',
                'filial' => 'CD Benevides'
            ]
        ];

        // 2. LISTA DE LOJAS (Gera usuários automaticamente baseados nas cidades)
        // Adicione ou remova cidades aqui conforme necessário
        $cidadesLojas = [
            'Belém', 
            'Ananindeua', 
            'Castanhal', 
            'Icoaraci', 
            'Bragança', 
            'Capanema', 
            'Paragominas', 
            'Tomé-Açu', 
            'Acará', 
            'Moju',
            'Fortaleza (Aldeota)'
        ];

        foreach ($cidadesLojas as $cidade) {
            // Gera um email tipo: loja.castanhal@shineray.com
            $slug = Str::slug($cidade); 
            
            $usuariosParaCriar[] = [
                'name' => "Loja {$cidade}",
                'email' => "loja.{$slug}@shineray.com",
                'password' => $senhaPadrao,
                'perfil' => 'loja',
                'filial' => "Filial {$cidade}"
            ];
        }

        // 3. EXECUÇÃO SEGURA (Create ou Update)
        foreach ($usuariosParaCriar as $dados) {
            // Verifica se o usuário já existe (inclusive na lixeira)
            $user = User::withTrashed()->where('email', $dados['email'])->first();

            if ($user) {
                // Se existe, atualiza os dados e restaura (caso tenha sido excluído)
                $user->update([
                    'name' => $dados['name'],
                    'password' => $dados['password'], // Atualiza a senha para o padrão
                    'perfil' => $dados['perfil'],
                    'filial' => $dados['filial'],
                    'deleted_at' => null // Restaura da lixeira
                ]);
            } else {
                // Se não existe, cria do zero
                User::create($dados);
            }
        }
    }
}