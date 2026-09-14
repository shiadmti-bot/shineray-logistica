<?php

namespace Tests\Feature;

use App\Models\Basqueta;
use App\Models\Devolucao;
use App\Models\EstoqueLocal;
use App\Models\Moto;
use App\Models\Pedido;
use App\Models\User;
use App\Services\Devolucao\ChecklistMoto;
use App\Services\GoogleDriveComprovantes;
use Google\Service\Drive as GoogleDrive;
use Google\Service\Drive\DriveFile;
use Google\Service\Drive\FileList;
use Google\Service\Drive\Permission;
use Google\Service\Drive\Resource\Files;
use Google\Service\Drive\Resource\Permissions;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

/**
 * Backup de comprovantes no Google Drive (v3.4).
 *
 * Protege duas coisas. A árvore que a equipe usa há meses continua idêntica —
 * Filial - {users.filial} / ano / mês / subpasta — e o romaneio de peças entra
 * nela, na subpasta Peças, sem disputar cache com o fluxo de motos.
 *
 * O Drive é um fake em memória que responde como a API: busca pasta por nome e
 * pai, cria, e recusa consulta malformada.
 */
class ComprovanteGoogleDriveTest extends TestCase
{
    use DatabaseTransactions;

    /** @var array<string, array{nome: string, pai: string}> pastas do Drive falso, por id */
    private array $pastas = [];

    /** @var array<int, array{nome: string, pai: string}> arquivos enviados ao Drive falso */
    private array $arquivos = [];

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Http::fake();
        Storage::fake('public');
        Carbon::setTestNow('2026-09-14 10:00:00');
        config(['services.google.folder_id' => 'raiz-backup']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    /** Guarda do phpunit.xml: sem ela, a suíte subia fotos falsas no Drive real. */
    public function test_a_suite_nunca_usa_o_drive_real()
    {
        $this->assertTrue(blank(config('services.google.refresh_token')));
        $this->assertFalse(app(GoogleDriveComprovantes::class)->configurado());
    }

    /**
     * A regressão da colisão de cache: comprovante de moto e romaneio de peça da
     * mesma filial, no mesmo mês. Antes, quem gravava primeiro quebrava o outro.
     */
    public function test_comprovante_de_moto_e_romaneio_de_peca_da_mesma_filial_convivem()
    {
        $drive = new GoogleDriveComprovantes($this->driveFalso());
        // Guarda o objeto: o fake apaga o temporário quando é coletado.
        $upload = UploadedFile::fake()->image('canhoto.jpg');
        $foto   = $upload->getRealPath();

        $drive->enviar($foto, 'PEDIDO_1.jpg', 'image/jpeg', 'Castanhal/PA', GoogleDriveComprovantes::PASTA_COMPROVANTES);
        $drive->enviar($foto, 'BASQUETA_1.jpg', 'image/jpeg', 'Castanhal/PA', GoogleDriveComprovantes::PASTA_PECAS);
        $drive->enviar($foto, 'PEDIDO_2.jpg', 'image/jpeg', 'Castanhal/PA', GoogleDriveComprovantes::PASTA_COMPROVANTES);

        $this->assertSame([
            'PEDIDO_1.jpg'   => 'Filial - Castanhal/PA/2026/Setembro/Comprovantes',
            'BASQUETA_1.jpg' => 'Filial - Castanhal/PA/2026/Setembro/Peças',
            'PEDIDO_2.jpg'   => 'Filial - Castanhal/PA/2026/Setembro/Comprovantes',
        ], $this->caminhosDosArquivos());

        // Filial, ano, mês, Comprovantes e Peças: nenhuma pasta em dobro.
        $this->assertCount(5, $this->pastas);
    }

    public function test_nome_de_filial_com_apostrofo_encontra_a_pasta_existente()
    {
        $drive = new GoogleDriveComprovantes($this->driveFalso());
        // Guarda o objeto: o fake apaga o temporário quando é coletado.
        $upload = UploadedFile::fake()->image('canhoto.jpg');
        $foto   = $upload->getRealPath();

        $drive->enviar($foto, 'PEDIDO_1.jpg', 'image/jpeg', "Pau D'Arco/PA", GoogleDriveComprovantes::PASTA_COMPROVANTES);

        // Sem cache, a segunda chamada precisa ACHAR as pastas pela consulta.
        Cache::flush();
        $drive->enviar($foto, 'PEDIDO_2.jpg', 'image/jpeg', "Pau D'Arco/PA", GoogleDriveComprovantes::PASTA_COMPROVANTES);

        $this->assertSame("Filial - Pau D'Arco/PA/2026/Setembro/Comprovantes", $this->caminhosDosArquivos()['PEDIDO_2.jpg']);
        $this->assertCount(4, $this->pastas);
    }

    public function test_recebimento_de_motos_mantem_comprovantes_e_avarias_na_arvore_da_filial()
    {
        $this->usarDriveFalso();

        $loja = $this->loja('Castanhal/PA');

        $pedido = Pedido::create(['user_id' => $loja->id, 'status' => 'em_transito']);

        $moto = Moto::create([
            'chassi' => '9C2DRIVE' . random_int(100000, 999999),
            'modelo' => 'NEW JEF 125',
            'cor'    => 'VERMELHA',
            'status' => 'em_transito',
        ]);

        $pedido->motos()->attach($moto->id, ['destino' => 'Castanhal/PA']);

        $this->actingAs($loja)
            ->post(route('pedidos.finalizar', $pedido->id), [
                'arquivo_romaneio' => UploadedFile::fake()->image('canhoto.jpg'),
                'avarias'          => [$moto->id => 'Risco no para-lama'],
                'fotos_avarias'    => [$moto->id => UploadedFile::fake()->image('avaria.jpg')],
            ])
            ->assertSessionHasNoErrors();

        $this->assertEqualsCanonicalizing([
            'Filial - Castanhal/PA/2026/Setembro/Comprovantes',
            'Filial - Castanhal/PA/2026/Setembro/Avarias',
        ], array_values($this->caminhosDosArquivos()));

        $pedido->refresh();
        $this->assertSame('concluido', $pedido->status);
        $this->assertStringStartsWith('https://drive.google.com/', $pedido->comprovante_url);
    }

    public function test_romaneio_de_peca_entra_na_pasta_pecas_da_mesma_filial_das_motos()
    {
        $this->usarDriveFalso();

        [$loja, $basqueta] = $this->basquetaFaturada();

        $this->actingAs($loja)
            ->post(route('pecas.basquetas.conferir', $basqueta->id), [
                'foto' => UploadedFile::fake()->image('romaneio.jpg'),
            ])
            ->assertSessionHasNoErrors();

        // A pasta usa o users.filial ("Castanhal/PA"), não o nome do local de
        // estoque ("Loja Castanhal/PA") — senão a filial ganharia duas pastas.
        $this->assertSame(
            ['Filial - Castanhal/PA/2026/Setembro/Peças'],
            array_values($this->caminhosDosArquivos())
        );

        $this->assertStringStartsWith('https://drive.google.com/', $basqueta->fresh()->foto_romaneio_url);
    }

    /** O código anterior lia relações inexistentes e mandava tudo para "Filial - Matriz". */
    public function test_anexo_de_devolucao_vai_para_a_pasta_da_loja_e_nao_para_a_matriz()
    {
        $this->usarDriveFalso();

        User::factory()->create([
            'email'  => 'drive_cd_' . uniqid() . '@shineray.com.br',
            'perfil' => 'cd',
        ]);

        $loja = $this->loja('Castanhal/PA');

        $moto = Moto::create([
            'chassi'        => '9C2DEVOL' . random_int(100000, 999999),
            'modelo'        => 'NEW JEF 125',
            'cor'           => 'VERMELHA',
            'status'        => 'estoque_loja',
            'loja_atual_id' => $loja->id,
        ]);

        $this->actingAs($loja)
            ->post(route('devolucoes.store'), ['motos' => [$moto->id], 'motivo' => 'defeito_fabrica'])
            ->assertSessionHasNoErrors();

        $devolucao = Devolucao::where('user_id', $loja->id)->latest('id')->firstOrFail();

        $this->actingAs($loja)
            ->post(route('devolucoes.anexos.store', $devolucao->id), [
                'etapa'   => ChecklistMoto::ETAPA_ORIGEM,
                'item_id' => $devolucao->itens()->first()->id,
                'arquivo' => UploadedFile::fake()->image('moto.jpg'),
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(
            ['Filial - Castanhal/PA/2026/Setembro/Comprovantes'],
            array_values($this->caminhosDosArquivos())
        );
    }

    /**
     * Na Vercel o disco local é /tmp. Sem Drive, gravar ali devolvia um link
     * quebrado com cara de sucesso; agora a conferência falha inteira.
     */
    public function test_sem_drive_e_sem_disco_duravel_a_conferencia_nao_e_registrada()
    {
        config(['filesystems.comprovantes.fallback_local' => false]);

        [$loja, $basqueta] = $this->basquetaFaturada();

        $this->actingAs($loja)
            ->post(route('pecas.basquetas.conferir', $basqueta->id), [
                'foto' => UploadedFile::fake()->image('romaneio.jpg'),
            ])
            ->assertSessionHasErrors('foto');

        $basqueta->refresh();
        $this->assertSame(Basqueta::STATUS_FATURADA, $basqueta->status);
        $this->assertNull($basqueta->foto_romaneio_url);
    }

    // ------------------------------------------------------------------

    private function usarDriveFalso(): void
    {
        $servico = new GoogleDriveComprovantes($this->driveFalso());

        $this->app->scoped(GoogleDriveComprovantes::class, fn () => $servico);
    }

    /** Drive em memória: responde listFiles e create como a API, e recusa consulta malformada como ela. */
    private function driveFalso(): GoogleDrive
    {
        $files = Mockery::mock(Files::class);

        $files->shouldReceive('listFiles')->andReturnUsing(function (array $parametros) {
            $padrao = '/^mimeType=\'application\/vnd\.google-apps\.folder\' and name=\'((?:[^\'\\\\]|\\\\.)*)\' and \'([^\']+)\' in parents and trashed=false$/';

            if (! preg_match($padrao, $parametros['q'] ?? '', $m)) {
                throw new \Google\Service\Exception('Invalid Value', 400);
            }

            $nome = stripslashes($m[1]);

            $lista = new FileList();
            $lista->setFiles(collect($this->pastas)
                ->filter(fn ($pasta) => $pasta['nome'] === $nome && $pasta['pai'] === $m[2])
                ->keys()
                ->map(fn ($id) => new DriveFile(['id' => $id]))
                ->values()
                ->all());

            return $lista;
        });

        $files->shouldReceive('create')->andReturnUsing(function (DriveFile $meta) {
            $id  = 'id-' . (count($this->pastas) + count($this->arquivos) + 1);
            $pai = $meta->getParents()[0];

            if ($meta->getMimeType() === 'application/vnd.google-apps.folder') {
                $this->pastas[$id] = ['nome' => $meta->getName(), 'pai' => $pai];
            } else {
                $this->arquivos[] = ['nome' => $meta->getName(), 'pai' => $pai];
            }

            return new DriveFile(['id' => $id, 'webViewLink' => "https://drive.google.com/file/d/{$id}/view"]);
        });

        $permissoes = Mockery::mock(Permissions::class);
        $permissoes->shouldReceive('create')->andReturn(new Permission());

        $drive = Mockery::mock(GoogleDrive::class);
        $drive->files = $files;
        $drive->permissions = $permissoes;

        return $drive;
    }

    /** @return array<string, string> nome do arquivo => caminho da pasta, da raiz para baixo */
    private function caminhosDosArquivos(): array
    {
        $caminhos = [];

        foreach ($this->arquivos as $arquivo) {
            $partes = [];

            for ($id = $arquivo['pai']; isset($this->pastas[$id]); $id = $this->pastas[$id]['pai']) {
                array_unshift($partes, $this->pastas[$id]['nome']);
            }

            $caminhos[$arquivo['nome']] = implode('/', $partes);
        }

        return $caminhos;
    }

    /** @return array{0: User, 1: Basqueta} */
    private function basquetaFaturada(): array
    {
        $local = EstoqueLocal::create([
            'nome'            => 'Loja Castanhal/PA',
            'slug'            => 'loja-castanhal-drive-' . uniqid(),
            'tipo'            => EstoqueLocal::TIPO_LOJA,
            'participa_pecas' => true,
            'ativo'           => true,
        ]);

        $loja = $this->loja('Castanhal/PA', ['estoque_local_id' => $local->id]);

        $basqueta = Basqueta::create([
            'estoque_local_id' => $local->id,
            'status'           => Basqueta::STATUS_FATURADA,
            'romaneio_versao'  => 1,
        ]);

        return [$loja, $basqueta];
    }

    private function loja(string $filial, array $extra = []): User
    {
        return User::factory()->create([
            'email'  => 'drive_loja_' . uniqid() . '@shineray.com.br',
            'perfil' => 'loja',
            'filial' => $filial,
            ...$extra,
        ]);
    }
}
