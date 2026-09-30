<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V3 — LOGÍSTICA REVERSA COM CHECKLIST (Loja → CD)
 *
 * A devolução existia na v2.2 e foi desativada na v2.6, virando "uma
 * transferência com o CD escolhido como destino" (ver o bloco de compatibilidade
 * em PedidoController::store). Funcionava para mover a moto e falhava no que
 * importa numa devolução: PROVAR o estado em que ela saiu da loja e o estado em
 * que chegou ao CD. Sem isso, toda avaria virava discussão de quem estragou.
 *
 * O QUE ESTA VERSÃO ACRESCENTA
 * O formulário de papel "Checklist de Recebimento de Moto" passa a ser o
 * documento do fluxo: 31 itens conferidos DUAS vezes — na origem, antes do
 * embarque, e no destino, no ato do recebimento — com foto anexada para toda
 * não conformidade.
 *
 * POR QUE UMA TABELA PRÓPRIA E NÃO MAIS UM `tipo` EM `pedidos`
 * O pedido responde "o que vai sair e para onde". A devolução responde outra
 * coisa: quem conferiu, o que estava quebrado, quem assinou, qual foto prova.
 * Nada disso é atributo de pedido, e enfiar 20 colunas de conferência lá
 * penalizaria todo o resto do sistema — que continua sendo, em volume, pedido
 * de reposição.
 *
 * O TRANSPORTE CONTINUA SENDO PEDIDO
 * `devolucoes.pedido_id` guarda o pedido de transferência Loja → CD criado na
 * aprovação do gestor. É ele que faz a devolução aparecer na aba de Coletas da
 * montagem de carga, ganhar romaneio, trânsito e Timeline do chassi — de graça,
 * sem duplicar uma linha do código de logística. A devolução é o dossiê; o
 * pedido é o frete.
 *
 * SOMENTE MOTO, POR ENQUANTO
 * Peça tem outro ciclo (fungível, saldo por SKU, ledger em peca_movimentos) e
 * outro documento de conferência. Nada aqui a impede depois — mas nada aqui
 * finge cobri-la agora.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('devolucoes', function (Blueprint $table) {
            $table->id();

            // A loja que devolve e o usuário do CD que vai receber.
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('destino_user_id')->nullable()->constrained('users')->nullOnDelete();

            /*
             * O frete. NULL até o gestor aprovar — antes disso a moto não pode
             * entrar em fila de coleta nenhuma.
             */
            $table->foreignId('pedido_id')->nullable()->constrained('pedidos')->nullOnDelete();

            /*
             * rascunho             -> a loja está preenchendo o checklist de origem
             * aguardando_aprovacao -> enviada; a diretoria decide
             * recusada             -> a diretoria negou (terminal)
             * aprovada             -> autorizada; o pedido de frete existe e a moto anda
             * recebida             -> o CD conferiu no destino e fechou (terminal)
             * cancelada            -> a loja desistiu antes de sair (terminal)
             */
            $table->string('status')->default('rascunho');

            $table->string('motivo');            // categoria: por que está voltando
            $table->text('observacao')->nullable();

            /*
             * DADOS DA MOVIMENTAÇÃO — o cabeçalho do formulário de papel.
             *
             * São do EMBARQUE, não da moto: uma devolução com três motos viaja
             * numa nota, num caminhão, sob um lacre. Por isso ficam aqui e não
             * em devolucao_itens.
             */
            $table->string('nf_numero')->nullable();
            $table->string('transportadora')->nullable();
            $table->string('placa', 10)->nullable();
            $table->string('lacre')->nullable();
            $table->timestamp('saida_em')->nullable();     // saída da loja
            $table->timestamp('chegada_em')->nullable();   // chegada ao CD

            /*
             * CONFERÊNCIA DO ENTREGADOR — o terceiro bloco de assinatura do
             * formulário. Fica no cabeçalho porque quem dirige assina a viagem
             * inteira, uma vez, e não moto a moto.
             */
            $table->string('entregador_nome')->nullable();
            $table->string('entregador_resultado')->nullable();
            $table->timestamp('entregador_assinado_em')->nullable();

            // --- Decisão da diretoria ---
            $table->foreignId('aprovado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('aprovado_em')->nullable();
            $table->text('recusa_motivo')->nullable();

            // --- Fechamento no CD ---
            $table->foreignId('recebido_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('recebido_em')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'status']);
            $table->index('status');
        });

        Schema::create('devolucao_itens', function (Blueprint $table) {
            $table->id();

            $table->foreignId('devolucao_id')->constrained('devolucoes')->cascadeOnDelete();
            $table->foreignId('moto_id')->constrained('motos')->cascadeOnDelete();

            /*
             * Fotografia dos dados da moto no momento da devolução.
             *
             * Duplicar chassi/modelo/cor de `motos` é deliberado: o cadastro da
             * moto continua vivo e muda (ela é revendida, transferida, corrigida).
             * O checklist é um documento datado — precisa dizer o que estava
             * escrito nele naquele dia, não o que o cadastro diz hoje.
             */
            $table->string('chassi');
            $table->string('modelo')->nullable();
            $table->string('cor')->nullable();
            $table->string('ano_modelo', 20)->nullable();
            $table->string('numero_motor')->nullable();

            /*
             * As duas colunas de marcação do papel: { "pneus": "C", ... }.
             * O domínio das chaves e das respostas vive em
             * App\Services\Devolucao\ChecklistMoto — não em constraint de banco,
             * porque a lista de itens evolui e o histórico precisa continuar
             * legível com a lista que valia na época.
             */
            $table->json('checklist_origem')->nullable();
            $table->json('checklist_destino')->nullable();

            // Campo 5 do formulário: obrigatório para todo NC.
            $table->text('observacao_origem')->nullable();
            $table->text('observacao_destino')->nullable();

            // --- Assinatura da conferência na origem (a loja) ---
            $table->string('origem_resultado')->nullable();   // conforme | ressalva | nao_conforme
            $table->string('origem_responsavel')->nullable();
            $table->string('origem_matricula', 50)->nullable();
            $table->timestamp('origem_assinado_em')->nullable();
            $table->foreignId('origem_user_id')->nullable()->constrained('users')->nullOnDelete();

            // --- Assinatura da conferência no destino (o CD) ---
            $table->string('destino_resultado')->nullable();
            $table->string('destino_responsavel')->nullable();
            $table->string('destino_matricula', 50)->nullable();
            $table->timestamp('destino_assinado_em')->nullable();
            $table->foreignId('destino_user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            // A mesma moto não entra duas vezes na mesma devolução.
            $table->unique(['devolucao_id', 'moto_id']);
            $table->index('chassi');
        });

        /*
         * OS ANEXOS — a prova.
         *
         * Tabela própria, e não uma coluna `foto_url`, porque uma avaria quase
         * nunca cabe numa foto só: o risco na carenagem, o número do chassi para
         * comprovar que é a moto certa, o canhoto da nota. O formulário de papel
         * manda "registro fotográfico anexado" no plural, e o plural é o caso
         * comum.
         *
         * `devolucao_item_id` NULL = anexo do embarque inteiro (a nota fiscal, a
         * foto do caminhão carregado); preenchido = prova daquela moto.
         */
        Schema::create('devolucao_anexos', function (Blueprint $table) {
            $table->id();

            $table->foreignId('devolucao_id')->constrained('devolucoes')->cascadeOnDelete();
            $table->foreignId('devolucao_item_id')->nullable()
                  ->constrained('devolucao_itens')->cascadeOnDelete();

            // origem | destino — de qual das duas conferências este anexo é prova.
            $table->string('etapa');

            $table->string('url');
            $table->string('nome_original')->nullable();
            $table->text('descricao')->nullable();

            $table->foreignId('enviado_por')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->index(['devolucao_id', 'etapa']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('devolucao_anexos');
        Schema::dropIfExists('devolucao_itens');
        Schema::dropIfExists('devolucoes');
    }
};
