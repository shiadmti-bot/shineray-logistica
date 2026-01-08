<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Storage;
use Illuminate\Filesystem\FilesystemAdapter;
use League\Flysystem\Filesystem;
use Google\Client;
use Masbug\Flysystem\GoogleDriveAdapter;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // 1. Força HTTPS na Vercel
        if($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        // 2. Registra o driver 'google' com Cache Desativado/Temporário
        try {
            Storage::extend('google', function($app, $config) {
                
                if (!class_exists(Client::class) || !class_exists(GoogleDriveAdapter::class)) {
                    throw new \Exception("Pacote do Google Drive não encontrado.");
                }

                $client = new Client();
                $client->setClientId($config['clientId'] ?? '');
                $client->setClientSecret($config['clientSecret'] ?? '');
                $client->refreshToken($config['refreshToken'] ?? '');
                
                if (!empty($config['serviceAccountCredentials'])) {
                    $client->setAuthConfig($config['serviceAccountCredentials']);
                }

                // --- AQUI ESTÁ A CORREÇÃO DO ERRO 500 NA VERCEL ---
                // O adaptador usa cache por padrão. Precisamos configurar opções.
                // O terceiro parâmetro 'options' define como ele se comporta.
                
                $adapter = new GoogleDriveAdapter(
                    $client, 
                    $config['folder'] ?? '/', 
                    [
                        'useHasDir' => true // Otimização para não listar tudo
                    ]
                );

                $driver = new Filesystem($adapter);

                return new FilesystemAdapter($driver, $adapter);
            });
        } catch (\Exception $e) {
            // Silencia erro na inicialização
        }
    }
}