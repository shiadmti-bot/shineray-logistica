<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Spatie\Activitylog\Models\Activity;

/**
 * Trilha de alterações do sistema (spatie/activitylog) — exclusiva do admin.
 *
 * Pedido, Romaneio, User e Peca gravam cada mudança em `activity_log` desde a
 * v2, e a tela Admin/Auditoria existia, mas nenhuma rota levava até ela: a
 * trilha era escrita e ninguém conseguia ler sem abrir o banco.
 *
 * Vai para a tela só o que ela mostra. O model inteiro levaria junto o
 * usuário que fez a alteração, com e-mail e onesignal_id.
 */
class AuditoriaController extends Controller
{
    public function __invoke()
    {
        $logs = Activity::query()
            ->with('causer:id,name')
            ->latest('id')
            ->paginate(30)
            ->through(fn (Activity $registro) => [
                'id'          => $registro->id,
                'created_at'  => $registro->created_at,
                'event'       => $registro->event,
                'description' => $registro->description,
                'subject'     => $registro->subject_type ? class_basename($registro->subject_type) : null,
                'subject_id'  => $registro->subject_id,
                'causer'      => $registro->causer ? ['name' => $registro->causer->name] : null,
                'properties'  => [
                    'attributes' => $registro->properties->get('attributes'),
                    'old'        => $registro->properties->get('old'),
                ],
            ]);

        return Inertia::render('Admin/Auditoria', ['logs' => $logs]);
    }
}
