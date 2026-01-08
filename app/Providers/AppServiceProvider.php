<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Storage; // <--- Importante
use Google\Client; // <--- Importante
use Google\Service\Drive; // <--- Importante
use Masbug\Flysystem\GoogleDriveAdapter; // <--- Importante
use League\Flysystem\Filesystem; // <--- Importante

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
        // Força HTTPS na Vercel
        if($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        // --- AQUI ESTÁ A MÁGICA ---
        // Ensinamos o Laravel a criar o driver 'google' manualmente
        try {
            Storage::extend('google', function($app, $config) {
                $client = new \Google\Client();
                $client->setClientId($config['clientId'] ?? '');
                $client->setClientSecret($config['clientSecret'] ?? '');
                $client->refreshToken($config['refreshToken'] ?? '');
                
                // Pega as credenciais do JSON da variável de ambiente
                if (!empty($config['serviceAccountCredentials'])) {
                    $client->setAuthConfig($config['serviceAccountCredentials']);
                }

                $adapter = new \Masbug\Flysystem\GoogleDriveAdapter($client, $config['folder'] ?? '/');
                
                return new \League\Flysystem\Filesystem($adapter);
            });
        } catch (\Exception $e) {
            // Se der erro ao registrar, apenas loga para não derrubar o site todo de cara
            // Log::error("Erro ao registrar Google Drive: " . $e->getMessage());
        }
    }
}