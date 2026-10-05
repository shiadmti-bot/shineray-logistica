<?php

namespace Tests\Feature\Seguranca;

use App\Providers\AppServiceProvider;
use Illuminate\Database\Console\Migrations\FreshCommand;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use ReflectionProperty;
use Tests\TestCase;

/**
 * A trava que impede `migrate:fresh` e afins contra banco remoto.
 *
 * Existe por causa de 11/09/2026: um `migrate:fresh --env=testing` apagou a
 * produção. E, como esta suíte descobriu, a trava original (só por evento)
 * NÃO cobria justamente esse comando: com APP_ENV=testing o Laravel não
 * dispara CommandStarting. O PHPUnit roda com APP_ENV=testing — ou seja, este
 * teste reproduz a condição do incidente, e só passa pela camada 2
 * (Prohibitable, ver AppServiceProvider::travarComandosDestrutivosRemotos).
 *
 * SEGURO DE RODAR: o host remoto é `.invalid`, domínio reservado que nunca
 * resolve. Se a trava regredir, o comando falha por conexão — não encontra
 * banco nenhum para apagar. Nenhum teste aqui usa DatabaseTransactions.
 */
class TravaAntiDestruicaoTest extends TestCase
{
    protected function tearDown(): void
    {
        // A trava nativa é estática: não pode vazar para os próximos testes.
        DB::prohibitDestructiveCommands(false);
        unset($_SERVER['PERMITIR_DESTRUIR_BANCO_REMOTO'], $_ENV['PERMITIR_DESTRUIR_BANCO_REMOTO']);
        putenv('PERMITIR_DESTRUIR_BANCO_REMOTO');

        parent::tearDown();
    }

    /** @return array<string, array{0: string}> */
    public static function comandosDestrutivos(): array
    {
        return [
            'migrate:fresh'    => ['migrate:fresh'],
            'migrate:refresh'  => ['migrate:refresh'],
            'migrate:reset'    => ['migrate:reset'],
            'migrate:rollback' => ['migrate:rollback'],
            'db:wipe'          => ['db:wipe'],
        ];
    }

    #[DataProvider('comandosDestrutivos')]
    public function test_comando_destrutivo_contra_banco_remoto_e_bloqueado_mesmo_em_testing(string $comando): void
    {
        $this->apontarBancoPara('tidb-producao.invalid');

        // --force não desarma: a liberação é só pela variável digitada na hora.
        $this->artisan($comando, ['--force' => true])
            ->expectsOutputToContain('prohibited')
            ->assertFailed();
    }

    public function test_banco_local_continua_liberado(): void
    {
        $this->apontarBancoPara('127.0.0.1');

        $this->assertFalse($this->travado(), 'O banco de teste local precisa continuar recriável (composer db:local).');
    }

    public function test_liberacao_explicita_desarma_a_trava(): void
    {
        $_SERVER['PERMITIR_DESTRUIR_BANCO_REMOTO'] = 'sim';

        $this->apontarBancoPara('tidb-producao.invalid');

        $this->assertFalse($this->travado());
    }

    public function test_sem_a_variavel_o_remoto_fica_travado(): void
    {
        $this->apontarBancoPara('tidb-producao.invalid');

        $this->assertTrue($this->travado());
    }

    /** Troca o host do banco padrão e reaplica a decisão da trava (que é tomada no boot). */
    private function apontarBancoPara(string $host): void
    {
        config([
            'database.default'                    => 'mysql',
            'database.connections.mysql.host'     => $host,
            'database.connections.mysql.database' => 'producao_ficticia',
        ]);

        $this->app->getProvider(AppServiceProvider::class)->boot();
    }

    private function travado(): bool
    {
        return (new ReflectionProperty(FreshCommand::class, 'prohibitedFromRunning'))->getValue();
    }
}
