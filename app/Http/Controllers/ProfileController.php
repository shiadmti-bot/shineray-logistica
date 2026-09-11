<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Display the user's profile form.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => session('status'),
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        return Redirect::route('profile.edit');
    }

    /*
     * `destroy()` REMOVIDO (v3.4) — autoexclusão de conta não existe aqui.
     *
     * O método do Breeze deslogava e apagava o próprio usuário. A rota que o
     * alcançava (`DELETE /profile`) foi removida junto, mas o método também
     * saiu de propósito: enquanto ele existisse, reativar a brecha custaria
     * uma linha de rota, e nada no arquivo diria por que aquilo era errado.
     *
     * O ciclo de vida da conta pertence ao admin, em UserController
     * (/usuarios): lá a inativação preserva a integridade referencial de
     * pedidos, romaneios e logs, que é justamente o que a autoexclusão
     * ignorava.
     */
}
