<?php

namespace App\Console\Commands;

use App\Services\Estoque\PecaMicroworkProvider;
use App\Services\Estoque\StockProviderInterface;
use Illuminate\Console\Command;

/**
 * Sincroniza o catálogo de peças com o Microwork (relatório 151/67).
 *
 * Por padrão importa SOMENTE O CATÁLOGO. O saldo do relatório não é atribuível
 * a um local físico — uma empresa do Microwork agrupa mais de um ponto (a
 * empresa 3 mistura CD e Ananindeua) — e importá-lo faria peça de uma loja
 * aparecer como disponível em outra. Ver PecaMicroworkProvider::sincronizar().
 *
 * --com-saldo força a importação do saldo. Só use quando cada empresa
 * corresponder a exatamente um local e o mapeamento estiver preenchido em
 * estoque_locais.codigo_empresa_microwork.
 */
class SyncPecasEstoque extends Command
{
    protected $signature = 'pecas:sync-estoque
                            {--com-saldo : Também importa saldo (exige mapeamento empresa->local confiável)}';

    protected $description = 'Sincroniza o catálogo de peças com o Microwork.';

    public function handle(): int
    {
        /** @var StockProviderInterface $provider */
        $provider = app('estoque.provider.peca');

        if (! $provider->suportaSincronizacao()) {
            $this->warn('Provider de peças sem fonte externa configurada.');
            $this->line('Defina MICROWORK_TOKEN no .env para ativar.');

            return self::SUCCESS;
        }

        $comSaldo = $this->option('com-saldo');

        if ($comSaldo && ! $provider instanceof PecaMicroworkProvider) {
            $this->error('O provider ativo não suporta importação de saldo.');

            return self::FAILURE;
        }

        if ($comSaldo) {
            $this->warn('Modo --com-saldo: o saldo do Microwork sobrescreverá o saldo local.');
            $this->line('Isso só é seguro se cada empresa corresponder a UM local físico.');
        }

        $this->info($comSaldo ? 'Sincronizando catálogo e saldo...' : 'Sincronizando catálogo de peças...');

        $resultado = $comSaldo
            ? $provider->sincronizarComSaldo()
            : $provider->sincronizar();

        if (! $resultado->sucesso) {
            $this->error($resultado->resumo());

            return self::FAILURE;
        }

        $this->info($resultado->resumo());

        if (! $comSaldo) {
            $this->newLine();
            $this->line('Saldo NÃO importado (por decisão de arquitetura).');
            $this->line('O saldo por local é mantido pelo próprio sistema, via entrada e inventário.');
        }

        return self::SUCCESS;
    }
}
