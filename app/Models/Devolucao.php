<?php

namespace App\Models;

use App\Services\Devolucao\ChecklistMoto;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Uma devolução de motos da loja para o CD (v3).
 *
 * É o DOSSIÊ da logística reversa: quem devolveu, por quê, em que estado saiu,
 * em que estado chegou, quem assinou cada ponta e quais fotos provam. O frete
 * em si continua sendo um Pedido de transferência Loja → CD — criado na
 * aprovação e guardado em `pedido_id` — para que romaneio, coleta, trânsito e
 * Timeline do chassi funcionem sem uma linha nova de código logístico.
 *
 * A regra que dá sentido ao módulo: nenhuma moto sai da loja sem checklist de
 * origem assinado, e nenhuma devolução fecha sem checklist de destino. As duas
 * travas vivem em DevolucaoController — aqui ficam apenas as perguntas que
 * respondem se elas podem passar.
 */
class Devolucao extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'devolucoes';

    protected $fillable = [
        'user_id',
        'destino_user_id',
        'pedido_id',
        'status',
        'motivo',
        'observacao',
        'nf_numero',
        'transportadora',
        'placa',
        'lacre',
        'saida_em',
        'chegada_em',
        'entregador_nome',
        'entregador_resultado',
        'entregador_assinado_em',
        'aprovado_por',
        'aprovado_em',
        'recusa_motivo',
        'recebido_por',
        'recebido_em',
    ];

    protected $casts = [
        'saida_em'               => 'datetime',
        'chegada_em'             => 'datetime',
        'entregador_assinado_em' => 'datetime',
        'aprovado_em'            => 'datetime',
        'recebido_em'            => 'datetime',
    ];

    public const STATUS_RASCUNHO   = 'rascunho';
    public const STATUS_AGUARDANDO = 'aguardando_aprovacao';
    public const STATUS_APROVADA   = 'aprovada';
    public const STATUS_RECUSADA   = 'recusada';
    public const STATUS_RECEBIDA   = 'recebida';
    public const STATUS_CANCELADA  = 'cancelada';

    /** Acabou: não muda mais e não segura moto nenhuma. */
    public const STATUS_ENCERRADOS = [
        self::STATUS_RECUSADA,
        self::STATUS_RECEBIDA,
        self::STATUS_CANCELADA,
    ];

    /**
     * Por que a moto está voltando.
     *
     * Lista fechada porque este campo é o que a diretoria vai somar depois:
     * "quantas voltaram por avaria de transporte neste trimestre?" só tem
     * resposta se o motivo for categoria, e não texto livre. O detalhe vai em
     * `observacao`.
     */
    public const MOTIVOS = [
        'avaria_transporte'  => 'Avaria de transporte',
        'defeito_fabrica'    => 'Defeito de fábrica / garantia',
        'erro_envio'         => 'Erro de envio (modelo ou cor divergente)',
        'excesso_estoque'    => 'Excesso de estoque / baixo giro',
        'recall'             => 'Recall ou campanha do fabricante',
        'venda_cancelada'    => 'Venda cancelada pelo cliente',
        'outro'              => 'Outro (descrever na observação)',
    ];

    // --- RELACIONAMENTOS ---

    /** A loja que está devolvendo. */
    public function loja()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** O usuário do CD que recebe. */
    public function destino()
    {
        return $this->belongsTo(User::class, 'destino_user_id');
    }

    /** O frete: pedido de transferência Loja → CD criado na aprovação. */
    public function pedido()
    {
        return $this->belongsTo(Pedido::class);
    }

    public function itens()
    {
        return $this->hasMany(DevolucaoItem::class);
    }

    public function anexos()
    {
        return $this->hasMany(DevolucaoAnexo::class)->latest('id');
    }

    public function aprovadoPor()
    {
        return $this->belongsTo(User::class, 'aprovado_por');
    }

    public function recebidoPor()
    {
        return $this->belongsTo(User::class, 'recebido_por');
    }

    // --- COMPORTAMENTO ---

    public function estaEncerrada(): bool
    {
        return in_array($this->status, self::STATUS_ENCERRADOS, true);
    }

    /**
     * A loja ainda pode mexer no conteúdo.
     *
     * Depois de enviada para aprovação, o que o gestor leu tem de ser o que
     * está gravado — senão a assinatura dele não vale nada.
     */
    public function podeEditar(): bool
    {
        return $this->status === self::STATUS_RASCUNHO;
    }

    /** Autorizada e a caminho: a moto já está em fila de coleta. */
    public function emTransporte(): bool
    {
        return $this->status === self::STATUS_APROVADA;
    }

    public function motivoRotulo(): string
    {
        return self::MOTIVOS[$this->motivo] ?? $this->motivo;
    }

    /**
     * O que ainda falta para esta devolução poder ser enviada à diretoria.
     *
     * Devolve FRASES, não códigos: a lista vai inteira para a tela da loja, e
     * "faltam 4 itens do checklist da moto 9C2..." resolve sozinho, enquanto
     * "checklist_incompleto" gera um telefonema para o TI.
     *
     * @return array<int, string>
     */
    public function pendenciasParaEnvio(): array
    {
        $pendencias = [];

        if ($this->itens->isEmpty()) {
            return ['Nenhuma moto foi incluída nesta devolução.'];
        }

        foreach ($this->itens as $item) {
            foreach ($item->pendenciasDaEtapa(ChecklistMoto::ETAPA_ORIGEM) as $pendencia) {
                $pendencias[] = "Moto {$item->chassi}: {$pendencia}";
            }
        }

        return $pendencias;
    }

    /** Unidades no embarque. */
    public function totalMotos(): int
    {
        return $this->itens()->count();
    }

    public function scopePendentesDeAprovacao($query)
    {
        return $query->where('status', self::STATUS_AGUARDANDO);
    }

    /** Em curso: nem rascunho parado, nem encerrada. */
    public function scopeEmAndamento($query)
    {
        return $query->whereIn('status', [self::STATUS_AGUARDANDO, self::STATUS_APROVADA]);
    }
}
