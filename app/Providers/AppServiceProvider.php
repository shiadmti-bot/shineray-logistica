<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Console\Events\CommandStarting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Gate;
use RuntimeException;
use App\Enums\Perfil;
use App\Models\User;
use App\Services\Estoque\MotoMicroworkProvider;
use App\Services\Estoque\PecaLocalProvider;
use App\Services\Estoque\PecaMicroworkProvider;
use App\Services\GoogleDriveComprovantes;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        /*
         * PROVIDERS DE ESTOQUE (v3)
         *
         * Resolvidos por tag para que as telas peçam "o provider de peça" sem
         * saber se o dado vem do banco local ou do Microwork.
         *
         * Peça usa PecaLocalProvider enquanto o relatório externo não estiver
         * configurado. Assim que MICROWORK_PECAS_CONFIG existir no .env, a troca
         * abaixo passa a resolver PecaMicroworkProvider sem alterar consumidores.
         */
        $this->app->bind(MotoMicroworkProvider::class, fn ($app) => new MotoMicroworkProvider(
            $app->make(\App\Services\MicroworkService::class)
        ));

        $this->app->bind('estoque.provider.moto', fn ($app) => $app->make(MotoMicroworkProvider::class));

        $this->app->bind('estoque.provider.peca', function ($app) {
            $temRelatorioExterno = ! empty(config('services.microwork.pecas.relatorio_configuracao'))
                && ! empty(config('services.microwork.token'));

            return $temRelatorioExterno
                ? $app->make(PecaMicroworkProvider::class)
                : $app->make(PecaLocalProvider::class);
        });

        /*
         * Um cliente do Google Drive por request: recebimento com avarias faz
         * vários uploads, e renovar o token a cada um é latência à toa.
         * Registrado explicitamente porque, por autowiring, o container montaria
         * um Google\Service\Drive sem credencial e o daria como "configurado".
         */
        $this->app->scoped(GoogleDriveComprovantes::class, fn () => new GoogleDriveComprovantes());
    }

    /**
     * Bootstrap any application services.
     */
    /**
     * Comandos que destroem dados de forma irreversível.
     *
     * `migrate` simples não entra: é o que roda no deploy e só avança.
     */
    private const COMANDOS_DESTRUTIVOS = [
        'migrate:fresh',
        'migrate:refresh',
        'migrate:reset',
        'migrate:rollback',
        'db:wipe',
    ];

    public function boot(): void
    {
        $this->travarComandosDestrutivosRemotos();

        // 1. Configuração de HTTPS (Mantenha, essencial para Vercel)
        if($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        // 2. GATES POR PERFIL — um por case do enum (`can:admin` nas rotas).
        foreach (Perfil::cases() as $perfil) {
            Gate::define($perfil->value, fn (User $user) => $user->temPerfil($perfil));
        }
    }

    /**
     * Recusa comando destrutivo quando o banco alvo NÃO é local.
     *
     * POR QUE ISTO EXISTE
     *
     * Em 11/09/2026 um `php artisan migrate:fresh --env=testing --force` rodado
     * nesta máquina apagou o banco de PRODUÇÃO. A intenção era migrar o banco de
     * teste; `--env=testing` não enxerga as variáveis do phpunit.xml, então o
     * artisan carregou o .env — que apontava para o TiDB de produção. Restaurado
     * por snapshot, com perda da manhã de trabalho.
     *
     * POR QUE A PROTEÇÃO NATIVA DO LARAVEL NÃO PEGOU
     *
     * `confirmToProceed()` só interroga quando `APP_ENV=production`. O .env
     * dizia `APP_ENV=local` enquanto apontava para produção, então o comando
     * rodou sem um único aviso — e `--force` teria pulado a pergunta de
     * qualquer forma.
     *
     * A DIFERENÇA DESTA TRAVA: ela olha PARA ONDE A CONEXÃO VAI, não para como
     * o ambiente se autodeclara. Host é fato; APP_ENV é opinião, e foi a opinião
     * que estava errada.
     *
     * `--force` NÃO desarma. A liberação exige uma variável explícita, digitada
     * na hora, que ninguém tem no .env por acidente:
     *
     *     PERMITIR_DESTRUIR_BANCO_REMOTO=sim php artisan migrate:fresh
     */
    private function travarComandosDestrutivosRemotos(): void
    {
        /*
         * CAMADA 2 — A QUE NÃO DEPENDE DE EVENTO (v3.7).
         *
         * A camada 1, abaixo, escuta CommandStarting. Só que o Kernel do
         * Laravel 12 só dispara esse evento fora de "unit tests" — e decide
         * isso por APP_ENV === 'testing', não por estar no PHPUnit. Resultado:
         * `migrate:fresh --env=testing`, o comando EXATO de 11/09, passava por
         * fora da trava e seguia para o banco do .env. Verificado com um host
         * `.invalid`: sem --env, BLOQUEADO; com --env=testing, tentava conectar.
         *
         * Os cinco comandos da lista têm uma trava nativa (Prohibitable),
         * conferida dentro do próprio handle(), em qualquer ambiente. Ela é a
         * que garante; a camada 1 continua porque explica o porquê na tela.
         */
        DB::prohibitDestructiveCommands($this->bancoRemotoSemLiberacao());

        // CAMADA 1 — a mensagem completa, quando o evento é disparado.
        Event::listen(CommandStarting::class, function (CommandStarting $evento) {
            if (! in_array($evento->command, self::COMANDOS_DESTRUTIVOS, true)) {
                return;
            }

            $conexao = config('database.default');
            $host    = (string) config("database.connections.{$conexao}.host", '');
            $base    = (string) config("database.connections.{$conexao}.database", '');

            // SQLite e afins não têm host: não há rede, não há risco remoto.
            if (! $this->hostRemoto($host)) {
                return;
            }

            if ($this->destruicaoRemotaLiberada()) {
                $evento->output->writeln(
                    "<comment>Destruindo dados em host REMOTO {$host}/{$base} — liberado explicitamente.</comment>"
                );

                return;
            }

            throw new RuntimeException(
                PHP_EOL
                . "BLOQUEADO: '{$evento->command}' apaga dados, e o banco configurado NAO e local." . PHP_EOL
                . "  host: {$host}" . PHP_EOL
                . "  base: {$base}" . PHP_EOL . PHP_EOL
                . "Se a intencao era o banco de testes, use:" . PHP_EOL
                . "  composer db:local      (recria 127.0.0.1/shineray_test; nao existe .env.testing de proposito)" . PHP_EOL . PHP_EOL
                . "Se a intencao E destruir este banco remoto, declare:" . PHP_EOL
                . "  PERMITIR_DESTRUIR_BANCO_REMOTO=sim php artisan {$evento->command}" . PHP_EOL
            );
        });
    }

    /** O banco padrão é remoto e ninguém liberou a destruição explicitamente. */
    private function bancoRemotoSemLiberacao(): bool
    {
        $conexao = config('database.default');

        return $this->hostRemoto((string) config("database.connections.{$conexao}.host", ''))
            && ! $this->destruicaoRemotaLiberada();
    }

    private function hostRemoto(string $host): bool
    {
        return $host !== '' && ! in_array($host, ['127.0.0.1', 'localhost', '::1'], true);
    }

    private function destruicaoRemotaLiberada(): bool
    {
        return strtolower((string) env('PERMITIR_DESTRUIR_BANCO_REMOTO')) === 'sim';
    }
}