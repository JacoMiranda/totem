<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\Category;
use App\Enums\ManifestationStatus;
use App\Enums\Sentiment;
use App\Enums\Urgency;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Manifestation;
use App\Models\ManifestationNote;
use App\Models\ManifestationStatusHistory;
use App\Models\User;
use App\Services\NotificationDispatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;

/** Contrato de docs/API.md ("Manifestações — painel, bearer, RBAC"). */
class ManifestationController extends Controller
{
    public function __construct(private readonly NotificationDispatchService $notificacoes) {}

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('ver-manifestacoes');

        $query = Manifestation::query()
            ->when($request->filled('categoria'), fn ($q) => $q->where('categoria', $request->string('categoria')))
            ->when($request->filled('sentimento'), fn ($q) => $q->where('sentimento', $request->string('sentimento')))
            ->when($request->filled('urgencia'), fn ($q) => $q->where('urgencia', $request->string('urgencia')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('deviceId'), fn ($q) => $q->where('device_id', $request->string('deviceId')))
            ->when($request->filled('de'), fn ($q) => $q->whereDate('criado_em', '>=', $request->string('de')))
            ->when($request->filled('ate'), fn ($q) => $q->whereDate('criado_em', '<=', $request->string('ate')))
            ->when($request->filled('q'), fn ($q) => $q->where(fn ($sub) => $sub
                ->where('transcricao', 'like', '%'.$request->string('q').'%')
                ->orWhere('resumo', 'like', '%'.$request->string('q').'%')))
            ->orderBy($request->string('sort', 'criado_em'), 'desc');

        $pagina = $query->paginate($request->integer('pageSize', 25));

        return response()->json([
            // ->items() (não só ->through()) - through() muta e devolve o
            // MESMO objeto paginador, que serializa como
            // {current_page, data, first_page_url, ...} em vez de um array
            // simples - o frontend (ManifestationsList.tsx) espera
            // `data.data` como array puro pra mapear, não um paginador
            // aninhado dentro de outro. Bug real: a tela quebrava (crash
            // silencioso no .map()) assim que a lista tinha 0 ou mais itens.
            'data' => $pagina->through(fn (Manifestation $m) => $this->resumo($m))->items(),
            'meta' => ['page' => $pagina->currentPage(), 'pageSize' => $pagina->perPage(), 'total' => $pagina->total()],
        ]);
    }

    public function show(Manifestation $manifestation): JsonResponse
    {
        Gate::authorize('ver-manifestacoes');

        $manifestation->load(['device', 'responsavel', 'statusHistory.autor', 'notes.autor']);

        return response()->json([
            ...$this->resumo($manifestation),
            'transcricao' => $manifestation->transcricao,
            'device' => $manifestation->device?->only(['id', 'codigo', 'nome']),
            'responsavel' => $manifestation->responsavel?->only(['id', 'name']),
            'respostaOficial' => $manifestation->resposta_oficial,
            'respostaPublicadaEm' => $manifestation->resposta_publicada_em?->toIso8601String(),
            'temAudio' => (bool) $manifestation->audio_object_key,
            'linhaDoTempo' => $manifestation->statusHistory->map(fn (ManifestationStatusHistory $h) => [
                'deStatus' => $h->de_status?->value,
                'paraStatus' => $h->para_status->value,
                'autor' => $h->autor?->name,
                'motivo' => $h->motivo,
                'em' => $h->criado_em->toIso8601String(),
            ]),
            'notas' => $manifestation->notes->map(fn (ManifestationNote $n) => [
                'id' => $n->id,
                'texto' => $n->texto,
                'autor' => $n->autor->name,
                'em' => $n->criado_em->toIso8601String(),
            ]),
        ]);
    }

    /**
     * Não é uma URL assinada de verdade (isso é conceito de S3 - áudio
     * aqui é disco local, ver docs/ARQUITETURA.md adaptado) - baixa
     * diretamente, mas SÓ depois de auditar o acesso (docs/MODELO-DADOS.md:
     * "Registrar aqui: acesso a áudio").
     */
    public function audio(Request $request, Manifestation $manifestation)
    {
        Gate::authorize('ver-audio-manifestacao');
        abort_if(! $manifestation->audio_object_key, 404);

        AuditLog::create([
            'ator_id' => $request->user()->id,
            'acao' => 'acesso_audio',
            'entidade' => 'manifestation',
            'entidade_id' => $manifestation->id,
            'ip' => $request->ip(),
            'criado_em' => now(),
        ]);

        return Storage::disk('local')->download($manifestation->audio_object_key);
    }

    public function updateStatus(Request $request, Manifestation $manifestation): JsonResponse
    {
        Gate::authorize('mudar-status-manifestacao');

        $validado = $request->validate([
            'status' => ['required', new Enum(ManifestationStatus::class)],
            'motivo' => ['nullable', 'string'],
        ]);

        $deStatus = $manifestation->status;
        $manifestation->update(['status' => $validado['status']]);

        ManifestationStatusHistory::create([
            'manifestation_id' => $manifestation->id,
            'de_status' => $deStatus,
            'para_status' => $validado['status'],
            'autor_id' => $request->user()->id,
            'motivo' => $validado['motivo'] ?? null,
            'criado_em' => now(),
        ]);

        return response()->json($this->resumo($manifestation->fresh()));
    }

    public function assign(Request $request, Manifestation $manifestation): JsonResponse
    {
        Gate::authorize('atribuir-manifestacao');

        $validado = $request->validate(['responsavelId' => ['required', 'exists:users,id']]);
        $manifestation->update(['responsavel_id' => $validado['responsavelId']]);

        AuditLog::create([
            'ator_id' => $request->user()->id,
            'acao' => 'atribuicao',
            'entidade' => 'manifestation',
            'entidade_id' => $manifestation->id,
            'metadados' => ['responsavel_id' => $validado['responsavelId']],
            'ip' => $request->ip(),
            'criado_em' => now(),
        ]);

        $this->notificacoes->dispatchParaTipo('atribuida', $manifestation, ['responsavel_id' => $validado['responsavelId']]);

        return response()->json($this->resumo($manifestation->fresh()));
    }

    public function classify(Request $request, Manifestation $manifestation): JsonResponse
    {
        Gate::authorize('reclassificar-manifestacao');

        $validado = $request->validate([
            'sentimento' => ['sometimes', new Enum(Sentiment::class)],
            'categoria' => ['sometimes', new Enum(Category::class)],
            'urgencia' => ['sometimes', new Enum(Urgency::class)],
        ]);

        $antes = $manifestation->only(['sentimento', 'categoria', 'urgencia']);
        $manifestation->update($validado);

        AuditLog::create([
            'ator_id' => $request->user()->id,
            'acao' => 'reclassificacao',
            'entidade' => 'manifestation',
            'entidade_id' => $manifestation->id,
            'metadados' => ['antes' => $antes, 'depois' => $validado],
            'ip' => $request->ip(),
            'criado_em' => now(),
        ]);

        return response()->json($this->resumo($manifestation->fresh()));
    }

    public function addNote(Request $request, Manifestation $manifestation): JsonResponse
    {
        Gate::authorize('adicionar-nota-manifestacao');

        $validado = $request->validate(['texto' => ['required', 'string']]);

        $nota = ManifestationNote::create([
            'manifestation_id' => $manifestation->id,
            'autor_id' => $request->user()->id,
            'texto' => $validado['texto'],
            // Explícito - $timestamps=false no model, e o default useCurrent()
            // do MySQL nunca volta pro objeto Eloquent recém-criado sem um
            // re-fetch (bug real encontrado por teste: ->criado_em vinha null
            // aqui, quebrando o toIso8601String() abaixo na mesma resposta).
            'criado_em' => now(),
        ]);

        return response()->json(['id' => $nota->id, 'texto' => $nota->texto, 'em' => $nota->criado_em->toIso8601String()], 201);
    }

    /** {texto, publicar: bool} - resposta oficial só fica visível na consulta pública quando publicar=true. */
    public function resposta(Request $request, Manifestation $manifestation): JsonResponse
    {
        Gate::authorize('responder-manifestacao');

        $validado = $request->validate([
            'texto' => ['required', 'string'],
            'publicar' => ['required', 'boolean'],
        ]);

        $manifestation->update([
            'resposta_oficial' => $validado['texto'],
            'resposta_publicada_em' => $validado['publicar'] ? now() : null,
        ]);

        if ($validado['publicar'] && $manifestation->status !== ManifestationStatus::Concluida) {
            // Capturado ANTES do save() de propósito: depois de salvar, o
            // Eloquent sincroniza os atributos "originais" com os atuais
            // (syncOriginal), então getOriginal('status') already-mutated
            // devolveria "Respondida" pra ambos de/para - bug real que essa
            // ordem evita (histórico sempre bateria "Respondida -> Respondida").
            $deStatus = $manifestation->status;
            $manifestation->status = ManifestationStatus::Respondida;
            $manifestation->save();
            ManifestationStatusHistory::create([
                'manifestation_id' => $manifestation->id,
                'de_status' => $deStatus,
                'para_status' => ManifestationStatus::Respondida,
                'autor_id' => $request->user()->id,
                'motivo' => 'Resposta oficial publicada.',
                'criado_em' => now(),
            ]);
        }

        return response()->json($this->resumo($manifestation->fresh()));
    }

    /** @return array<string, mixed> */
    private function resumo(Manifestation $m): array
    {
        return [
            'id' => $m->id,
            'protocolo' => $m->protocolo,
            'canal' => $m->canal->value,
            'sentimento' => $m->sentimento?->value,
            'categoria' => $m->categoria?->value,
            'urgencia' => $m->urgencia->value,
            'status' => $m->status->value,
            'resumo' => $m->resumo,
            'keywords' => $m->keywords,
            'criadoEm' => $m->criado_em->toIso8601String(),
        ];
    }
}
