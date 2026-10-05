<?php

namespace App\Http\Controllers;

use App\Models\Pedido;
use App\Models\Message;
use App\Enums\Perfil;
use App\Events\NewMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;
use App\Models\User;
use App\Services\OneSignalService;
use App\Notifications\NovaMensagemChat;

class ChatController extends Controller
{
    /**
     * Garante que quem chama participa da conversa deste pedido.
     *
     * O QUE ESTAVA ABERTO (corrigido na v3.4)
     *
     * Os três métodos recebiam `$pedidoId` da URL e agiam sobre ele sem
     * verificar relação nenhuma com quem pedia. `index` era um
     * `Message::where('pedido_id', $pedidoId)->get()` puro: trocar o número na
     * URL devolvia a conversa inteira de outra filial — negociação, motivo de
     * recusa, prazo combinado, nome de quem falou o quê. `store` deixava
     * escrever no chat alheio e `markAsRead` deixava marcar como lida mensagem
     * de terceiro, fazendo o destinatário legítimo perder o aviso de não lida
     * sem entender por quê.
     *
     * A REGRA JÁ EXISTIA NESTE ARQUIVO. `store` a usa desde sempre para decidir
     * A QUEM NOTIFICAR: loja fala com CD e gestor; CD e gestor falam com o
     * solicitante e com a origem. Ela só nunca tinha sido usada para AUTORIZAR.
     * É a mesma regra, agora aplicada nos dois sentidos.
     *
     * withTrashed de propósito: pedido cancelado é soft-deleted, e o histórico
     * da conversa continua sendo dos participantes. Barrar aqui trocaria um
     * furo de privacidade por uma perda de rastreabilidade.
     */
    private function autorizarParticipante($pedidoId): Pedido
    {
        $pedido = Pedido::withTrashed()->findOrFail($pedidoId);
        $user = Auth::user();

        // CD, gestor e admin acompanham qualquer pedido — é o trabalho deles.
        if ($user->isOperacaoCentral()) {
            return $pedido;
        }

        // A loja entra só nos próprios: o que ela pediu, ou o que sai do
        // estoque dela numa transferência.
        if ($pedido->user_id === $user->id || $pedido->origem_user_id === $user->id) {
            return $pedido;
        }

        abort(403, 'Esta conversa pertence ao pedido de outra filial.');
    }

    /**
     * O que o chat mostra de quem escreveu.
     *
     * `with('user')` mandava o usuário inteiro — e-mail, onesignal_id,
     * atribuições — a cada participante, inclusive pelo broadcast. A tela usa
     * nome, perfil e id (ChatBox.jsx).
     */
    private const AUTOR = 'user:id,name,perfil,filial';

    /**
     * Lista as mensagens de um pedido.
     */
    public function index($pedidoId)
    {
        $this->autorizarParticipante($pedidoId);

        return Message::where('pedido_id', $pedidoId)
            ->with(self::AUTOR)
            ->orderBy('created_at', 'asc')
            ->get();
    }

    /**
     * Salva uma nova mensagem e dispara o evento.
     */
    public function store(Request $request, $pedidoId)
    {
        // 1. Validação
        $dados = $request->validate([
            'content' => 'required|string|max:5000',
            'canal'   => 'required|string|in:cd,gestor'
        ]);

        $pedido = $this->autorizarParticipante($pedidoId);

        // 2. Criação da Mensagem
        $message = $pedido->messages()->create([
            'user_id' => Auth::id(),
            'content' => $dados['content'],
            'canal'   => $dados['canal'],
            'read_at' => null
        ]);

        // Carrega o autor para exibir o nome instantaneamente no frontend
        $message->load(self::AUTOR);

        // 3. Dispara o Evento (WebSocket - Atualiza o Chat aberto)
        event(new NewMessage($message));

        // 4. Notificações Inteligentes (Sininho + Push)
        $user = Auth::user();
        $destinatarios = collect([]);

        if ($user->isLoja()) {
            // Se Loja fala -> Avisa Gestores e CD
            $destinatarios = User::comPerfil(Perfil::Gestor, Perfil::Cd)->get();
        } else {
            // Se CD/Gestor fala -> Avisa Loja Solicitante e Origem
            if ($pedido->user_id !== $user->id) {
                $destinatarios->push($pedido->user); // Solicitante
            }
            // A relação é `origem`. O código lia `origem_user`, que não existe
            // no model e dava sempre null: a loja de origem de uma
            // transferência nunca era avisada das mensagens do CD e do gestor.
            if ($pedido->origem_user_id && $pedido->origem_user_id !== $user->id) {
                $destinatarios->push($pedido->origem); // Origem (se houver)
            }
        }

        // Filtra nulos e o próprio remetente (garantia extra)
        $destinatarios = $destinatarios->filter(function($u) use ($user) {
            return $u && $u->id !== $user->id;
        })->unique('id');

        // A. Envia Notificação Interna (Sininho + Toast)
        Notification::send($destinatarios, new \App\Notifications\NovaMensagemChat(
            $dados['content'], 
            $user->name, 
            $pedido->id
        ));

        // B. Envia Push Notification (OneSignal)
        $onesignalIds = $destinatarios->pluck('onesignal_id')->filter()->values()->toArray();
        if (!empty($onesignalIds)) {
            try {
                (new \App\Services\OneSignalService())->sendToUser(
                    $onesignalIds,
                    "Nova mensagem de {$user->name}",
                    $dados['content'],
                    route('pedidos.show', $pedido->id)
                );
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error("Erro OneSignal Chat: " . $e->getMessage());
            }
        }

        return $message;
    }

    /**
     * Marca as mensagens como lidas.
     */
    public function markAsRead(Request $request, $pedidoId)
    {
        $this->autorizarParticipante($pedidoId);

        Message::where('pedido_id', $pedidoId)
            ->where('user_id', '!=', Auth::id()) // Apenas mensagens dos outros
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->noContent();
    }
}