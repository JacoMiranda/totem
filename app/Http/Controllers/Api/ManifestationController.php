<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreManifestationRequest;
use App\Models\Device;
use App\Models\Manifestation;
use App\Models\ManifestationStatusHistory;
use App\Services\ProtocoloService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Contrato de docs/API.md ("Manifestações — totem / criação"). Rotas
 * protegidas pelo middleware device.key (ver DeviceApiKeyAuth) - nunca o
 * mesmo guard/token da equipe (Sanctum).
 */
class ManifestationController extends Controller
{
    public function __construct(private readonly ProtocoloService $protocolo) {}

    /**
     * Idempotente por clientId (docs/API.md) - reenviar o mesmo clientId
     * (retry de sync após queda de rede, por exemplo) NUNCA cria um
     * segundo registro, só devolve o que já existe.
     */
    public function store(StoreManifestationRequest $request): JsonResponse
    {
        $existente = Manifestation::where('client_id', $request->validated('clientId'))->first();
        if ($existente) {
            return $this->respostaCriacao($existente, existente: true);
        }

        /** @var Device $device */
        $device = $request->attributes->get('device');

        $manifestacao = new Manifestation;
        $manifestacao->fill([
            'client_id' => $request->validated('clientId'),
            'criado_em' => $request->validated('criadoEm'),
            'consentimento_lgpd' => (bool) $request->validated('consentimentoLgpd'),
            'transcricao' => $request->validated('transcricao'),
            'resumo' => $request->validated('resumo'),
            'keywords' => $request->validated('keywords'),
            'sentimento' => $request->validated('sentimento'),
            'categoria' => $request->validated('categoria'),
            'urgencia' => $request->validated('urgencia') ?? 'Média',
            'status' => 'Recebida',
            'canal' => 'Totem',
            'device_id' => $device->id,
            'requerente_type' => $request->validated('requerenteType'),
            'requerente_id' => $request->validated('requerenteId'),
            'origem_ip' => $request->ip(),
        ]);
        $manifestacao->protocolo = $this->protocolo->gerarProtocolo();
        $pin = $this->protocolo->gerarPin();
        $manifestacao->pin_acompanhamento = $this->protocolo->hashPin($pin);
        $manifestacao->save();

        ManifestationStatusHistory::create([
            'manifestation_id' => $manifestacao->id,
            'de_status' => null,
            'para_status' => 'Recebida',
            'autor_id' => null, // sistema
        ]);

        $device->update(['ultima_sync_em' => now()]);

        return $this->respostaCriacao($manifestacao, existente: false, pin: $pin);
    }

    private function respostaCriacao(Manifestation $m, bool $existente, ?string $pin = null): JsonResponse
    {
        return response()->json([
            'id' => $m->id,
            'protocolo' => $m->protocolo,
            // PIN só aparece na resposta de criação de verdade (uma vez) -
            // num replay idempotente, o cliente já recebeu o PIN antes,
            // nunca reexibir (o hash não permite recuperar o valor mesmo
            // que quiséssemos).
            'pin' => $pin,
            'status' => $m->status->value,
            'audioUploadUrl' => "/api/v1/manifestations/{$m->id}/audio",
        ], $existente ? 200 : 201);
    }

    /** multipart/form-data, campo `file` - docs/API.md. */
    public function uploadAudio(Request $request, Manifestation $manifestation): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:25600', 'mimetypes:audio/webm,audio/ogg,audio/mpeg,audio/mp4,audio/wav'],
            'duracaoSeg' => ['nullable', 'integer', 'min:0'],
        ]);

        $arquivo = $request->file('file');
        // getClientOriginalExtension() (nao extension()) - extension()
        // deriva do MIME type via Symfony MimeTypes, que nao tem mapeamento
        // confiavel pra "audio/webm" (MIME menos comum), retornando
        // extensao errada/vazia (achado real testando). Confiamos na
        // extensao que o cliente mandou, ja validada pela regra
        // `mimetypes` acima (nao é so o nome do arquivo, o conteudo real
        // tambem precisa bater com um dos MIMEs aceitos).
        $extensao = $arquivo->getClientOriginalExtension() ?: 'webm';
        $nomeArquivo = "{$manifestation->id}.{$extensao}";
        Storage::disk('local')->putFileAs('audio', $arquivo, $nomeArquivo);
        $caminho = "audio/{$nomeArquivo}";

        $manifestation->update([
            'audio_object_key' => $caminho,
            'audio_mime' => $arquivo->getMimeType(),
            'audio_duracao_seg' => $request->integer('duracaoSeg') ?: null,
        ]);

        return response()->json(['ok' => true, 'audioObjectKey' => $caminho]);
    }

    /** Consulta simples pelo próprio device que criou (não confundir com GET /public/manifestations - essa é a rota pública com PIN, Fase 6). */
    public function show(string $protocolo): JsonResponse
    {
        $manifestacao = Manifestation::where('protocolo', $protocolo)->firstOrFail();

        return response()->json([
            'id' => $manifestacao->id,
            'protocolo' => $manifestacao->protocolo,
            'status' => $manifestacao->status->value,
            'criadoEm' => $manifestacao->criado_em->toIso8601String(),
        ]);
    }
}
