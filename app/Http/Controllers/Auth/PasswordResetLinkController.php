<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Inertia\Inertia;
use Inertia\Response;

class PasswordResetLinkController extends Controller
{
    /**
     * Display the password reset link request view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/ForgotPassword', [
            'status' => session('status'),
        ]);
    }

    /**
     * Handle an incoming password reset link request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        // We will send the password reset link to this user. Once we have attempted
        // to send the link, we will examine the response then see the message we
        // need to show to the user. Finally, we'll send out a proper response.
        Password::sendResetLink(
            $request->only('email')
        );

        /*
         * A MESMA RESPOSTA, EXISTA A CONTA OU NÃO.
         *
         * O Breeze devolvia "não encontramos usuário com este e-mail" para
         * endereço desconhecido — qualquer visitante descobria, um a um, quais
         * e-mails têm acesso ao sistema, que é a primeira lista de que um
         * ataque de senha precisa. Quem tem conta recebe o link; quem não tem
         * lê a mesma frase e não aprende nada. (Pedido repetido dentro da
         * janela do broker também cai aqui: o link anterior continua valendo.)
         */
        return back()->with('status', __(Password::RESET_LINK_SENT));
    }
}
