<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use App\Models\User;
use Carbon\Carbon;

class UserActivity
{
    public function handle(Request $request, Closure $next)
    {
        if (Auth::check()) {
            // Para não pesar o banco, só atualiza se passou 1 minuto desde a última vez
            $expiresAt = Carbon::now()->addMinutes(1);
            
            // Usamos o Cache para evitar Update no banco a cada milissegundo (Performance)
            if (!Cache::has('user-is-online-' . Auth::id())) {
                User::where('id', Auth::id())->update(['last_seen_at' => now()]);
                Cache::put('user-is-online-' . Auth::id(), true, $expiresAt);
            }
        }

        return $next($request);
    }
}