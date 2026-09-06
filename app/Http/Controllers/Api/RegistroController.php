<?php

namespace App\Http\Controllers\Api;

use App\Enums\OrganizacaoStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\Organizacao;
use App\Models\Plano;
use App\Models\User;
use App\Services\NomeadorDeTotens;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Cadastro self-service a partir da home: cria a conta do cliente
 * (organização), o primeiro usuário e JÁ PROVISIONA os totens do pacote,
 * nomeados automaticamente (ver NomeadorDeTotens).
 *
 * Provisionar no cadastro é proposital: o cliente sai da inscrição com
 * totens prontos pra parear, sem depender da nossa equipe. Isso NÃO
 * contradiz a decisão de "liberação pela plataforma" - o que a plataforma
 * controla é o PACOTE (limite de totens e status da conta); dentro do
 * pacote contratado o cliente se vira sozinho.
 */
class RegistroController extends Controller
{
    public function __construct(private readonly NomeadorDeTotens $nomeador) {}

    /** Catálogo público exibido na home (sem auth). */
    public function planos(): JsonResponse
    {
        return response()->json(
            Plano::where('ativo', true)->orderBy('ordem')->get()->map(fn (Plano $p) => [
                'slug' => $p->slug,
                'nome' => $p->nome,
                'descricao' => $p->descricao,
                'limiteDispositivos' => $p->limite_dispositivos,
                'precoCentavos' => $p->preco_centavos,
                'precoFormatado' => $p->precoFormatado(),
                'trialDias' => $p->trial_dias,
                'recursos' => $p->recursos ?? [],
            ])->values()
        );
    }

    public function registrar(Request $request): JsonResponse
    {
        // Normaliza ANTES de validar. Sem isso, "Maria@x.com" passava pela
        // regra `unique` (que compara o valor cru) e só estourava no INSERT
        // como erro 500, porque o e-mail é gravado em minúsculas - além de
        // abrir caminho pra contas duplicadas por diferença de caixa.
        $request->merge(['email' => Str::lower(trim((string) $request->input('email')))]);

        $dados = $request->validate([
            'empresa' => ['required', 'string', 'min:2', 'max:120'],
            'documento' => ['nullable', 'string', 'max:32'],
            'responsavel' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email', 'max:180', Rule::unique('users', 'email')],
            'senha' => ['required', 'string', 'min:8', 'max:200'],
            'planoSlug' => ['required', 'string', Rule::exists('planos', 'slug')->where('ativo', true)],
            // Locais opcionais, um por totem, na ordem: ['Recepção', 'Triagem'].
            'locais' => ['sometimes', 'array', 'max:50'],
            'locais.*' => ['nullable', 'string', 'max:60'],
        ], [
            'email.unique' => 'Já existe uma conta com este e-mail.',
            'senha.min' => 'A senha precisa de pelo menos 8 caracteres.',
        ]);

        $plano = Plano::where('slug', $dados['planoSlug'])->firstOrFail();

        $resultado = DB::transaction(function () use ($dados, $plano) {
            $organizacao = Organizacao::create([
                'nome' => trim($dados['empresa']),
                'slug' => $this->slugUnico(trim($dados['empresa'])),
                'documento' => $dados['documento'] ?? null,
                'plano_id' => $plano->id,
                'status' => $plano->trial_dias > 0 ? OrganizacaoStatus::Trial : OrganizacaoStatus::Ativa,
                'trial_expira_em' => $plano->trial_dias > 0 ? now()->addDays($plano->trial_dias) : null,
            ]);

            $usuario = User::create([
                'organizacao_id' => $organizacao->id,
                'name' => trim($dados['responsavel']),
                'email' => $dados['email'],
                'password' => Hash::make($dados['senha']),
                'role' => UserRole::Admin, // primeiro usuário administra a própria conta
                'ativo' => true,
                'email_verified_at' => now(),
            ]);

            $devices = $this->provisionarTotens($organizacao, $plano->limite_dispositivos, $dados['locais'] ?? []);

            return compact('organizacao', 'usuario', 'devices');
        });

        /** @var User $usuario */
        $usuario = $resultado['usuario'];
        $token = $usuario->createToken('portal')->plainTextToken;

        return response()->json([
            'accessToken' => $token,
            'user' => [
                'id' => $usuario->id,
                'name' => $usuario->name,
                'email' => $usuario->email,
                'role' => $usuario->role->value,
            ],
            'organizacao' => $this->serializarOrganizacao($resultado['organizacao'], $plano),
            'devices' => collect($resultado['devices'])->map(fn (Device $d) => [
                'id' => $d->id,
                'codigo' => $d->codigo,
                'nome' => $d->nome,
                'unidade' => $d->unidade,
            ])->values(),
        ], 201);
    }

    /**
     * Cria os totens do pacote. A device key NÃO é devolvida aqui - ela é
     * emitida no pareamento, na própria máquina que vai virar o totem
     * (POST /devices/{id}/pair). Mandar a chave por e-mail/JSON de cadastro
     * seria espalhar um segredo que só a máquina do totem precisa ter.
     *
     * @param  string[]  $locais
     * @return Device[]
     */
    private function provisionarTotens(Organizacao $organizacao, int $quantidade, array $locais): array
    {
        return array_map(
            fn (array $dados) => Device::create([
                ...$dados,
                'organizacao_id' => $organizacao->id,
                // Chave aleatória inicial que ninguém conhece: o device nasce
                // impareado, e só passa a valer quando alguém parear.
                'api_key_hash' => hash('sha256', Str::random(64)),
                'ativo' => true,
            ]),
            $this->nomeador->gerar($organizacao, $quantidade, $locais),
        );
    }

    private function serializarOrganizacao(Organizacao $organizacao, Plano $plano): array
    {
        return [
            'id' => $organizacao->id,
            'nome' => $organizacao->nome,
            'slug' => $organizacao->slug,
            'status' => $organizacao->status->value,
            'trialExpiraEm' => $organizacao->trial_expira_em?->toIso8601String(),
            'plano' => ['slug' => $plano->slug, 'nome' => $plano->nome, 'limiteDispositivos' => $plano->limite_dispositivos],
        ];
    }

    /** Duas empresas podem ter o mesmo nome; o slug (base do código dos totens) não pode repetir. */
    private function slugUnico(string $nomeEmpresa): string
    {
        $base = $this->nomeador->slugDaOrganizacao($nomeEmpresa);
        $candidato = $base;

        for ($i = 2; Organizacao::where('slug', $candidato)->exists(); $i++) {
            $candidato = $base.$i;
        }

        return $candidato;
    }
}
