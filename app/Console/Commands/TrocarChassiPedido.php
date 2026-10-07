<?php

namespace App\Console\Commands;

use App\Models\Moto;
use App\Models\Pedido;
use App\Models\PedidoItem;
use App\Models\PedidoLog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Corrige um chassi que seguiu fisicamente no lugar de outro.
 *
 * Caso típico (incidente 07/10, manifesto #12087265): o CD separou a New Jet
 * 6690 para Icoaraci e a 6691 para Soure, mas no carregamento as duas foram
 * trocadas. O Microwork já foi corrigido; o app continuava dizendo que a 6690
 * estava no caminhão de Icoaraci.
 *
 * O fluxo normal não resolve: "Desfazer" é bloqueado para moto já despachada
 * (correto — a tela não sabe o que está no caminhão), e desfazer + atribuir de
 * novo perderia o vínculo com a carga que já saiu.
 *
 * O que o comando faz, numa transação:
 *   1. No {pedido}, o chassi {entra} ocupa a MESMA cota do chassi {sai}
 *      (mesmo pivot, mesmo motivo/destino) e herda o estado logístico dele
 *      (status, carga, localização). O espelho em romaneio_itens acompanha (se existir).
 *   2. O chassi {sai}:
 *        - com --para-pedido: vai para esse pedido. Se {entra} vinha de lá,
 *          ocupa a vaga dele (troca completa); senão, uma cota pendente do
 *          mesmo modelo/cor, como "separado".
 *        - sem --para-pedido: volta ao estoque do CD (igual a "Desfazer").
 *   3. Registra a correção na linha do tempo dos pedidos envolvidos.
 */
class TrocarChassiPedido extends Command
{
    protected $signature = 'pedido:trocar-chassi
        {pedido : Pedido em que o chassi está registrado errado}
        {sai : Chassi registrado hoje no pedido}
        {entra : Chassi que fisicamente seguiu no lugar dele}
        {--para-pedido= : Pedido que deve ficar com o chassi que sai}
        {--motivo= : Justificativa registrada na linha do tempo}
        {--dry : Apenas simula}
        {--force : Não pede confirmação e aceita modelo/cor divergentes}';

    protected $description = 'Substitui um chassi trocado fisicamente no carregamento, mantendo a carga e a cota do pedido';

    private const PEDIDO_ENCERRADO = ['concluido', 'cancelado', 'rejeitado'];

    public function handle(): int
    {
        $pedidoId  = (int) $this->argument('pedido');
        $saiChassi = trim((string) $this->argument('sai'));
        $entraChassi = trim((string) $this->argument('entra'));
        $destinoId = $this->option('para-pedido') ? (int) $this->option('para-pedido') : null;
        $motivo    = (string) ($this->option('motivo') ?: 'Correção operacional de carregamento');
        $dry       = (bool) $this->option('dry');
        $force     = (bool) $this->option('force');

        $pedido  = Pedido::with('user')->find($pedidoId);
        $destino = $destinoId ? Pedido::with('user')->find($destinoId) : null;
        $sai     = Moto::where('chassi', $saiChassi)->first();
        $entra   = Moto::where('chassi', $entraChassi)->first();

        if (! $pedido || ! $sai || ! $entra || ($this->option('para-pedido') && ! $destino)) {
            $this->error('Pedido ou chassi não encontrado. Confira os números informados.');
            return self::FAILURE;
        }

        foreach (array_filter([$pedido, $destino]) as $p) {
            if (in_array($p->status, self::PEDIDO_ENCERRADO, true)) {
                $this->error("O pedido #{$p->id} está '{$p->status}'. Correção de chassi só em pedido ativo.");
                return self::FAILURE;
            }
        }

        $vinculoSai = DB::table('pedido_moto')->where('pedido_id', $pedido->id)->where('moto_id', $sai->id)->first();
        if (! $vinculoSai) {
            $this->error("O chassi {$sai->chassi} não está no pedido #{$pedido->id}.");
            return self::FAILURE;
        }

        // Onde o chassi que entra está hoje (precisa estar livre ou no pedido de destino).
        $outrosPedidosEntra = $entra->pedidos()->whereNotIn('pedidos.status', self::PEDIDO_ENCERRADO)->get();
        $vinculoEntra = null;

        foreach ($outrosPedidosEntra as $p) {
            if ($destino && $p->id === $destino->id) {
                $vinculoEntra = DB::table('pedido_moto')->where('pedido_id', $p->id)->where('moto_id', $entra->id)->first();
                continue;
            }
            $this->error("O chassi {$entra->chassi} está preso no pedido ativo #{$p->id}. Informe-o em --para-pedido para fazer a troca completa.");
            return self::FAILURE;
        }

        if (! $this->mesmoProduto($sai, $entra)) {
            $this->warn("Modelo/cor divergentes: {$sai->modelo} {$sai->cor} x {$entra->modelo} {$entra->cor}.");
            if (! $force) {
                $this->error('Use --force se a troca for intencional.');
                return self::FAILURE;
            }
        }

        // Cota do pedido de destino que vai receber o chassi que sai.
        $cotaDestino = null;
        if ($destino && ! $vinculoEntra) {
            $cotaDestino = PedidoItem::where('pedido_id', $destino->id)->get()
                ->first(fn ($i) => $i->qtd_pendente > 0 && $this->mesmoTexto($i->modelo, $sai->modelo) && $this->mesmoTexto($i->cor, $sai->cor));

            if (! $cotaDestino) {
                $this->error("O pedido #{$destino->id} não tem cota pendente de {$sai->modelo} {$sai->cor} para receber o chassi {$sai->chassi}.");
                return self::FAILURE;
            }
        }

        $this->resumo($pedido, $sai, $entra, $destino, $vinculoEntra, $cotaDestino);

        if ($dry) {
            $this->comment('[DRY-RUN] Nenhuma alteração foi feita.');
            return self::SUCCESS;
        }

        if (! $force && ! $this->confirm('Confirma a correção?')) {
            return self::SUCCESS;
        }

        DB::transaction(function () use ($pedido, $sai, $entra, $destino, $vinculoSai, $vinculoEntra, $cotaDestino, $motivo) {
            $estadoSai   = $sai->only(['status', 'romaneio_id', 'localizacao_atual', 'loja_atual_id']);
            $estadoEntra = $entra->only(['status', 'romaneio_id', 'localizacao_atual', 'loja_atual_id']);

            // 1. O chassi que entra assume a vaga e o estado logístico do que sai.
            DB::table('pedido_moto')->where('id', $vinculoSai->id)->update(['moto_id' => $entra->id, 'updated_at' => now()]);
            $entra->update($estadoSai);

            if ($estadoSai['romaneio_id'] && class_exists(\App\Models\RomaneioItem::class)) {
                \App\Models\RomaneioItem::where('romaneio_id', $estadoSai['romaneio_id'])
                    ->where('itemable_type', Moto::class)
                    ->where('itemable_id', $sai->id)
                    ->update(['itemable_id' => $entra->id]);
            }

            // 2. Destino do chassi que sai.
            if ($vinculoEntra) {
                // Troca completa: ocupa a vaga que era do chassi que entrou.
                DB::table('pedido_moto')->where('id', $vinculoEntra->id)->update(['moto_id' => $sai->id, 'updated_at' => now()]);
                $sai->update($estadoEntra);

                if ($estadoEntra['romaneio_id'] && class_exists(\App\Models\RomaneioItem::class)) {
                    \App\Models\RomaneioItem::where('romaneio_id', $estadoEntra['romaneio_id'])
                        ->where('itemable_type', Moto::class)
                        ->where('itemable_id', $entra->id)
                        ->update(['itemable_id' => $sai->id]);
                }
            } elseif ($cotaDestino) {
                $destino->motos()->attach($sai->id, [
                    'destino'        => mb_strtoupper((string) $cotaDestino->local),
                    'motivo'         => $cotaDestino->motivo,
                    'pedido_item_id' => $cotaDestino->id,
                ]);
                $cotaDestino->increment('qtd_atribuida');

                $sai->update([
                    'status'            => 'separado',
                    'romaneio_id'       => null,
                    'loja_atual_id'     => null,
                    'localizacao_atual' => "Separado no CD (Pedido #{$destino->id})",
                ]);
            } else {
                $sai->update([
                    'status'            => 'estoque_fabrica',
                    'romaneio_id'       => null,
                    'loja_atual_id'     => null,
                    'localizacao_atual' => 'Fábrica/CD (Chassi corrigido)',
                ]);
            }

            // 3. Auditoria.
            $dados = [
                'chassi_saiu'    => $sai->chassi,
                'chassi_entrou'  => $entra->chassi,
                'carga'          => $estadoSai['romaneio_id'],
                'pedido_destino' => $destino?->id,
                'motivo'         => $motivo,
            ];

            PedidoLog::create([
                'pedido_id' => $pedido->id,
                'titulo'    => 'Chassi Corrigido 🔁',
                'descricao' => "Chassi {$sai->chassi} substituído por {$entra->chassi}"
                    . ($estadoSai['romaneio_id'] ? " na Carga #{$estadoSai['romaneio_id']}" : '')
                    . ". {$motivo}",
                'dados'     => $dados,
            ]);

            if ($destino) {
                PedidoLog::create([
                    'pedido_id' => $destino->id,
                    'titulo'    => 'Chassi Corrigido 🔁',
                    'descricao' => "Chassi {$sai->chassi} vinculado a este pedido"
                        . ($vinculoEntra ? " no lugar de {$entra->chassi}" : '')
                        . " (vinha do pedido #{$pedido->id}). {$motivo}",
                    'dados'     => $dados,
                ]);
            }
        });

        $this->info('Correção aplicada.');

        return self::SUCCESS;
    }

    private function resumo(Pedido $pedido, Moto $sai, Moto $entra, ?Pedido $destino, $vinculoEntra, ?PedidoItem $cota): void
    {
        $this->table(['', 'Chassi', 'Modelo / Cor', 'Status', 'Carga'], [
            ['SAI',   $sai->chassi,   "{$sai->modelo} {$sai->cor}",     $sai->status,   $sai->romaneio_id ?? '-'],
            ['ENTRA', $entra->chassi, "{$entra->modelo} {$entra->cor}", $entra->status, $entra->romaneio_id ?? '-'],
        ]);

        $this->line("Pedido #{$pedido->id} ({$pedido->user?->filial}): {$entra->chassi} assume a vaga de {$sai->chassi}"
            . ($sai->romaneio_id ? " na Carga #{$sai->romaneio_id} (status '{$sai->status}')." : '.'));

        if ($vinculoEntra) {
            $this->line("Pedido #{$destino->id} ({$destino->user?->filial}): {$sai->chassi} assume a vaga de {$entra->chassi} (troca completa).");
        } elseif ($cota) {
            $this->line("Pedido #{$destino->id} ({$destino->user?->filial}): {$sai->chassi} entra na cota #{$cota->id} ({$cota->modelo} {$cota->cor}) como 'separado'.");
        } else {
            $this->line("{$sai->chassi} volta ao estoque do CD.");
        }
    }

    private function mesmoProduto(Moto $a, Moto $b): bool
    {
        return $this->mesmoTexto($a->modelo, $b->modelo) && $this->mesmoTexto($a->cor, $b->cor);
    }

    private function mesmoTexto(?string $a, ?string $b): bool
    {
        return mb_strtoupper(trim((string) $a)) === mb_strtoupper(trim((string) $b));
    }
}
