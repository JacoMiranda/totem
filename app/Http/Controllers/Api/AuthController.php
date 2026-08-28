<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/**
 * Auth da equipe (docs/API.md) - Sanctum personal access tokens (bearer),
 * não cookie/sessão SPA. Aproxima "access token curto + refresh httpOnly"
 * do plano original com um token de expiração fixa (ver config/sanctum.php)
 * em vez de um endpoint de refresh separado - simples o suficiente pra
 * agora, revisitar se um fluxo de refresh de verdade fizer falta.
 */
class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credenciais = $request->validate([
            'email' => ['required', 'email'],
            'senha' => ['required', 'string'],
        ]);

        $user = User::where('email', $credenciais['email'])->first();

        if (! $user || ! Auth::getProvider()->validateCredentials($user, ['password' => $credenciais['senha']]) || ! $user->ativo) {
            throw ValidationException::withMessages(['email' => ['Credenciais inválidas.']]);
        }

        $user->update(['ultimo_login_em' => now()]);
        $token = $user->createToken('painel-admin')->plainTextToken;

        return response()->json(['accessToken' => $token, 'user' => $this->serializarUser($user)]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->serializarUser($request->user()));
    }

    private function serializarUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'unidade' => $user->unidade,
        ];
    }
}
