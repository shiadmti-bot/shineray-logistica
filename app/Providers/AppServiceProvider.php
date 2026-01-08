<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\Filesystem;
use Masbug\Flysystem\GoogleDriveAdapter;
use Google\Client;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // 1. Força HTTPS em Produção (Vercel)
        if($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        // 2. Registra o driver 'google' manualmente
        try {
            Storage::extend('google', function($app, $config) {
                
                // Configura o Cliente do Google
                $client = new Client();
                $client->setClientId($config['clientId'] ?? '');
                $client->setClientSecret($config['clientSecret'] ?? '');
                $client->refreshToken($config['refreshToken'] ?? '');
                
                // Se tiver credenciais de Service Account (seu caso), usa elas
                if (!empty($config['serviceAccountCredentials'])) {
                    $client->setAuthConfig($config['serviceAccountCredentials']);
                }

                // Cria o adaptador na pasta raiz ou na pasta especificada
                $adapter = new GoogleDriveAdapter($client, $config['folder'] ?? '/');

                // Retorna o sistema de arquivos pronto
                return new Filesystem($adapter);
            });
        } catch (\Exception $e) {
            // Se falhar o registro, não derruba o app, apenas loga (se tiver logs ativos)
        }
    }
}