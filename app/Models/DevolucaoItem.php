<?php

namespace App\Models;

use App\Services\Devolucao\ChecklistMoto;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Uma moto dentro de uma devolução — e o checklist dela nas duas pontas.
 *
 * O item carrega chassi, modelo e cor COPIADOS de `motos` no momento em que
 * entra na devolução. Não é redundância por descuido: o cadastro da moto segue
 * mudando (ela volta a ser vendida, transferida, tem o modelo corrigido) e o
 * checklist é um documento datado. Ele tem de continuar dizendo o que estava
 * escrito nele naquele dia.
 *
 * As duas colunas JSON são as duas colunas de marcação do papel: ORIGEM (a
 * loja, antes do embarque) e DESTINO (o CD, no recebimento). Mesmas perguntas,
 * conferentes diferentes — é a comparação entre as duas que responde a única
 * pergunta que importa numa avaria: já saiu assim, ou aconteceu no caminho?
 */
class DevolucaoItem extends Model
{
    use HasFactory;

    protected $table = 'devolucao_itens';

    protected $fillable = [
        'devolucao_id',
        'moto_id',
        'chassi',
        'modelo',
        'cor',
        'ano_modelo',
        'numero_motor',
        'checklist_origem',
        'checklist_destino',
        'observacao_origem',
        'observacao_destino',
        'origem_resultado',
        'origem_responsavel',
        'origem_matricula',
        'origem_assinado_em',
        'origem_user_id',
        'destino_resultado',
        'destino_responsavel',
        'destino_matricula',
        'destino_assinado_em',
        'destino_user_id',
    ];

    protected $casts = [
        'checklist_origem'    => 'array',
        'checklist_destino'   => 'array',
        'origem_assinado_em'  => 'datetime',
        'destino_assinado_em' => 'datetime',
    ];

    // --- RELACIONAMENTOS ---

    public function devolucao()
    {
        return $this->belongsTo(Devolucao::class);
    }

    public function moto()
    {
        return $this->belongsTo(Moto::class);
    }

    public function anexos()
    {
        return $this->hasMany(DevolucaoAnexo::class)->latest('id');
    }

    // --- COMPORTAMENTO ---

    /**
     * As marcações de uma etapa. Sempre array — nunca null — para que quem
     * chama não precise repetir o `?? []` em toda linha.
     *
     * @return array<string, string>
     */
    public function checklist(string $etapa): array
    {
        return $etapa === ChecklistMoto::ETAPA_DESTINO
            ? ($this->checklist_destino ?? [])
            : ($this->checklist_origem ?? []);
    }

    public function resultado(string $etapa): ?string
    {
        return $etapa === ChecklistMoto::ETAPA_DESTINO
            ? $this->destino_resultado
            : $this->origem_resultado;
    }

    public function observacao(string $etapa): ?string
    {
        return $etapa === ChecklistMoto::ETAPA_DESTINO
            ? $this->observacao_destino
            : $this->observacao_origem;
    }

    /** Alguém assinou esta etapa. */
    public function conferido(string $etapa): bool
    {
        return $etapa === ChecklistMoto::ETAPA_DESTINO
            ? $this->destino_assinado_em !== null
            : $this->origem_assinado_em !== null;
    }

    /** @return array<string, string> chave => rótulo do que veio marcado NC. */
    public function naoConformes(string $etapa): array
    {
        return ChecklistMoto::naoConformes($this->checklist($etapa));
    }

    /** Anexos desta moto numa etapa — as fotos que provam a não conformidade. */
    public function anexosDaEtapa(string $etapa)
    {
        return $this->anexos->where('etapa', $etapa);
    }

    /**
     * O que falta para esta etapa estar completa, em português.
     *
     * A mesma checagem serve para o envio à diretoria (etapa origem) e para o
     * fechamento no CD (etapa destino), porque as exigências do formulário são
     * as mesmas nas duas pontas: marcar tudo, assinar, descrever todo NC e
     * anexar o registro fotográfico.
     *
     * @return array<int, string>
     */
    public function pendenciasDaEtapa(string $etapa): array
    {
        $pendencias = [];
        $respostas  = $this->checklist($etapa);
        $faltantes  = ChecklistMoto::faltantes($respostas);

        if ($faltantes !== []) {
            $qtd     = count($faltantes);
            $exemplo = implode(', ', array_slice($faltantes, 0, 3));

            $pendencias[] = $qtd > 3
                ? "faltam {$qtd} itens do checklist (ex.: {$exemplo})"
                : "faltam marcar: {$exemplo}";
        }

        if (! $this->resultado($etapa)) {
            $pendencias[] = 'falta o veredito da conferência (conforme / com ressalva / não conforme)';
        }

        $responsavel = $etapa === ChecklistMoto::ETAPA_DESTINO
            ? $this->destino_responsavel
            : $this->origem_responsavel;

        if (! $responsavel) {
            $pendencias[] = 'falta o nome do responsável pela inspeção';
        }

        $naoConformes = ChecklistMoto::naoConformes($respostas);

        if ($naoConformes !== []) {
            // Campo 5 do formulário: "obrigatório para todo NC".
            if (! trim((string) $this->observacao($etapa))) {
                $pendencias[] = 'há item não conforme sem descrição da avaria';
            }

            /*
             * "Divergência deve ser comunicada com registro fotográfico
             * anexado" — está no cabeçalho do formulário. Sem a foto, a
             * descrição é a palavra de um lado contra a do outro.
             */
            if ($this->anexosDaEtapa($etapa)->isEmpty()) {
                $pendencias[] = 'há item não conforme sem foto anexada';
            }
        }

        return $pendencias;
    }

    /**
     * O que a marcação do CD implica para a moto de volta ao pátio.
     *
     * 'nao_conforme' é o "retido" do formulário: a moto fica no CD, mas
     * separada, para análise — e o sistema precisa mostrá-la como avariada em
     * vez de somá-la ao estoque disponível.
     */
    public function statusMotoNoRetorno(): string
    {
        return $this->destino_resultado === ChecklistMoto::RESULTADO_NAO_CONFORME
            ? 'avariado'
            : 'estoque_fabrica';
    }
}
