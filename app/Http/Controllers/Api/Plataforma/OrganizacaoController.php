<?php

namespace App\Http\Controllers\Api\Plataforma;

use App\Enums\OrganizacaoStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\Manifestation;
use App\Models\Organizacao;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;

/**
 * Back-office da plataforma (docs/FASE-10-MULTITENANT.md): o time comercial/
 * suporte vê todas as contas de cliente, o pacote de cada uma, e faz
 * manutenção cadastral (trocar plano, suspender, ajustar dados, redefinir
 * a senha do admin da conta). Gate `gerenciar-plataforma` (usuário SEM
 * organização + papel admin).
 */
class OrganizacaoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('gerenciar-plataforma');

        // Contagens em lote pra não fazer N+1 numa lista de contas.
        $totens = Device::withoutGlobalScopes()->selectRaw('organizacao_id, count(*) as n')->groupBy('organizacao_id')->pluck('n', 'organizacao_id');
        $manifs = Manifestation::withoutGlobalScopes()->selectRaw('organizacao_id, count(*) as n')->groupBy('organizacao_id')->pluck('n', 'organizacao_id');
        $usuarios = User::selectRaw('organizacao_id, count(*) as n')->whereNotNull('organizacao_id')->groupBy('organizacao_id')->pluck('n', 'organizacao_id');

        $orgs = Organizacao::with('plano:id,nome,slug,limite_dispositivos')
            ->when($request->filled('q'), fn ($x) => $x->where(fn ($s) => $s
                ->where('nome', 'like', '%'.$request->string('q').'%')
                ->orWhere('documento', 'like', '%'.$request->string('q').'%')
                ->orWhere('slug', 'like', '%'.$request->string('q').'%')))
            ->when($request->filled('status'), fn ($x) => $x->where('status', $request->string('status')))
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Organizacao $o) => [
                'id' => $o->id,
                'nome' => $o->nome,
                'slug' => $o->slug,
                'documento' => $o->documento,
                'status' => $o->status->value,
                'operante' => $o->operante(),
                'trialExpiraEm' => $o->trial_expira_em?->toIso8601String(),
                'plano' => $o->plano?->only(['id', 'nome', 'slug', 'limite_dispositivos']),
                'totens' => (int) ($totens[$o->id] ?? 0),
                'manifestacoes' => (int) ($manifs[$o->id] ?? 0),
                'usuarios' => (int) ($usuarios[$o->id] ?? 0),
                'criadaEm' => $o->created_at?->toIso8601String(),
            ]);

        return response()->json($orgs);
    }

    public function show(Organizacao $organizacao): JsonResponse
    {
        Gate::authorize('gerenciar-plataforma');

        return response()->json([
            'id' => $organizacao->id,
            'nome' => $organizacao->nome,
            'slug' => $organizacao->slug,
            'documento' => $organizacao->documento,
            'status' => $organizacao->status->value,
            'trialExpiraEm' => $organizacao->trial_expira_em?->toIso8601String(),
            'planoId' => $organizacao->plano_id,
            'criadaEm' => $organizacao->created_at?->toIso8601String(),
            'usuarios' => User::where('organizacao_id', $organizacao->id)->orderByDesc('role')->get(['id', 'name', 'email', 'role', 'ativo', 'ultimo_login_em'])
                ->map(fn (User $u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'role' => $u->role->value,
                    'ativo' => (bool) $u->ativo,
                    'ultimoLoginEm' => $u->ultimo_login_em?->toIso8601String(),
                ]),
            'devices' => Device::withoutGlobalScopes()->where('organizacao_id', $organizacao->id)->orderBy('codigo')->get(['id', 'codigo', 'nome', 'unidade', 'ativo', 'ultima_sync_em'])
                ->map(fn (Device $d) => [
                    'id' => $d->id,
                    'codigo' => $d->codigo,
                    'nome' => $d->nome,
                    'unidade' => $d->unidade,
                    'ativo' => (bool) $d->ativo,
                    'ultimaSyncEm' => $d->ultima_sync_em?->toIso8601String(),
                ]),
        ]);
    }

    public function update(Request $request, Organizacao $organizacao): JsonResponse
    {
        Gate::authorize('gerenciar-plataforma');

        $dados = $request->validate([
            'nome' => ['sometimes', 'string', 'max:150'],
            'documento' => ['sometimes', 'nullable', 'string', 'max:30'],
            'status' => ['sometimes', new Enum(OrganizacaoStatus::class)],
            'planoId' => ['sometimes', 'nullable', 'uuid', Rule::exists('planos', 'id')],
            'trialExpiraEm' => ['sometimes', 'nullable', 'date'],
        ]);

        $organizacao->fill([
            'nome' => $dados['nome'] ?? $organizacao->nome,
        ]);
        if ($request->has('documento')) {
            $organizacao->documento = $dados['documento'] ?: null;
        }
        if (isset($dados['status'])) {
            $organizacao->status = $dados['status'];
        }
        if ($request->has('planoId')) {
            $organizacao->plano_id = $dados['planoId'] ?: null;
        }
        if ($request->has('trialExpiraEm')) {
            $organizacao->trial_expira_em = $dados['trialExpiraEm'] ?: null;
        }
        $organizacao->save();

        return $this->show($organizacao->fresh());
    }

    /** Redefine a senha do admin da conta e devolve a senha temporária UMA vez. */
    public function resetarSenhaAdmin(Organizacao $organizacao): JsonResponse
    {
        Gate::authorize('gerenciar-plataforma');

        $admin = User::where('organizacao_id', $organizacao->id)
            ->where('role', UserRole::Admin)
            ->orderBy('id')
            ->first();

        abort_unless($admin, 404, 'Esta conta não tem um admin.');

        $senha = Str::password(12, symbols: false);
        $admin->update(['password' => Hash::make($senha)]);

        return response()->json(['email' => $admin->email, 'senhaTemporaria' => $senha]);
    }
}
