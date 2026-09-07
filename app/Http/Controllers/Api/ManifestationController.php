<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreManifestationRequest;
use App\Models\Device;
use App\Models\Manifestation;
use App\Models\ManifestationStatusHistory;
use App\Services\AtribuidorDeManifestacoes;
use App\Services\NotificationDispatchService;
use App\Services\ProtocoloService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Contrato de docs/API.md ("Manifestações — totem / criação"). Rotas
 * protegidas pelo middleware device.key (ver DeviceApiKeyAuth) - nunca o
 * mesmo guard/token da equipe (Sanctum).
 */
class ManifestationController extends Controller
{
    public function __construct(
        private readonly ProtocoloService $protocolo,
        private readonly NotificationDispatchService $notificacoes,
        private readonly AtribuidorDeManifestacoes $atribuidor,
    ) {}

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
            // A manifestação herda a organização DO DEVICE - a requisição do
            // totem não tem usuário logado, então o vínculo com a conta do
            // cliente vem daqui (ver App\Models\Scopes\PorOrganizacao).
            'organizacao_id' => $device->organizacao_id,
            'requerente_type' => $request->validated('requerenteType'),
            'requerente_id' => $request->validated('requerenteId'),
            'origem_ip' => $request->ip(),
        ]);
        $manifestacao->protocolo = $this->protocolo->gerarProtocolo();
        $pin = $this->protocolo->gerarPin();
        $manifestacao->pin_acompanhamento = $this->protocolo->hashPin($pin);

        // Manifestação sem nada a tratar (elogio, ou dúvida/sugestão
        // tranquila) já entra concluída - a equipe só cuida do que é
        // negativo. Continua aparecendo na lista (status Concluída), o
        // cidadão acompanha normalmente, e conta como "resolvida" no mural.
        $autoConcluir = $this->naoRequerTratamento($manifestacao);

        if ($autoConcluir) {
            $manifestacao->status = 'Concluída';
        } elseif ($device->organizacao) {
            // Distribuição automática: vai pra quem tem menos caso em aberto
            // no pool da organização (ver AtribuidorDeManifestacoes). Fica
            // null se ninguém no pool - a equipe atribui à mão.
            $manifestacao->responsavel_id = $this->atribuidor->proximoResponsavel($device->organizacao)?->id;
        }

        $manifestacao->save();

        ManifestationStatusHistory::create([
            'manifestation_id' => $manifestacao->id,
            'de_status' => null,
            'para_status' => $autoConcluir ? 'Concluída' : 'Recebida',
            'motivo' => $autoConcluir ? 'Concluída automaticamente — manifestação não requer tratamento.' : null,
            'autor_id' => null, // sistema
            // criado_em explícito (não só o default useCurrent do MySQL) -
            // o model tem $timestamps=false, e o valor gerado pelo BANCO
            // nunca volta pro objeto Eloquent recém-criado sem um re-fetch;
            // qualquer código que leia ->criado_em na MESMA instância (ver
            // bug real corrigido em Admin\ManifestationController::addNote)
            // pegaria null. Mais barato setar aqui sempre do que garantir
            // que ninguém nunca vai ler de volta sem re-buscar.
            'criado_em' => now(),
        ]);

        $device->update(['ultima_sync_em' => now()]);

        // Só na criação de verdade (nunca num replay idempotente) - urgência
        // Crítica ou teor Denúncia disparam notificação (docs/PLANO-
        // SISTEMA-PROFISSIONAL.md, Fase 7). Sem preferência ativa cadastrada
        // pro tipo 'critica_recebida', isto não gera nenhum envio de verdade.
        if ($manifestacao->urgencia?->value === 'Crítica' || $manifestacao->categoria?->value === 'Denúncia') {
            $this->notificacoes->dispatchParaTipo('critica_recebida', $manifestacao);
        }

        return $this->respostaCriacao($manifestacao, existente: false, pin: $pin);
    }

    /**
     * "Não requer tratamento" = nada negativo: nunca Reclamação/Denúncia,
     * nunca sentimento Insatisfeito/Preocupado, nunca urgência Alta/Crítica.
     *
     * Elogio só conclui sozinho se o SENTIMENTO for de fato positivo
     * (Excelente/Satisfeito). Um "elogio" com sentimento neutro ou ausente
     * pode ser ironia ("parabéns pela fila de 2 horas") e vai pra fila da
     * equipe olhar. Sugestão e Dúvida tranquilas concluem direto.
     */
    private function naoRequerTratamento(Manifestation $m): bool
    {
        $cat = $m->categoria?->value;
        $sent = $m->sentimento?->value;
        $urg = $m->urgencia?->value;

        if (in_array($cat, ['Reclamação', 'Denúncia'], true)) {
            return false;
        }
        if (in_array($sent, ['Insatisfeito', 'Preocupado'], true)) {
            return false;
        }
        if (in_array($urg, ['Alta', 'Crítica'], true)) {
            return false;
        }

        if ($cat === 'Elogio') {
            return in_array($sent, ['Excelente', 'Satisfeito'], true);
        }

        return in_array($cat, ['Sugestão', 'Dúvida'], true);
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
        // NÃO usar `mimetypes:` aqui: um webm/ogg só-áudio é frequentemente
        // detectado pelo libmagic como `video/webm` / `application/octet-stream`
        // (achado real: nenhum áudio chegava em produção, upload dava 422). O
        // arquivo vem do PRÓPRIO totem, já autenticado por device key -
        // validar extensão + tamanho é suficiente.
        $request->validate([
            'file' => ['required', 'file', 'max:25600'],
            'duracaoSeg' => ['nullable', 'integer', 'min:0'],
        ]);

        $arquivo = $request->file('file');
        abort_unless(
            in_array(strtolower((string) $arquivo->getClientOriginalExtension()), ['webm', 'ogg', 'mp4', 'm4a', 'mp3', 'wav', 'aac'], true),
            422,
            'Formato de áudio não suportado.',
        );
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
