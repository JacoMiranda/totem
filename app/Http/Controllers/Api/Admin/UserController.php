<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AtribuidorDeManifestacoes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;

/**
 * Cadastro da equipe da conta (docs/API.md). Só admin (Gate
 * `gerenciar-usuarios`). Tudo escopado à organização do admin logado - um
 * admin nunca vê nem mexe em usuário de outra conta.
 *
 * `recebe_atribuicao` liga/desliga a pessoa do rodízio de distribuição
 * automática (ver AtribuidorDeManifestacoes).
 */
class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('gerenciar-usuarios');

        $usuarios = User::where('organizacao_id', $this->orgId($request))
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role', 'unidade', 'ativo', 'recebe_atribuicao']);

        return response()->json($usuarios->map(fn (User $u) => $this->apresentar($u)));
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('gerenciar-usuarios');

        $dados = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:180', Rule::unique('users', 'email')],
            'senha' => ['required', 'string', 'min:8'],
            'role' => ['required', new Enum(UserRole::class)],
            'unidade' => ['nullable', 'string', 'max:120'],
            'recebeAtribuicao' => ['boolean'],
        ]);

        $u = User::create([
            'organizacao_id' => $this->orgId($request),
            'name' => $dados['name'],
            'email' => mb_strtolower(trim($dados['email'])),
            'password' => Hash::make($dados['senha']),
            'role' => $dados['role'],
            'unidade' => $dados['unidade'] ?? null,
            'ativo' => true,
            'recebe_atribuicao' => $dados['recebeAtribuicao'] ?? ($dados['role'] === UserRole::Analista->value),
            'email_verified_at' => now(),
        ]);

        return response()->json($this->apresentar($u), 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        Gate::authorize('gerenciar-usuarios');
        abort_unless($user->organizacao_id === $this->orgId($request), 404);

        $dados = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'role' => ['sometimes', new Enum(UserRole::class)],
            'unidade' => ['nullable', 'string', 'max:120'],
            'ativo' => ['sometimes', 'boolean'],
            'recebeAtribuicao' => ['sometimes', 'boolean'],
            'senha' => ['sometimes', 'nullable', 'string', 'min:8'],
        ]);

        // O admin não pode se auto-rebaixar nem se desativar (trancaria a conta).
        if ($user->id === $request->user()->id && (($dados['ativo'] ?? true) === false || (($dados['role'] ?? 'admin') !== 'admin'))) {
            abort(422, 'Você não pode rebaixar nem desativar a sua própria conta.');
        }

        $user->fill(array_filter([
            'name' => $dados['name'] ?? null,
            'role' => $dados['role'] ?? null,
            'unidade' => array_key_exists('unidade', $dados) ? $dados['unidade'] : null,
        ], fn ($v) => $v !== null));

        if (array_key_exists('ativo', $dados)) {
            $user->ativo = $dados['ativo'];
        }
        if (array_key_exists('recebeAtribuicao', $dados)) {
            $user->recebe_atribuicao = $dados['recebeAtribuicao'];
        }
        if (! empty($dados['senha'])) {
            $user->password = Hash::make($dados['senha']);
        }
        $user->save();

        return response()->json($this->apresentar($user));
    }

    /** Passa TODAS as manifestações em aberto de um funcionário para outro. */
    public function transferirCarga(Request $request, AtribuidorDeManifestacoes $atribuidor): JsonResponse
    {
        Gate::authorize('gerenciar-usuarios');

        $dados = $request->validate([
            'de' => ['required', 'integer', 'different:para'],
            'para' => ['required', 'integer'],
        ]);

        $org = $request->user()->organizacao;
        $de = User::where('organizacao_id', $org?->id)->findOrFail($dados['de']);
        $para = User::where('organizacao_id', $org?->id)->findOrFail($dados['para']);

        $movidas = $atribuidor->transferirCarga($org, $de, $para);

        return response()->json(['movidas' => $movidas]);
    }

    private function apresentar(User $u): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'role' => $u->role->value,
            'unidade' => $u->unidade,
            'ativo' => (bool) $u->ativo,
            'recebeAtribuicao' => (bool) $u->recebe_atribuicao,
        ];
    }

    private function orgId(Request $request): ?string
    {
        return $request->user()->organizacao_id;
    }
}
