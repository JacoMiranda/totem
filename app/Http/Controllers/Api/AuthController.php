<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
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

    /**
     * A própria pessoa edita o próprio perfil: nome e (opcionalmente) senha.
     * Trocar a senha exige a senha atual. E-mail e papel NÃO se mexem aqui -
     * papel é o admin em /admin/equipe.
     */
    public function atualizarPerfil(Request $request): JsonResponse
    {
        $user = $request->user();

        $dados = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'senhaAtual' => ['required_with:novaSenha', 'string'],
            'novaSenha' => ['sometimes', 'nullable', 'string', 'min:8'],
        ]);

        if (! empty($dados['novaSenha'])) {
            if (! Hash::check($dados['senhaAtual'] ?? '', $user->password)) {
                throw ValidationException::withMessages(['senhaAtual' => ['Senha atual incorreta.']]);
            }
            $user->password = Hash::make($dados['novaSenha']);
        }
        if (isset($dados['name'])) {
            $user->name = $dados['name'];
        }
        $user->save();

        return response()->json($this->serializarUser($user->fresh()));
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
