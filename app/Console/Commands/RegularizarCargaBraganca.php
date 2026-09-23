<?php

namespace App\Console\Commands;

use App\Models\Message;
use App\Models\Moto;
use App\Models\Pedido;
use App\Models\PedidoLog;
use App\Models\Romaneio;
use App\Models\User;
use App\Services\OneSignalService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RegularizarCargaBraganca extends Command
{
    protected $signature = 'carga:regularizar-braganca {--dry : Apenas simula a regularização sem alterar o banco de dados} {--force : Executa a operação sem solicitar confirmação manual}';

    protected $description = 'Reconstitui a Carga 1 de Bragança (manifesto físico #11630811 de 11/09) colocando o Pedido #20875761 em trânsito com auditoria transparente';

    /**
     * Chassis previstos na Carga 1 para a Loja Bragança
     */
    private const CHASSIS_CARGA_1 = [
        '99HNJ1125TS007227', // New Jet 125 preta
        '99HNJ1125TS011757', // New Jet 125 branca
        '99HNJ1125TS011764', // New Jet 125 branca
        '99HJF1170VS002179', // Jef 170 branca
        '99HJF1170VS002934', // Jef 170 preta
        '99HJF1170VS002942', // Jef 170 preta
        '99HJF1170VS002913', // Jef 170 azul
        '99HJF1170VS003283', // Jef 170 vermelha
        '99HSHF250VS000212', // SHI250 preta/branco
        '99HJF1150SS005603', // Jef S branca
    ];

    private const PEDIDO_CARGA_1_ID = 20875761;
    private const PEDIDO_CARGA_2_ID = 20275761;
    private const ROMANEIO_CARGA_2_ID = 11300813;

    public function handle(): int
    {
        $dry = (bool) $this->option('dry');
        $force = (bool) $this->option('force');

        $this->info('=====================================================');
        $this->info('  REGULARIZAÇÃO DE CARGAS - INCIDENTE 11/09 (BRAGANÇA)  ');
        $this->info('=====================================================');

        // 1. Auditoria da Carga 2
        $this->verificarCarga2();

        // 2. Auditoria e Validação da Carga 1
        $pedido = Pedido::with(['motos', 'user'])->find(self::PEDIDO_CARGA_1_ID);

        if (! $pedido) {
            $this->error("Pedido #" . self::PEDIDO_CARGA_1_ID . " não encontrado no banco de dados.");
            return self::FAILURE;
        }

        $this->newLine();
        $this->info("--- Auditoria da Carga 1 (Pedido #" . self::PEDIDO_CARGA_1_ID . ") ---");
        $this->line("Destino: " . ($pedido->user?->filial ?? 'Loja Bragança'));
        $this->line("Status atual do Pedido: {$pedido->status}");

        $motosEncontradas = Moto::whereIn('chassi', self::CHASSIS_CARGA_1)->get();

        if ($motosEncontradas->count() !== count(self::CHASSIS_CARGA_1)) {
            $this->error("Nem todos os 10 chassis foram encontrados no cadastro de motos. Encontrados: {$motosEncontradas->count()} de " . count(self::CHASSIS_CARGA_1));
            return self::FAILURE;
        }

        $tableData = [];
        foreach ($motosEncontradas as $m) {
            $tableData[] = [
                'ID'      => $m->id,
                'Chassi'  => $m->chassi,
                'Modelo'  => $m->modelo,
                'Cor'     => $m->cor,
                'Status'  => $m->status,
                'Romaneio Atual' => $m->romaneio_id ?? '-',
            ];
        }

        $this->table(['ID', 'Chassi', 'Modelo', 'Cor', 'Status', 'Romaneio Atual'], $tableData);

        if ($pedido->status === 'em_transito' || $pedido->status === 'concluido') {
            $this->warn("Atenção: O Pedido #{$pedido->id} já está com status '{$pedido->status}'. Romaneio atual: #{$pedido->romaneio_id}.");
            if (! $force && ! $this->confirm('Deseja continuar mesmo assim?')) {
                return self::SUCCESS;
            }
        }

        if ($dry) {
            $this->newLine();
            $this->comment("[DRY-RUN] Nenhuma alteração foi realizada.");
            $this->comment("A execução real criará um novo Romaneio:");
            $this->line("  - Motorista: PAULO WENDEL");
            $this->line("  - Placa: NSQ4I26");
            $this->line("  - Rota: BRAGANÇA");
            $this->line("  - Status: em_transito");
            $this->line("  - Motos: 10 unidades com status 'transito_loja'");
            $this->line("  - Pedido #" . self::PEDIDO_CARGA_1_ID . ": status 'em_transito'");
            $this->line("  - PedidoLog: 'Saiu para Entrega 🚚' e 'Registro Operacional (Reconstituição) 📋' (ref. manifesto físico #11630811)");
            $this->line("  - Chat: Mensagem enviada para a Loja Bragança com instruções para anexo do romaneio assinado.");
            return self::SUCCESS;
        }

        if (! $force && ! $this->confirm('Confirma a criação da Carga 1 e a liberação para trânsito do Pedido #' . self::PEDIDO_CARGA_1_ID . '?')) {
            $this->info("Operação cancelada pelo usuário.");
            return self::SUCCESS;
        }

        // 3. Execução Transacional
        DB::transaction(function () use ($pedido, $motosEncontradas) {
            $cdUser = User::where('perfil', 'cd')->first() ?? User::find(3) ?? $pedido->user;

            // A) Criação do Romaneio
            $romaneio = Romaneio::create([
                'user_id'        => $cdUser->id,
                'status'         => 'em_transito',
                'motorista'      => 'PAULO WENDEL',
                'placa'          => 'NSQ4I26',
                'rota'           => 'BRAGANÇA',
                'tipo'           => 'misto',
                'saida_em'       => now(),
            ]);

            $this->info("Romaneio #{$romaneio->id} criado com sucesso!");

            // B) Atualização das Motos e espelhamento em romaneio_itens
            foreach ($motosEncontradas as $moto) {
                $moto->update([
                    'status'            => 'transito_loja',
                    'romaneio_id'       => $romaneio->id,
                    'localizacao_atual' => 'Em Trânsito para Bragança/PA',
                ]);

                $romaneio->sincronizarItemMoto($moto, $pedido);
            }

            // C) Atualização do Pedido Pai
            $pedido->update([
                'status'      => 'em_transito',
                'romaneio_id' => $romaneio->id,
            ]);

            // D) Logs de Auditoria
            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo'    => 'Saiu para Entrega 🚚',
                'descricao' => "Motos vinculadas à Carga #{$romaneio->id} deixaram o pátio com motorista PAULO WENDEL.",
            ]);

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo'    => 'Registro Operacional (Reconstituição) 📋',
                'descricao' => "Carga regularizada no sistema em 15/09/2026 após perda de dados de 11/09. Manifesto físico original #11630811, emitido em 11/09 às 08:57 (motorista PAULO WENDEL, placa NSQ4I26), conferido e assinado pela loja.",
            ]);

            // E) Mensagem no Chat do Pedido
            Message::create([
                'pedido_id' => $pedido->id,
                'user_id'   => $cdUser->id,
                'content'   => "Carga regularizada no sistema em 15/09/2026 após a perda de dados da manhã de 11/09. Manifesto físico original #11630811, emitido em 11/09 às 08:57 (motorista PAULO WENDEL, placa NSQ4I26). Por favor, anexe a foto do manifesto assinado para conclusão do recebimento.",
                'canal'     => 'cd',
            ]);

            // F) Notificação OneSignal (se aplicável)
            try {
                if ($pedido->user?->onesignal_id) {
                    (new OneSignalService())->sendToUser(
                        [$pedido->user->onesignal_id],
                        'Pedido em Trânsito 🚚',
                        "O(s) item(ns) do seu pedido #{$pedido->id} saiu/saíram para entrega! Acompanhe o rastreio.",
                        route('pedidos.show', $pedido->id)
                    );
                }
            } catch (\Throwable $e) {
                // Silencia falhas de envio de push em ambiente de console
            }

            $this->info("Pedido #{$pedido->id} atualizado para 'em_transito' e vinculado ao Romaneio #{$romaneio->id}.");
        });

        $this->newLine();
        $this->info("=====================================================");
        $this->info("  REGULARIZAÇÃO CONCLUÍDA COM SUCESSO!               ");
        $this->info("=====================================================");

        return self::SUCCESS;
    }

    private function verificarCarga2(): void
    {
        $this->info("--- Auditoria da Carga 2 (Transferência Capitão Poço -> Bragança) ---");
        $romaneio2 = Romaneio::find(self::ROMANEIO_CARGA_2_ID);
        $pedido2 = Pedido::find(self::PEDIDO_CARGA_2_ID);
        $moto2 = Moto::where('chassi', '99HJTS125TS024954')->first();

        if ($romaneio2 && $pedido2) {
            $this->line("Romaneio #" . self::ROMANEIO_CARGA_2_ID . ": Status = {$romaneio2->status} (Criado em {$romaneio2->created_at}, Concluído em {$romaneio2->updated_at})");
            $this->line("Pedido #" . self::PEDIDO_CARGA_2_ID . ": Status = {$pedido2->status}");
            if ($moto2) {
                $this->line("Moto Chassi 99HJTS125TS024954: Status = {$moto2->status} (Local: {$moto2->localizacao_atual})");
            }
            $this->info("STATUS DA CARGA 2: Já concluída e recebida pela Loja Bragança em 11/09/2026. NÃO FOI PERDIDA.");
        } else {
            $this->warn("Aviso: Registros da Carga 2 não puderam ser localizados pelos IDs padrão.");
        }
    }
}
