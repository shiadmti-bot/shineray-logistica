<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

/**
 * Estado gravado de um módulo opcional. Ler sempre por App\Services\Modulos,
 * que aplica o padrão de config/modulos.php quando não há linha.
 *
 * LogsActivity: quem ligou ou desligou um módulo, e quando, aparece na tela
 * de Auditoria do admin.
 */
class ModuloSistema extends Model
{
    use LogsActivity;

    protected $table = 'modulos_sistema';

    protected $fillable = ['chave', 'ativo', 'atualizado_por'];

    protected $casts = [
        'ativo' => 'boolean',
    ];

    public function atualizadoPor()
    {
        return $this->belongsTo(User::class, 'atualizado_por');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['chave', 'ativo'])
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn (string $evento) => "Módulo foi {$evento}");
    }
}
