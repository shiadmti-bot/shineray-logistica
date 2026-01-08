<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Storage;
use Illuminate\Filesystem\FilesystemAdapter;
use League\Flysystem\Filesystem;

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

        // 2. Registra o driver 'google' de forma SEGURA
        try {
            Storage::extend('google', function($app, $config) {
                
                // Verifica se as classes do pacote existem antes de usar
                if (!class_exists(\Google\Client::class) || !class_exists(\Masbug\Flysystem\GoogleDriveAdapter::class)) {
                    throw new \Exception("Pacote do Google Drive não encontrado.");
                }

                $client = new \Google\Client();
                $client->setClientId($config['clientId'] ?? '');
                $client->setClientSecret($config['clientSecret'] ?? '');
                $client->refreshToken($config['refreshToken'] ?? '');
                
                if (!empty($config['serviceAccountCredentials'])) {
                    $client->setAuthConfig($config['serviceAccountCredentials']);
                }

                $adapter = new \Masbug\Flysystem\GoogleDriveAdapter($client, $config['folder'] ?? '/');
                $driver = new Filesystem($adapter);

                return new FilesystemAdapter($driver, $adapter);
            });
        } catch (\Exception $e) {
            // Silencia o erro para o site não cair (Erro 500) na inicialização
            // O erro só vai aparecer se tentar fazer upload
        }
    }
}