<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\Organizacao;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Gestão de dispositivos (docs/API.md, seção "Dispositivos (admin)") -
 * protegido por Sanctum (equipe) + Gate gerenciar-dispositivos, NUNCA
 * pelo próprio device.key (um totem não pode se auto-cadastrar).
 */
class DeviceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('gerenciar-dispositivos');

        $plataforma = $request->user()->daPlataforma();

        // Sem organização (equipe da plataforma) o global scope não filtra:
        // a lista traz TODOS os totens de TODAS as contas. Aí precisa do
        // nome da empresa e de filtro por empresa/busca.
        $dispositivos = Device::with('organizacao:id,nome')
            ->when($plataforma && $request->filled('organizacaoId'), fn ($q) => $q->where('organizacao_id', $request->string('organizacaoId')))
            ->when($request->filled('q'), fn ($q) => $q->where(fn ($s) => $s
                ->where('codigo', 'like', '%'.$request->string('q').'%')
                ->orWhere('nome', 'like', '%'.$request->string('q').'%')
                ->orWhere('unidade', 'like', '%'.$request->string('q').'%')
                ->orWhereHas('organizacao', fn ($o) => $o->where('nome', 'like', '%'.$request->string('q').'%'))))
            ->orderBy('nome')
            ->get()
            ->map(fn (Device $d) => [
                'id' => $d->id,
                'codigo' => $d->codigo,
                'nome' => $d->nome,
                'unidade' => $d->unidade,
                'ativo' => $d->ativo,
                'organizacao' => $d->organizacao?->only(['id', 'nome']),
                'ultimaSyncEm' => $d->ultima_sync_em?->toIso8601String(),
                'versaoApp' => $d->versao_app,
            ]);

        return response()->json([
            'dispositivos' => $dispositivos,
            'plataforma' => $plataforma,
            // Lista de empresas pro filtro - só faz sentido pra plataforma.
            'organizacoes' => $plataforma
                ? Organizacao::orderBy('nome')->get(['id', 'nome'])
                : [],
        ]);
    }

    /**
     * Lista enxuta pro seletor da tela de login do KIOSK (ver
     * SetupScreen.tsx): o cliente entra com as credenciais dele e escolhe
     * qual totem aquela máquina vai ser. Separado de index() porque a
     * listagem do painel é admin-only e devolve mais campos - aqui basta o
     * necessário pra desenhar os cartões, e o gate é atendente+.
     */
    public function pareaveis(): JsonResponse
    {
        Gate::authorize('parear-dispositivo');

        return response()->json(
            Device::orderBy('nome')->get()->map(fn (Device $d) => [
                'id' => $d->id,
                'codigo' => $d->codigo,
                'nome' => $d->nome,
                'unidade' => $d->unidade,
                'ativo' => $d->ativo,
                'ultimaSyncEm' => $d->ultima_sync_em?->toIso8601String(),
            ])->values()
        );
    }

    /**
     * Pareia ESTA máquina com o dispositivo escolhido: emite uma chave
     * nova e devolve em texto puro (única vez que ela existe fora do
     * hash). Emitir em vez de "buscar" é obrigatório - só guardamos o
     * hash da chave, ela não é recuperável.
     *
     * Efeito colateral proposital: a chave anterior deixa de valer. Um
     * registro de dispositivo representa UM totem físico; se outra máquina
     * parear no mesmo registro, a antiga é desconectada (e isso aparece em
     * `ultima_sync_em` no painel).
     */
    public function pair(Device $device): JsonResponse
    {
        Gate::authorize('parear-dispositivo');

        if (! $device->ativo) {
            return response()->json([
                'error' => ['code' => 'DEVICE_INATIVO', 'message' => 'Este totem está desativado. Fale com o administrador.'],
            ], 422);
        }

        $chaveCrua = Str::random(48);
        $device->update(['api_key_hash' => hash('sha256', $chaveCrua)]);

        return response()->json([
            'id' => $device->id,
            'codigo' => $device->codigo,
            'nome' => $device->nome,
            'unidade' => $device->unidade,
            'empresa' => $device->organizacao?->nome,
            'deviceKey' => $chaveCrua,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        // Gate::authorize (nao $this->authorize) - o Controller base
        // deste projeto e minimo, sem a trait AuthorizesRequests que
        // outras versoes/scaffolds do Laravel incluem por padrao.
        Gate::authorize('gerenciar-dispositivos');

        $plataforma = $request->user()->daPlataforma();

        $validado = $request->validate([
            'codigo' => ['required', 'string', 'max:255', 'unique:devices,codigo'],
            'nome' => ['required', 'string', 'max:255'],
            'unidade' => ['nullable', 'string', 'max:255'],
            // Admin de cliente: o totem é da conta dele. Plataforma: precisa dizer de qual.
            'organizacaoId' => [$plataforma ? 'required' : 'prohibited', 'uuid', Rule::exists('organizacoes', 'id')],
        ]);

        $validado['organizacao_id'] = $plataforma ? $validado['organizacaoId'] : $request->user()->organizacao_id;
        unset($validado['organizacaoId']);

        [$device, $chaveCrua] = $this->criarComNovaChave($validado);

        return response()->json(['id' => $device->id, 'codigo' => $device->codigo, 'deviceKey' => $chaveCrua], 201);
    }

    /** Nova key - a antiga para de funcionar imediatamente (revogação implícita). */
    public function rotateKey(Device $device): JsonResponse
    {
        Gate::authorize('gerenciar-dispositivos');

        $chaveCrua = Str::random(48);
        $device->update(['api_key_hash' => hash('sha256', $chaveCrua)]);

        return response()->json(['id' => $device->id, 'deviceKey' => $chaveCrua]);
    }

    public function update(Request $request, Device $device): JsonResponse
    {
        Gate::authorize('gerenciar-dispositivos');

        $validado = $request->validate(['ativo' => ['required', 'boolean']]);
        $device->update($validado);

        return response()->json(['id' => $device->id, 'ativo' => $device->ativo]);
    }

    /** @return array{0: Device, 1: string} */
    private function criarComNovaChave(array $dados): array
    {
        // A key crua só existe neste momento - nunca gravada, nunca
        // recuperável depois (mesmo espírito de senha/api_key_hash já
        // usado no política-laravel pra provedores de IA).
        $chaveCrua = Str::random(48);

        $device = Device::create([
            ...$dados,
            'api_key_hash' => hash('sha256', $chaveCrua),
            'ativo' => true,
        ]);

        return [$device, $chaveCrua];
    }
}
